// Photo mode: when you stop touching the home, light is traced bounce by bounce until the picture
// looks like a studio render. Any touch drops back to the live view straight away.
import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture, DenoiseMaterial } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { denoise, aiAvailable } from "./ai/denoise.js";

// The tracer mixes up colours on objects made of several materials, so it gets its own copy of the
// home where every surface is a separate object with one material.
export function photoScene(src, { sun = true, lampCap = 0, lamps = null } = {}) {
  const out = new THREE.Scene();
  src.updateMatrixWorld(true);
  src.traverseVisible((o) => {
    if (o.isPoints || o.isLine || o.isSprite) return;
    if (o.isMesh) {
      if (o.material?.isShadowMaterial) return;
      const add = (geo, mat) => { if (!mat || mat.visible === false) return; const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrixWorld.copy(o.matrixWorld); out.add(m); };
      if (Array.isArray(o.material)) {
        const g = o.geometry;
        for (const grp of g.groups) {
          const part = new THREE.BufferGeometry();
          for (const [k, a] of Object.entries(g.attributes)) part.setAttribute(k, a);
          if (g.index) part.setIndex(Array.from(g.index.array.slice(grp.start, grp.start + grp.count)));
          else { part.setDrawRange(grp.start, grp.count); }
          add(part, o.material[grp.materialIndex]);
        }
      } else add(o.geometry, o.material);
    } else if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight && o.intensity > 0 && (sun || !o.isDirectionalLight) && !(lamps && o.userData.lamp)) {
      const l = o.clone(false);
      // with baked light the live lamps only carry half their light (their shine); photos need all of it
      if (o.isPointLight && src.userData.baked) l.intensity *= 2;
      // the same white balance as the live view: warm lamps look warm, not orange
      if (o.isPointLight) { const c = l.color, lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, k = 0.55; c.setRGB(c.r + (lum - c.r) * k, c.g + (lum - c.g) * k, c.b + (lum - c.b) * k); } l.matrixAutoUpdate = false; l.matrix.copy(o.matrixWorld); l.matrixWorld.copy(o.matrixWorld);
      l.position.setFromMatrixPosition(o.matrixWorld);
      if (o.target) { l.target = new THREE.Object3D(); l.target.position.setFromMatrixPosition(o.target.matrixWorld); out.add(l.target); l.target.updateMatrixWorld(); }
      out.add(l);
    }
  });
  // lamps from their exact emitters: spots as spot lights, the rest as soft lights facing their way
  if (lamps) for (const L of lamps) {
    const c = L.color.clone(), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, k = 0.55; c.setRGB(c.r + (lum - c.r) * k, c.g + (lum - c.g) * k, c.b + (lum - c.b) * k);
    let l, I;
    if (L.cone) { I = L.lm / (2 * Math.PI * (1 - Math.cos(L.cone))); l = new THREE.SpotLight(c, I, 0, Math.min(1.4, L.cone * 1.15), 0.5, 2); }
    else if (L.down >= 0.7) { I = L.lm / Math.PI; l = new THREE.SpotLight(c, I, 0, 1.5, 1, 2); }
    else { I = L.lm / (4 * Math.PI); l = new THREE.PointLight(c, I, 0, 2); }
    if (lampCap > 0) l.intensity *= lampCap / (lampCap + I / 1.44);
    l.position.set(...L.p); l.updateMatrixWorld();
    if (l.isSpotLight) { l.target.position.set(L.p[0] + L.dir[0], L.p[1] + L.dir[1], L.p[2] + L.dir[2]); out.add(l.target); l.target.updateMatrixWorld(); }
    out.add(l);
  }
  return out;
}

export class PhotoMode {
  constructor(engine) {
    this.e = engine;
    const pt = new WebGLPathTracer(engine.renderer);
    pt.tiles.set(engine.quality === "high" ? 2 : 3, engine.quality === "high" ? 2 : 3);
    pt.renderScale = engine.quality === "high" ? 1 : 0.75;
    pt.bounces = engine.quality === "high" ? 6 : 4;
    pt.transmissiveBounces = 4;
    pt.filterGlossyFactor = 0.5;
    pt.minSamples = 3; pt.renderDelay = 0; pt.fadeDuration = 600;
    pt.dynamicLowRes = false;
    pt.rasterizeSceneCallback = () => engine.composer.render();
    // plain random sampling: the default pattern leaves a maze-like grain on some GPUs
    pt._pathTracer.material.setDefine("RANDOM_TYPE", 0);
    // a denoiser smooths the grain while keeping edges sharp, softer as the photo fills in
    const premult = engine.renderer.getContextAttributes()?.premultipliedAlpha;
    this.denoise = new FullScreenQuad(new DenoiseMaterial({ map: null, blending: THREE.NoBlending, premultipliedAlpha: premult }));
    pt.renderToCanvasCallback = (target, renderer, quad) => {
      const m = this.denoise.material, k = Math.min(1, pt.samples / 120);
      m.map = target.texture; m.opacity = quad.material.opacity; m.blending = quad.material.blending; m.transparent = quad.material.opacity < 1;
      m.sigma = 5 - 1.5 * k; m.threshold = 0.3 - 0.15 * k; m.kSigma = 1.2;
      const ac = renderer.autoClear; renderer.autoClear = false; this.denoise.render(renderer); renderer.autoClear = ac;
    };
    this.pt = pt; this.active = false; this.version = -1;
    this.max = { low: 120, medium: 260, high: 600 }[engine.quality];
    // with a WebGPU graphics chip, the local AI cleans the photo after far fewer light samples
    this.aiAt = { low: 24, medium: 48, high: 96 }[engine.quality];
    aiAvailable().then((ok) => (this.ai = ok));
    this.view = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: null }));
  }
  start() {
    const e = this.e;
    // the tracer needs a plain sky picture for its light from outside
    if (!this.sky) { this.sky = new GradientEquirectTexture(64); }
    const day = e.isDay;
    this.sky.topColor.set(day ? "#cfe0ff" : "#1a2050"); this.sky.bottomColor.set(day ? "#f2ebe0" : "#0b0d17"); this.sky.update();
    // rebuilt every time: lights, curtains and doors may have moved since the last photo
    e.scene.userData.baked = !!e.baked;
    this.scene = photoScene(e.scene, { lampCap: e.baked ? e.bakeMgr.U.bakeLampCap.value : 0, lamps: e.photoLamps() });
    this.cleaned?.dispose(); this.cleaned = null; this.cleaning = false;
    this.scene.environment = e.skyTexture || this.sky;
    // baked: the sky picture is scaled to the real sky brightness (cd/m²) so photo and live view agree
    this.scene.environmentIntensity = e.baked && e.skyTexture ? (e.skyNow?.L || 1) / (e.skyMean || 1) : e.skyTexture ? { day: 1, sunset: 1.2, night: 2 }[e.skyKind] : e.scene.environmentIntensity;
    this.scene.background = null;
    this.pt.setScene(this.scene, e.camera);
    this.pt.reset();
    this.active = true; this.done = false;
    e.emit("photo", { progress: 0 });
  }
  step() {
    if (this.cleaned) { this.show(); return; }
    if (this.done) return;
    this.pt.renderSample();
    if (this.ai && !this.cleaning && this.pt.samples >= this.aiAt) { this.clean(); return; }
    const p = Math.min(1, this.pt.samples / this.max);
    if ((this._n = (this._n || 0) + 1) % 10 === 0) this.e.emit("photo", { progress: p });
    if (p >= 1) { this.done = true; this.e.emit("photo", { progress: 1 }); }
  }
  async clean() {
    const e = this.e; this.cleaning = true; this.done = true; e.emit("photo", { progress: 0.95, ai: true });
    try {
      this.cleaned = await denoise({ renderer: e.renderer, target: this.pt._pathTracer.target, scene: this.scene, camera: e.camera, exposure: e.renderer.toneMappingExposure, mid: e.baked ? Math.min(0.35, e.renderer.toneMappingExposure * (0.45 * (e.bakeMgr.Eavg || 0)) / Math.PI) * 0.75 : 0, small: e.quality !== "high" });
      if (!this.active) return;
      this.show(); e.emit("photo", { progress: 1, ai: true });
    } catch (err) { console.warn("Roost Atelier AI clean-up:", err); this.ai = false; this.done = false; this.cleaning = false; }
  }
  // the clean picture, shown with the same camera look (exposure is already in it)
  show() {
    const r = this.e.renderer, ex = r.toneMappingExposure;
    this.view.material.map = this.cleaned; this.view.material.needsUpdate = this.view.material.map !== this._shown; this._shown = this.cleaned;
    r.toneMappingExposure = 1; r.setRenderTarget(null); this.view.render(r); r.toneMappingExposure = ex;
  }
  stop() {
    if (!this.active) return;
    this.active = false;
    this.e.emit("photo", { progress: -1 });
    this.e.request(false);
  }
  dispose() { this.stop(); this.pt.dispose(); this.denoise.dispose(); this.view.dispose(); this.cleaned?.dispose(); }
}
