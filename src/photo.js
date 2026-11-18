// Photo mode: when you stop touching the home, light is traced bounce by bounce until the picture
// looks like a studio render. Any touch drops back to the live view straight away.
import { WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";

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
    this.pt = pt; this.active = false; this.version = -1;
    this.max = { low: 120, medium: 260, high: 600 }[engine.quality];
  }
  start() {
    const e = this.e;
    const hidden = [];
    e.scene.traverse((o) => { if (o.visible && (o.isPoints || o.material?.isShadowMaterial)) { o.visible = false; hidden.push(o); } });
    this.hidden = hidden;
    // the tracer needs a plain sky picture for its light from outside
    if (!this.sky) { this.sky = new GradientEquirectTexture(64); }
    const day = e.isDay;
    this.sky.topColor.set(day ? "#cfe0ff" : "#1a2050"); this.sky.bottomColor.set(day ? "#f2ebe0" : "#0b0d17"); this.sky.update();
    this.prevEnv = e.scene.environment; e.scene.environment = this.sky;
    if (this.version !== e.version) { this.pt.setScene(e.scene, e.camera); this.version = e.version; }
    else { this.pt.updateCamera(); this.pt.updateLights(); this.pt.updateMaterials(); this.pt.updateEnvironment(); }
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
    for (const o of this.hidden || []) o.visible = true;
    if (this.prevEnv) { this.e.scene.environment = this.prevEnv; this.prevEnv = null; }
    this.e.emit("photo", { progress: -1 });
    this.e.request(false);
  }
  dispose() { this.stop(); this.pt.dispose(); }
}
