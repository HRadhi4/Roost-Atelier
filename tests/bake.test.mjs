import assert from "node:assert";
import { sunKeys, sunDir, encode, decode } from "../src/bake/index.js";
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
// the small light file (RAB2) comes back within a few percent of the light that was stored
{
  const n = 5000, L = 3, E = new Float32Array(n * L * 3);
  for (let i = 0; i < E.length; i++) E[i] = i % 7 === 0 ? 0 : Math.exp((Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * 12 - 8);
  const buf = encode({ n, L, layers: [], stats: { mean: [] } }, E), small = new Uint8Array(buf);
  assert.deepEqual([...small.slice(0, 4)], [82, 65, 66, 50], "new files are RAB2");
  const { meta, bytes } = decode(buf);
  let worst = 0, sumErr = 0, cnt = 0;
  for (let l = 0; l < L; l++) for (let k = 0; k < n; k++) {
    const o = ((Math.floor(k / meta.W) + l * meta.R) * meta.W + (k % meta.W)) * 4, e = bytes[o + 3];
    for (let c = 0; c < 3; c++) {
      const want = E[(k * L + l) * 3 + c], got = e ? (bytes[o + c] / 255) * 2 ** (e - 136) : 0;
      const sum = E[(k * L + l) * 3] + E[(k * L + l) * 3 + 1] + E[(k * L + l) * 3 + 2];
      if (sum > 1e-4) { const er = Math.abs(got - want) / sum; worst = Math.max(worst, er); sumErr += er; cnt++; }
    }
  }
  assert(worst < 0.06 && sumErr / cnt < 0.012, `light close to the original (worst ${worst.toFixed(4)}, average ${(sumErr / cnt).toFixed(4)})`);
  // an old RAB1 file still opens as it is
  const old = new Uint8Array(8 + 2 + 4); old.set([82, 65, 66, 49]); new DataView(old.buffer).setUint32(4, 2, true); old.set([123, 125], 8);
  assert(decode(old.buffer).bytes.length === 4, "old light files still open");
  assert.equal(decode(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0]).buffer), null, "not a light file");
}
console.log("bake: all passed");
