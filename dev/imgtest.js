import { fromImage } from "../src/recon.js";
import { SAMPLES } from "../src/samples.js";
import { walls, openingsOn, area, planBounds } from "../src/model.js";
const f = SAMPLES[0].make().floors[0], b = planBounds(f), S = 47; // px per metre (unknown to the importer)
const c = document.createElement("canvas"); c.width = (b.x1 - b.x0 + 2) * S; c.height = (b.y1 - b.y0 + 2) * S;
const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
const P = (p) => [(p[0] - b.x0 + 1) * S, (p[1] - b.y0 + 1) * S];
for (const w of walls(f)) { if (w.parapet) continue; const ops = openingsOn(w, f.openings), dx = w.b[0]-w.a[0], dy = w.b[1]-w.a[1], L = Math.hypot(dx,dy), ux=dx/L, uy=dy/L; let pos=0;
  const seg=(a,e)=>{x.strokeStyle="#111";x.lineWidth=w.thick*S;x.lineCap="square";x.beginPath();x.moveTo(...P([w.a[0]+ux*a,w.a[1]+uy*a]));x.lineTo(...P([w.a[0]+ux*e,w.a[1]+uy*e]));x.stroke();};
  for (const o of ops) { if (o.t0>pos) seg(pos,o.t0); if (o.op.type==="window"){x.strokeStyle="#111";x.lineWidth=1.5;x.beginPath();x.moveTo(...P([w.a[0]+ux*o.t0,w.a[1]+uy*o.t0]));x.lineTo(...P([w.a[0]+ux*o.t1,w.a[1]+uy*o.t1]));x.stroke();} pos=o.t1; } if (pos<L) seg(pos,L); }
x.lineWidth = 1.2; x.strokeStyle = "#333"; for (const it of f.items) { const [px,py]=P([it.x,it.y]); x.strokeRect(px-15,py-10,30,20); }
x.fillStyle="#222"; x.font="14px sans-serif"; for (const r of f.rooms) { const [px,py]=P(r.pts[0]); x.fillText(r.name, px+20, py+30); }
document.body.appendChild(c);
const t = performance.now(); const r = fromImage(c);
window.result = { ms: Math.round(performance.now()-t), rooms: r.rooms.length, ops: r.openings.length, size: r.size, areas: r.rooms.map(q=>Math.abs(area(q.pts)).toFixed(1)+"/"+q.pts.length).join(" ") };
