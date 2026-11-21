// Drawing a plan with lines: a line follows the walls you draw, and every space it closes becomes an area of its own.
// A line across a room cuts it in two (each side its own area); a line from a wall out and back to a wall makes the
// space it closes a new area; a line that closes on itself is an area too. Everything is plain geometry on the plan
// (metres), so it can be tested on its own.
import { area, inside } from "./model.js";

const EPS = 1e-3; // 1 mm: closer than this counts as the same point / on the line
const key = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
const near = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

// where p falls along a-b (0..1) and how far it is from the line
function along(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
  const d = Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / Math.sqrt(L2);
  return { t, d };
}
// the crossing point of a-b and c-d (only where both really meet)
function cross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const qp = [c[0] - a[0], c[1] - a[1]], t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  const tl = EPS / Math.hypot(...r), ul = EPS / Math.hypot(...s);
  if (t < -tl || t > 1 + tl || u < -ul || u > 1 + ul) return null;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

// the closed spaces made by a set of line pieces: each is a list of corners (without its outer outline)
export function faces(segs) {
  // 1) cut every piece where it meets another one or where another piece's end touches it
  const pts = [];
  for (const s of segs) pts.push(s.a, s.b);
  const pieces = [];
  segs.forEach((s, i) => {
    const cuts = [{ t: 0, p: s.a }, { t: 1, p: s.b }];
    segs.forEach((o, j) => {
      if (i === j) return;
      const x = cross(s.a, s.b, o.a, o.b); if (x) cuts.push({ t: along(x, s.a, s.b).t, p: x });
      for (const p of [o.a, o.b]) { const q = along(p, s.a, s.b); if (q.d < EPS && q.t > 0 && q.t < 1) cuts.push({ t: q.t, p }); }
    });
    cuts.sort((x, y) => x.t - y.t);
    for (let k = 0; k + 1 < cuts.length; k++) if (!near(cuts[k].p, cuts[k + 1].p)) pieces.push({ a: cuts[k].p, b: cuts[k + 1].p, fresh: s.fresh });
  });
  // 2) one corner per spot, one line per pair of corners (a line drawn twice, like a shared wall, counts once)
  const node = new Map(), nodeOf = (p) => { const k = key(p); if (!node.has(k)) node.set(k, { k, p: [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4], out: [] }); return node.get(k); };
  const edges = new Map();
  for (const s of pieces) {
    const u = nodeOf(s.a), v = nodeOf(s.b); if (u === v) continue;
    const ek = u.k < v.k ? `${u.k}|${v.k}` : `${v.k}|${u.k}`;
    if (edges.has(ek)) { edges.get(ek).fresh ||= s.fresh; continue; }
    edges.set(ek, { u, v, fresh: !!s.fresh });
  }
  // 3) lines that end in the open close nothing: take them away (again and again, a loose tail can be long)
  let live = [...edges.values()], changed = true;
  while (changed) {
    changed = false;
    const deg = new Map(); for (const e of live) { deg.set(e.u, (deg.get(e.u) || 0) + 1); deg.set(e.v, (deg.get(e.v) || 0) + 1); }
    const next = live.filter((e) => deg.get(e.u) > 1 && deg.get(e.v) > 1);
    if (next.length !== live.length) { live = next; changed = true; }
  }
  for (const n of node.values()) n.out = [];
  for (const e of live) { e.u.out.push({ to: e.v, e }); e.v.out.push({ to: e.u, e }); }
  for (const n of node.values()) n.out.sort((x, y) => Math.atan2(x.to.p[1] - n.p[1], x.to.p[0] - n.p[0]) - Math.atan2(y.to.p[1] - n.p[1], y.to.p[0] - n.p[0]));
  // 4) walk round every space, always taking the next line round the corner
  const seen = new Set(), out = [];
  for (const n of node.values()) for (const h of n.out) {
    const hk = `${n.k}>${h.to.k}`; if (seen.has(hk)) continue;
    const ring = [], fresh = [];
    let from = n, to = h.to, e = h.e, guard = 0;
    while (guard++ < 100000) {
      const k = `${from.k}>${to.k}`; if (seen.has(k)) break; seen.add(k);
      ring.push(from.p); fresh.push(e.fresh);
      const list = to.out, back = list.findIndex((x) => x.to === from);
      const nx = list[(back - 1 + list.length) % list.length];
      from = to; to = nx.to; e = nx.e;
    }
    if (ring.length >= 3) out.push({ pts: ring, signed: signedArea(ring), fresh: fresh.some(Boolean) });
  }
  // the outer outline of each group of lines goes round the other way: keep the spaces inside
  return out.filter((f) => f.signed > 1e-6).map((f) => ({ pts: tidy(f.pts), fresh: f.fresh }));
}

export function signedArea(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
// corners in the middle of a straight wall are left out
function tidy(pts) {
  let p = pts;
  for (let pass = 0; pass < 3; pass++) {
    const q = p.filter((c, i) => { const a = p[(i - 1 + p.length) % p.length], b = p[(i + 1) % p.length]; return along(c, a, b).d > EPS; });
    if (q.length === p.length || q.length < 3) break; p = q;
  }
  return p;
}
// a spot surely inside a space (its middle can be outside for an L-shape)
export function innerPoint(pts) {
  const s = Math.sign(signedArea(pts)) || 1;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.02) continue;
    for (const off of [0.01, 0.05]) {
      // inward is to the left of a-b when the corners go round positively
      const p = [(a[0] + b[0]) / 2 - (s * (b[1] - a[1]) / L) * off, (a[1] + b[1]) / 2 + (s * (b[0] - a[0]) / L) * off];
      if (inside(p, pts)) return p;
    }
  }
  return pts[0];
}
const edgesOf = (pts, fresh = false) => pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length], fresh }));
const pathSegs = (path, closed) => { const s = []; for (let i = 0; i + 1 < path.length; i++) s.push({ a: path[i], b: path[i + 1], fresh: true }); if (closed && path.length > 2) s.push({ a: path[path.length - 1], b: path[0], fresh: true }); return s; };

// the room's settings for a wall that lies along one of its old walls (feature walls go with their wall)
function carryWalls(old, pts) {
  if (!old.walls) return undefined;
  const out = {};
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    old.pts.forEach((p, j) => {
      const q = old.pts[(j + 1) % old.pts.length], fin = old.walls[j];
      if (!fin) return;
      const A = along(a, p, q), B = along(b, p, q);
      if (A.d < EPS && B.d < EPS && A.t > -EPS && A.t < 1 + EPS && B.t > -EPS && B.t < 1 + EPS) out[i] = fin;
    });
  });
  return Object.keys(out).length ? out : undefined;
}

// the plan after drawing a line: rooms it cuts become two (or more), the spaces it closes become new rooms.
// path: the corners drawn; closed: the line came back to its start. newId() names new rooms.
// Returns { rooms, made: [ids of new rooms], split: [ids of rooms that were cut] }.
export function drawLine(rooms, path, closed, newId) {
  const segs = pathSegs(path, closed);
  if (!segs.length) return { rooms, made: [], split: [] };
  const orient = Math.sign(signedArea(rooms[0]?.pts || [[0, 0], [1, 0], [1, 1], [0, 1]])) || 1;
  const facing = (pts) => (Math.sign(signedArea(pts)) === orient ? pts : pts.slice().reverse());
  const out = [], made = [], split = [], inner = [];
  // 1) each room the line goes through is cut along it
  for (const r of rooms) {
    const pieces = faces([...edgesOf(r.pts), ...segs]).filter((f) => f.fresh && area(f.pts) > 0.05 && inside(innerPoint(f.pts), r.pts));
    // a closed line drawn inside the room without touching its walls: a smaller area inside it (like a cupboard)
    if (pieces.length === 1 && area(pieces[0].pts) < area(r.pts) - 0.05) { out.push(r); const c = { id: newId(), type: "other", name: "", pts: facing(pieces[0].pts) }; inner.push(c); made.push(c.id); continue; }
    if (pieces.length < 2) { out.push(r); continue; }
    pieces.sort((a, b) => area(b.pts) - area(a.pts));
    split.push(r.id);
    pieces.forEach((f, i) => {
      const pts = facing(f.pts), walls = carryWalls(r, pts);
      const c = { ...r, pts };
      if (walls) c.walls = walls; else delete c.walls;
      // the biggest piece stays the same room (its name, devices' room, cards); the others are new areas
      if (i > 0) { c.id = newId(); c.name = ""; delete c.locked; made.push(c.id); }
      out.push(c);
    });
  }
  // 2) spaces closed by the line outside every room become new rooms
  const all = faces([...rooms.flatMap((r) => edgesOf(r.pts)), ...segs]);
  for (const f of all) {
    if (!f.fresh || area(f.pts) < 0.3) continue;
    const p = innerPoint(f.pts);
    if (rooms.some((r) => inside(p, r.pts))) continue;
    const c = { id: newId(), type: "other", name: "", pts: facing(f.pts) };
    out.push(c); made.push(c.id);
  }
  out.push(...inner);
  return { rooms: out, made, split };
}

// the nearest point on any wall (within reach), for the line to land exactly on it
export function onWall(rooms, p, reach) {
  let best = null;
  for (const r of rooms) r.pts.forEach((a, i) => {
    const b = r.pts[(i + 1) % r.pts.length], q = along(p, a, b);
    if (q.t < 0 || q.t > 1 || q.d > reach || (best && q.d >= best.d)) return;
    best = { d: q.d, p: [a[0] + (b[0] - a[0]) * q.t, a[1] + (b[1] - a[1]) * q.t], a, b };
  });
  return best;
}
// where the line from p towards q first meets the wall a-b (to keep a straight line straight when it lands on a wall)
export function meet(p, q, a, b) {
  const r = [q[0] - p[0], q[1] - p[1]], s = [b[0] - a[0], b[1] - a[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const qp = [a[0] - p[0], a[1] - p[1]], u = (qp[0] * r[1] - qp[1] * r[0]) / den, t = (qp[0] * s[1] - qp[1] * s[0]) / den;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  return [p[0] + r[0] * t, p[1] + r[1] * t];
}
