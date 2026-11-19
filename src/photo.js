// Photo mode: when you stop touching the home, light is traced bounce by bounce until the picture
// looks like a studio render. Any touch drops back to the live view straight away.
import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture, DenoiseMaterial } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

// The tracer mixes up colours on objects made of several materials, so it gets its own copy of the
// home where every surface is a separate object with one material.
function photoScene(src) {
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
    } else if (o.isLight && !o.isAmbientLight && o.intensity > 0) {
      const l = o.clone(false); l.matrixAutoUpdate = false; l.matrix.copy(o.matrixWorld); l.matrixWorld.copy(o.matrixWorld);
      l.position.setFromMatrixPosition(o.matrixWorld);
      if (o.target) { l.target = new THREE.Object3D(); l.target.position.setFromMatrixPosition(o.target.matrixWorld); out.add(l.target); l.target.updateMatrixWorld(); }
      out.add(l);
    }
  });
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
  }
  start() {
    const e = this.e;
    // the tracer needs a plain sky picture for its light from outside
    if (!this.sky) { this.sky = new GradientEquirectTexture(64); }
    const day = e.isDay;
    this.sky.topColor.set(day ? "#cfe0ff" : "#1a2050"); this.sky.bottomColor.set(day ? "#f2ebe0" : "#0b0d17"); this.sky.update();
    // rebuilt every time: lights, curtains and doors may have moved since the last photo
    this.scene = photoScene(e.scene);
    this.scene.environment = e.skyTexture || this.sky; this.scene.environmentIntensity = e.skyTexture ? { day: 1, sunset: 1.2, night: 2 }[e.skyKind] : e.scene.environmentIntensity;
    this.scene.background = null;
    this.pt.setScene(this.scene, e.camera);
    this.pt.reset();
    this.active = true; this.done = false;
    e.emit("photo", { progress: 0 });
  }
  step() {
    if (this.done) return;
    this.pt.renderSample();
    const p = Math.min(1, this.pt.samples / this.max);
    if ((this._n = (this._n || 0) + 1) % 10 === 0) this.e.emit("photo", { progress: p });
    if (p >= 1) { this.done = true; this.e.emit("photo", { progress: 1 }); }
  }
  stop() {
    if (!this.active) return;
    this.active = false;
    this.e.emit("photo", { progress: -1 });
    this.e.request(false);
  }
  dispose() { this.stop(); this.pt.dispose(); this.denoise.dispose(); }
}
