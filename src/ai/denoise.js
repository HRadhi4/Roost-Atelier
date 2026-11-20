// Local AI clean-up for photos: Intel's Open Image Denoise network (the same kind of AI denoiser that
// professional renderers use), running on this device's graphics through WebGPU. Nothing leaves the house:
// the network's weights ship with Roost Atelier.
import * as THREE from "three";

let unetP = null, unetSmall = false;
export const AI_BASE = { url: new URL("../ai/", import.meta.url).href };

// a computer whose graphics chip lost the AI clean-up once is not asked again (losing it can take the whole picture
// down with it); the plain traced picture is used there instead
const BAD = "roost-atelier-ai-failed";
export function aiFailed() { try { localStorage.setItem(BAD, String(Date.now())); } catch {} }
export async function aiAvailable() {
  try { const t = +localStorage.getItem(BAD); if (t && Date.now() - t < 30 * 864e5) return false; } catch {}
  try { return !!(navigator.gpu && (await navigator.gpu.requestAdapter())); } catch { return false; }
}
async function unet(small) {
  if (unetP && unetSmall === small) return unetP;
  unetSmall = small;
  unetP = (async () => {
    const { initUNetFromURL } = await import("oidn-web");
    return initUNetFromURL(`${AI_BASE.url}${small ? "rt_hdr_alb_nrm_small.tza" : "rt_hdr_alb_nrm.tza"}`, undefined, { aux: true, hdr: true });
  })();
  unetP.catch(() => { unetP = null; });
  return unetP;
}

// surface colour and direction of every pixel: they let the AI keep edges and textures sharp
function auxBuffers(renderer, scene, camera, w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
  const swap = new Map(), basic = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!basic.has(m)) basic.set(m, new THREE.MeshBasicMaterial({ color: m.color || 0xffffff, map: m.map || null, side: m.side, toneMapped: false }));
    swap.set(o, m); o.material = basic.get(m);
  });
  const prevTM = renderer.toneMapping, prevBg = scene.background; renderer.toneMapping = THREE.NoToneMapping; scene.background = null;
  const read = () => { const a = new Float32Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, a); return a; };
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  const albedo = read();
  const nm = new THREE.ShaderMaterial({ vertexShader: "varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }", fragmentShader: "varying vec3 vN; void main(){ gl_FragColor = vec4(normalize(gl_FrontFacing ? vN : -vN), 1.0); }", side: THREE.DoubleSide });
  scene.overrideMaterial = nm; renderer.clear(); renderer.render(scene, camera); scene.overrideMaterial = null;
  const normal = read();
  renderer.setRenderTarget(null); renderer.toneMapping = prevTM; scene.background = prevBg;
  for (const [o, m] of swap) o.material = m;
  for (const m of basic.values()) m.dispose(); nm.dispose(); rt.dispose();
  // the AI expects albedo 0..1 and normals -1..1 given as 0..255 numbers
  for (let i = 0; i < albedo.length; i++) albedo[i] = Math.min(1, albedo[i]) * 255;
  for (let i = 0; i < normal.length; i++) normal[i] *= 255;
  return { albedo, normal };
}

// target: the path tracer's accumulated picture (linear light). Returns a texture with the clean picture.
export async function denoise({ renderer, target, scene, camera, exposure, mid, small }) {
  const w = target.width, h = target.height, color = new Float32Array(w * h * 4);
  renderer.readRenderTargetPixels(target, 0, 0, w, h, color);
  // expose the photo like the live view: its average brightness lands where the live view's does
  if (mid) { let sl = 0, n = 0; for (let i = 0; i < color.length; i += 16) { const l = 0.2126 * color[i] + 0.7152 * color[i + 1] + 0.0722 * color[i + 2]; if (l > 0) { sl += Math.log(l + 1e-6); n++; } } const lg = Math.exp(sl / Math.max(1, n)); if (lg > 0) exposure = mid / lg; }
  for (let i = 0; i < color.length; i += 4) { color[i] *= exposure; color[i + 1] *= exposure; color[i + 2] *= exposure; color[i + 3] = 1; }
  const { albedo, normal } = auxBuffers(renderer, scene, camera, w, h);
  // the graphics chip can drop the AI's connection (sleep, another tab, a driver reset): connect again once
  let out;
  for (let attempt = 0; ; attempt++) {
    try { const net = await unet(small); out = await run(net); break; }
    catch (err) { unetP = null; if (attempt >= 1) throw err; }
  }
  function run(net) { return new Promise((res, rej) => net.tileExecute({ color: { data: color, width: w, height: h }, albedo: { data: albedo, width: w, height: h }, normal: { data: normal, width: w, height: h }, done: res, error: rej })); }
  // some graphics chips hand back an empty (black) or broken picture: then the photo is used as traced
  let top = 0, bad = false; for (let i = 0; i < out.data.length; i += 4) { const v = out.data[i] + out.data[i + 1] + out.data[i + 2]; if (!Number.isFinite(v)) { bad = true; break; } if (v > top) top = v; }
  if (bad || top < 1e-4) throw new Error("the AI clean-up returned an empty picture");
  const tex = new THREE.DataTexture(out.data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.colorSpace = THREE.LinearSRGBColorSpace; tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return tex;
}
