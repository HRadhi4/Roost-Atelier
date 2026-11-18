// The home as data: floors with rooms (polygons in metres), openings (doors and windows), furniture and devices.
// Walls are not stored: they are worked out from the room edges, so dragging a room drags its walls.

export const EXT_WALL = 0.2;
export const INT_WALL = 0.12;
export const SNAP = 0.05;

let counter = 0;
export const uid = (p = "x") => `${p}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const snap = (v, s = SNAP) => Math.round(v / s) * s;
export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export const ROOM_TYPES = {
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
  other: { name: "Room", floor: "oak", icon: "mdi:square-outline" },
};

export function newPlan(name = "My home") {
  return {
    v: 1, name, north: 0, units: "m", style: "warm",
    settings: { quality: "auto", walls: "cut", sun: true },
    floors: [{ id: uid("f"), name: "Ground floor", height: 2.8, elevation: 0, rooms: [], openings: [], items: [], devices: [], walls: [] }],
  };
}

export const rect = (x, y, w, d) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];

export function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
  return a / 2;
}
export function centroid(pts) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length], f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f; cy += (y1 + y2) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) return [pts[0][0], pts[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}
export function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
export function inside([x, y], pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export const roomAt = (floor, p) => floor.rooms.find((r) => inside(p, r.pts)) || null;

// ---------------------------------------------------------------- walls from rooms
const key = (x, y) => `${round(x, 3)},${round(y, 3)}`;
function onSeg(p, a, b, eps = 1e-3) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > eps * Math.hypot(bx - ax, by - ay)) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay), len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  return dot > eps && dot < len2 - eps;
}

// Every wall piece: { a, b, rooms: [room ids], exterior, thick }
export function walls(floor) {
  const edges = [];
  for (const r of floor.rooms) {
    const n = r.pts.length;
    for (let i = 0; i < n; i++) edges.push({ a: r.pts[i], b: r.pts[(i + 1) % n], room: r.id, outdoor: !!ROOM_TYPES[r.type]?.outdoor });
  }
  for (const w of floor.walls || []) edges.push({ a: w.a, b: w.b, room: null, free: w });
  const verts = [];
  for (const e of edges) verts.push(e.a, e.b);
  const pieces = new Map();
  for (const e of edges) {
    const cuts = [e.a, e.b, ...verts.filter((v) => onSeg(v, e.a, e.b))];
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1];
    cuts.sort((p, q) => (p[0] - e.a[0]) * dx + (p[1] - e.a[1]) * dy - ((q[0] - e.a[0]) * dx + (q[1] - e.a[1]) * dy));
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01) continue;
      const k1 = key(...a), k2 = key(...b), k = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      const p = pieces.get(k) || { a: k1 < k2 ? a : b, b: k1 < k2 ? b : a, rooms: [], outdoor: [], free: null };
      if (e.room) { if (!p.rooms.includes(e.room)) p.rooms.push(e.room); p.outdoor.push(e.outdoor); }
      if (e.free) p.free = e.free;
      pieces.set(k, p);
    }
  }
  const out = [];
  for (const p of pieces.values()) {
    const indoorRooms = p.outdoor.filter((o) => !o).length;
    // an edge between a room and a balcony is still an outside wall; balcony edges on their own are a low parapet
    const parapet = p.rooms.length && indoorRooms === 0;
    const exterior = p.rooms.length === 1 || (p.rooms.length === 2 && indoorRooms === 1);
    out.push({ a: p.a, b: p.b, rooms: p.rooms, exterior, parapet, free: !!p.free, thick: p.free?.thick ?? (exterior ? EXT_WALL : INT_WALL) });
  }
  return out;
}

// Openings on a wall piece: [{ op, t0, t1 }] in metres along the wall from a.
export function openingsOn(w, openings) {
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

// The nearest wall to a point, with the point moved onto it.
export function nearestWall(floor, p, max = 0.6) {
  let best = null;
  for (const w of walls(floor)) {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len2 = dx * dx + dy * dy;
    let t = ((p[0] - w.a[0]) * dx + (p[1] - w.a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const q = [w.a[0] + t * dx, w.a[1] + t * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < max && (!best || d < best.d)) best = { w, q, t, d, len: Math.sqrt(len2), angle: Math.atan2(dy, dx) };
  }
  return best;
}

// Room edges near a value, for snapping a dragged edge to its neighbours.
export function snapTargets(floor, skipId) {
  const xs = new Set(), ys = new Set();
  for (const r of floor.rooms) if (r.id !== skipId) for (const [x, y] of r.pts) { xs.add(round(x, 3)); ys.add(round(y, 3)); }
  return { xs: [...xs], ys: [...ys] };
}
export function snapTo(v, list, tol = 0.25) {
  let best = null;
  for (const t of list) if (Math.abs(t - v) < tol && (best === null || Math.abs(t - v) < Math.abs(best - v))) best = t;
  return best ?? snap(v);
}

export function planBounds(floor) {
  const pts = floor.rooms.flatMap((r) => r.pts);
  if (!pts.length) return { x0: 0, y0: 0, x1: 10, y1: 8 };
  return bounds(pts);
}

export function validate(plan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.floors) || !plan.floors.length) return newPlan();
  for (const f of plan.floors) {
    f.rooms = (f.rooms || []).filter((r) => Array.isArray(r.pts) && r.pts.length >= 3);
    for (const k of ["openings", "items", "devices", "walls"]) f[k] = Array.isArray(f[k]) ? f[k] : [];
    f.height = Number(f.height) || 2.8;
    f.elevation = Number(f.elevation) || 0;
  }
  plan.settings = { quality: "auto", walls: "cut", sun: true, ...(plan.settings || {}) };
  return plan;
}
