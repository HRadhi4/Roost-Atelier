// The fast probe grouping must group and number points exactly like the old text labels (stored light stays valid).
import { probeKey } from "../src/bake/prepare.js";
const PROBE = 0.06, n = 200000, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
let s = 7; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let k = 0; k < n; k++) {
  const src = k > 10 && r() < 0.6 ? Math.floor(r() * k) : -1; // many points share a spot, as in real homes
  for (let c = 0; c < 3; c++) pos[k * 3 + c] = src >= 0 ? pos[src * 3 + c] + (r() - 0.5) * 0.03 : (r() - 0.5) * 30;
  const v = [r() - 0.5, r() - 0.5, r() - 0.5], l = Math.hypot(...v); for (let c = 0; c < 3; c++) nrm[k * 3 + c] = src >= 0 && r() < 0.8 ? nrm[src * 3 + c] : v[c] / l;
}
const old = (k) => `${Math.round(pos[k * 3] / PROBE)},${Math.round(pos[k * 3 + 1] / PROBE)},${Math.round(pos[k * 3 + 2] / PROBE)}|${Math.round(nrm[k * 3] * 2)},${Math.round(nrm[k * 3 + 1] * 2)},${Math.round(nrm[k * 3 + 2] * 2)}`;
const group = (key) => { const m = new Map(), out = new Int32Array(n); for (let k = 0; k < n; k++) { const q = key(k); let v = m.get(q); if (v === undefined) { v = m.size; m.set(q, v); } out[k] = v; } return out; };
let t = performance.now(); const A = group(old); const tOld = performance.now() - t;
t = performance.now(); const B = group((k) => probeKey(pos, nrm, k)); const tNew = performance.now() - t;
for (let k = 0; k < n; k++) if (A[k] !== B[k]) { console.error("probe numbering differs at", k); process.exit(1); }
console.log(`probes: same numbering, ${Math.round(tOld)} ms before, ${Math.round(tNew)} ms now`);
