import assert from "node:assert";
import { SAMPLES } from "../src/samples.js";
import { overlaps, settle, push } from "../src/collide.js";
for (const s of SAMPLES) for (const f of s.make().floors) {
  const o = overlaps(f.items);
  assert.equal(o.length, 0, `${s.id}: ${o.map(([a, b]) => `${a.kind} and ${b.kind}`).join(", ")} overlap`);
}
// a table dropped onto a sofa slides out; a chair may tuck under a dining table
const sofa = { id: "a", kind: "sofa", x: 0, y: 0, rot: 0 }, table = { id: "b", kind: "coffee_table", x: 0.3, y: 0.2, rot: 0 };
assert(push(sofa, table)); assert(settle(table, [sofa, table])); assert(!push(sofa, table), "table moved clear");
assert(!push({ id: "t", kind: "dining_table", x: 0, y: 0, rot: 0 }, { id: "c", kind: "dining_chair", x: 0.5, y: 0.35, rot: 180 }), "chairs tuck under tables");
// turned pieces: a sofa at 90° next to a table
assert(!push({ id: "s", kind: "sofa", x: 0, y: 0, rot: 90 }, { id: "t", kind: "coffee_table", x: 1.2, y: 0, rot: 0 }), "turned sofa clear of the table");
console.log("collide: all passed");
