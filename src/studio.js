// The background photo studio: once the light is ready it makes a realistic photo of the whole floor and of
// every room, on its own hidden canvas, so you can keep working. It slows down while you move the view,
// and stops when the home changes (the photos are made again with the new light).
import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture, EquirectCamera, DenoiseMaterial } from "three-gpu-pathtracer";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { photoScene } from "./photo.js";
import { denoise, aiAvailable, aiFailed } from "./ai/denoise.js";
import { smoothPhoto } from "./ai/atrous.js";
import { ROOM_TYPES, panoSpot } from "./model.js";
import { withCamera } from "./still.js";
export { panoSpot };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// is a finished picture all black? (looked at small)
function dark(canvas) {
  const c = document.createElement("canvas"); c.width = 48; c.height = 30; const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, 48, 30); const d = x.getImageData(0, 0, 48, 30).data; let top = 0;
  for (let i = 0; i < d.length; i += 4) top = Math.max(top, d[i], d[i + 1], d[i + 2]);
  return top < 8;
}

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
    this.running = true; this.black = 0;
    await e.ensureSky();
    const ai = await aiAvailable().catch(() => false);
    const q = e.quality, pano = shots[0].view === "pano";
    // a 360° view is twice as wide as it is tall
    const [W, H] = this.size || (pano ? (q === "high" ? [4096, 2048] : q === "medium" ? [3072, 1536] : [2048, 1024]) : q === "high" ? [1600, 1000] : q === "medium" ? [1280, 800] : [960, 600]);
    const canvas = document.createElement("canvas");
    // a graphics chip that gives up (its drawing surface is lost, or the tracing stops moving) is not waited for:
    // the picture is drawn the plain 3D way instead, and the rest of the run skips tracing
    let lost = false; canvas.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); lost = true; });
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
      // background work: enough light samples for the AI to finish a clean photo; without it more samples, then the
      // edge-keeping clean-up that runs on any graphics chip
      const target = this.samples || (pano ? { low: 128, medium: 200, high: 320 }[q] : ai ? { low: 40, medium: 72, high: 128 }[q] : { low: 128, medium: 256, high: 512 }[q]);
      smooth = pano ? new FullScreenQuad(new DenoiseMaterial({ map: null, blending: THREE.NoBlending })) : null;
      // the traced picture as it is (no AI clean-up), drawn onto the photo
      const traced = () => {
        quad.material.map = pt._pathTracer.target.texture; quad.material.blending = THREE.NoBlending; quad.material.needsUpdate = true;
        renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(); quad.render(renderer);
      };
      // no AI here: the light is smoothed while edges, corners and textures stay sharp
      const smoothed = (scene, cam, exposure) => {
        if (this.noSmooth) return traced();
        try {
          const clean = smoothPhoto({ renderer, target: pt._pathTracer.target, scene, camera: cam, exposure });
          quad.material.map = clean.texture; quad.material.blending = THREE.NoBlending; quad.material.needsUpdate = true;
          renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(); quad.render(renderer);
          clean.dispose();
        } catch (err) { console.warn("Roost Atelier photo clean-up:", err); traced(); }
      };
      // the home drawn the normal way (not traced) from the photo's camera. It uses the 3D view's own drawing surface
      // (a browser allows only so many, and a chip in trouble may refuse a new one), sized to the photo for a moment
      const plain = (draw) => {
        const r = e.renderer, size = r.getSize(new THREE.Vector2()), ratio = r.getPixelRatio(), prevView = e.view, bg = e.scene.background, bgi = e.scene.backgroundIntensity, pc = e.composer;
        try { e.busy = true; e.composer = null; return draw(r); }
        finally { e.view = prevView; e._wallsOverride = null; e.scene.background = bg; e.scene.backgroundIntensity = bgi; e.composer = pc; r.setPixelRatio(ratio); r.setSize(size.x, size.y, false); e.applyWalls(); e.fitSun(); e.busy = false; e.request(true); }
      };
      // the picture is drawn twice as big and shrunk smoothly, so its edges come out clean (no jagged lines)
      const grab = (r, w, h, k = 1) => { const out = document.createElement("canvas"); out.width = w; out.height = h; const x = out.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(r.domElement, 0, 0, w * k, h * k, 0, 0, w, h); return out; };
      const bigger = (r, w, h) => { const max = Math.min(r.capabilities.maxTextureSize || 4096, 8192); return Math.max(1, Math.min(2, Math.floor(max / Math.max(w, h)))); };
      const realBack = (exposure) => { const real = e.photoSky(exposure); if (real) { e.scene.background = real.tex; e.scene.backgroundIntensity = real.intensity; } return real; };
      const rasterShot = (shot, cam, W, H, exposure, toneMapping) => {
        try {
          return plain((r) => {
            e.view = shot.view; e._wallsOverride = "full"; e.applyWalls(); e.fitSun(); if (!realBack(exposure) && shot.view === "3d") e.scene.background = new THREE.Color("#0B0D17");
            const k = bigger(r, W, H), bi = e.scene.backgroundIntensity;
            r.setPixelRatio(1); r.setSize(W * k, H * k, false); const tm = r.toneMapping, ex = r.toneMappingExposure; r.toneMapping = toneMapping; r.toneMappingExposure = exposure;
            e.scene.updateMatrixWorld(true); r.setRenderTarget(null); r.render(e.scene, cam); const out = grab(r, W, H, k); e.scene.backgroundIntensity = bi;
            r.toneMapping = tm; r.toneMappingExposure = ex; return out;
          });
        } catch (err) { console.warn("Roost Atelier photo studio (plain picture):", err); return null; }
      };
      // a 360° picture drawn the plain way: six square views round the spot, unwrapped into one picture
      const rasterPano = (shot, cam, W, H, exposure, toneMapping) => {
        try {
          const S = Math.min(1024, Math.max(256, Math.round(W / 4)));
          // faces: +x, -x, +y, -y, +z, -z (looking out from the spot)
          const dirs = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, -1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]];
          const faces = plain((r) => {
            e.view = "walk"; e._wallsOverride = "full"; e.applyWalls(); e.fitSun(); realBack(exposure); e.scene.updateMatrixWorld(true);
            const k = bigger(r, S, S); r.setPixelRatio(1); r.setSize(S * k, S * k, false); const tm = r.toneMapping, ex = r.toneMappingExposure; r.toneMapping = toneMapping; r.toneMappingExposure = exposure; r.setRenderTarget(null);
            const list = dirs.map(([x, y, z, ux, uy, uz]) => {
              const pc = new THREE.PerspectiveCamera(90, 1, 0.05, 400); pc.position.copy(cam.position); pc.up.set(ux, uy, uz); pc.lookAt(cam.position.x + x, cam.position.y + y, cam.position.z + z); pc.updateMatrixWorld(true);
              r.render(e.scene, pc); const t = grab(r, S, S, k); return { cam: pc, px: t.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, S, S).data };
            });
            r.toneMapping = tm; r.toneMappingExposure = ex; return list;
          });
          // each pixel of the 360° picture looks along a direction: find the face it falls on, and where
          const flat = document.createElement("canvas"); flat.width = W; flat.height = H; const fx = flat.getContext("2d"), img = fx.createImageData(W, H), o = img.data;
          const v = new THREE.Vector3(), inv = faces.map((f) => f.cam.matrixWorldInverse);
          for (let y = 0; y < H; y++) {
            const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
            for (let x = 0; x < W; x++) {
              const lon = ((x + 0.5) / W - 0.25) * 2 * Math.PI, dx = Math.sin(lon) * cl, dy = sl, dz = -Math.cos(lon) * cl;
              const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
              const k = ax >= ay && ax >= az ? (dx > 0 ? 0 : 1) : ay >= az ? (dy > 0 ? 2 : 3) : dz > 0 ? 4 : 5;
              v.set(cam.position.x + dx, cam.position.y + dy, cam.position.z + dz).applyMatrix4(inv[k]);
              const px = Math.min(S - 1, Math.max(0, Math.floor(((v.x / -v.z) * 0.5 + 0.5) * S))), py = Math.min(S - 1, Math.max(0, Math.floor((0.5 - (v.y / -v.z) * 0.5) * S)));
              const si = (py * S + px) * 4, di = (y * W + x) * 4, src = faces[k].px; o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]; o[di + 3] = 255;
            }
          }
          fx.putImageData(img, 0, 0);
          return flat;
        } catch (err) { console.warn("Roost Atelier photo studio (plain 360° picture):", err); return null; }
      };
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
        let cam, camInfo;
        if (shot.view === "pano") { const p = panoSpot(shot.room); cam = new EquirectCamera(); cam.position.set(p[0], p[1], p[2]); cam.updateMatrixWorld(); camInfo = { pos: p, boxes: e.deviceBoxes() }; }
        else {
          const pose = e.pose(shot.view, shot.room, W / H); cam = new THREE.PerspectiveCamera(pose.fov, W / H, 0.05, 400); cam.position.copy(pose.pos); cam.lookAt(pose.target); cam.updateMatrixWorld();
          camInfo = { pos: pose.pos.toArray(), target: pose.target.toArray(), fov: pose.fov, aspect: W / H, boxes: e.deviceBoxes() };
        }
        renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
        const day = e.isDay; sky.topColor.set(day ? "#cfe0ff" : "#1a2050"); sky.bottomColor.set(day ? "#f2ebe0" : "#0b0d17"); sky.update();
        // "Real sky": the sky photo lights the rooms and is seen past the garden and through the windows (photos only)
        const real = e.photoSky(exposure);
        scene.environment = real?.tex || e.skyTexture || sky;
        const envMean = real ? real.mean : e.skyMean || 1;
        scene.environmentIntensity = e.baked && (real || e.skyTexture) ? (e.skyNow?.L || 1) / envMean : e.scene.environmentIntensity;
        if (real) { scene.background = real.tex; scene.backgroundIntensity = real.intensity; }
        else scene.background = shot.view !== "3d" ? null : new THREE.Color("#0B0D17");
        let gaveUp = this.traceBroken || lost;
        if (!gaveUp) { pt.setScene(scene, cam); pt.reset(); }
        // trace, a little at a time so the page stays smooth; pause while you move the view
        let lastS = -1, lastT = performance.now(), first = true;
        while (!gaveUp && pt.samples < target) {
          if (token !== this.token) return;
          if (e.busy || e.keys?.size) { await wait(400); lastT = performance.now(); continue; }
          if (lost) { gaveUp = true; break; }
          pt.renderSample();
          // the first light can take a while (the chip prepares the tracer); after that it must keep moving
          if (pt.samples !== lastS) { if (lastS >= 0) first = false; lastS = pt.samples; lastT = performance.now(); }
          else if (performance.now() - lastT > (first ? 150000 : 30000)) { gaveUp = true; break; }
          if ((this._n = (this._n || 0) + 1) % 9 === 0) { this.onProgress({ state: "working", done: i, total: shots.length, f: (i + 0.9 * Math.min(1, pt.samples / target)) / shots.length, name: shot.name }); await wait(8); }
        }
        if (token !== this.token) return;
        if (gaveUp) {
          if (!this.traceBroken) console.warn("Roost Atelier photo studio: tracing stopped on this graphics chip; plain 3D pictures are made instead");
          this.traceBroken = true;
          const c2 = shot.view === "pano" ? rasterPano(shot, cam, W, H, exposure, toneMapping) : rasterShot(shot, cam, W, H, exposure, toneMapping);
          if (c2 && !dark(c2)) {
            let blob = await new Promise((r) => c2.toBlob(r, "image/jpeg", 0.9));
            if (blob) blob = await withCamera(blob, camInfo).catch(() => blob);
            if (token !== this.token) return;
            if (blob) await this.save(shot.key, blob).catch(() => {});
            this.onProgress({ state: "working", done: i + 1, total: shots.length, f: (i + 1) / shots.length, name: shot.name, saved: shot.key });
          } else { this.black = (this.black || 0) + 1; this.onProgress({ state: "working", done: i + 1, total: shots.length, f: (i + 1) / shots.length, name: shot.name, black: true }); }
          continue;
        }
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
          } catch (err) { console.warn("Roost Atelier AI clean-up:", err); aiFailed(); smoothed(scene, cam, exposure); }
        } else smoothed(scene, cam, exposure);
        // never keep a black photo: show the traced picture instead, and if that is black too, keep the old photo
        // still black (the graphics chip gave up on tracing at this size): the 3D view's own picture, with its stored light
        let out = canvas;
        if (dark(canvas)) traced();
        if ((this.forceRaster || dark(canvas)) && shot.view !== "pano") { const c2 = rasterShot(shot, cam, W, H, exposure, toneMapping); if (c2 && !dark(c2)) out = c2; }
        if (out === canvas && dark(canvas)) { if (dark(canvas)) { console.warn("Roost Atelier photo studio: the photo came out black on this graphics chip"); this.onProgress({ state: "working", done: i + 1, total: shots.length, f: (i + 1) / shots.length, name: shot.name, black: true }); this.black = (this.black || 0) + 1; continue; } }
        // the picture carries the camera it was taken with, so the dashboard card can put device buttons on it
        let blob = await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
        if (blob) blob = await withCamera(blob, camInfo).catch(() => blob);
        if (token !== this.token) return;
        if (blob) await this.save(shot.key, blob).catch(() => {});
        this.onProgress({ state: "working", done: i + 1, total: shots.length, f: (i + 1) / shots.length, name: shot.name, saved: shot.key });
      }
      this.onProgress({ state: this.black ? "black" : "done", done: shots.length, total: shots.length, f: 1, black: this.black });
      return !this.black;
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
