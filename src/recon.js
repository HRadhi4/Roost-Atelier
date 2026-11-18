// Turning a drawing into a home: walls are painted onto a fine grid (5 cm squares), door gaps are
// closed for a moment so each room becomes its own sealed space, then every space is traced back into
// a clean room shape and the gaps become doors and windows again.
import { uid, round, rect, walls, openingsOn, inside, area } from "./model.js";

export const RES = 0.05;

export class Grid {
  constructor(x0, y0, x1, y1, res = RES, pad = 2.2) {
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; // room around the home so the outside is recognised
    this.res = res; this.x0 = x0; this.y0 = y0;
    this.nx = Math.max(4, Math.ceil((x1 - x0) / res) + 1); this.ny = Math.max(4, Math.ceil((y1 - y0) / res) + 1);
    this.w = new Uint8Array(this.nx * this.ny);
  }
  cell(x, y) { return [Math.round((x - this.x0) / this.res), Math.round((y - this.y0) / this.res)]; }
  pos(i, j) { return [this.x0 + i * this.res, this.y0 + j * this.res]; }
  // a thick line in metres
  line(a, b, thick) {
    const r = Math.max(1, Math.round(thick / 2 / this.res)), [i0, j0] = this.cell(...a), [i1, j1] = this.cell(...b);
    const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0), 1);
    for (let s = 0; s <= n; s++) {
      const ci = Math.round(i0 + ((i1 - i0) * s) / n), cj = Math.round(j0 + ((j1 - j0) * s) / n);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < this.nx && j < this.ny) this.w[j * this.nx + i] = 1; }
    }
  }
}

// distance (in cells, chessboard) from every cell to the nearest set cell
function dist(mask, nx, ny) {
  const INF = 1e9, d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? 0 : INF;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!d[k]) continue; let v = d[k]; if (i) v = Math.min(v, d[k - 1] + 1); if (j) { v = Math.min(v, d[k - nx] + 1); if (i) v = Math.min(v, d[k - nx - 1] + 1); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + 1); } d[k] = v; }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; if (!d[k]) continue; let v = d[k]; if (i < nx - 1) v = Math.min(v, d[k + 1] + 1); if (j < ny - 1) { v = Math.min(v, d[k + nx] + 1); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + 1); if (i) v = Math.min(v, d[k + nx - 1] + 1); } d[k] = v; }
  return d;
}
function components(free, nx, ny) {
  const lab = new Int32Array(nx * ny).fill(-1), out = [], q = new Int32Array(nx * ny);
  for (let s = 0; s < free.length; s++) {
    if (!free[s] || lab[s] >= 0) continue;
    const id = out.length; let h = 0, tl = 0, border = false; q[tl++] = s; lab[s] = id; const cells = [];
    while (h < tl) { const k = q[h++]; cells.push(k); const i = k % nx, j = (k / nx) | 0; if (!i || !j || i === nx - 1 || j === ny - 1) border = true; for (const n of [k - 1, k + 1, k - nx, k + nx]) { if (n < 0 || n >= free.length || (n === k - 1 && !i) || (n === k + 1 && i === nx - 1)) continue; if (free[n] && lab[n] < 0) { lab[n] = id; q[tl++] = n; } } }
    out.push({ id, cells, border });
  }
  return { lab, comps: out };
}
// square-shaped grow / shrink keep rectangular rooms rectangular
function grow(mask, nx, ny, r, allowed) { const d = dist(mask, nx, ny), o = new Uint8Array(mask.length); for (let k = 0; k < o.length; k++) o[k] = d[k] <= r && (!allowed || allowed[k] || mask[k]) ? 1 : 0; return o; }
function shrink(mask, nx, ny, r) { const inv = new Uint8Array(mask.length); for (let k = 0; k < inv.length; k++) inv[k] = mask[k] ? 0 : 1; for (let i = 0; i < nx; i++) { inv[i] = 1; inv[(ny - 1) * nx + i] = 1; } for (let j = 0; j < ny; j++) { inv[j * nx] = 1; inv[j * nx + nx - 1] = 1; } const d = dist(inv, nx, ny), o = new Uint8Array(mask.length); for (let k = 0; k < o.length; k++) o[k] = d[k] > r ? 1 : 0; return o; }

// outline of a set of cells as a polygon in metres
function outline(mask, g) {
  const { nx, ny } = g, edges = new Map();
  const add = (a, b) => edges.set(a.join(","), b);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!mask[j * nx + i]) continue;
    const up = j > 0 && mask[(j - 1) * nx + i], dn = j < ny - 1 && mask[(j + 1) * nx + i], lf = i > 0 && mask[j * nx + i - 1], rt = i < nx - 1 && mask[j * nx + i + 1];
    if (!up) add([i, j], [i + 1, j]); if (!rt) add([i + 1, j], [i + 1, j + 1]); if (!dn) add([i + 1, j + 1], [i, j + 1]); if (!lf) add([i, j + 1], [i, j]);
  }
  let best = [];
  const used = new Set();
  for (const start of edges.keys()) {
    if (used.has(start)) continue;
    const loop = []; let k = start;
    while (k && !used.has(k)) { used.add(k); const p = k.split(",").map(Number); loop.push(p); const n = edges.get(k); k = n ? n.join(",") : null; }
    if (loop.length > best.length) best = loop;
  }
  return best.map(([i, j]) => [g.x0 + (i - 0.5) * g.res, g.y0 + (j - 0.5) * g.res]);
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]]; let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9, d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L; if (d > max) { max = d; idx = i; } }
  if (max > eps) return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
  return [a, b];
}
function simplify(loop, eps) {
  if (loop.length < 4) return loop;
  // split the closed loop at its two farthest points so RDP works on open lines
  let far = 0, fd = 0; for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > fd) { fd = d; far = i; } }
  const a = rdp(loop.slice(0, far + 1), eps), b = rdp([...loop.slice(far), loop[0]], eps);
  let pts = [...a.slice(0, -1), ...b.slice(0, -1)];
  // straighten edges that are nearly level or upright
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1];
    if (Math.abs(dy) < Math.abs(dx) * 0.18) { const y = (p[1] + q[1]) / 2; p[1] = y; q[1] = y; } else if (Math.abs(dx) < Math.abs(dy) * 0.18) { const x = (p[0] + q[0]) / 2; p[0] = x; q[0] = x; }
  }
  return dedupe(pts);
}
function dedupe(pts) {
  let out = pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3; });
  // drop points in the middle of a straight run
  let changed = true;
  while (changed && out.length > 3) { changed = false; for (let i = 0; i < out.length; i++) { const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-4) { out.splice(i, 1); changed = true; break; } } }
  return out;
}
// line up corners that are almost the same, across all rooms, on a 5 cm grid
function cluster(rooms, tol = 0.14) {
  for (const ax of [0, 1]) {
    const vals = rooms.flatMap((r) => r.pts.map((p) => p[ax])).sort((a, b) => a - b), groups = [];
    for (const v of vals) { const g = groups[groups.length - 1]; if (g && v - g[g.length - 1] <= tol) g.push(v); else groups.push([v]); }
    const map = new Map(); for (const g of groups) { const m = round(Math.round(g.reduce((s, v) => s + v, 0) / g.length / RES) * RES, 3); for (const v of g) map.set(v, m); }
    for (const r of rooms) for (const p of r.pts) p[ax] = map.get(p[ax]);
  }
  for (const r of rooms) r.pts = dedupe(r.pts);
}

// The whole job. grid.w holds the walls. Returns { rooms, openings, thick }.
export function rooms(g, { gap = 1.0, minArea = 1.2, thick } = {}) {
  const { nx, ny } = g, W = g.w, rc = Math.round(gap / 2 / g.res);
  const wt = thick || wallThickness(g);
  // 1. close the doorways
  const closed = grow(W, nx, ny, rc);
  // the outside: far from every wall and reachable from the edge, then brought back up to the walls.
  // This keeps wide windows and sliding doors from letting the outside into a room.
  const rb = Math.round(1.7 / g.res), big = grow(W, nx, ny, rb), farOut = new Uint8Array(W.length);
  { const fr = new Uint8Array(W.length); for (let k = 0; k < fr.length; k++) fr[k] = big[k] ? 0 : 1; const { comps: cs } = components(fr, nx, ny); for (const c of cs) if (c.border) for (const k of c.cells) farOut[k] = 1; }
  const outside = grow(farOut, nx, ny, rb + 1);
  const free = new Uint8Array(W.length); for (let k = 0; k < free.length; k++) free[k] = closed[k] || outside[k] ? 0 : 1;
  const { comps } = components(free, nx, ny);
  const seeds = comps.filter((c) => !c.border && c.cells.length * g.res * g.res >= minArea * 0.3);
  // 2. grow each sealed space back to its walls, all at once so neighbours split doorways fairly
  const lab = new Int32Array(W.length).fill(-1), q = [];
  seeds.forEach((c, n) => { for (const k of c.cells) { lab[k] = n; q.push(k); } });
  const step = new Int32Array(W.length); let h = 0;
  while (h < q.length) {
    const k = q[h++], i = k % nx;
    for (const n of [k - 1, k + 1, k - nx, k + nx]) { if (n < 0 || n >= W.length || (n === k - 1 && !i) || (n === k + 1 && i === nx - 1)) continue; if (!W[n] && !outside[n] && lab[n] < 0) { lab[n] = lab[k]; step[n] = step[k] + 1; q.push(n); } }
  }
  const half = Math.max(1, Math.round(wt / 2 / g.res)), out = [];
  seeds.forEach((c, n) => {
    let m = new Uint8Array(W.length); for (let k = 0; k < W.length; k++) m[k] = lab[k] === n ? 1 : 0;
    // 3. cut off the tongues that leaked through doorways (narrower than a doorway)
    m = grow(shrink(m, nx, ny, rc), nx, ny, rc, m);
    // 4. reach the middle of the walls so neighbouring rooms share one wall line
    m = grow(m, nx, ny, half, W);
    let cnt = 0; for (let k = 0; k < m.length; k++) cnt += m[k];
    if (cnt * g.res * g.res < minArea) return;
    const pts = simplify(outline(m, g), 0.12);
    if (pts.length >= 3 && Math.abs(area(pts)) >= minArea) out.push({ id: uid("r"), type: "other", name: "", pts });
  });
  cluster(out);
  for (const r of out) { if (area(r.pts) < 0) r.pts.reverse(); r.pts = r.pts.map(([x, y]) => [round(x, 3), round(y, 3)]); }
  const good = out.filter((r) => r.pts.length >= 3 && Math.abs(area(r.pts)) >= minArea);
  guessTypes(good);
  return { rooms: good, openings: openingsFrom(g, good, wt), thick: wt };
}

// typical wall thickness from the drawing (most common thick run of wall squares)
export function wallThickness(g) {
  const runs = [];
  for (let j = 0; j < g.ny; j += 2) { let r = 0; for (let i = 0; i < g.nx; i++) { if (g.w[j * g.nx + i]) r++; else { if (r >= 2) runs.push(r); r = 0; } } }
  for (let i = 0; i < g.nx; i += 2) { let r = 0; for (let j = 0; j < g.ny; j++) { if (g.w[j * g.nx + i]) r++; else { if (r >= 2) runs.push(r); r = 0; } } }
  if (!runs.length) return 0.15;
  runs.sort((a, b) => a - b);
  return Math.min(0.35, Math.max(0.08, runs[Math.floor(runs.length * 0.3)] * g.res));
}

// gaps in walls between rooms are doors (or arches when wide); gaps in outside walls are windows
function openingsFrom(g, rs, wt) {
  const f = { rooms: rs, openings: [], items: [], devices: [] }, out = [];
  for (const w of walls(f)) {
    if (w.parapet) continue;
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, n = Math.floor(len / g.res);
    let run = 0, start = 0;
    const flush = (endT) => {
      const width = run * g.res; if (width < 0.55) return;
      const mid = (start + endT) / 2 * g.res, x = round(w.a[0] + ux * mid, 3), y = round(w.a[1] + uy * mid, 3);
      if (w.exterior) out.push({ id: uid("o"), type: width > 2.2 ? "slider" : "window", x, y, width: round(Math.min(width, 4), 2), height: width > 2.2 ? 2.2 : 1.4, sill: width > 2.2 ? 0 : 0.9 });
      else out.push({ id: uid("o"), type: width > 1.3 ? "arch" : "door", x, y, width: round(Math.min(width, 3), 2), height: 2.1, sill: 0, swing: 1 });
    };
    for (let s = 2; s < n - 2; s++) {
      const x = w.a[0] + ux * s * g.res, y = w.a[1] + uy * s * g.res, [i, j] = g.cell(x, y);
      let wall = false; const r = Math.max(1, Math.round(wt / 2 / g.res));
      for (let o = -r; o <= r && !wall; o++) { const ii = Math.round(i - uy * o), jj = Math.round(j + ux * o); if (g.w[jj * g.nx + ii]) wall = true; }
      if (!wall) { if (!run) start = s; run++; } else if (run) { flush(s); run = 0; }
    }
    if (run) flush(n - 2);
  }
  // the outside door nearest the middle of the bottom edge is the main door
  return out;
}

function guessTypes(rs) {
  const sorted = [...rs].sort((a, b) => Math.abs(area(b.pts)) - Math.abs(area(a.pts)));
  sorted.forEach((r, i) => {
    const A = Math.abs(area(r.pts));
    r.type = i === 0 ? "living" : A < 3.2 ? "bath" : A < 6 ? "hall" : A < 18 ? "bedroom" : "other";
  });
}

// ---------------------------------------------------------------- inputs
// DXF: walls from lines and polylines; doors from swing arcs; furniture from named blocks.
const BLOCKS = [[/sofa|couch|كنب/i, "sofa"], [/bed.*(king|queen|double)|double.*bed|سرير/i, "bed_double"], [/bed/i, "bed_single"], [/arm.?chair/i, "armchair"], [/dining.*table|table.*dining/i, "dining_table"], [/chair|كرسي/i, "dining_chair"],
  [/coffee|centre.?table|center.?table/i, "coffee_table"], [/table|طاولة/i, "dining_table"], [/wc|toilet|closet|مرحاض/i, "toilet"], [/basin|sink|lav|مغسل/i, "basin"], [/bath.?tub|tub|بانيو/i, "bathtub"], [/shower|دش/i, "shower"],
  [/fridge|refrig|ثلاج/i, "fridge"], [/wardrobe|closet|دولاب|خزان/i, "wardrobe"], [/desk|مكتب/i, "desk"], [/tv|television|تلفز/i, "tv_unit"], [/plant|tree|نبات|شجر/i, "plant"], [/washer|washing|غسال/i, "washing_machine"], [/stove|cooker|hob|oven|counter|kitchen|مطبخ/i, "kitchen_base"], [/rug|carpet|سجاد/i, "rug"]];
export function fromDxf(text, { gap = 1.0 } = {}) {
  return import("dxf-parser").then(({ default: DxfParser }) => {
    const dxf = new DxfParser().parseSync(text);
    const units = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 }[dxf.header?.$INSUNITS];
    const segs = [], arcs = [], inserts = [], wallLayer = /wall|جدار|حائط|a-wall/i;
    const layers = new Set();
    const walk = (ents, tf = (p) => p) => {
      for (const e of ents || []) {
        if (e.type === "LINE") { segs.push([tf(e.vertices[0]), tf(e.vertices[1]), e.layer]); layers.add(e.layer); }
        else if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") { const v = e.vertices || []; for (let i = 0; i < v.length - 1 + (e.shape ? 1 : 0); i++) segs.push([tf(v[i]), tf(v[(i + 1) % v.length]), e.layer]); layers.add(e.layer); }
        else if (e.type === "ARC") arcs.push({ c: tf(e.center), r: e.radius, a0: e.startAngle, a1: e.endAngle, layer: e.layer });
        else if (e.type === "INSERT") inserts.push(e);
      }
    };
    walk(dxf.entities);
    const useLayer = [...layers].some((l) => wallLayer.test(l || ""));
    const ws = segs.filter((s) => !useLayer || wallLayer.test(s[2] || ""));
    let pts = ws.flatMap((s) => [s[0], s[1]]);
    if (!pts.length) throw new Error("No walls were found in this drawing");
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    let span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const k = units || (span > 400 ? 0.001 : span > 60 ? 0.01 : 1); // guess millimetres / centimetres / metres
    const X = (p) => [(p.x - Math.min(...xs)) * k, (Math.max(...ys) - p.y) * k]; // CAD y goes up, plans go down
    const minX = Math.min(...xs), maxY = Math.max(...ys), Xf = (p) => [(p.x - minX) * k, (maxY - p.y) * k];
    void X; span *= k;
    const g = new Grid(-1, -1, (Math.max(...xs) - minX) * k + 1, (maxY - Math.min(...ys)) * k + 1);
    for (const [a, b] of ws) g.line(Xf(a), Xf(b), RES * 1.5);
    // CAD walls are two thin lines: fill between close parallel lines so they read as solid walls
    fillPairs(g, ws.map(([a, b]) => [Xf(a), Xf(b)]));
    const res = rooms(g, { gap });
    // door swings
    for (const a of arcs) {
      const r = a.r * k; if (r < 0.55 || r > 1.3) continue;
      const c = Xf(a.c), e0 = [c[0] + Math.cos(a.a0) * r, c[1] - Math.sin(a.a0) * r], e1 = [c[0] + Math.cos(a.a1) * r, c[1] - Math.sin(a.a1) * r];
      for (const e of [e0, e1]) {
        const mid = [(c[0] + e[0]) / 2, (c[1] + e[1]) / 2];
        const near = res.openings.find((o) => Math.hypot(o.x - mid[0], o.y - mid[1]) < 0.6);
        if (near) { near.type = "door"; near.width = round(r, 2); }
      }
    }
    const items = [];
    for (const ins of inserts) {
      const kind = BLOCKS.find(([re]) => re.test(ins.name || ""))?.[1]; if (!kind) continue;
      const [x, y] = Xf(ins.position);
      items.push({ id: uid("i"), kind, x: round(x, 3), y: round(y, 3), rot: Math.round(((ins.rotation || 0) + 180) % 360) });
    }
    return { ...res, items, span };
  });
}
function fillPairs(g, segs) {
  const MAXT = 0.4;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [a, b] = segs[i], [c, d] = segs[j];
    const ux = b[0] - a[0], uy = b[1] - a[1], L = Math.hypot(ux, uy), vx = d[0] - c[0], vy = d[1] - c[1], M = Math.hypot(vx, vy);
    if (L < 0.2 || M < 0.2) continue;
    if (Math.abs((ux * vy - uy * vx) / (L * M)) > 0.02) continue; // not parallel
    const off = Math.abs((c[0] - a[0]) * -uy / L + (c[1] - a[1]) * ux / L); if (off < 0.04 || off > MAXT) continue;
    // overlap along the direction
    const t = (p) => ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / L, t0 = Math.max(0, Math.min(t(c), t(d))), t1 = Math.min(L, Math.max(t(c), t(d)));
    if (t1 - t0 < 0.15) continue;
    const nx = -uy / L, ny = ux / L, sgn = Math.sign((c[0] - a[0]) * nx + (c[1] - a[1]) * ny);
    const p0 = [a[0] + (ux / L) * t0 + nx * sgn * off / 2, a[1] + (uy / L) * t0 + ny * sgn * off / 2], p1 = [a[0] + (ux / L) * t1 + nx * sgn * off / 2, a[1] + (uy / L) * t1 + ny * sgn * off / 2];
    g.line(p0, p1, off + RES);
  }
}

// Images (and PDF pages drawn as images): dark thick strokes are walls.
export function fromImage(img, { metresPerPx, gap = 1.0 } = {}) {
  const W0 = img.width, H0 = img.height, c = document.createElement("canvas");
  // first pass at up to 1600 px to measure the walls
  const s0 = Math.min(1, 1600 / Math.max(W0, H0)); c.width = Math.round(W0 * s0); c.height = Math.round(H0 * s0);
  let x = c.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  let d = x.getImageData(0, 0, c.width, c.height).data, dark = new Uint8Array(c.width * c.height);
  for (let k = 0; k < dark.length; k++) dark[k] = d[k * 4] * 0.3 + d[k * 4 + 1] * 0.59 + d[k * 4 + 2] * 0.11 < 110 ? 1 : 0;
  const thickPx = rawThick(dark, c.width, c.height) || 4; // walls are the most common thick dark stroke
  const m = metresPerPx ? metresPerPx / s0 : 0.15 / thickPx; // metres per pixel in the measured image
  // second pass at 5 cm per pixel: thin lines fade out, walls stay
  const k = m / RES;
  const g = new Grid(0, 0, c.width * m, c.height * m);
  const c2 = document.createElement("canvas"); c2.width = g.nx; c2.height = g.ny;
  x = c2.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#fff"; x.fillRect(0, 0, c2.width, c2.height); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, c.width * k, c.height * k);
  d = x.getImageData(0, 0, g.nx, g.ny).data;
  for (let i = 0; i < g.w.length; i++) g.w[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11 < 150 ? 1 : 0;
  const res = rooms(g, { thick: thickPx * m, gap });
  return { ...res, items: [], metresPerPx: m * s0, size: [round(W0 * m * s0, 2), round(H0 * m * s0, 2)] };
}
function rawThick(dark, w, h) {
  const runs = [];
  for (let j = 0; j < h; j += 3) { let r = 0; for (let i = 0; i < w; i++) { if (dark[j * w + i]) r++; else { if (r >= 3) runs.push(r); r = 0; } } }
  for (let i = 0; i < w; i += 3) { let r = 0; for (let j = 0; j < h; j++) { if (dark[j * w + i]) r++; else { if (r >= 3) runs.push(r); r = 0; } } }
  if (runs.length < 10) return 0;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length * 0.5)];
}

export async function pdfToImage(buf, workerSrc) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const doc = await pdfjs.getDocument({ data: buf }).promise, page = await doc.getPage(1);
  const v0 = page.getViewport({ scale: 1 }), scale = Math.min(4, 2400 / Math.max(v0.width, v0.height)), v = page.getViewport({ scale });
  const c = document.createElement("canvas"); c.width = v.width; c.height = v.height;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: x, viewport: v }).promise;
  return c;
}
void rect; void inside; void openingsOn;
