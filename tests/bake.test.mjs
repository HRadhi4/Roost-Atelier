import assert from "node:assert";
import { sunKeys, sunDir } from "../src/bake/index.js";
import { bakeHash } from "../src/bake/prepare.js";
import { SAMPLES } from "../src/samples.js";
// the sun's path in Bahrain in June and December: rises in the east, highest at noon in the south
for (const [m, maxEl] of [[5, 87], [11, 41]]) {
  const k = sunKeys(26, new Date(2026, m, 21));
  assert(k.length >= 5, "enough sun positions");
  const noon = k.reduce((a, b) => (b.el > a.el ? b : a));
  assert(Math.abs(noon.el - maxEl) < 6, `noon height ${noon.el} near ${maxEl}`);
  assert(k[0].az < 130 && k[k.length - 1].az > 230, "east in the morning, west in the evening");
}
const d = sunDir(180, 45); assert(Math.abs(Math.hypot(...d) - 1) < 1e-9 && d[2] > 0, "south is +z on the plan");
// switching lamps or renaming must not ask for a new bake; moving furniture must
const f = SAMPLES[0].make().floors[0], h0 = bakeHash(f, {});
f.devices[0].entity = "light.x"; f.devices[0].name = "New"; f.devices[0].lumens = 3000; f.devices[0].kelvin = 4000;
assert.equal(bakeHash(f, {}), h0, "lamp settings don't need a bake");
f.items[0].x += 0.5; assert.notEqual(bakeHash(f, {}), h0, "moving furniture needs a bake");
console.log("bake: all passed");
