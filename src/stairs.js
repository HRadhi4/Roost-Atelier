// Stairs that join two levels. The person taps where they start on one level and where they arrive on the level
// above; the stairs are built between the two, the floor above gets an opening with a railing, and the ceiling
// below an opening too. Several styles: wood, wrought iron with scrolls, glass, round (spiral), rounded first steps
// and a palace staircase.
// Local layout of a straight flight: x across, the first step at +z (front), climbing towards -z, floor at y = 0.
import * as THREE from "three";
import { wood, solid, metal, glass, brass, chrome } from "./materials.js";

// [name, default width, round?, icon]
export const STAIR_STYLES = {
  wood: ["Wooden stairs", 1.0, false, "mdi:stairs"],
  iron: ["Iron stairs with scrolls", 1.0, false, "mdi:stairs-box"],
  glass: ["Glass stairs", 1.0, false, "mdi:stairs-up"],
  spiral: ["Round stairs", 1.8, true, "mdi:rotate-3d-variant"],
  bullnose: ["Stairs with rounded first steps", 1.1, false, "mdi:stairs"],
  palace: ["Palace stairs", 1.8, false, "mdi:castle"],
};
export const RISER = 0.18, GOING = 0.27;
// a round stair turns this much from the first step to the top
export const SPIRAL_TURN = 315;

// how high each level sits (a level without its own height sits on the one below plus a 30 cm slab)
export function elevOf(plan, j) {
  const f = plan.floors[j]; if (!f) return 0;
  return j === 0 || f.elevation ? f.elevation || 0 : plan.floors.slice(0, j).reduce((a, x) => a + (x.height || 2.8) + 0.3, 0);
}
export function riseTo(plan, fi) {
  return plan.floors[fi + 1] ? Math.max(1, elevOf(plan, fi + 1) - elevOf(plan, fi)) : (plan.floors[fi]?.height || 2.8);
}
// the shortest straight flight that is still comfortable to climb for this height
// (steps at most 19 cm high and at least 22 cm deep)
export const minRun = (rise) => Math.max(1.6, Math.ceil(rise / 0.19) * 0.22);

// the stairs between a start (bottom) and an arrival point (top, on the level above)
export function stairFrom(start, end, style, rise) {
  const S = STAIR_STYLES[style] || STAIR_STYLES.wood, w = S[1];
  if (S[2]) {
    // round: it stands where the person tapped first; the arrival only turns it so the top step faces that way
    const turn = SPIRAL_TURN, phi = Math.atan2(end[0] - start[0], end[1] - start[1]);
    return { x: r3(start[0]), y: r3(start[1]), w, d: w, h: rise, style, rot: Math.round(((phi - (turn * Math.PI) / 180) * 180) / Math.PI), short: false };
  }
  let dx = end[0] - start[0], dy = end[1] - start[1], len = Math.hypot(dx, dy);
  if (len < 0.05) { dx = 0; dy = -1; len = 1; }
  const need = minRun(rise), run = Math.max(need, Math.min(9, len)), ux = dx / len, uy = dy / len;
  return { x: r3(start[0] + (ux * run) / 2), y: r3(start[1] + (uy * run) / 2), w, d: r3(run), h: rise, style, rot: Math.round((Math.atan2(-ux, -uy) * 180) / Math.PI), short: len < need - 0.05 };
}
const r3 = (v) => Math.round(v * 1000) / 1000;

// a point of the stairs (local x, z) on the plan
function toPlan(it, x, z) {
  const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [r3(it.x + x * c + z * s), r3(it.y - x * s + z * c)];
}
// the opening in the floor above (and in the ceiling below), as a plan polygon
export function stairHole(it) {
  const st = it.style || "wood";
  if (STAIR_STYLES[st]?.[2]) { const R = (it.w || 1.8) / 2 + 0.06; return Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return [r3(it.x + R * Math.sin(a)), r3(it.y + R * Math.cos(a))]; }); }
  const w = (it.w || 1) / 2 + 0.06, d = it.d || 3.6, z0 = -d / 2 - 0.02, z1 = -d / 2 + Math.min(d * 0.95, Math.max(1.2, d * 0.72));
  return [toPlan(it, -w, z0), toPlan(it, w, z0), toPlan(it, w, z1), toPlan(it, -w, z1)];
}
// the stairs from the level below that arrive on level fi
export function stairsArriving(plan, fi) {
  const below = plan.floors[fi - 1]; if (!below) return [];
  return below.items.filter((i) => i.kind === "stairs" && i.link === fi);
}

// ---------------------------------------------------------------- building them
const up = new THREE.Vector3(0, 1, 0);
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
const box = (g, w, h, d, mat, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z); g.add(m); return m; };
// a straight bar from p to q
function bar(g, p, q, r, mat, seg = 8) {
  const a = new THREE.Vector3(...p), b = new THREE.Vector3(...q), m = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); g.add(m); return m;
}
// a rail that bends through points
function tube(g, pts, r, mat) { const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); const m = mesh(new THREE.TubeGeometry(c, Math.max(16, pts.length * 4), r, 8, false), mat); g.add(m); return m; }
// a sloping plate (a stringer, a glass side) under the pitch line, lying in the y-z plane at x
function slope(g, x, t, h, d, rise, mat, lift) {
  const geo = new THREE.BoxGeometry(t, h, d); geo.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0, -rise / d));
  const m = mesh(geo, mat, x, rise / 2 + lift, 0); g.add(m); return m;
}
// a turned post (a baluster, a newel): a vase shape
const turnedCache = new Map();
function turned(h, r) {
  const k = `${h.toFixed(3)}|${r.toFixed(3)}`;
  if (!turnedCache.has(k)) {
    const p = [[0, 0], [r * 1.25, 0], [r * 1.25, h * 0.06], [r * 0.7, h * 0.1], [r * 1.1, h * 0.3], [r * 0.55, h * 0.5], [r * 0.7, h * 0.75], [r * 0.5, h * 0.85], [r * 1.15, h * 0.9], [r * 1.15, h], [0, h]];
    turnedCache.set(k, new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 14));
  }
  return turnedCache.get(k);
}
// a curl of iron in the plane of a balustrade (the y-z plane)
function scroll(g, x, y, z, r, mat, flip) {
  const m = mesh(new THREE.TorusGeometry(r, 0.006, 6, 18, Math.PI * 1.6), mat, x, y, z);
  m.rotation.y = Math.PI / 2; m.rotation.x = flip ? Math.PI : 0; g.add(m);
}

export function buildStairs(o) {
  const st = o.style || "wood", g = new THREE.Group();
  if (st === "spiral") return spiral(o, g);
  const W = o.w || 1, D = o.d || 3.6, H = o.h || 2.8, n = Math.max(3, Math.round(H / RISER)), rh = H / n, td = D / n;
  const zc = (i) => D / 2 - (i + 0.5) * td, pitch = (z) => ((D / 2 - z) / D) * H, side = o.side === "left" ? -1 : 1;

  if (st === "wood") {
    const m = wood(o.wood || "oak");
    for (let i = 0; i < n; i++) box(g, W, rh * (i + 1), td, m, 0, 0, zc(i));
    const rail = metal("#2B2D33", 0.35), x = side * (W / 2 - 0.03);
    bar(g, [x, 0.9 + rh, D / 2], [x, H + 0.9, -D / 2], 0.02, rail, 10);
    for (let i = 0; i < n; i += 2) bar(g, [x, rh * (i + 1), zc(i)], [x, pitch(zc(i)) + 0.9 + rh / 2, zc(i)], 0.012, rail, 6);
    return g;
  }

  if (st === "iron") {
    const iron = metal("#1C1C20", 0.45), tread = wood(o.wood || "walnut");
    for (const sx of [-1, 1]) slope(g, sx * (W / 2 - 0.006), 0.012, 0.26, D, H, iron, -0.2);
    for (let i = 0; i < n; i++) box(g, W - 0.03, 0.045, td + 0.03, tread, 0, rh * (i + 1) - 0.045, zc(i));
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.006);
      bar(g, [x, 0.95, D / 2 + 0.02], [x, H + 0.95, -D / 2], 0.02, iron, 10);
      for (let i = 0; i < n; i++) {
        const z = zc(i), y0 = rh * (i + 1), top = pitch(z) + 0.95;
        bar(g, [x, y0, z], [x, top, z], 0.008, iron, 6);
        // a pair of scrolls on every other step
        if (i % 2 === 0) { const ym = (y0 + top) / 2; scroll(g, x, ym + 0.06, z - td / 2, Math.min(0.06, td / 2.4), iron, false); scroll(g, x, ym - 0.08, z - td / 2, Math.min(0.06, td / 2.4), iron, true); }
      }
      // a newel post with a brass ball at the bottom
      box(g, 0.06, 1.0, 0.06, iron, x, 0, D / 2 + 0.03);
      const ball = mesh(new THREE.SphereGeometry(0.045, 16, 12), brass(), x, 1.04, D / 2 + 0.03); g.add(ball);
    }
    return g;
  }

  if (st === "glass") {
    const stone = solid("#ECE9E3", { rough: 0.35, clear: 0.3 }), steel = metal("#3A3D44", 0.3), pane = glass();
    slope(g, 0, 0.16, 0.22, D, H, steel, -0.18);
    for (let i = 0; i < n; i++) box(g, W, 0.06, td + 0.02, stone, 0, rh * (i + 1) - 0.06, zc(i));
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 0.012), p = slope(g, x, 0.012, 1.0, D, H, pane, 0.04 + rh); p.userData.glass = true; p.castShadow = false;
      bar(g, [x, rh + 1.06, D / 2], [x, H + 1.06, -D / 2], 0.018, chrome(), 10);
    }
    return g;
  }

  if (st === "bullnose" || st === "palace") {
    const palace = st === "palace";
    const stepM = palace ? solid("#F2EFEA", { rough: 0.22, clear: 0.5 }) : wood(o.wood || "walnut"), riserM = palace ? stepM : solid("#F4F1EC", { rough: 0.8 });
    const rail = wood(palace ? "walnut" : o.wood || "walnut"), post = palace ? solid("#F6F3EE", { rough: 0.3, clear: 0.4 }) : solid("#F4F1EC", { rough: 0.6 });
    const flare = palace ? 4 : 2, extra = palace ? 0.2 : 0.18;
    for (let i = 0; i < n; i++) {
      const wide = i < flare ? (flare - i) * extra : 0, w = W + 2 * wide, h = rh * (i + 1);
      box(g, w, h - 0.03, td, riserM, 0, 0, zc(i));
      box(g, w + 0.02, 0.03, td + 0.03, stepM, 0, h - 0.03, zc(i) + 0.015);
      // the wide bottom steps end in half circles
      if (wide > 0) for (const sx of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(td / 2 + 0.015, td / 2 + 0.015, h, 20, 1, false, sx > 0 ? 0 : Math.PI, Math.PI), stepM, sx * w / 2, h / 2, zc(i)); g.add(c); }
    }
    if (palace) {
      // a red runner down the middle of the steps
      const carpet = solid("#8E1F2B", { rough: 0.95 }), cw = W * 0.56;
      for (let i = 0; i < n; i++) { box(g, cw, 0.008, td, carpet, 0, rh * (i + 1), zc(i)); box(g, cw, rh, 0.008, carpet, 0, rh * i, zc(i) + td / 2 + 0.004); }
    }
    const sides = palace ? [-1, 1] : [side];
    for (const sx of sides) {
      const x = sx * (W / 2 - 0.05);
      for (let i = flare; i < n; i++) { const z = zc(i), y0 = rh * (i + 1), h = pitch(z) + 0.92 - y0; g.add(mesh(turned(h, palace ? 0.028 : 0.02), post, x, y0, z)); }
      // the handrail sweeps down and curls round the newel post on the wide bottom step
      const nz = zc(0), nx = sx * (W / 2 + (flare - 0.5) * extra), ny = rh;
      const newel = mesh(turned(1.05, palace ? 0.06 : 0.045), post, nx, ny, nz); g.add(newel);
      const pts = [[nx, ny + 1.05, nz], [nx - sx * 0.05, ny + 1.0, nz - 0.25], [x, pitch(zc(flare)) + 0.94, zc(flare)], [x, H + 0.94, -D / 2]];
      tube(g, pts, palace ? 0.035 : 0.028, rail);
      if (palace) { const v = mesh(new THREE.TorusGeometry(0.1, 0.03, 10, 28), rail, nx, ny + 1.05, nz); v.rotation.x = Math.PI / 2; g.add(v); }
    }
    return g;
  }
  return buildStairs({ ...o, style: "wood" });
}

// a round stair: a centre pole, wedge steps turning round it, and a rail that winds up the outside
function spiral(o, g) {
  const R = (o.w || 1.8) / 2, H = o.h || 2.8, n = Math.max(8, Math.round(H / RISER)), rh = H / n, turn = (SPIRAL_TURN * Math.PI) / 180, step = turn / n;
  const iron = metal("#1C1C20", 0.4), tread = wood(o.wood || "oak");
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, H + 1.0, 16), iron, 0, (H + 1.0) / 2, 0));
  const rail = [];
  for (let i = 0; i < n; i++) {
    const a = i * step, y = rh * (i + 1);
    const t = mesh(new THREE.CylinderGeometry(R, R, 0.045, 10, 1, false, a, step * 1.08), tread, 0, y - 0.0225, 0); g.add(t);
    const am = a + step / 2, bx = Math.sin(am) * (R - 0.04), bz = Math.cos(am) * (R - 0.04);
    bar(g, [bx, y, bz], [bx, y + 0.92, bz], 0.009, iron, 6);
    rail.push([bx, y + 0.92, bz]);
  }
  tube(g, rail, 0.022, iron);
  return g;
}

// the railing round the opening on the level above, open where the stairs arrive
export function holeRails(it) {
  const g = new THREE.Group(), st = it.style || "wood", spiralLike = STAIR_STYLES[st]?.[2];
  const pane = st === "glass", mat = pane ? chrome() : st === "palace" || st === "bullnose" ? wood("walnut") : metal("#1C1C20", 0.4);
  const post = st === "palace" || st === "bullnose" ? solid("#F4F1EC", { rough: 0.4 }) : mat;
  const run = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.1) return;
    bar(g, [a[0], 0.95, a[1]], [b[0], 0.95, b[1]], 0.022, mat, 10);
    if (pane) { const p = mesh(new THREE.BoxGeometry(len, 0.9, 0.012), glass(), (a[0] + b[0]) / 2, 0.47, (a[1] + b[1]) / 2); p.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); p.userData.glass = true; p.castShadow = false; g.add(p); return; }
    const k = Math.max(1, Math.round(len / 0.12));
    for (let i = 0; i <= k; i++) { const x = a[0] + ((b[0] - a[0]) * i) / k, z = a[1] + ((b[1] - a[1]) * i) / k; if (st === "palace" || st === "bullnose") g.add(mesh(turned(0.93, 0.024), post, x, 0, z)); else bar(g, [x, 0, z], [x, 0.95, z], 0.008, mat, 6); }
  };
  const hole = stairHole(it);
  if (spiralLike) {
    const phi = (((it.rot || 0) + SPIRAL_TURN) * Math.PI) / 180;
    for (let i = 0; i < hole.length; i++) {
      const a = hole[i], b = hole[(i + 1) % hole.length], m = Math.atan2((a[0] + b[0]) / 2 - it.x, (a[1] + b[1]) / 2 - it.y);
      const off = Math.abs(Math.atan2(Math.sin(m - phi), Math.cos(m - phi)));
      if (off > 0.75) run(a, b);
    }
  } else { run(hole[0], hole[3]); run(hole[3], hole[2]); run(hole[2], hole[1]); }
  g.traverse((x) => { if (x.isMesh) x.userData.stairs = it.id; });
  return g;
}

// how a stair looks on the plan: the steps as lines and an arrow going up
export function stairSvg(it, px, stroke, fill) {
  const st = it.style || "wood";
  if (STAIR_STYLES[st]?.[2]) {
    const R = (it.w || 1.8) / 2, n = Math.max(8, Math.round((it.h || 2.8) / RISER)), step = SPIRAL_TURN / n;
    let s = `<circle r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="${px}"/><circle r="0.06" fill="${stroke}"/>`;
    for (let i = 0; i <= n; i++) { const a = (i * step * Math.PI) / 180; s += `<line x2="${R * Math.sin(a)}" y2="${R * Math.cos(a)}" stroke="${stroke}" stroke-width="${0.7 * px}"/>`; }
    return s;
  }
  const W = it.w || 1, D = it.d || 3.6, n = Math.max(3, Math.round((it.h || 2.8) / RISER)), td = D / n;
  let s = `<rect x="${-W / 2}" y="${-D / 2}" width="${W}" height="${D}" fill="${fill}" stroke="${stroke}" stroke-width="${px}"/>`;
  for (let i = 1; i < n; i++) s += `<line x1="${-W / 2}" x2="${W / 2}" y1="${D / 2 - i * td}" y2="${D / 2 - i * td}" stroke="${stroke}" stroke-width="${0.7 * px}"/>`;
  return s + `<path d="M0 ${D / 2 - 0.15}V${-D / 2 + 0.25}M-0.12 ${-D / 2 + 0.4}L0 ${-D / 2 + 0.22}L0.12 ${-D / 2 + 0.4}" stroke="${stroke}" stroke-width="${1.6 * px}" fill="none"/>`;
}

// the part of an opening inside a room (rooms are usually convex; for any other shape the opening is kept
// only when it lies wholly inside)
export function clipTo(hole, room) {
  const area = (p) => p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;
  const inPoly = ([x, y], pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sgn = Math.sign(area(room)), convex = room.every((p, i) => sgn * cross(p, room[(i + 1) % room.length], room[(i + 2) % room.length]) >= -1e-9);
  if (!convex) return hole.every((p) => inPoly(p, room)) ? hole : null;
  let out = hole;
  for (let i = 0; i < room.length && out.length; i++) {
    const a = room[i], b = room[(i + 1) % room.length], inn = (p) => sgn * cross(a, b, p) > 1e-9, input = out; out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k], q = input[(k + 1) % input.length], pi = inn(p), qi = inn(q);
      if (pi) out.push(p);
      if (pi !== qi) { const t = cross(a, b, p) / (cross(a, b, p) - cross(a, b, q)); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out.length >= 3 && Math.abs(area(out)) > 0.02 ? out : null;
}
