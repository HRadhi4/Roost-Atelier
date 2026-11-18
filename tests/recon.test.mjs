import { Grid, rooms } from "../src/recon.js";
import { SAMPLES } from "../src/samples.js";
import assert from "node:assert";
import { walls, openingsOn, planBounds, area } from "../src/model.js";
for (const s of SAMPLES) {
  const f = s.make().floors[0];
  const b = planBounds(f), g = new Grid(b.x0 - 1, b.y0 - 1, b.x1 + 1, b.y1 + 1);
  for (const w of walls(f)) {
    if (w.parapet) continue;
    const ops = openingsOn(w, f.openings), dx = w.b[0]-w.a[0], dy = w.b[1]-w.a[1], L = Math.hypot(dx,dy), ux=dx/L, uy=dy/L;
    let pos = 0; const seg=(a,c)=>g.line([w.a[0]+ux*a,w.a[1]+uy*a],[w.a[0]+ux*c,w.a[1]+uy*c],w.thick);
    for (const {t0,t1} of ops) { if (t0>pos) seg(pos,t0); pos=t1; } if (pos<L) seg(pos,L);
  }
  const t = performance.now(); const r = rooms(g);
  const want = { apartment: 7, villa: 5, studio: 3 }[s.id];
  assert(r.rooms.length >= want, `${s.id}: expected at least ${want} rooms, found ${r.rooms.length}`);
  assert(r.rooms.every((x) => x.pts.length <= 8), `${s.id}: room outlines should be clean`);
  const indoor = f.rooms.filter(x=>!["balcony","garden"].includes(x.type));
  console.log(s.id, "rooms in:", indoor.length, "found:", r.rooms.length, "openings in:", f.openings.length, "found:", r.openings.length, Math.round(performance.now()-t)+"ms");
  console.log("  areas in ", indoor.map(x=>Math.abs(area(x.pts)).toFixed(1)).sort().join(" "));
  console.log("  areas out", r.rooms.map(x=>Math.abs(area(x.pts)).toFixed(1)+"/"+x.pts.length).sort().join(" "));
}
console.log("recon: all passed");
