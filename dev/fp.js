import * as THREE from "three";
import { LIBRARY, build, dims } from "../src/furniture.js";
const out = [];
for (const kind of Object.keys(LIBRARY)) {
  const it = { id: "x", kind, x: 0, y: 0, rot: 0 }, g = build(it), d = dims(it);
  g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3());
  const ox = Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) - d.w / 2, oz = Math.max(Math.abs(b.min.z), Math.abs(b.max.z)) - d.d / 2;
  if (ox > 0.05 || oz > 0.05) out.push(`${kind}: footprint ${d.w}x${d.d}, drawn x ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)} z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}`);
}
window.result = out.length ? out.join("\n") : "all pieces inside their footprint";
