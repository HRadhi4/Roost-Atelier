// Every fitting in the library builds, and its light comes from a real place pointing a real way.
import assert from "node:assert/strict";
import { LIGHT_SUBS } from "../src/devices.js";
import { emittersFor, lampModel, anchorOf } from "../src/lights.js";

const room = { pts: [[0, 0], [5, 0], [5, 4], [0, 4]] };
for (const [k, [look, opts]] of Object.entries(LIGHT_SUBS)) {
  const dv = { x: 2, y: 2, rot: 90, ...opts, look };
  const em = emittersFor(dv, look, 2.8, room);
  const g = lampModel(dv, look);
  if (em) {
    assert.ok(em.length > 0, k);
    for (const e of em) { assert.ok(e.p.every(Number.isFinite) && e.dir.every(Number.isFinite), k); assert.ok(Math.abs(Math.hypot(...e.dir) - 1) < 1e-6, `${k} dir`); assert.ok(e.p[1] >= 0 && e.p[1] <= 2.8, `${k} height ${e.p[1]}`); }
    assert.ok(g.children.length > 0, `${k} has a model`);
    const a = anchorOf(dv, look, 2.8); assert.ok(["ceiling", "wall", "floor"].includes(a.mount), k);
  }
}
// a wall light faces into the room: rot 90 faces +x
const wl = emittersFor({ x: 0, y: 2, rot: 90, look: "wall", style: "reading" }, "wall", 2.8, room)[0];
assert.ok(wl.p[0] > 0.1, "the reading arm reaches into the room");
console.log("lights: all passed");
