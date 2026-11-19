// Baked light: the home is lit once in the background (on the strongest device that opens it), the result
// is kept on the Home Assistant server, and from then on every lamp, window and the sun are mixed live.
// Switching, dimming or recolouring a lamp, opening a curtain or the sun moving never needs a new bake.
import * as THREE from "three";
import { prepare, bakeHash, BAKE_VERSION } from "./prepare.js";

const MAXL = 64, TEXW = 2048, RAYS = 96, PASSES = 3;
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ---------------------------------------------------------------- the sun's path today
export function sunKeys(lat = 26, date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0), N = Math.floor((date - start) / 864e5);
  const dec = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI * (284 + N)) / 365), phi = (lat * Math.PI) / 180, keys = [];
  for (let h = -90; h <= 90; h += 22.5) {
    const H = (h * Math.PI) / 180, se = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H), el = (Math.asin(se) * 180) / Math.PI;
    if (el < 3) continue;
    const az = ((Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) * 180) / Math.PI + 180 + 360) % 360;
    keys.push({ az: Math.round(az * 10) / 10, el: Math.round(el * 10) / 10 });
  }
  return keys;
}
export function sunDir(az, el, northDeg = 0) {
  const a = (az * Math.PI) / 180 + (northDeg * Math.PI) / 180, e = (el * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

// ---------------------------------------------------------------- shared shader pieces
const U = { bakeTex: { value: null }, bakeW: { value: Array.from({ length: MAXL }, () => new THREE.Vector3()) }, bakeLayers: { value: 0 }, bakeRows: { value: 1 }, bakeWidth: { value: TEXW }, bakeRoomGain: { value: new Array(33).fill(1) } };
let PATCHED_BEGIN = null;
function patchedBegin() {
  if (PATCHED_BEGIN) return PATCHED_BEGIN;
  const B = THREE.ShaderChunk.lights_fragment_begin, call = "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
  const i0 = B.indexOf("NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )"), i1 = B.indexOf(call, i0);
  // lamps: their light on surfaces comes from the bake; they only add their shine (reflections) live
  PATCHED_BEGIN = i0 < 0 || i1 < 0 ? B : B.slice(0, i1) + `{ vec3 bakedKeep = reflectedLight.directDiffuse; ${call} reflectedLight.directDiffuse = bakedKeep; }` + B.slice(i1 + call.length);
  return PATCHED_BEGIN;
}
const bakedCache = new Map();
function bakedMaterial(m) {
  if (bakedCache.has(m)) return bakedCache.get(m);
  const b = m.clone();
  b.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
attribute float bakeId; attribute float bakeRoom;
uniform highp sampler2D bakeTex; uniform vec3 bakeW[${MAXL}]; uniform int bakeLayers; uniform int bakeRows; uniform int bakeWidth; uniform float bakeRoomGain[33];
varying vec3 vBaked;`).replace("#include <begin_vertex>", `#include <begin_vertex>
{ int bid = int(bakeId + 0.5), bx = bid % bakeWidth, by = bid / bakeWidth; vec3 e = vec3(0.0);
  for (int l = 0; l < ${MAXL}; l++) { if (l >= bakeLayers) break; vec4 t = texelFetch(bakeTex, ivec2(bx, by + l * bakeRows), 0); if (t.a > 0.0) e += t.rgb * exp2(t.a * 255.0 - 136.0) * bakeW[l]; }
  vBaked = e * bakeRoomGain[int(bakeRoom + 0.5)]; }`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vBaked;")
      .replace("#include <lights_fragment_begin>", patchedBegin())
      .replace("#include <lights_fragment_maps>", "#include <lights_fragment_maps>\niblIrradiance = vBaked;");
  };
  b.customProgramCacheKey = () => "roost-baked";
  bakedCache.set(m, b); return b;
}

// ---------------------------------------------------------------- file format
function encode(meta, data /* Float32 n*L*3 */) {
  const { n, L } = meta, R = Math.ceil(n / TEXW), bytes = new Uint8Array(TEXW * R * L * 4);
  for (let l = 0; l < L; l++) for (let k = 0; k < n; k++) {
    const i = (k * L + l) * 3, r = data[i], g = data[i + 1], b = data[i + 2], m = Math.max(r, g, b);
    const o = ((Math.floor(k / TEXW) + l * R) * TEXW + (k % TEXW)) * 4;
    if (!(m > 1e-12)) continue;
    const e = Math.ceil(Math.log2(m)), s = 255 / 2 ** e;
    bytes[o] = Math.round(r * s); bytes[o + 1] = Math.round(g * s); bytes[o + 2] = Math.round(b * s); bytes[o + 3] = Math.max(1, Math.min(255, e + 136));
  }
  const head = new TextEncoder().encode(JSON.stringify({ ...meta, W: TEXW, R })), out = new Uint8Array(8 + head.length + bytes.length);
  out.set([82, 65, 66, 49]); new DataView(out.buffer).setUint32(4, head.length, true); out.set(head, 8); out.set(bytes, 8 + head.length);
  return out.buffer;
}
function decode(buf) {
  const u = new Uint8Array(buf); if (u[0] !== 82 || u[1] !== 65 || u[2] !== 66 || u[3] !== 49) return null;
  const hl = new DataView(buf).getUint32(4, true), meta = JSON.parse(new TextDecoder().decode(u.subarray(8, 8 + hl)));
  return { meta, bytes: u.subarray(8 + hl) };
}

// ---------------------------------------------------------------- running the bake
function workerUrl() { return new URL("./bake-worker.js", import.meta.url); }
export async function runBake(prep, { sunDirs, onProgress, signal }) {
  const { n, pos, nrm, alb, index, lights, windows, rep, vpos } = prep, L = lights.length + windows.length + 1 + sunDirs.length;
  const cores = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)), W = Math.max(1, Math.min(cores, Math.ceil(n / 4000)));
  const ranges = Array.from({ length: W }, (_, i) => [Math.floor((n * i) / W), Math.floor((n * (i + 1)) / W)]);
  const workers = ranges.map(() => new Worker(workerUrl(), { type: "module" }));
  const kill = () => workers.forEach((w) => w.terminate());
  signal?.addEventListener("abort", kill);
  const ask = (w, msg, want) => new Promise((res, rej) => {
    const on = (ev) => { if (ev.data.cmd === "error") { w.removeEventListener("message", on); rej(new Error(ev.data.error)); } else if (ev.data.cmd === want) { w.removeEventListener("message", on); res(ev.data); } };
    w.addEventListener("message", on); w.addEventListener("error", (e) => rej(new Error(e.message || "worker failed")), { once: true }); if (msg) w.postMessage(msg);
  });
  const D = new Float32Array(n * L * 3);
  let done = 0; const step = (k) => { done += k; onProgress?.(Math.min(0.99, done)); };
  await Promise.all(workers.map(async (w, i) => {
    const traced = ask(w, null, "traced");
    const r = await ask(w, { cmd: "init", pos, nrm, alb, index, lights, windows, sunDirs, range: ranges[i], rays: RAYS, rep, vpos }, "direct");
    D.set(r.D, ranges[i][0] * L * 3); step(0.25 / W);
    await traced; step(0.45 / W);
  }));
  if (signal?.aborted) throw new Error("cancelled");
  const nb = neighbours(prep);
  let E = D, G = null;
  for (let p = 0; p < PASSES; p++) {
    G = new Float32Array(n * L * 3);
    await Promise.all(workers.map(async (w, i) => { const r = await ask(w, { cmd: "pass", E }, "pass"); G.set(r.G, ranges[i][0] * L * 3); }));
    G = smooth(G, nb, L);
    E = new Float32Array(n * L * 3); for (let i = 0; i < E.length; i++) E[i] = D[i] + G[i];
    step(0.3 / PASSES);
  }
  kill();
  // sun layers keep only the bounce (in walk-through the sun itself is drawn live with sharp shadows);
  // the sun's direct light is kept as extra layers for the overview, where walls are cut and ceilings hidden
  const sOff = lights.length + windows.length + 1, K = L - sOff, L2 = L + K, F = new Float32Array(n * L2 * 3);
  for (let k = 0; k < n; k++) for (let l = 0; l < L; l++) {
    const i = (k * L + l) * 3, o = (k * L2 + l) * 3;
    if (l < sOff) { F[o] = E[i]; F[o + 1] = E[i + 1]; F[o + 2] = E[i + 2]; }
    else { F[o] = G[i]; F[o + 1] = G[i + 1]; F[o + 2] = G[i + 2]; const d = (k * L2 + l + K) * 3; F[d] = D[i]; F[d + 1] = D[i + 1]; F[d + 2] = D[i + 2]; }
  }
  return { E: F, L: L2, sOff };
}
// points close together on the same kind of surface share their bounced light (removes speckle)
function neighbours(prep) {
  const { n, pos, nrm } = prep, cell = 0.3, map = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  for (let k = 0; k < n; k++) { const c = key(Math.floor(pos[k * 3] / cell), Math.floor(pos[k * 3 + 1] / cell), Math.floor(pos[k * 3 + 2] / cell)); (map.get(c) || map.set(c, []).get(c)).push(k); }
  const start = new Int32Array(n + 1), list = [], wts = [];
  for (let k = 0; k < n; k++) {
    start[k] = list.length;
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let cnt = 0;
    for (let i = -1; i <= 1 && cnt < 28; i++) for (let j = -1; j <= 1 && cnt < 28; j++) for (let l = -1; l <= 1 && cnt < 28; l++) {
      for (const q of map.get(key(cx + i, cy + j, cz + l)) || []) {
        const dd = (pos[q * 3] - x) ** 2 + (pos[q * 3 + 1] - y) ** 2 + (pos[q * 3 + 2] - z) ** 2; if (dd > 0.3 * 0.3) continue;
        const dn = nrm[q * 3] * nrm[k * 3] + nrm[q * 3 + 1] * nrm[k * 3 + 1] + nrm[q * 3 + 2] * nrm[k * 3 + 2]; if (dn < 0.9) continue;
        list.push(q); wts.push(Math.exp(-dd / 0.03)); if (++cnt >= 28) break;
      }
    }
  }
  start[n] = list.length;
  return { start, list: Int32Array.from(list), wts: Float32Array.from(wts) };
}
function smooth(G, { start, list, wts }, L) {
  const n = start.length - 1, out = new Float32Array(G.length), S = L * 3;
  for (let k = 0; k < n; k++) {
    let ws = 0; const o = k * S;
    for (let j = start[k]; j < start[k + 1]; j++) { const q = list[j] * S, w = wts[j]; ws += w; for (let c = 0; c < S; c++) out[o + c] += G[q + c] * w; }
    if (ws > 0) for (let c = 0; c < S; c++) out[o + c] /= ws; else for (let c = 0; c < S; c++) out[o + c] = G[o + c];
  }
  return out;
}
// average brightness of each layer in each room, used to set the camera exposure like a real camera
function stats(prep, E, L) {
  const R = prep.rooms.length, cnt = new Float32Array(R + 1), m = new Float32Array((R + 1) * L);
  for (let k = 0; k < prep.n; k++) {
    const r = prep.room[k] + 1; cnt[r]++; cnt[0]++;
    for (let l = 0; l < L; l++) { const i = (k * L + l) * 3, v = lum(E[i], E[i + 1], E[i + 2]); m[r * L + l] += v; m[l] += v; }
  }
  for (let r = 0; r <= R; r++) for (let l = 0; l < L; l++) m[r * L + l] /= cnt[r] || 1;
  return { mean: Array.from(m, (v) => +v.toPrecision(4)) };
}

// ---------------------------------------------------------------- the manager on each engine
export class BakeManager {
  constructor(engine) { this.e = engine; this.state = "none"; this.U = U; }
  key() { const e = this.e; return `${e.plan?.id || "local"}_${e.floorIndex || 0}`; }
  hashNow() {
    const e = this.e, d = new Date();
    return bakeHash(e.floor, { month: `${d.getFullYear()}-${d.getMonth()}`, lat: Math.round(e.location?.lat ?? 26), north: e.plan?.north || 0 });
  }
  // called after the home was (re)built
  async onBuilt() {
    const e = this.e; if (e.opts.bake === false) return;
    const hash = this.hashNow();
    this.live = null; this.prep = null;
    if (this.data && this.data.meta.hash === hash) return this.apply(this.data);
    clearTimeout(this._t); this.abort?.abort();
    const token = (this._token = Symbol());
    let stored = null;
    try { stored = await e.opts.store?.load(this.key()); } catch { /* offline */ }
    if (token !== this._token) return;
    const parsed = stored && decode(stored);
    if (parsed && parsed.meta.hash === hash && parsed.meta.version === BAKE_VERSION) { this.data = parsed; return this.apply(parsed); }
    if (e.opts.canBake === false) { this.setState("waiting"); return; }
    // wait until the home has stopped changing for a moment
    this.setState("queued");
    this._t = setTimeout(() => this.bake(hash, token), e.opts.editing ? 2500 : 800);
  }
  async bake(hash, token) {
    const e = this.e;
    try {
      this.abort = new AbortController();
      const prep = prepare(e), keys = sunKeys(e.location?.lat ?? 26, midMonth()), north = e.plan?.north || 0;
      this.setState("baking", 0);
      const t0 = performance.now();
      const { E, L, sOff } = await runBake(prep, { sunDirs: keys.map((k) => sunDir(k.az, k.el, north)), signal: this.abort.signal, onProgress: (p) => this.setState("baking", p) });
      if (token !== this._token) return;
      const layers = [...prep.lights.map((l) => ({ t: "light", id: l.id })), ...prep.windows.map((w) => ({ t: "window", id: w.id })), { t: "sky" }, ...keys.map((k) => ({ t: "sun", az: k.az, el: k.el })), ...keys.map((k) => ({ t: "sundir", az: k.az, el: k.el }))];
      const meta = { version: BAKE_VERSION, hash, n: prep.n, verts: prep.verts, L, layers, rooms: prep.rooms, stats: stats(prep, E, L), seconds: Math.round((performance.now() - t0) / 100) / 10, at: new Date().toISOString() };
      const buf = encode(meta, E);
      this.data = decode(buf);
      this.apply(this.data, prep);
      e.opts.store?.save(this.key(), buf).catch?.(() => {});
    } catch (err) {
      if (String(err?.message) !== "cancelled") { console.warn("Roost Atelier light bake:", err); this.setState("failed"); }
    }
  }
  setState(s, p) { this.state = s; this.e.emit("bake", { state: s, progress: p ?? (s === "ready" ? 1 : 0) }); }
  apply(parsed, prep) {
    const e = this.e;
    prep ||= prepare(e);
    if (prep.n !== parsed.meta.n || (parsed.meta.verts && prep.verts !== parsed.meta.verts)) {
      // bake again here (never fetch the same file again in a loop)
      console.warn("Roost Atelier: stored light doesn't match this home, baking again");
      this.data = null;
      if (this.e.opts.canBake === false) { this.setState("waiting"); return; }
      clearTimeout(this._t); const token = (this._token = Symbol()); this.setState("queued");
      this._t = setTimeout(() => this.bake(this.hashNow(), token), 300);
      return;
    }
    this.prep = prep;
    const { meta, bytes } = parsed;
    if (this.tex?.image?.data !== bytes) {
      this.tex?.dispose();
      this.tex = new THREE.DataTexture(bytes, meta.W, meta.R * meta.L, THREE.RGBAFormat, THREE.UnsignedByteType);
      this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    }
    U.bakeTex.value = this.tex; U.bakeLayers.value = meta.L; U.bakeRows.value = meta.R; U.bakeWidth.value = meta.W;
    // room numbers for per-room brightness
    for (const r of prep.recv) {
      const ids = r.geo.attributes.bakeId.array, rm = new Float32Array(ids.length);
      for (let i = 0; i < ids.length; i++) rm[i] = prep.room[ids[i] | 0] + 1;
      r.geo.setAttribute("bakeRoom", new THREE.BufferAttribute(rm, 1));
      if (!r.mesh.userData.liveMaterial) r.mesh.userData.liveMaterial = r.mesh.material;
      const mats = r.mesh.userData.liveMaterial;
      r.mesh.material = Array.isArray(mats) ? mats.map(bakedMaterial) : bakedMaterial(mats);
    }
    this.layerIndex = meta.layers;
    this.active = true; e.baked = true;
    e.onBaked?.();
    this.setState("ready");
  }
  // how strongly each layer shines right now (light states, sky, sun, curtains, weather)
  update(w) {
    if (!this.active) return;
    const meta = this.data.meta, out = U.bakeW.value, L = meta.L, mean = meta.stats.mean, row = ((w.room ?? -1) + 1) * L;
    const K = meta.layers.filter((l) => l.t === "sun").length, sunStart = L - 2 * K, dirStart = L - K;
    let Eexp = 0;
    meta.layers.forEach((ly, l) => {
      let c = [0, 0, 0], meter = 1;
      if (ly.t === "light") c = w.lights[ly.id] || c;
      else if (ly.t === "window") c = w.sky.map((v) => v * (w.windows[ly.id] ?? 1));
      else if (ly.t === "sky") c = w.sky;
      else if (ly.t === "sun" || ly.t === "sundir") {
        const k = w.sunKeyW?.[ly.t === "sun" ? l - sunStart : l - dirStart] || 0;
        // direct sun from the bake only in the overview; in walk-through it is drawn live
        const on = ly.t === "sun" || w.cut;
        c = on ? w.sun.map((v) => v * k * w.curtainAvg) : c;
        // like an interior photographer: expose for the room, let the sun patches glow
        if (ly.t === "sundir") meter = 0.12;
      }
      out[l].set(c[0], c[1], c[2]);
      Eexp += meter * lum(c[0], c[1], c[2]) * (mean[row + l] ?? mean[l] ?? 0);
      // in walk-through the live sun still lights the room: count it when setting the exposure
      if (ly.t === "sundir" && !w.cut) Eexp += meter * lum(...w.sun) * (w.sunKeyW?.[l - dirStart] || 0) * w.curtainAvg * (mean[row + l] ?? mean[l] ?? 0);
    });
    for (let i = 0; i < 33; i++) U.bakeRoomGain.value[i] = w.roomGain?.[i] ?? 1;
    this.Eavg = Eexp;
  }
  sunKeyWeights(az, el) {
    const keys = this.data?.meta.layers.filter((l) => l.t === "sun") || [];
    if (el <= 0 || !keys.length) return keys.map(() => 0);
    const ang = keys.map((k) => { const a = sunDir(k.az, k.el), b = sunDir(az, el); return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))); });
    const order = ang.map((a, i) => [a, i]).sort((x, y) => x[0] - y[0]), wts = keys.map(() => 0);
    const [a0, i0] = order[0], [a1, i1] = order[1] || order[0];
    if (i0 === i1 || a0 + a1 < 1e-6) wts[i0] = 1; else { wts[i0] = a1 / (a0 + a1); wts[i1] = a0 / (a0 + a1); }
    return wts;
  }
  restoreLive() {
    for (const r of this.prep?.recv || []) if (r.mesh.userData.liveMaterial) r.mesh.material = r.mesh.userData.liveMaterial;
    this.active = false; this.e.baked = false;
  }
  dispose() { this.abort?.abort(); clearTimeout(this._t); this.tex?.dispose(); }
}
function midMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 15); }
