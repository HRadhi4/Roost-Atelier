// Drawing with lines: every space a line closes becomes an area.
import assert from "node:assert/strict";
import { drawLine } from "../src/areas.js";
import { rect, area } from "../src/model.js";
let n = 0; const id = () => "n" + ++n;
const A = { id: "A", name: "Living", type: "living", pts: rect(0, 0, 6, 4), walls: { 1: "marble" } };
const B = { id: "B", name: "Bed", type: "bedroom", pts: rect(6, 0, 4, 4) };
const sizes = (r) => r.rooms.map((x) => +area(x.pts).toFixed(2));
let r = drawLine([A, B], [[2, 0], [2, 4]], false, id);
assert.deepEqual(sizes(r), [16, 8, 16]); assert.equal(r.rooms[0].id, "A"); assert.equal(r.rooms[0].name, "Living"); assert.equal(r.rooms[1].type, "living"); assert.deepEqual(r.rooms[0].walls, { 1: "marble" });
r = drawLine([A, B], [[0, 2], [3, 2], [3, 4]], false, id); assert.deepEqual(sizes(r), [18, 6, 16]); assert.equal(r.rooms[0].pts.length, 6);
r = drawLine([A, B], [[0, 2], [10, 2]], false, id); assert.deepEqual(r.split, ["A", "B"]); assert.equal(r.rooms.length, 4);
r = drawLine([A, B], [[0, 4], [0, 7], [6, 7], [6, 4]], false, id); assert.deepEqual(sizes(r), [24, 16, 18]);
r = drawLine([A, B], [[20, 0], [24, 0], [24, 3], [20, 3]], true, id); assert.deepEqual(sizes(r), [24, 16, 12]);
r = drawLine([A, B], [[1, 1], [2, 1], [2, 2], [1, 2]], true, id); assert.deepEqual(sizes(r), [24, 16, 1]);
r = drawLine([A, B], [[2, 0], [2, 3]], false, id); assert.equal(r.made.length, 0);
r = drawLine([A, B], [[2, -1], [2, 5]], false, id); assert.deepEqual(sizes(r), [16, 8, 16]);
r = drawLine([], [[0, 0], [3, 0], [3, 3], [0, 3]], true, id); assert.deepEqual(sizes(r), [9]);
console.log("areas: all passed");
