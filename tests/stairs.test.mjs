// Stairs between two levels: built from where they start and where they arrive, with an opening above.
import assert from "node:assert/strict";
import { stairFrom, stairHole, clipTo, minRun, riseTo, buildStairs, STAIR_STYLES } from "../src/stairs.js";

const plan = { floors: [{ height: 2.8, elevation: 0 }, { height: 2.8, elevation: 3.1 }] };
assert.equal(riseTo(plan, 0), 3.1);
// straight: from (1, 4.2) up to (1, 0.6): the flight runs between them, top towards the arrival
const s = stairFrom([1, 4.2], [1, 0.4], "iron", 3.1);
assert.ok(Math.abs(s.d - 3.8) < 0.01 && s.x === 1 && Math.abs(s.y - 2.3) < 0.01 && !s.short, JSON.stringify(s));
const hole = stairHole({ ...s, kind: "stairs" }), ys = hole.map((p) => p[1]);
assert.ok(Math.min(...ys) < 0.45 && Math.max(...ys) < 4.0, "the opening is over the top of the flight: " + JSON.stringify(hole));
// too short a flight is made long enough to climb comfortably
const short = stairFrom([0, 0], [0, -1], "wood", 3.1);
assert.ok(short.short && short.d >= minRun(3.1) - 1e-9);
// round: stands where tapped first
const r = stairFrom([2, 2], [3, 2], "spiral", 3.1);
assert.ok(r.x === 2 && r.y === 2 && r.w === r.d);
// an opening that pokes out of a room is cut to the room
const c = clipTo([[-1, -1], [1, -1], [1, 1], [-1, 1]], [[0, 0], [4, 0], [4, 4], [0, 4]]);
assert.ok(c && c.every(([x, y]) => x >= -1e-9 && y >= -1e-9));
// every style builds
for (const st of Object.keys(STAIR_STYLES)) assert.ok(buildStairs({ style: st, w: 1.2, d: st === "spiral" ? 1.8 : 4, h: 3.1 }).children.length > 5, st);
console.log("stairs: all passed");
