// src/model.js
var EXT_WALL = 0.2;
var INT_WALL = 0.12;
var counter = 0;
var uid = (p = "x") => `${p}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
var round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
var ROOM_TYPES = {
  living: { name: "Living room", floor: "oak", icon: "mdi:sofa" },
  dining: { name: "Dining", floor: "oak", icon: "mdi:silverware-fork-knife" },
  kitchen: { name: "Kitchen", floor: "porcelain", icon: "mdi:stove" },
  bedroom: { name: "Bedroom", floor: "oak", icon: "mdi:bed" },
  bath: { name: "Bathroom", floor: "marble", icon: "mdi:shower" },
  hall: { name: "Hall", floor: "porcelain", icon: "mdi:door-sliding" },
  entrance: { name: "Entrance", floor: "porcelain", icon: "mdi:door" },
  office: { name: "Office", floor: "walnut", icon: "mdi:desk" },
  laundry: { name: "Laundry", floor: "porcelain", icon: "mdi:washing-machine" },
  balcony: { name: "Balcony", floor: "deck", icon: "mdi:balcony", outdoor: true },
  garden: { name: "Garden", floor: "grass", icon: "mdi:flower", outdoor: true },
  majlis: { name: "Majlis", floor: "marble", icon: "mdi:sofa-outline" },
  other: { name: "Room", floor: "oak", icon: "mdi:square-outline" }
};
function newPlan(name = "My home") {
  return {
    v: 1,
    name,
    north: 0,
    units: "m",
    style: "warm",
    settings: { quality: "auto", walls: "cut", sun: true },
    floors: [{ id: uid("f"), name: "Ground floor", height: 2.8, elevation: 0, rooms: [], openings: [], items: [], devices: [], walls: [] }]
  };
}
var rect = (x2, y, w, d) => [[x2, y], [x2 + w, y], [x2 + w, y + d], [x2, y + d]];
function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
var key = (x2, y) => `${round(x2, 3)},${round(y, 3)}`;
function onSeg(p, a, b2, eps = 1e-3) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b2;
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > eps * Math.hypot(bx - ax, by - ay)) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay), len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  return dot > eps && dot < len2 - eps;
}
function walls(floor) {
  const edges = [];
  for (const r2 of floor.rooms) {
    const n = r2.pts.length;
    for (let i = 0; i < n; i++) edges.push({ a: r2.pts[i], b: r2.pts[(i + 1) % n], room: r2.id, outdoor: !!ROOM_TYPES[r2.type]?.outdoor });
  }
  for (const w of floor.walls || []) edges.push({ a: w.a, b: w.b, room: null, free: w });
  const verts = [];
  for (const e of edges) verts.push(e.a, e.b);
  const pieces = /* @__PURE__ */ new Map();
  for (const e of edges) {
    const cuts = [e.a, e.b, ...verts.filter((v) => onSeg(v, e.a, e.b))];
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1];
    cuts.sort((p, q) => (p[0] - e.a[0]) * dx + (p[1] - e.a[1]) * dy - ((q[0] - e.a[0]) * dx + (q[1] - e.a[1]) * dy));
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b2 = cuts[i + 1];
      if (Math.hypot(b2[0] - a[0], b2[1] - a[1]) < 0.01) continue;
      const k1 = key(...a), k2 = key(...b2), k = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      const p = pieces.get(k) || { a: k1 < k2 ? a : b2, b: k1 < k2 ? b2 : a, rooms: [], outdoor: [], free: null };
      if (e.room) {
        if (!p.rooms.includes(e.room)) p.rooms.push(e.room);
        p.outdoor.push(e.outdoor);
      }
      if (e.free) p.free = e.free;
      pieces.set(k, p);
    }
  }
  const out = [];
  for (const p of pieces.values()) {
    const indoorRooms = p.outdoor.filter((o) => !o).length;
    const parapet = p.rooms.length && indoorRooms === 0;
    const exterior = p.rooms.length === 1 || p.rooms.length === 2 && indoorRooms === 1;
    out.push({ a: p.a, b: p.b, rooms: p.rooms, exterior, parapet, free: !!p.free, thick: p.free?.thick ?? (exterior ? EXT_WALL : INT_WALL) });
  }
  return out;
}
function openingsOn(w, openings) {
  const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const res = [];
  for (const op of openings) {
    const rx = op.x - w.a[0], ry = op.y - w.a[1];
    const along = rx * ux + ry * uy, across = Math.abs(-rx * uy + ry * ux);
    if (across > 0.12) continue;
    const t0 = Math.max(0, along - op.width / 2), t1 = Math.min(len, along + op.width / 2);
    if (t1 - t0 > 0.05) res.push({ op, t0, t1 });
  }
  return res.sort((p, q) => p.t0 - q.t0);
}
function planBounds(floor) {
  const pts = floor.rooms.flatMap((r2) => r2.pts);
  if (!pts.length) return { x0: 0, y0: 0, x1: 10, y1: 8 };
  return bounds(pts);
}

// src/recon.js
var RES = 0.05;
var Grid = class {
  constructor(x0, y0, x1, y1, res = RES, pad = 2.2) {
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
    this.res = res;
    this.x0 = x0;
    this.y0 = y0;
    this.nx = Math.max(4, Math.ceil((x1 - x0) / res) + 1);
    this.ny = Math.max(4, Math.ceil((y1 - y0) / res) + 1);
    this.w = new Uint8Array(this.nx * this.ny);
  }
  cell(x2, y) {
    return [Math.round((x2 - this.x0) / this.res), Math.round((y - this.y0) / this.res)];
  }
  pos(i, j) {
    return [this.x0 + i * this.res, this.y0 + j * this.res];
  }
  // a thick line in metres
  line(a, b2, thick) {
    const r2 = Math.max(1, Math.round(thick / 2 / this.res)), [i0, j0] = this.cell(...a), [i1, j1] = this.cell(...b2);
    const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0), 1);
    for (let s = 0; s <= n; s++) {
      const ci = Math.round(i0 + (i1 - i0) * s / n), cj = Math.round(j0 + (j1 - j0) * s / n);
      for (let dj = -r2; dj <= r2; dj++) for (let di = -r2; di <= r2; di++) {
        const i = ci + di, j = cj + dj;
        if (i >= 0 && j >= 0 && i < this.nx && j < this.ny) this.w[j * this.nx + i] = 1;
      }
    }
  }
};
function dist(mask, nx, ny) {
  const INF = 1e9, d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? 0 : INF;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!d[k]) continue;
    let v = d[k];
    if (i) v = Math.min(v, d[k - 1] + 1);
    if (j) {
      v = Math.min(v, d[k - nx] + 1);
      if (i) v = Math.min(v, d[k - nx - 1] + 1);
      if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + 1);
    }
    d[k] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    if (!d[k]) continue;
    let v = d[k];
    if (i < nx - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < ny - 1) {
      v = Math.min(v, d[k + nx] + 1);
      if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + 1);
      if (i) v = Math.min(v, d[k + nx - 1] + 1);
    }
    d[k] = v;
  }
  return d;
}
function components(free, nx, ny) {
  const lab = new Int32Array(nx * ny).fill(-1), out = [], q = new Int32Array(nx * ny);
  for (let s = 0; s < free.length; s++) {
    if (!free[s] || lab[s] >= 0) continue;
    const id = out.length;
    let h = 0, tl = 0, border = false;
    q[tl++] = s;
    lab[s] = id;
    const cells = [];
    while (h < tl) {
      const k = q[h++];
      cells.push(k);
      const i = k % nx, j = k / nx | 0;
      if (!i || !j || i === nx - 1 || j === ny - 1) border = true;
      for (const n of [k - 1, k + 1, k - nx, k + nx]) {
        if (n < 0 || n >= free.length || n === k - 1 && !i || n === k + 1 && i === nx - 1) continue;
        if (free[n] && lab[n] < 0) {
          lab[n] = id;
          q[tl++] = n;
        }
      }
    }
    out.push({ id, cells, border });
  }
  return { lab, comps: out };
}
function grow(mask, nx, ny, r2, allowed) {
  const d = dist(mask, nx, ny), o = new Uint8Array(mask.length);
  for (let k = 0; k < o.length; k++) o[k] = d[k] <= r2 && (!allowed || allowed[k] || mask[k]) ? 1 : 0;
  return o;
}
function shrink(mask, nx, ny, r2) {
  const inv = new Uint8Array(mask.length);
  for (let k = 0; k < inv.length; k++) inv[k] = mask[k] ? 0 : 1;
  for (let i = 0; i < nx; i++) {
    inv[i] = 1;
    inv[(ny - 1) * nx + i] = 1;
  }
  for (let j = 0; j < ny; j++) {
    inv[j * nx] = 1;
    inv[j * nx + nx - 1] = 1;
  }
  const d = dist(inv, nx, ny), o = new Uint8Array(mask.length);
  for (let k = 0; k < o.length; k++) o[k] = d[k] > r2 ? 1 : 0;
  return o;
}
function outline(mask, g) {
  const { nx, ny } = g, edges = /* @__PURE__ */ new Map();
  const add = (a, b2) => edges.set(a.join(","), b2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!mask[j * nx + i]) continue;
    const up = j > 0 && mask[(j - 1) * nx + i], dn = j < ny - 1 && mask[(j + 1) * nx + i], lf = i > 0 && mask[j * nx + i - 1], rt = i < nx - 1 && mask[j * nx + i + 1];
    if (!up) add([i, j], [i + 1, j]);
    if (!rt) add([i + 1, j], [i + 1, j + 1]);
    if (!dn) add([i + 1, j + 1], [i, j + 1]);
    if (!lf) add([i, j + 1], [i, j]);
  }
  let best = [];
  const used = /* @__PURE__ */ new Set();
  for (const start of edges.keys()) {
    if (used.has(start)) continue;
    const loop = [];
    let k = start;
    while (k && !used.has(k)) {
      used.add(k);
      const p = k.split(",").map(Number);
      loop.push(p);
      const n = edges.get(k);
      k = n ? n.join(",") : null;
    }
    if (loop.length > best.length) best = loop;
  }
  return best.map(([i, j]) => [g.x0 + (i - 0.5) * g.res, g.y0 + (j - 0.5) * g.res]);
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b2] = [pts[0], pts[pts.length - 1]];
  let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1e-9, d = Math.abs((b2[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b2[1] - a[1])) / L;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max > eps) return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  return [a, b2];
}
function simplify(loop, eps) {
  if (loop.length < 4) return loop;
  let far = 0, fd = 0;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const a = rdp(loop.slice(0, far + 1), eps), b2 = rdp([...loop.slice(far), loop[0]], eps);
  let pts = [...a.slice(0, -1), ...b2.slice(0, -1)];
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1];
    if (Math.abs(dy) < Math.abs(dx) * 0.18) {
      const y = (p[1] + q[1]) / 2;
      p[1] = y;
      q[1] = y;
    } else if (Math.abs(dx) < Math.abs(dy) * 0.18) {
      const x2 = (p[0] + q[0]) / 2;
      p[0] = x2;
      q[0] = x2;
    }
  }
  return dedupe(pts);
}
function dedupe(pts) {
  let out = pts.filter((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3;
  });
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], b2 = out[i], c2 = out[(i + 1) % out.length];
      const cr = (b2[0] - a[0]) * (c2[1] - b2[1]) - (b2[1] - a[1]) * (c2[0] - b2[0]);
      if (Math.abs(cr) < 1e-4) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}
function cluster(rooms2, tol = 0.14) {
  for (const ax of [0, 1]) {
    const vals = rooms2.flatMap((r2) => r2.pts.map((p) => p[ax])).sort((a, b2) => a - b2), groups = [];
    for (const v of vals) {
      const g = groups[groups.length - 1];
      if (g && v - g[g.length - 1] <= tol) g.push(v);
      else groups.push([v]);
    }
    const map = /* @__PURE__ */ new Map();
    for (const g of groups) {
      const m = round(Math.round(g.reduce((s, v) => s + v, 0) / g.length / RES) * RES, 3);
      for (const v of g) map.set(v, m);
    }
    for (const r2 of rooms2) for (const p of r2.pts) p[ax] = map.get(p[ax]);
  }
  for (const r2 of rooms2) r2.pts = dedupe(r2.pts);
}
function rooms(g, { gap = 1, minArea = 1.2, thick } = {}) {
  const { nx, ny } = g, W = g.w, rc = Math.round(gap / 2 / g.res);
  const wt = thick || wallThickness(g);
  const closed = grow(W, nx, ny, rc);
  const rb = Math.round(1.7 / g.res), big = grow(W, nx, ny, rb), farOut = new Uint8Array(W.length);
  {
    const fr = new Uint8Array(W.length);
    for (let k = 0; k < fr.length; k++) fr[k] = big[k] ? 0 : 1;
    const { comps: cs } = components(fr, nx, ny);
    for (const c2 of cs) if (c2.border) for (const k of c2.cells) farOut[k] = 1;
  }
  const outside = grow(farOut, nx, ny, rb + 1);
  const free = new Uint8Array(W.length);
  for (let k = 0; k < free.length; k++) free[k] = closed[k] || outside[k] ? 0 : 1;
  const { comps } = components(free, nx, ny);
  const seeds = comps.filter((c2) => !c2.border && c2.cells.length * g.res * g.res >= minArea * 0.3);
  const lab = new Int32Array(W.length).fill(-1), q = [];
  seeds.forEach((c2, n) => {
    for (const k of c2.cells) {
      lab[k] = n;
      q.push(k);
    }
  });
  const step = new Int32Array(W.length);
  let h = 0;
  while (h < q.length) {
    const k = q[h++], i = k % nx;
    for (const n of [k - 1, k + 1, k - nx, k + nx]) {
      if (n < 0 || n >= W.length || n === k - 1 && !i || n === k + 1 && i === nx - 1) continue;
      if (!W[n] && !outside[n] && lab[n] < 0) {
        lab[n] = lab[k];
        step[n] = step[k] + 1;
        q.push(n);
      }
    }
  }
  const half = Math.max(1, Math.round(wt / 2 / g.res)), out = [];
  seeds.forEach((c2, n) => {
    let m = new Uint8Array(W.length);
    for (let k = 0; k < W.length; k++) m[k] = lab[k] === n ? 1 : 0;
    m = grow(shrink(m, nx, ny, rc), nx, ny, rc, m);
    m = grow(m, nx, ny, half, W);
    let cnt = 0;
    for (let k = 0; k < m.length; k++) cnt += m[k];
    if (cnt * g.res * g.res < minArea) return;
    const pts = simplify(outline(m, g), 0.12);
    if (pts.length >= 3 && Math.abs(area(pts)) >= minArea) out.push({ id: uid("r"), type: "other", name: "", pts });
  });
  cluster(out);
  for (const r2 of out) {
    if (area(r2.pts) < 0) r2.pts.reverse();
    r2.pts = r2.pts.map(([x2, y]) => [round(x2, 3), round(y, 3)]);
  }
  const good = out.filter((r2) => r2.pts.length >= 3 && Math.abs(area(r2.pts)) >= minArea);
  guessTypes(good);
  return { rooms: good, openings: openingsFrom(g, good, wt), thick: wt };
}
function wallThickness(g) {
  const runs = [];
  for (let j = 0; j < g.ny; j += 2) {
    let r2 = 0;
    for (let i = 0; i < g.nx; i++) {
      if (g.w[j * g.nx + i]) r2++;
      else {
        if (r2 >= 2) runs.push(r2);
        r2 = 0;
      }
    }
  }
  for (let i = 0; i < g.nx; i += 2) {
    let r2 = 0;
    for (let j = 0; j < g.ny; j++) {
      if (g.w[j * g.nx + i]) r2++;
      else {
        if (r2 >= 2) runs.push(r2);
        r2 = 0;
      }
    }
  }
  if (!runs.length) return 0.15;
  runs.sort((a, b2) => a - b2);
  return Math.min(0.35, Math.max(0.08, runs[Math.floor(runs.length * 0.3)] * g.res));
}
function openingsFrom(g, rs, wt) {
  const f2 = { rooms: rs, openings: [], items: [], devices: [] }, out = [];
  for (const w of walls(f2)) {
    if (w.parapet) continue;
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, n = Math.floor(len / g.res);
    let run = 0, start = 0;
    const flush = (endT) => {
      const width = run * g.res;
      if (width < 0.55) return;
      const mid = (start + endT) / 2 * g.res, x2 = round(w.a[0] + ux * mid, 3), y = round(w.a[1] + uy * mid, 3);
      if (w.exterior) out.push({ id: uid("o"), type: width > 2.2 ? "slider" : "window", x: x2, y, width: round(Math.min(width, 4), 2), height: width > 2.2 ? 2.2 : 1.4, sill: width > 2.2 ? 0 : 0.9 });
      else out.push({ id: uid("o"), type: width > 1.3 ? "arch" : "door", x: x2, y, width: round(Math.min(width, 3), 2), height: 2.1, sill: 0, swing: 1 });
    };
    for (let s = 2; s < n - 2; s++) {
      const x2 = w.a[0] + ux * s * g.res, y = w.a[1] + uy * s * g.res, [i, j] = g.cell(x2, y);
      let wall = false;
      const r2 = Math.max(1, Math.round(wt / 2 / g.res));
      for (let o = -r2; o <= r2 && !wall; o++) {
        const ii = Math.round(i - uy * o), jj = Math.round(j + ux * o);
        if (g.w[jj * g.nx + ii]) wall = true;
      }
      if (!wall) {
        if (!run) start = s;
        run++;
      } else if (run) {
        flush(s);
        run = 0;
      }
    }
    if (run) flush(n - 2);
  }
  return out;
}
function guessTypes(rs) {
  const sorted = [...rs].sort((a, b2) => Math.abs(area(b2.pts)) - Math.abs(area(a.pts)));
  sorted.forEach((r2, i) => {
    const A = Math.abs(area(r2.pts));
    r2.type = i === 0 ? "living" : A < 3.2 ? "bath" : A < 6 ? "hall" : A < 18 ? "bedroom" : "other";
  });
}
function fromImage(img, { metresPerPx, gap = 1 } = {}) {
  const W0 = img.width, H0 = img.height, c2 = document.createElement("canvas");
  const s0 = Math.min(1, 1600 / Math.max(W0, H0));
  c2.width = Math.round(W0 * s0);
  c2.height = Math.round(H0 * s0);
  let x2 = c2.getContext("2d", { willReadFrequently: true });
  x2.fillStyle = "#fff";
  x2.fillRect(0, 0, c2.width, c2.height);
  x2.drawImage(img, 0, 0, c2.width, c2.height);
  let d = x2.getImageData(0, 0, c2.width, c2.height).data, dark = new Uint8Array(c2.width * c2.height);
  for (let k2 = 0; k2 < dark.length; k2++) dark[k2] = d[k2 * 4] * 0.3 + d[k2 * 4 + 1] * 0.59 + d[k2 * 4 + 2] * 0.11 < 110 ? 1 : 0;
  const thickPx = rawThick(dark, c2.width, c2.height) || 4;
  const m = metresPerPx ? metresPerPx / s0 : 0.15 / thickPx;
  const k = m / RES;
  const g = new Grid(0, 0, c2.width * m, c2.height * m);
  const c22 = document.createElement("canvas");
  c22.width = g.nx;
  c22.height = g.ny;
  x2 = c22.getContext("2d", { willReadFrequently: true });
  x2.fillStyle = "#fff";
  x2.fillRect(0, 0, c22.width, c22.height);
  x2.imageSmoothingQuality = "high";
  x2.drawImage(c2, 0, 0, c2.width * k, c2.height * k);
  d = x2.getImageData(0, 0, g.nx, g.ny).data;
  for (let i = 0; i < g.w.length; i++) g.w[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11 < 150 ? 1 : 0;
  const res = rooms(g, { thick: thickPx * m, gap });
  return { ...res, items: [], metresPerPx: m * s0, size: [round(W0 * m * s0, 2), round(H0 * m * s0, 2)] };
}
function rawThick(dark, w, h) {
  const runs = [];
  for (let j = 0; j < h; j += 3) {
    let r2 = 0;
    for (let i = 0; i < w; i++) {
      if (dark[j * w + i]) r2++;
      else {
        if (r2 >= 3) runs.push(r2);
        r2 = 0;
      }
    }
  }
  for (let i = 0; i < w; i += 3) {
    let r2 = 0;
    for (let j = 0; j < h; j++) {
      if (dark[j * w + i]) r2++;
      else {
        if (r2 >= 3) runs.push(r2);
        r2 = 0;
      }
    }
  }
  if (runs.length < 10) return 0;
  runs.sort((a, b2) => a - b2);
  return runs[Math.floor(runs.length * 0.5)];
}

// src/samples.js
var room = (type, name, pts, extra = {}) => ({ id: uid("r"), type, name, pts, ...extra });
var door = (x2, y, width = 0.9, extra = {}) => ({ id: uid("o"), type: "door", x: x2, y, width, height: 2.1, sill: 0, swing: 1, ...extra });
var win = (x2, y, width = 1.6, extra = {}) => ({ id: uid("o"), type: "window", x: x2, y, width, height: 1.5, sill: 0.9, ...extra });
var item = (kind, x2, y, rot = 0, extra = {}) => ({ id: uid("i"), kind, x: x2, y, rot, ...extra });
var dev = (kind, x2, y, extra = {}) => ({ id: uid("d"), kind, entity: "", x: x2, y, ...extra });
function apartment() {
  const p = newPlan("Two-bedroom apartment");
  const f2 = p.floors[0];
  f2.rooms = [
    room("balcony", "Balcony", rect(0, -1.6, 6.5, 1.6)),
    room("living", "Living room", rect(0, 0, 6.5, 5)),
    room("kitchen", "Kitchen", rect(6.5, 0, 3.5, 5)),
    room("bedroom", "Master bedroom", rect(10, 0, 4.5, 5)),
    room("entrance", "Entrance", rect(0, 5, 3, 4)),
    room("hall", "Hall", rect(3, 5, 11.5, 1.4)),
    room("bath", "Bathroom", rect(3, 6.4, 2.5, 2.6)),
    room("bedroom", "Bedroom", rect(5.5, 6.4, 4.5, 2.6)),
    room("bath", "Master bath", rect(10, 6.4, 4.5, 2.6))
  ];
  const kitchen = f2.rooms[2];
  kitchen.floor = "porcelain";
  f2.openings = [
    door(1.5, 9, 1, { main: true, swing: -1 }),
    door(1.5, 5, 0.9),
    door(3, 5.7, 0.9),
    door(8.25, 5, 0.9),
    door(11.2, 5, 0.9),
    door(4.25, 6.4, 0.8),
    door(7, 6.4, 0.9),
    door(12, 6.4, 0.8),
    { id: uid("o"), type: "arch", x: 6.5, y: 2.6, width: 1.4, height: 2.2, sill: 0 },
    { id: uid("o"), type: "slider", x: 3.25, y: 0, width: 2.6, height: 2.2, sill: 0 },
    win(0, 2.5, 2),
    win(8.25, 0, 1.6),
    win(12.25, 0, 2.2),
    win(14.5, 2.5, 1.6),
    win(7.75, 9, 1.8),
    win(4.25, 9, 0.7, { sill: 1.5, height: 0.6 }),
    win(12.25, 9, 0.8, { sill: 1.5, height: 0.6 })
  ];
  f2.items = [
    item("rug", 3.1, 2.6, 0),
    item("sofa_l", 3.2, 3.9, 180),
    item("coffee_table", 3.1, 2.55, 0),
    item("armchair", 5.4, 2, -100),
    item("tv_unit", 3.1, 0.35, 0),
    item("tv", 3.1, 0.14, 0, { z: 1.05 }),
    item("plant", 0.55, 0.55),
    item("floor_lamp", 5.85, 4.4),
    item("dining_table", 5, 4.1, 90, { w: 1.6 }),
    item("dining_chair", 4.55, 3.55, 90),
    item("dining_chair", 4.55, 4.65, 90),
    item("dining_chair", 5.45, 3.55, -90),
    item("dining_chair", 5.45, 4.65, -90),
    item("kitchen_base", 8.25, 0.4, 0, { w: 3.1 }),
    item("kitchen_base", 9.6, 2.2, 90, { w: 2 }),
    item("fridge", 6.95, 0.45, 0),
    item("kitchen_island", 8.2, 3, 0, { w: 1.8 }),
    item("bar_stool", 7.7, 3.7, 180),
    item("bar_stool", 8.7, 3.7, 180),
    item("pendant_lamp", 8.2, 3, 0, { mount: "ceiling" }),
    item("bed_double", 12.25, 1.25, 0),
    item("nightstand", 11.05, 0.35),
    item("nightstand", 13.45, 0.35),
    item("wardrobe", 14.15, 3.8, -90, { w: 1.8 }),
    item("rug", 12.25, 2.4, 0, { w: 2.2, d: 1.4, color: "#B7A68F" }),
    item("console", 1.5, 8.7, 180, { w: 1.1 }),
    item("plant_small", 2.6, 8.6),
    item("mirror", 0.05, 7, 90, { z: 1 }),
    item("bathtub", 4.25, 8.55, 180),
    item("toilet", 3.3, 7.4, 90),
    item("basin", 5.25, 7.4, -90),
    item("bed_single", 9, 7.7, -90),
    item("desk", 6.3, 8.6, 180),
    item("office_chair", 6.3, 8.1, 0),
    item("bookshelf", 5.72, 6.9, 90),
    item("shower", 13.95, 8.45, 0),
    item("toilet", 10.35, 8.5, 90),
    item("basin", 12.25, 8.7, 180, { w: 1.2 }),
    item("bench", 4.5, -0.8, 0),
    item("plant", 0.5, -0.8),
    item("plant", 6, -0.8)
  ];
  f2.devices = [
    dev("light", 3.1, 2.5, { look: "pendant", name: "Living light" }),
    dev("light", 8.2, 2, { look: "spots", name: "Kitchen light" }),
    dev("light", 12.25, 2.5, { look: "flush", name: "Bedroom light" }),
    dev("light", 1.5, 7, { look: "flush", name: "Entrance light" }),
    dev("light", 8.75, 5.7, { look: "spots", name: "Hall light" }),
    dev("ac", 6.2, 2, { name: "Living AC", rot: -90 }),
    dev("ac", 14.35, 1.2, { name: "Bedroom AC", rot: -90 }),
    dev("tv", 3.1, 0.14, { name: "TV" }),
    dev("curtain", 0, 2.5, { name: "Living curtains" }),
    dev("curtain", 12.25, 0, { name: "Bedroom curtains" }),
    dev("door", 1.5, 9, { name: "Front door" })
  ];
  return p;
}
function studio() {
  const p = newPlan("Studio");
  const f2 = p.floors[0];
  f2.rooms = [room("living", "Studio", rect(0, 0, 7, 5.5)), room("bath", "Bathroom", rect(7, 0, 2.4, 2.8)), room("entrance", "Entrance", rect(7, 2.8, 2.4, 2.7))];
  f2.openings = [door(8.2, 5.5, 1, { main: true, swing: -1 }), door(7, 4.2, 0.9), door(8.2, 2.8, 0.8), win(3.5, 0, 3), win(0, 2.75, 1.6), win(8.2, 0, 0.6, { sill: 1.5, height: 0.6 })];
  f2.items = [
    item("bed_double", 1.25, 1.2, 90),
    item("nightstand", 0.3, 2.6),
    item("sofa", 4.6, 4.8, 180),
    item("coffee_table", 4.6, 3.8),
    item("tv_unit", 4.6, 2.45, 0, { w: 1.6 }),
    item("kitchen_base", 6.65, 1.8, 90, { w: 2.8 }),
    item("fridge", 6.6, 4.9, -90),
    item("rug", 4.6, 3.8, 0, { w: 2, d: 1.4 }),
    item("plant", 6.5, 0.5),
    item("toilet", 7.4, 0.5, 0),
    item("shower", 8.95, 0.45, 0),
    item("basin", 7.3, 2.35, 90)
  ];
  f2.devices = [dev("light", 3.5, 2.7, { look: "pendant", name: "Studio light" }), dev("ac", 3.5, 0.15, { name: "AC", rot: 0 }), dev("curtain", 3.5, 0, { name: "Curtains" })];
  return p;
}
function villa() {
  const p = newPlan("Villa, ground floor");
  const f2 = p.floors[0];
  f2.rooms = [
    room("garden", "Garden", rect(-3, -3, 22, 3)),
    room("majlis", "Majlis", rect(0, 0, 7, 6)),
    room("living", "Family living", rect(7, 0, 7, 6)),
    room("kitchen", "Kitchen", rect(14, 0, 5, 6)),
    room("entrance", "Entrance", rect(0, 6, 4, 4)),
    room("hall", "Hall", rect(4, 6, 10, 2)),
    room("dining", "Dining", rect(14, 6, 5, 4)),
    room("bath", "Guest bath", rect(4, 8, 3, 2)),
    room("bedroom", "Guest bedroom", rect(7, 8, 7, 4)),
    room("laundry", "Laundry", rect(14, 10, 5, 2))
  ];
  f2.openings = [
    door(2, 10, 1.6, { main: true, double: true, swing: -1 }),
    door(2, 6, 1.2, { double: true }),
    door(4, 7, 1),
    door(10.5, 6, 1.6, { double: true }),
    door(14, 7, 1.2),
    door(5.5, 8, 0.8),
    door(9, 8, 0.9),
    door(16.5, 10, 0.9),
    { id: uid("o"), type: "arch", x: 14, y: 3, width: 2, height: 2.3, sill: 0 },
    { id: uid("o"), type: "slider", x: 10.5, y: 0, width: 3.2, height: 2.4, sill: 0 },
    win(3.5, 0, 2.4),
    win(0, 3, 2),
    win(16.5, 0, 1.8),
    win(19, 3, 1.6),
    win(19, 8, 1.6),
    win(10.5, 12, 2),
    win(5.5, 10, 0.7, { sill: 1.6, height: 0.5 })
  ];
  f2.items = [
    item("majlis_seat", 3.5, 0.5, 0, { w: 6 }),
    item("majlis_seat", 0.5, 3, 90, { w: 4.8 }),
    item("majlis_seat", 6.5, 3, -90, { w: 4.8 }),
    item("rug", 3.5, 3, 0, { w: 4.4, d: 3.6, color: "#8E2F2F" }),
    item("coffee_table", 3.5, 3, 0, { w: 1.6 }),
    item("sofa_l", 10.2, 4.2, 180, { w: 3.4 }),
    item("tv_unit", 10.5, 0.35, 0, { w: 2.6 }),
    item("tv", 10.5, 0.14, 0, { z: 1.1, w: 1.9 }),
    item("rug", 10.5, 2.8, 0, { w: 3.6, d: 2.4 }),
    item("coffee_table", 10.4, 2.8),
    item("armchair", 7.8, 2, 90),
    item("plant", 13.4, 0.6),
    item("kitchen_base", 16.5, 0.4, 0, { w: 4.6 }),
    item("kitchen_base", 18.6, 3, -90, { w: 4.4 }),
    item("kitchen_island", 16.2, 3.2, 0, { w: 2.4 }),
    item("fridge", 14.5, 0.45),
    item("dining_table", 16.5, 8, 0, { w: 2.4 }),
    ...[15.6, 16.5, 17.4].flatMap((x2) => [item("dining_chair", x2, 7.35, 0), item("dining_chair", x2, 8.65, 180)]),
    item("console", 2, 9.7, 180, { w: 1.4 }),
    item("plant", 0.5, 9.4),
    item("plant", 3.5, 9.4),
    item("bed_double", 10.5, 10.95, 180),
    item("nightstand", 9.3, 11.65),
    item("nightstand", 11.7, 11.65),
    item("wardrobe", 7.35, 10, 90, { w: 2.2 }),
    item("toilet", 4.4, 8.6, 90),
    item("basin", 6.6, 9.2, -90),
    item("washing_machine", 17.5, 11.65, 180),
    item("washing_machine", 18.2, 11.65, 180, { color: "#E8E8E8" }),
    item("tree", -1.5, -1.5),
    item("tree", 20, -1.5),
    item("bench", 7, -1.2, 0, { w: 2 })
  ];
  f2.devices = [
    dev("light", 3.5, 3, { look: "chandelier", name: "Majlis chandelier" }),
    dev("light", 10.5, 2.8, { look: "pendant", name: "Living light" }),
    dev("light", 16.5, 3, { look: "spots", name: "Kitchen light" }),
    dev("light", 16.5, 8, { look: "pendant", name: "Dining light" }),
    dev("light", 10.5, 10, { look: "flush", name: "Guest bedroom light" }),
    dev("ac", 6.8, 3, { rot: -90, name: "Majlis AC" }),
    dev("ac", 13.8, 3, { rot: -90, name: "Living AC" }),
    dev("ac", 13.8, 10, { rot: -90, name: "Bedroom AC" }),
    dev("tv", 10.5, 0.14, { name: "TV" }),
    dev("curtain", 3.5, 0, { name: "Majlis curtains" }),
    dev("curtain", 10.5, 0, { name: "Living curtains" }),
    dev("door", 2, 10, { name: "Front door" })
  ];
  return p;
}
var SAMPLES = [
  { id: "apartment", name: "Two-bedroom apartment", make: apartment, size: "14.5 \xD7 10.6 m" },
  { id: "villa", name: "Villa ground floor with majlis", make: villa, size: "22 \xD7 15 m" },
  { id: "studio", name: "Studio", make: studio, size: "9.4 \xD7 5.5 m" }
];

// dev/imgtest.js
var f = SAMPLES[0].make().floors[0];
var b = planBounds(f);
var S = 47;
var c = document.createElement("canvas");
c.width = (b.x1 - b.x0 + 2) * S;
c.height = (b.y1 - b.y0 + 2) * S;
var x = c.getContext("2d");
x.fillStyle = "#fff";
x.fillRect(0, 0, c.width, c.height);
var P = (p) => [(p[0] - b.x0 + 1) * S, (p[1] - b.y0 + 1) * S];
for (const w of walls(f)) {
  if (w.parapet) continue;
  const ops = openingsOn(w, f.openings), dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  let pos = 0;
  const seg = (a, e) => {
    x.strokeStyle = "#111";
    x.lineWidth = w.thick * S;
    x.lineCap = "square";
    x.beginPath();
    x.moveTo(...P([w.a[0] + ux * a, w.a[1] + uy * a]));
    x.lineTo(...P([w.a[0] + ux * e, w.a[1] + uy * e]));
    x.stroke();
  };
  for (const o of ops) {
    if (o.t0 > pos) seg(pos, o.t0);
    if (o.op.type === "window") {
      x.strokeStyle = "#111";
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(...P([w.a[0] + ux * o.t0, w.a[1] + uy * o.t0]));
      x.lineTo(...P([w.a[0] + ux * o.t1, w.a[1] + uy * o.t1]));
      x.stroke();
    }
    pos = o.t1;
  }
  if (pos < L) seg(pos, L);
}
x.lineWidth = 1.2;
x.strokeStyle = "#333";
for (const it of f.items) {
  const [px, py] = P([it.x, it.y]);
  x.strokeRect(px - 15, py - 10, 30, 20);
}
x.fillStyle = "#222";
x.font = "14px sans-serif";
for (const r2 of f.rooms) {
  const [px, py] = P(r2.pts[0]);
  x.fillText(r2.name, px + 20, py + 30);
}
document.body.appendChild(c);
var t = performance.now();
var r = fromImage(c);
window.result = { ms: Math.round(performance.now() - t), rooms: r.rooms.length, ops: r.openings.length, size: r.size, areas: r.rooms.map((q) => Math.abs(area(q.pts)).toFixed(1) + "/" + q.pts.length).join(" ") };
