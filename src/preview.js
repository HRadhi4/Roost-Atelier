// A small live 3D picture of the selected piece of furniture, shown in the side panel.
// It turns slowly by itself, can be turned with a finger or the mouse, and follows every change at once.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { build, dims } from "./furniture.js";

export class ItemPreview {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pv3";
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.7; pm.dispose();
    const key = new THREE.DirectionalLight("#fff4e6", 1.6); key.position.set(3, 6, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.001;
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
    this.scene.add(key);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShadowMaterial({ opacity: 0.28 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.camera = new THREE.PerspectiveCamera(30, 1.6, 0.05, 100);
    this.angle = -0.6; this.spin = true;
    this.canvas.addEventListener("pointerdown", (e) => { this._drag = e.clientX; this.spin = false; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener("pointermove", (e) => { if (this._drag == null) return; this.angle -= (e.clientX - this._drag) * 0.012; this._drag = e.clientX; this.draw(); });
    this.canvas.addEventListener("pointerup", () => { this._drag = null; clearTimeout(this._resume); this._resume = setTimeout(() => (this.spin = true), 3000); });
    this.tick = this.tick.bind(this);
  }
  // put the preview into a place in the panel and show this piece
  mount(host, it) {
    host.appendChild(this.canvas); this.set(it);
    if (!this._raf) this._raf = requestAnimationFrame(this.tick);
  }
  set(it) {
    if (!it) return;
    const d = dims(it), key = JSON.stringify([it.kind, d.w, d.d, d.h, it.color, it.mount]);
    if (key === this._key) return; this._key = key;
    if (this.obj) { this.scene.remove(this.obj); this.obj.traverse((o) => o.geometry?.dispose?.()); }
    const g = build({ ...it, rot: 0 });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // hanging pieces are shown from below, the rest standing on the floor
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    g.position.set(-c.x, -box.min.y, -c.z);
    this.obj = new THREE.Group(); this.obj.add(g); this.scene.add(this.obj);
    const r = Math.max(0.3, 0.5 * Math.hypot(size.x, size.y, size.z));
    this.ground.scale.setScalar(Math.max(size.x, size.z) * 0.85 + 0.2);
    this.fit = { r, y: size.y / 2 };
    this.draw();
  }
  tick(now) {
    if (!this.canvas.isConnected) { this._raf = null; return; }
    this._raf = requestAnimationFrame(this.tick);
    // a slow turn needs only 30 pictures a second
    if (this.spin && !document.hidden) { if (now - (this._t || 0) < 32) return; const dt = Math.min(0.1, (now - (this._t || now)) / 1000); this.angle += dt * 0.35; this._t = now; this.draw(); }
    else this._t = now;
  }
  draw() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h || !this.fit) return;
    if (this._w !== w || this._h !== h) { this._w = w; this._h = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    const { r, y } = this.fit, v = (this.camera.fov * Math.PI) / 360, dist = (r / Math.sin(Math.min(v, Math.atan(Math.tan(v) * this.camera.aspect)))) * 0.85;
    this.camera.position.set(Math.sin(this.angle) * dist * 0.9, y + dist * 0.42, Math.cos(this.angle) * dist * 0.9);
    this.camera.lookAt(0, y * 0.9, 0);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { cancelAnimationFrame(this._raf); this._raf = null; this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.canvas.remove(); }
}
