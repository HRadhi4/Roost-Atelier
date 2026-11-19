// Furniture is solid: two pieces can't share the same space. Footprints are turned rectangles; pieces
// at different heights (a shelf over a desk) or made to tuck in (chairs under tables) are allowed.
import { dims } from "./furniture.js";

const TUCK_IN = /^(dining_chair|bar_stool|office_chair|ottoman)$/, TUCK_UNDER = /^(dining_table|desk|kitchen_island|kitchen_base|console)$/;
const IGNORE = /^(rug|tree|plant|plant_small)$/; // rugs lie under things; leaves can brush past

export function box(it) {
  const d = dims(it), a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), z0 = d.mount === "wall" ? d.z : 0;
  return { x: it.x, y: it.y, hw: d.w / 2, hd: d.d / 2, ux: [c, -s], uz: [s, c], z0, z1: z0 + d.h, mount: d.mount };
}
// the solid parts of a piece: one rectangle, or two for an L-shaped corner sofa
function parts(it) {
  const B = box(it);
  if (it.kind !== "sofa_l") return [B];
  const at = (lx, lz) => [B.x + B.ux[0] * lx + B.uz[0] * lz, B.y + B.ux[1] * lx + B.uz[1] * lz];
  const D = 0.95, [bx, by] = at(0, -B.hd + D / 2), [cx, cy] = at(B.hw - 0.45, 0);
  return [{ ...B, x: bx, y: by, hd: D / 2 }, { ...B, x: cx, y: cy, hw: 0.45 }];
}
function canShare(a, b) {
  if (a.id === b.id || IGNORE.test(a.kind) || IGNORE.test(b.kind)) return true;
  if ((TUCK_IN.test(a.kind) && TUCK_UNDER.test(b.kind)) || (TUCK_IN.test(b.kind) && TUCK_UNDER.test(a.kind))) return true;
  const A = box(a), B = box(b);
  if (A.mount === "ceiling" || B.mount === "ceiling") return true;
  return A.z1 <= B.z0 + 0.01 || B.z1 <= A.z0 + 0.01;
}
// how far and which way b must move to stop overlapping a (null if they don't overlap)
export function push(a, b, gap = 0) {
  if (canShare(a, b)) return null;
  let worst = null;
  for (const A of parts(a)) for (const B of parts(b)) { const p = sat(A, B, gap); if (p && (!worst || p.depth > worst.depth)) worst = p; }
  return worst;
}
function sat(A, B, gap) {
  const dx = B.x - A.x, dy = B.y - A.y;
  let best = null;
  for (const n of [A.ux, A.uz, B.ux, B.uz]) {
    const rA = A.hw * Math.abs(A.ux[0] * n[0] + A.ux[1] * n[1]) + A.hd * Math.abs(A.uz[0] * n[0] + A.uz[1] * n[1]);
    const rB = B.hw * Math.abs(B.ux[0] * n[0] + B.ux[1] * n[1]) + B.hd * Math.abs(B.uz[0] * n[0] + B.uz[1] * n[1]);
    const dist = dx * n[0] + dy * n[1], over = rA + rB + gap - Math.abs(dist);
    if (over <= 1e-4) return null;
    if (!best || over < best.over) best = { over, n: dist >= 0 ? n : [-n[0], -n[1]] };
  }
  return { x: best.n[0] * best.over, y: best.n[1] * best.over, depth: best.over };
}
export function overlaps(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const p = push(items[i], items[j]); if (p && p.depth > 0.02) out.push([items[i], items[j], p]); }
  return out;
}
// slide `it` out of everything it overlaps; returns false if it can't find room
export function settle(it, items, gap = 0.01) {
  for (let k = 0; k < 8; k++) {
    let moved = false;
    for (const o of items) { if (o === it) continue; const p = push(o, it, gap); if (p) { it.x = Math.round((it.x + p.x) * 1000) / 1000; it.y = Math.round((it.y + p.y) * 1000) / 1000; moved = true; } }
    if (!moved) return true;
  }
  return !items.some((o) => o !== it && push(o, it));
}
