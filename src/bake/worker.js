// The light bake, run in the background. For every surface point it works out:
//  - direct light from each lamp (with soft shadows) and from the sun at several times of day,
//  - light from the sky through each window,
//  - light bouncing off walls, floors and furniture (several bounces).
// Each lamp, window and sun position is kept as its own layer, so they can be mixed later instantly.
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

let S = null; // state for this worker

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const ray = new THREE.Ray(), o = new THREE.Vector3(), d = new THREE.Vector3();

function init(m) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(m.vpos, 3));
  geo.setIndex(new THREE.BufferAttribute(m.index, 1));
  const bvh = m.index.length ? new MeshBVH(geo, { targetLeafSize: 8 }) : null;
  S = { ...m, geo, bvh, idx: geo.index.array };
  S.L = m.lights.length + m.windows.length + 1 + m.sunDirs.length;
  S.lOff = 0; S.wOff = m.lights.length; S.skyOff = m.lights.length + m.windows.length; S.sOff = S.skyOff + 1;
}
function blocked(px, py, pz, dx, dy, dz, far) {
  if (!S.bvh) return false;
  ray.origin.set(px, py, pz); ray.direction.set(dx, dy, dz);
  return !!S.bvh.raycastFirst(ray, THREE.DoubleSide, 0, far);
}
// emission of a lamp towards a direction (dy = vertical part of the direction from the lamp), per lumen
function emission(L, dy) {
  if (L.cone) { const c = Math.cos(L.cone); if (-dy < c) return 0; const k = Math.min(1, (-dy - c) / 0.08); return k / (2 * Math.PI * (1 - c)); }
  const down = L.down, lam = Math.max(0, -dy) / Math.PI, omni = 1 / (4 * Math.PI);
  return down * lam + (1 - down) * omni;
}

function direct([v0, v1]) {
  const { pos, nrm, lights, sunDirs, L } = S, D = new Float32Array((v1 - v0) * L * 3), r = rng(v0 * 7 + 3);
  const SAMPLES = 8;
  for (let v = v0; v < v1; v++) {
    if ((v - v0) % 1500 === 0) postMessage({ cmd: "progress", phase: 0, f: (v - v0) / (v1 - v0) });
    const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2], nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    const ox = px + nx * 0.01, oy = py + ny * 0.01, oz = pz + nz * 0.01, base = (v - v0) * L * 3;
    lights.forEach((Lt, li) => {
      const cx = Lt.p[0] - px, cy = Lt.p[1] - py, cz = Lt.p[2] - pz, dist = Math.hypot(cx, cy, cz);
      if (dist > 14 || cx * nx + cy * ny + cz * nz <= -Lt.r * 2) return;
      let e = 0;
      for (let s = 0; s < SAMPLES; s++) {
        // a point on the lamp (soft shadows come from its size)
        const a = 2 * Math.PI * ((s + r()) / SAMPLES), rr = Lt.r * Math.sqrt(r());
        const lx = Lt.p[0] + Math.cos(a) * rr, ly = Lt.p[1] + (r() - 0.5) * Lt.r * 0.5, lz = Lt.p[2] + Math.sin(a) * rr;
        let dx = lx - ox, dy = ly - oy, dz = lz - oz; const dd = Math.hypot(dx, dy, dz); if (dd < 0.02) continue;
        dx /= dd; dy /= dd; dz /= dd;
        const cos = dx * nx + dy * ny + dz * nz; if (cos <= 0) continue;
        const em = emission(Lt, -dy); if (!em) continue;
        if (blocked(ox, oy, oz, dx, dy, dz, dd - 0.03)) continue;
        e += (em * cos) / Math.max(dd * dd, 0.04);
      }
      e /= SAMPLES; if (e) { const k = base + li * 3; D[k] = D[k + 1] = D[k + 2] = e; }
    });
    // sky through each window, measured directly like a soft area light (no speckle)
    S.windows.forEach((w, wi) => {
      const nx2 = w.n[0], nz2 = w.n[2], ux = w.u[0], uz = w.u[2], A = 4 * w.hw * w.hh, WS = 5;
      let e = 0;
      for (let i = 0; i < WS; i++) for (let j = 0; j < WS; j++) {
        const a = ((i + r()) / WS) * 2 - 1, b = ((j + r()) / WS) * 2 - 1;
        const qx = w.c[0] + ux * a * w.hw, qy = w.c[1] + b * w.hh, qz = w.c[2] + uz * a * w.hw;
        let dx = qx - ox, dy = qy - oy, dz = qz - oz; const dd = Math.hypot(dx, dy, dz); if (dd < 0.05) continue;
        dx /= dd; dy /= dd; dz /= dd;
        const cr = dx * nx + dy * ny + dz * nz; if (cr <= 0) continue;
        const cw = Math.abs(dx * nx2 + dz * nz2); if (cw < 1e-3) continue;
        // the window opening has some depth: stop just short of its middle
        if (blocked(ox, oy, oz, dx, dy, dz, Math.max(0.01, dd - 0.15))) continue;
        e += (dy < -0.05 ? 0.3 : 1) * cr * cw * A / (dd * dd * WS * WS);
      }
      if (e) { const k = base + (S.wOff + wi) * 3; D[k] = D[k + 1] = D[k + 2] = e; }
    });
    // sunlight (per lux), only where the sun can reach through a window
    sunDirs.forEach((sd, si) => {
      const cos = sd[0] * nx + sd[1] * ny + sd[2] * nz; if (cos <= 0) return;
      if (blocked(ox, oy, oz, sd[0], sd[1], sd[2], 60)) return;
      const k = base + (S.sOff + si) * 3; D[k] = D[k + 1] = D[k + 2] = cos;
    });
  }
  return D;
}

// windows: which window (if any) a ray that left the house passed through
function windowOf(px, py, pz, dx, dy, dz) {
  let best = -1, bt = 1e9;
  S.windows.forEach((w, i) => {
    const den = dx * w.n[0] + dy * w.n[1] + dz * w.n[2]; if (Math.abs(den) < 1e-4) return;
    const t = ((w.c[0] - px) * w.n[0] + (w.c[1] - py) * w.n[1] + (w.c[2] - pz) * w.n[2]) / den; if (t <= 0 || t > bt) return;
    const hx = px + dx * t - w.c[0], hy = py + dy * t - w.c[1], hz = pz + dz * t - w.c[2];
    if (Math.abs(hx * w.u[0] + hz * w.u[2]) <= w.hw + 0.12 && Math.abs(hy) <= w.hh + 0.12) { best = i; bt = t; }
  });
  return best;
}

// shoot rays around each point once and remember what they hit; the bounces reuse them
function trace([v0, v1]) {
  const { pos, nrm, L, rays } = S, r = rng(v0 * 13 + 11), n = v1 - v0;
  const hitA = new Int32Array(n * rays).fill(-1), hitB = new Int32Array(n * rays), hitC = new Int32Array(n * rays), hitU = new Float32Array(n * rays * 2);
  const Esc = new Float32Array(n * L * 3);
  const ground = S.sunDirs.map((sd) => (0.22 / Math.PI) * Math.max(0, sd[1]));
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  for (let v = v0; v < v1; v++) {
    if ((v - v0) % 1500 === 0) postMessage({ cmd: "progress", phase: 1, f: (v - v0) / (v1 - v0) });
    const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2], nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    // a frame around the normal for cosine-weighted directions
    t1.set(Math.abs(nx) > 0.9 ? 0 : 1, Math.abs(nx) > 0.9 ? 1 : 0, 0).cross(d.set(nx, ny, nz)).normalize(); t2.copy(d).cross(t1);
    const ox = px + nx * 0.01, oy = py + ny * 0.01, oz = pz + nz * 0.01;
    for (let k = 0; k < rays; k++) {
      // stratified cosine-weighted direction
      const sq = Math.ceil(Math.sqrt(rays)), u1 = ((k % sq) + r()) / sq, u2 = (Math.floor(k / sq) + r()) / sq;
      const rr = Math.sqrt(Math.min(1, u1)), ph = 2 * Math.PI * u2, a = rr * Math.cos(ph), b = rr * Math.sin(ph), c = Math.sqrt(Math.max(0, 1 - a * a - b * b));
      const dx = t1.x * a + t2.x * b + nx * c, dy = t1.y * a + t2.y * b + ny * c, dz = t1.z * a + t2.z * b + nz * c;
      const slot = (v - v0) * rays + k;
      let hit = null;
      if (S.bvh) { ray.origin.set(ox, oy, oz); ray.direction.set(dx, dy, dz); hit = S.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 80); }
      if (hit) {
        if (hit.face.normal.x * dx + hit.face.normal.y * dy + hit.face.normal.z * dz < 0) {
          hitA[slot] = hit.face.a; hitB[slot] = hit.face.b; hitC[slot] = hit.face.c; hitU[slot * 2] = hit.barycoord.y; hitU[slot * 2 + 1] = hit.barycoord.z;
        } else hitA[slot] = -2; // hit the back of something: no light
        continue;
      }
      // left the house: sky light through a window, or open sky (balconies, gardens)
      hitA[slot] = -3;
      const w = windowOf(ox, oy, oz, dx, dy, dz), base = (v - v0) * L * 3;
      // through a window: already measured directly; open sky (balconies, gardens) is counted here
      if (w < 0) { const layer = S.skyOff, wt = (Math.PI / rays) * (dy < 0 ? 0.3 : 1); Esc[base + layer * 3] += wt; Esc[base + layer * 3 + 1] += wt; Esc[base + layer * 3 + 2] += wt; }
      // the ground outside, lit by the sun, shines back up through low windows
      if (dy < 0) ground.forEach((g, si) => { const q = base + (S.sOff + si) * 3; const add = (Math.PI / rays) * g; Esc[q] += add; Esc[q + 1] += add; Esc[q + 2] += add; });
    }
  }
  S.hits = { v0, v1, hitA, hitB, hitC, hitU, Esc };
}

// one bounce: light arriving at each point = sky + what the hit surfaces reflect
function pass(E) {
  const { v0, v1, hitA, hitB, hitC, hitU, Esc } = S.hits, { L, rays, alb } = S, n = v1 - v0, G = Esc.slice();
  for (let v = 0; v < n; v++) {
    const base = v * L * 3;
    for (let k = 0; k < rays; k++) {
      const slot = v * rays + k, a = hitA[slot]; if (a < 0) continue;
      const b = hitB[slot], c = hitC[slot], wb = hitU[slot * 2], wc = hitU[slot * 2 + 1], wa = 1 - wb - wc;
      const pa = S.rep[a], pb = S.rep[b], pcc = S.rep[c];
      const ar = (alb[pa * 3] * wa + alb[pb * 3] * wb + alb[pcc * 3] * wc) / rays, ag = (alb[pa * 3 + 1] * wa + alb[pb * 3 + 1] * wb + alb[pcc * 3 + 1] * wc) / rays, ab = (alb[pa * 3 + 2] * wa + alb[pb * 3 + 2] * wb + alb[pcc * 3 + 2] * wc) / rays;
      const A = pa * L * 3, B = pb * L * 3, C = pcc * L * 3;
      for (let l = 0; l < L; l++) {
        const j = l * 3;
        const er = E[A + j] * wa + E[B + j] * wb + E[C + j] * wc, eg = E[A + j + 1] * wa + E[B + j + 1] * wb + E[C + j + 1] * wc, eb = E[A + j + 2] * wa + E[B + j + 2] * wb + E[C + j + 2] * wc;
        if (er === 0 && eg === 0 && eb === 0) continue;
        G[base + j] += ar * er; G[base + j + 1] += ag * eg; G[base + j + 2] += ab * eb;
      }
    }
  }
  return G;
}

self.onmessage = (ev) => {
  const m = ev.data;
  try {
    if (m.cmd === "init") { init(m); const D = direct(m.range); postMessage({ cmd: "direct", D }, [D.buffer]); trace(m.range); postMessage({ cmd: "traced" }); }
    else if (m.cmd === "pass") { const G = pass(m.E); postMessage({ cmd: "pass", G }, [G.buffer]); }
  } catch (err) { postMessage({ cmd: "error", error: String(err?.stack || err) }); }
};
