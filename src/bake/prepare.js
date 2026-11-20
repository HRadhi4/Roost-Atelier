// Gathers every surface of the home for the light bake: where each point is, which way it faces and
// what colour it is. Every surface point gets a number (its "bake id") so the stored light can be found
// again later. The order is fixed, so the same home always gets the same numbers on every device.
import * as THREE from "three";

export const BAKE_VERSION = 10;
const PROBE = 0.06; // points closer than this (and facing the same way) share one light value

const _avg = new Map();
// the average colour of a texture, in linear light
function textureAverage(tex) {
  const img = tex?.image; if (!img) return [1, 1, 1];
  const key = img; if (_avg.has(key)) return _avg.get(key);
  let out = [1, 1, 1];
  try {
    const c = (typeof OffscreenCanvas !== "undefined") ? new OffscreenCanvas(8, 8) : Object.assign(document.createElement("canvas"), { width: 8, height: 8 });
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const lin = (v) => { v /= 64 * 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    out = [lin(r), lin(g), lin(b)];
  } catch { /* image not ready: treat as white */ }
  _avg.set(key, out); return out;
}
export function albedoOf(m) {
  if (!m) return [0.5, 0.5, 0.5];
  const c = m.color || new THREE.Color(1, 1, 1), t = m.map ? textureAverage(m.map) : [1, 1, 1], k = 1 - (m.metalness || 0) * 0.85;
  return [Math.min(0.92, c.r * t[0] * k), Math.min(0.92, c.g * t[1] * k), Math.min(0.92, c.b * t[2] * k)];
}

// Light shapes: how much of the lamp's light goes in each direction
export const LIGHT_PROFILE = { pendant: { r: 0.14, down: 0.75 }, chandelier: { r: 0.25, down: 0.35 }, spots: { r: 0.04, down: 1, cone: 0.55 }, flush: { r: 0.2, down: 1 }, floor: { r: 0.15, down: 0.45 } };

// what takes part in the bake: receivers get light, occluders block it
function roleOf(o) {
  const u = o.userData;
  if (!o.isMesh || u.noBake || u.glass || o.material?.isShadowMaterial || o.material?.transparent && o.material.opacity < 0.9) return null;
  let p = o, inDevice = false, leaf = false, exterior = false;
  while (p) { if (p.userData?.device) inDevice = true; if (p.name === "leaf") leaf = true; if (p.userData?.exterior) exterior = true; p = p.parent; }
  if (inDevice) return null;
  return { receive: true, occlude: !leaf || exterior };
}

// engine: the AtelierEngine after setPlan. Returns everything the bake needs.
export function prepare(engine) {
  const recv = [], seenGeo = new Set();
  const roots = [engine.rooms, engine.ceilings, engine.wallsG, engine.items];
  // doors are measured closed, whatever they are doing right now, so every device counts the same points
  const leaves = []; engine.wallsG.traverse((o) => { if (o.name === "leaf") { leaves.push([o, o.rotation.y]); o.rotation.y = 0; } });
  engine.scene.updateMatrixWorld(true);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (const root of roots) root.traverse((o) => {
    const r = roleOf(o); if (!r) return;
    if (o.userData.wall) {
      // walls have a full-height shape and a waist-height (cut) shape; both get light
      const variants = [[o.userData.fullGeo || o.geometry, o.userData.fullY ?? o.position.y, true]];
      if (o.userData.cutGeo) variants.push([o.userData.cutGeo, o.userData.cutY, false]);
      for (const [geo, y, occ] of variants) {
        q.setFromEuler(o.rotation); p.set(o.position.x, y, o.position.z);
        recv.push({ mesh: o, geo, matrix: m4.clone().compose(p, q, s), occlude: occ && r.occlude });
      }
      return;
    }
    if (seenGeo.has(o.geometry)) { o.geometry = o.geometry.clone(); }
    seenGeo.add(o.geometry);
    recv.push({ mesh: o, geo: o.geometry, matrix: o.matrixWorld.clone(), occlude: r.occlude });
  });

  for (const [o, r] of leaves) o.rotation.y = r;
  engine.scene.updateMatrixWorld(true);
  // count vertices, give out ids
  let n = 0;
  for (const r of recv) { r.base = n; n += r.geo.attributes.position.count; }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), alb = new Float32Array(n * 3);
  // the blocking triangles, counted first so they go straight into one array (no growing lists)
  let triTotal = 0;
  for (const r of recv) if (r.occlude) triTotal += r.geo.index ? r.geo.index.count : r.geo.attributes.position.count;
  const tris = new Uint32Array(triTotal); let tn = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  const rooms = engine.floor.rooms.filter((x) => x.pts?.length >= 3);
  for (const r of recv) {
    const g = r.geo, P = g.attributes.position, N = g.attributes.normal, cnt = P.count;
    nm.getNormalMatrix(r.matrix);
    const ids = new Float32Array(cnt);
    for (let i = 0; i < cnt; i++) {
      const k = r.base + i; ids[i] = k;
      v.fromBufferAttribute(P, i).applyMatrix4(r.matrix); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nrm[k * 3] = v.x; nrm[k * 3 + 1] = v.y; nrm[k * 3 + 2] = v.z; }
    }
    g.setAttribute("bakeId", new THREE.BufferAttribute(ids, 1));
    // colour of each point from the material of its triangles
    const mats = Array.isArray(r.mesh.material) ? r.mesh.material : [r.mesh.material];
    const idx = g.index ? g.index.array : null, triCount = (idx ? idx.length : cnt) / 3;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.length : cnt, materialIndex: 0 }];
    for (const grp of groups) {
      const a = albedoOf(mats[grp.materialIndex] || mats[0]);
      const a0 = a[0], a1 = a[1], a2 = a[2], end = Math.min(grp.start + grp.count, idx ? idx.length : cnt);
      for (let t = grp.start; t < end; t++) { const j = (r.base + (idx ? idx[t] : t)) * 3; alb[j] = a0; alb[j + 1] = a1; alb[j + 2] = a2; }
    }
    if (r.occlude) { const total = triCount * 3; for (let t = 0; t < total; t++) tris[tn++] = r.base + (idx ? idx[t] : t); }
  }
  // group points into probes
  const rep = new Int32Array(n), keyOf = new Map(), pp = new Float64Array(n * 3), pn = new Float64Array(n * 3), pa = new Float64Array(n * 3), pc = new Int32Array(n);
  let probes = 0;
  for (let k = 0; k < n; k++) {
    const key = probeKey(pos, nrm, k);
    let q = keyOf.get(key);
    if (q === undefined) { q = probes++; keyOf.set(key, q); }
    rep[k] = q; pc[q]++;
    for (let c = 0; c < 3; c++) { pp[q * 3 + c] += pos[k * 3 + c]; pn[q * 3 + c] += nrm[k * 3 + c]; pa[q * 3 + c] += alb[k * 3 + c]; }
  }
  const roomBox = rooms.map((r) => r.pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]));
  const m = probes, ppos = new Float32Array(m * 3), pnrm = new Float32Array(m * 3), palb = new Float32Array(m * 3), room = new Int32Array(m).fill(-1);
  for (let q = 0; q < m; q++) {
    const l = Math.hypot(pn[q * 3], pn[q * 3 + 1], pn[q * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) { ppos[q * 3 + c] = pp[q * 3 + c] / pc[q]; pnrm[q * 3 + c] = pn[q * 3 + c] / l; palb[q * 3 + c] = pa[q * 3 + c] / pc[q]; }
    // which room each probe belongs to (for per-room brightness)
    const x = ppos[q * 3], z = ppos[q * 3 + 2]; for (let i = 0; i < rooms.length; i++) { const bb = roomBox[i]; if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3]) continue; if (insidePoly(x, z, rooms[i].pts)) { room[q] = i; break; } }
  }
  // the stored light is looked up by probe number
  for (const r of recv) { const ids = r.geo.attributes.bakeId.array; for (let i = 0; i < ids.length; i++) ids[i] = rep[ids[i]]; r.geo.attributes.bakeId.needsUpdate = true; }

  // light sources
  const lights = [];
  for (const rec of engine.devices.values()) if (rec.kind === "light" && rec.lightPos) {
    const pr = LIGHT_PROFILE[rec.look] || LIGHT_PROFILE.flush;
    const em = rec.emitters || [{ p: rec.lightPos.toArray(), dir: [0, -1, 0], w: 1, ...pr }];
    const c = rec.lightPos.toArray(), span = Math.max(0, ...em.map((e) => Math.hypot(e.p[0] - c[0], e.p[1] - c[1], e.p[2] - c[2])));
    lights.push({ id: rec.dv.id, p: c, r: Math.max(...em.map((e) => e.r || 0.05)), span, em });
  }
  // windows and glass doors: openings in outside walls that let the sky in
  const windows = [];
  engine.wallsG.children.forEach((g) => {
    const op = g.userData.opening && engine.floor.openings.find((x) => x.id === g.userData.opening);
    if (!op || !g.userData.exterior || !(op.type === "window" || op.type === "slider" || op.type === "door" || op.type === "arch")) return;
    const u = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion), nn = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
    windows.push({ id: op.id, c: [g.position.x, op.sill + op.height / 2, g.position.z], u: u.toArray(), n: nn.toArray(), hw: g.userData.width / 2, hh: op.height / 2 });
  });
  // geometry (all points, for blocking light) and probes (where light is measured)
  return { recv, n: m, verts: n, pos: ppos, nrm: pnrm, alb: palb, room, rep, vpos: pos, index: tris, lights, windows, rooms: rooms.map((r) => r.id) };
}
// which probe a point belongs to: same cell of 6 cm and facing about the same way. A number (fast); the same
// grouping and order as the text labels used before, so stored light stays valid.
export function probeKey(pos, nrm, k) {
  const gx = Math.round(pos[k * 3] / PROBE), gy = Math.round(pos[k * 3 + 1] / PROBE), gz = Math.round(pos[k * 3 + 2] / PROBE);
  const a = Math.round(nrm[k * 3] * 2), b = Math.round(nrm[k * 3 + 1] * 2), c = Math.round(nrm[k * 3 + 2] * 2);
  if (Math.abs(gx) < 2048 && Math.abs(gy) < 2048 && Math.abs(gz) < 2048 && Math.abs(a) <= 2 && Math.abs(b) <= 2 && Math.abs(c) <= 2)
    return (((gx + 2048) * 4096 + (gy + 2048)) * 4096 + (gz + 2048)) * 125 + (a + 2) * 25 + (b + 2) * 5 + (c + 2);
  return `${gx},${gy},${gz}|${a},${b},${c}`;
}
function insidePoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

// a short fingerprint of everything that changes the light (not the on/off states)
export function bakeHash(floor, extra) {
  const keep = { h: floor.height, r: floor.rooms.map((r) => [r.pts, r.type, r.floor, r.wall, r.height, r.ceil, r.cornice, r.skirt, r.walls]), o: floor.openings, i: floor.items.map((i) => [i.kind, i.x, i.y, i.rot, i.w, i.d, i.h, i.color, i.mount, i.wood, i.metal, i.mat, i.round]),
    l: floor.devices.filter((d) => (d.kind || "light") === "light" && !d.entity?.match(/^(cover|climate|media_player|lock|person|fan|vacuum|binary_sensor)\./)).map((d) => [d.x, d.y, d.look, d.kind, d.len, d.heads, d.rot, d.tilt, d.aim, d.style, d.tx, d.ty, d.tz]), extra, v: BAKE_VERSION };
  const s = JSON.stringify(keep); let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13); }
  return ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0"));
}
