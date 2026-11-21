// Clean-up for photos on any graphics chip (no AI needed): the grain of the traced light is smoothed away while
// edges, corners and textures stay sharp. It looks at what each pixel shows (its surface colour, which way the
// surface faces and how far it is) and only blends pixels that show the same surface. The surface colour is taken
// out first and put back after, so wood grain, fabric and wallpaper keep every detail; only the light is smoothed.
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

// 1) light only: the picture divided by the surface colour, with lone hot pixels (fireflies) calmed down
const SPLIT = `
precision highp float; varying vec2 vUv;
uniform sampler2D tColor, tAlbedo; uniform vec2 px; uniform float exposure;
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 albedoAt(vec2 uv){ vec4 a = texture2D(tAlbedo, uv); return a.a < 0.5 ? vec3(1.0) : max(a.rgb, vec3(0.04)); }
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * exposure;
  // a pixel far brighter than everything round it is a stray light sample: bring it down to its neighbours
  float m = 0.0, mx = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { if (x == 0 && y == 0) continue; float l = lum(texture2D(tColor, vUv + vec2(float(x), float(y)) * px).rgb * exposure); m += l; mx = max(mx, l); }
  m /= 8.0; float l = lum(c), cap = max(mx, m * 3.0) + 0.02;
  if (l > cap) c *= cap / l;
  vec3 lt = c / albedoAt(vUv);
  // how grainy it is here: the spread of the light round this pixel (guides how hard it is smoothed)
  float s1 = 0.0, s2 = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 uv = vUv + vec2(float(x), float(y)) * px; float v = lum(texture2D(tColor, uv).rgb * exposure / albedoAt(uv)); v = v / (1.0 + v); s1 += v; s2 += v * v; }
  s1 /= 9.0; float vr = max(0.0, s2 / 9.0 - s1 * s1);
  gl_FragColor = vec4(lt, vr);
}`;

// 2) one round of the smoothing; each round looks twice as far (1, 2, 4, 8, 16 pixels)
const STEP = `
precision highp float; varying vec2 vUv;
uniform sampler2D tLight, tNormal; uniform vec2 px; uniform float stepw, sigC, sigN, sigZ;
float tm(float l){ return l / (1.0 + l); }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main(){
  vec4 c0 = texture2D(tLight, vUv); vec4 n0 = texture2D(tNormal, vUv); n0.xyz = normalize(n0.xyz + 1e-6);
  if (n0.w <= 0.0) { gl_FragColor = c0; return; }
  float k[3]; k[0] = 0.375; k[1] = 0.25; k[2] = 0.0625;
  vec3 sum = vec3(0.0); float wsum = 0.0, vsum = 0.0; float l0 = tm(lum(c0.rgb));
  float sc = sigC + 6.0 * c0.a;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 o = vec2(float(x), float(y)) * stepw;
    vec2 uv = vUv + o * px;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue;
    vec4 c = texture2D(tLight, uv); vec4 n = texture2D(tNormal, uv); n.xyz = normalize(n.xyz + 1e-6);
    if (n.w <= 0.0) continue;
    float dl = tm(lum(c.rgb)) - l0;
    float wc = exp(-dl * dl / sc);
    float wn = pow(max(0.0, dot(n0.xyz, n.xyz)), sigN);
    float wz = exp(-abs(n0.w - n.w) / (sigZ * n0.w * max(1.0, length(o)) + 1e-4));
    float w = k[x < 0 ? -x : x] * k[y < 0 ? -y : y] * wc * wn * wz;
    sum += c.rgb * w; wsum += w; vsum += w * w * c.a;
  }
  gl_FragColor = wsum > 0.0 ? vec4(sum / wsum, vsum / (wsum * wsum)) : c0;
}`;

// 3) the surface colour goes back on (and the exposure comes back off: the photo is shown with the usual camera look)
const JOIN = `
precision highp float; varying vec2 vUv;
uniform sampler2D tLight, tAlbedo, tColor; uniform float exposure;
void main(){
  vec4 a = texture2D(tAlbedo, vUv);
  // the sky through the windows and anything without a surface is kept as traced
  if (a.a < 0.5) { gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); return; }
  gl_FragColor = vec4(texture2D(tLight, vUv).rgb * max(a.rgb, vec3(0.04)) / exposure, 1.0);
}`;

// surface colour, facing and distance of every pixel, drawn smooth-edged
function guides(renderer, scene, camera, w, h) {
  // drawn twice as big and read back blended four pixels at a time: smooth edges on every graphics chip
  const opts = { type: THREE.HalfFloatType, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const albedo = new THREE.WebGLRenderTarget(w * 2, h * 2, opts), normal = new THREE.WebGLRenderTarget(w * 2, h * 2, opts);
  const swap = new Map(), basic = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (!basic.has(m)) basic.set(m, new THREE.MeshBasicMaterial({ color: m.color || 0xffffff, map: m.map || null, side: m.side, toneMapped: false }));
    swap.set(o, m); o.material = basic.get(m);
  });
  const prevTM = renderer.toneMapping, prevBg = scene.background, prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.toneMapping = THREE.NoToneMapping; scene.background = null; renderer.setClearColor(0x000000, 0);
  try {
    renderer.setRenderTarget(albedo); renderer.clear(); renderer.render(scene, camera);
    const nm = new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vN; varying float vZ; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec3 vN; varying float vZ; void main(){ gl_FragColor = vec4(normalize(gl_FrontFacing ? vN : -vN), vZ); }",
      side: THREE.DoubleSide,
    });
    scene.overrideMaterial = nm; renderer.setRenderTarget(normal); renderer.clear(); renderer.render(scene, camera); scene.overrideMaterial = null; nm.dispose();
  } finally {
    renderer.setRenderTarget(null); renderer.toneMapping = prevTM; scene.background = prevBg; renderer.setClearColor(prevClear, prevA);
    for (const [o, m] of swap) o.material = m;
    for (const m of basic.values()) m.dispose();
  }
  return { albedo, normal };
}

// target: the traced picture (linear light). Returns a render target holding the clean picture (linear light).
export function smoothPhoto({ renderer, target, scene, camera, exposure = 1, strength = 1 }) {
  const w = target.width, h = target.height, px = new THREE.Vector2(1 / w, 1 / h);
  const { albedo, normal } = guides(renderer, scene, camera, w, h);
  const rt = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  // the clean picture can be enlarged smoothly (it may have been traced at half size)
  const a = rt(), b = rt(), out = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const mat = (frag, u) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false });
  const split = new FullScreenQuad(mat(SPLIT, { tColor: { value: target.texture }, tAlbedo: { value: albedo.texture }, px: { value: px }, exposure: { value: exposure } }));
  const stepU = { tLight: { value: null }, tNormal: { value: normal.texture }, px: { value: px }, stepw: { value: 1 }, sigC: { value: 0.02 }, sigN: { value: 64 }, sigZ: { value: 0.02 } };
  const step = new FullScreenQuad(mat(STEP, stepU));
  const join = new FullScreenQuad(mat(JOIN, { tLight: { value: null }, tAlbedo: { value: albedo.texture }, tColor: { value: target.texture }, exposure: { value: exposure } }));
  const prevTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  try {
    renderer.setRenderTarget(a); split.render(renderer);
    let src = a, dst = b;
    for (let i = 0; i < 5; i++) {
      stepU.tLight.value = src.texture; stepU.stepw.value = 1 << i;
      // the first rounds are gentle on light changes (to keep soft shadows), the later ones only smooth what is alike
      stepU.sigC.value = (0.004 * strength) / (1 << i);
      renderer.setRenderTarget(dst); step.render(renderer);
      [src, dst] = [dst, src];
    }
    join.material.uniforms.tLight.value = src.texture;
    renderer.setRenderTarget(out); join.render(renderer);
  } finally {
    renderer.setRenderTarget(null); renderer.toneMapping = prevTM;
    split.dispose(); step.dispose(); join.dispose(); split.material.dispose(); step.material.dispose(); join.material.dispose();
    a.dispose(); b.dispose(); albedo.dispose(); normal.dispose();
  }
  return out;
}
