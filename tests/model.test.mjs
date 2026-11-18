import { walls, openingsOn, area, validate, nearestWall } from "../src/model.js";
import { SAMPLES } from "../src/samples.js";
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
for (const s of SAMPLES) {
  const p = validate(s.make()), f = p.floors[0], ws = walls(f);
  ok(ws.length > 6, `${s.id}: walls ${ws.length}`);
  for (const r of f.rooms) ok(Math.abs(area(r.pts)) > 1, `${s.id}: room ${r.name} area`);
  const ids = new Set(f.rooms.map((r) => r.id));
  for (const op of f.openings) { const on = ws.filter((w) => openingsOn(w, [op]).length); ok(on.length >= 1, `${s.id}: opening ${op.type} at ${op.x},${op.y} sits on a wall`); }
  const ext = ws.filter((w) => w.exterior).length, int = ws.filter((w) => w.rooms.length === 2).length;
  ok(ext > 3 && int >= 2, `${s.id}: exterior ${ext} interior ${int}`);
  ok(ids.size === f.rooms.length, "unique ids");
  console.log(s.id, "walls", ws.length, "exterior", ext, "shared", int);
}
const p = SAMPLES[0].make(); ok(nearestWall(p.floors[0], [0.1, 2])?.w, "nearest wall");
console.log(fails ? `${fails} failed` : "model: all passed"); process.exit(fails ? 1 : 0);
