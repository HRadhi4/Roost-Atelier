// The expert eye: finds what a designer would point out, and fixes it in one tap where it can.
import { ROOM_TYPES, area, bounds, inside, walls, openingsOn, round } from "./model.js";
import { dims, LIBRARY } from "./furniture.js";

const nameOf = (r) => r.name || ROOM_TYPES[r.type]?.name || "Room";
function overlap(a, b) {
  const A = bounds(a.pts), B = bounds(b.pts);
  const w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), h = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
  if (w <= 0.05 || h <= 0.05) return 0;
  // sample the shared box to be fair to L-shaped rooms
  let n = 0, k = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const p = [Math.max(A.x0, B.x0) + (w * (i + 0.5)) / 6, Math.max(A.y0, B.y0) + (h * (j + 0.5)) / 6]; k++; if (inside(p, a.pts) && inside(p, b.pts)) n++; }
  return (w * h * n) / k;
}

export function check(plan, floor) {
  const out = [], f = floor, ws = walls(f);
  // rooms on top of each other
  for (let i = 0; i < f.rooms.length; i++) for (let j = i + 1; j < f.rooms.length; j++) {
    const o = overlap(f.rooms[i], f.rooms[j]);
    if (o > 0.1) out.push({ text: `${nameOf(f.rooms[i])} and ${nameOf(f.rooms[j])} overlap by ${round(o, 1)} m².`, sel: { t: "room", id: f.rooms[j].id } });
  }
  // rooms you can't walk into
  for (const r of f.rooms) {
    if (ROOM_TYPES[r.type]?.outdoor && r.type === "garden") continue;
    const edges = ws.filter((w) => w.rooms.includes(r.id));
    const has = edges.some((w) => openingsOn(w, f.openings).some(({ op }) => op.type !== "window"));
    const open = edges.some((w) => w.rooms.length === 2 && !w.exterior && false);
    if (!has && !open && f.rooms.length > 1) out.push({ text: `${nameOf(r)} has no way in. Add a door, arch or sliding door.`, sel: { t: "room", id: r.id } });
    if (!ROOM_TYPES[r.type]?.outdoor && ["bedroom", "living", "majlis", "office"].includes(r.type)) {
      const win = edges.some((w) => w.exterior && openingsOn(w, f.openings).some(({ op }) => op.type === "window" || op.type === "slider"));
      if (!win) out.push({ text: `${nameOf(r)} has no window to the outside.`, sel: { t: "room", id: r.id } });
    }
    if (!ROOM_TYPES[r.type]?.outdoor && Math.abs(area(r.pts)) < 2.5 && r.type !== "bath" && r.type !== "laundry") out.push({ text: `${nameOf(r)} is very small (${round(Math.abs(area(r.pts)), 1)} m²).`, sel: { t: "room", id: r.id } });
  }
  if (!f.openings.some((o) => o.main) && f.openings.some((o) => o.type === "door")) {
    const ext = f.openings.find((o) => o.type === "door" && ws.some((w) => w.exterior && openingsOn(w, [o]).length));
    if (ext) out.push({ text: "No main entrance is marked.", sel: { t: "op", id: ext.id }, fix: () => (ext.main = true), fixLabel: "Make it the main door" });
  }
  // openings that are not on a wall
  for (const o of f.openings) if (!ws.some((w) => openingsOn(w, [o]).length)) out.push({ text: `A ${o.type} is not on any wall.`, sel: { t: "op", id: o.id }, fix: () => (f.openings = f.openings.filter((x) => x !== o)), fixLabel: "Remove it" });
  // furniture outside every room, and walkways
  for (const it of f.items) {
    if (!f.rooms.some((r) => inside([it.x, it.y], r.pts))) out.push({ text: `${LIBRARY[it.kind]?.[0] || "A piece"} is outside the home.`, sel: { t: "item", id: it.id } });
  }
  // doors blocked by furniture
  for (const o of f.openings.filter((x) => x.type === "door")) {
    const block = f.items.find((it) => { const d = dims(it); if (d.mount !== "floor" || it.kind === "rug") return false; return Math.hypot(it.x - o.x, it.y - o.y) < o.width / 2 + Math.min(d.w, d.d) / 2 + 0.15; });
    if (block) out.push({ text: `${LIBRARY[block.kind]?.[0] || "Furniture"} is blocking a door.`, sel: { t: "item", id: block.id } });
  }
  // devices with no Home Assistant link
  const unlinked = f.devices.filter((d) => !d.entity);
  if (unlinked.length) out.push({ text: `${unlinked.length} device${unlinked.length > 1 ? "s are" : " is"} not linked to Home Assistant yet. They show a demo state.`, sel: { t: "dev", id: unlinked[0].id } });
  if (f.height < 2.4) out.push({ text: "The ceiling is lower than 2.4 m." });
  void plan;
  return out;
}
