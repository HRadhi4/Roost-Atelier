// The background photo studio: once the light is ready it makes a realistic photo of the whole floor and of
// every room, on its own hidden canvas, so you can keep working. It slows down while you move the view,
// and stops when the home changes (the photos are made again with the new light).
import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture, EquirectCamera, DenoiseMaterial } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { photoScene } from "./photo.js";
import { denoise, aiAvailable } from "./ai/denoise.js";
import { ROOM_TYPES, panoSpot } from "./model.js";
export { panoSpot };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Studio {
  // save(key, blob) stores a photo; onProgress({ done, total, f, name, state }) drives the bar
  constructor(engine, { save, onProgress, samples, size }) {
    this.e = engine; this.samples = samples; this.size = size; this.save = save; this.onProgress = onProgress || (() => {});
    this.running = false; this.token = 0;
  }
  cancel() { this.token++; if (this.running) { this.running = false; this.onProgress({ state: "stopped" }); } }
  // shots: [{ key, name, view: "3d" | "walk", room }]
  async run(shots) {
    const e = this.e, token = ++this.token;
    if (!shots.length || !e.baked) return;
    this.running = true;
    await e.ensureSky();
    const ai = await aiAvailable().catch(() => false);
    const q = e.quality, pano = shots[0].view === "pano";
    // a 360° view is twice as wide as it is tall
    const [W, H] = this.size || (pano ? (q === "high" ? [4096, 2048] : q === "medium" ? [3072, 1536] : [2048, 1024]) : q === "high" ? [1600, 1000] : q === "medium" ? [1280, 800] : [960, 600]);
    const canvas = document.createElement("canvas");
    let renderer, pt, sky, quad, smooth;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      pt = new WebGLPathTracer(renderer);
      pt.tiles.set(3, 3); pt.renderScale = 1; pt.bounces = q === "high" ? 6 : 5; pt.transmissiveBounces = 4; pt.filterGlossyFactor = 0.5;
      pt.minSamples = 1; pt.renderDelay = 0; pt.fadeDuration = 0; pt.dynamicLowRes = false;
      pt._pathTracer.material.setDefine("RANDOM_TYPE", 0);
      sky = new GradientEquirectTexture(64);
      quad = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: null }));
      // background work: enough light samples for the AI to finish a clean photo, many more without it
      const target = this.samples || (pano ? { low: 96, medium: 160, high: 256 }[q] : ai ? { low: 40, medium: 72, high: 128 }[q] : { low: 160, medium: 320, high: 640 }[q]);
      smooth = pano ? new FullScreenQuad(new DenoiseMaterial({ map: null, blending: THREE.NoBlending })) : null;
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        if (token !== this.token) return;
        this.onProgress({ state: "working", done: i, total: shots.length, f: i / shots.length, name: shot.name });
        // the home as it looks from this spot: full walls; ceilings only inside a room
        const prevView = e.view;
        e.view = shot.view === "pano" ? "walk" : shot.view; e._wallsOverride = "full"; e.applyWalls(); e.fitSun();
        e.scene.userData.baked = !!e.baked;
        const scene = photoScene(e.scene, { sun: shot.view !== "3d", lampCap: e.baked ? e.bakeMgr.U.bakeLampCap.value : 0, lamps: e.photoLamps() });
        const exposure = e.renderer.toneMappingExposure, toneMapping = e.renderer.toneMapping;
        const mid = e.baked ? Math.min(0.35, exposure * (0.45 * (e.bakeMgr.Eavg || 0)) / Math.PI) * 0.75 : 0;
        e.view = prevView; e._wallsOverride = null; e.applyWalls(); e.fitSun();
        // camera
        let cam;
        if (shot.view === "pano") { const p = panoSpot(shot.room); cam = new EquirectCamera(); cam.position.set(p[0], p[1], p[2]); cam.updateMatrixWorld(); }
        else { const pose = e.pose(shot.view, shot.room, W / H); cam = new THREE.PerspectiveCamera(pose.fov, W / H, 0.05, 400); cam.position.copy(pose.pos); cam.lookAt(pose.target); cam.updateMatrixWorld(); }
        renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
        const day = e.isDay; sky.topColor.set(day ? "#cfe0ff" : "#1a2050"); sky.bottomColor.set(day ? "#f2ebe0" : "#0b0d17"); sky.update();
        scene.environment = e.skyTexture || sky;
        scene.environmentIntensity = e.baked && e.skyTexture ? (e.skyNow?.L || 1) / (e.skyMean || 1) : e.scene.environmentIntensity;
        scene.background = shot.view !== "3d" ? null : new THREE.Color("#0B0D17");
        pt.setScene(scene, cam); pt.reset();
        // trace, a little at a time so the page stays smooth; pause while you move the view
        while (pt.samples < target) {
          if (token !== this.token) return;
          if (e.busy || e.keys?.size) { await wait(400); continue; }
          pt.renderSample();
          if ((this._n = (this._n || 0) + 1) % 9 === 0) { this.onProgress({ state: "working", done: i, total: shots.length, f: (i + 0.9 * Math.min(1, pt.samples / target)) / shots.length, name: shot.name }); await wait(8); }
        }
        if (token !== this.token) return;
        if (smooth) {
          // 360° views: the light is smoothed while keeping edges (the AI clean-up needs a normal camera)
          const m = smooth.material; m.map = pt._pathTracer.target.texture; m.sigma = 3.5; m.threshold = 0.18; m.kSigma = 1.2;
          renderer.setRenderTarget(null); smooth.render(renderer);
        } else if (ai) {
          this.onProgress({ state: "working", done: i, total: shots.length, f: (i + 0.93) / shots.length, name: shot.name, ai: true });
          try {
            const clean = await denoise({ renderer, target: pt._pathTracer.target, scene, camera: cam, exposure, mid, small: q !== "high" });
            if (token !== this.token) { clean.dispose(); return; }
            quad.material.map = clean; quad.material.needsUpdate = true;
            renderer.toneMappingExposure = 1; renderer.setRenderTarget(null); quad.render(renderer); renderer.toneMappingExposure = exposure;
            clean.dispose();
          } catch (err) { console.warn("Roost Atelier AI clean-up:", err); }
        }
        const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
        if (token !== this.token) return;
        if (blob) await this.save(shot.key, blob).catch(() => {});
        this.onProgress({ state: "working", done: i + 1, total: shots.length, f: (i + 1) / shots.length, name: shot.name, saved: shot.key });
      }
      this.onProgress({ state: "done", done: shots.length, total: shots.length, f: 1 });
    } catch (err) {
      console.warn("Roost Atelier photo studio:", err);
      this.onProgress({ state: "failed" });
    } finally {
      if (token === this.token) this.running = false;
      pt?.dispose(); quad?.dispose(); smooth?.dispose(); sky?.dispose?.(); renderer?.dispose(); renderer?.forceContextLoss?.();
    }
  }
}

// which photos a floor needs: the whole floor first, then each indoor room
export function shotsFor(floor, t) {
  const rooms = floor.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor);
  return [{ key: "all", name: t("Whole floor"), view: "3d" }, ...rooms.map((r) => ({ key: r.id, name: r.name || t(ROOM_TYPES[r.type]?.name || "Room"), view: "walk", room: r }))];
}

// the 360° views a floor needs: one per indoor room
export function panosFor(floor, t) {
  return floor.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor).map((r) => ({ key: `pano_${r.id}`, name: `360° · ${r.name || t(ROOM_TYPES[r.type]?.name || "Room")}`, view: "pano", room: r }));
}
