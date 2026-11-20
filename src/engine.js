// The 3D home: builds the model from the plan, lights it like the real thing, and keeps it smooth.
// It only draws when something changes (or moves), lowers its sharpness while you drag, and can refine
// into a photo-real image when left alone (photo mode).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

// Real skies photographed as panoramas (day, sunset, night): they light the rooms and show in reflections
export const ENV_BASE = { url: new URL("../env/", import.meta.url).href };
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { N8AOPass } from "n8ao";
import { walls, openingsOn, centroid, inside, planBounds, ROOM_TYPES } from "./model.js";
import { floorMaterial, wallMaterial, solid, wood, glass, metal, fabric, onTextures, terraceMaterial } from "./materials.js";
import { build as buildItem, dims, DEVICE_LOOKS } from "./furniture.js";
import { deviceKind, lightLook, stateOf, kelvinToHex, pretendNext } from "./devices.js";
import { BakeManager, refreshBaked } from "./bake/index.js";
import { emittersFor, lampModel, aimModel, anchorOf } from "./lights.js";
import { stairHole, stairsArriving, holeRails, clipTo, riseTo, elevOf } from "./stairs.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const seg = (a) => Math.max(1, Math.ceil(a / 0.3));
// texture coordinates in metres, so a real plaster grain is the same size on every wall
function metreUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); if (ay > 0.5) uv.setXY(i, p.getX(i), p.getZ(i)); else if (ax > 0.5) uv.setXY(i, p.getZ(i), p.getY(i)); else uv.setXY(i, p.getX(i), p.getY(i)); }
  uv.needsUpdate = true; return g;
}
const wallGeo = (l, h, t) => metreUV(new THREE.BoxGeometry(l, h, t, seg(l), seg(h), 1));
// floors and ceilings are split into small pieces so the stored light has enough detail
function fineShape(pts, flip, holes = []) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, flip ? y : -y)));
  // openings for stairs going through the floor or the ceiling
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, flip ? y : -y))));
  let g = new THREE.ShapeGeometry(shape); g.deleteAttribute("normal");
  g = new TessellateModifier(0.32, 10).modify(g);
  g = mergeVertices(g); g.computeVertexNormals();
  g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
  return g;
}


// a surface the lamps never reach (the plinth under the house, the slab between levels): lit by the sun and sky
// only, so lamp light never shows through a wall on it
// the garden's own sunlight: the house's light is stored (baked), the garden's is drawn live and kept in balance
// with the rooms (outdoors is far brighter than indoors, so it is toned down like a good photo of a house)
const GARDEN = { gSunDir: { value: new THREE.Vector3(0, 1, 0) }, gSunCol: { value: new THREE.Color(0, 0, 0) }, gEnvK: { value: 1 }, gFill: { value: new THREE.Color(0, 0, 0) } };
function gardenLit(m) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GARDEN);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 gSunDir; uniform vec3 gSunCol; uniform float gEnvK; uniform vec3 gFill;")
      .replace("#include <lights_fragment_begin>", THREE.ShaderChunk.lights_fragment_begin.replaceAll("( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )", "0").replaceAll("( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )", "0"))
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= gEnvK; reflectedLight.indirectSpecular *= gEnvK; reflectedLight.directDiffuse += BRDF_Lambert( material.diffuseColor ) * ( max( dot( geometryNormal, gSunDir ), 0.0 ) * gSunCol + gFill );");
  };
  m.customProgramCacheKey = () => "roost-garden"; return m;
}
function noLamps(m) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_begin>", THREE.ShaderChunk.lights_fragment_begin.replaceAll("( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )", "0").replaceAll("( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )", "0")); };
  m.customProgramCacheKey = () => "roost-nolamps"; return m;
}

const isOn = (kind, st) => (kind === "curtain" ? st.open > 0.05 : kind === "door" ? !!st.open : kind === "lock" ? !st.locked : !!st.on);
const CUT = 1.15;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function pickQuality(renderer) {
  const gl = renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (/SwiftShader|llvmpipe|Mali-(4|T)|Adreno \(TM\) [345]\d\d/i.test(gpu) || cores <= 4 || mem <= 2) return "low";
  if (/Mali|Adreno|PowerVR|Apple GPU/i.test(gpu) || /Android|iPad|iPhone/i.test(navigator.userAgent)) return "medium";
  // graphics built into the processor (most laptops and mini PCs): lighter effects keep it smooth
  if (!/Arc/i.test(gpu) && /Intel|Iris|UHD Graphics|HD Graphics|Radeon\(TM\) Graphics|Radeon Graphics|Radeon Vega|Vega \d/i.test(gpu)) return "medium";
  return "high";
}

// How each wall end meets the others: straight on (no overlap), into a T (stops at the face),
// or at a corner (one wall wraps the corner, the other stops against it).
function joinEnds(ws) {
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`, nodes = new Map();
  ws.forEach((w, i) => { if (w.parapet) return; [["a", 0], ["b", 1]].forEach(([e, k]) => { const id = key(w[e]); if (!nodes.has(id)) nodes.set(id, []); nodes.get(id).push({ w, i, end: k }); }); });
  const dir = (w, end) => { const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], l = Math.hypot(dx, dy); return end ? [-dx / l, -dy / l] : [dx / l, dy / l]; };
  for (const list of nodes.values()) {
    const coll = (x) => list.some((y) => y !== x && (() => { const a = dir(x.w, x.end), b = dir(y.w, y.end); return a[0] * b[0] + a[1] * b[1] < -0.999; })());
    const through = list.filter(coll);
    for (const x of list) {
      let ext;
      if (list.length === 1) ext = x.w.thick / 2;
      else if (coll(x)) ext = 0;
      else if (through.length) ext = -Math.max(...through.map((y) => y.w.thick)) / 2;
      else { const first = list.reduce((m, y) => (y.i < m.i ? y : m)); ext = x === first ? Math.max(...list.map((y) => y.w.thick)) / 2 : -first.w.thick / 2; }
      x.w[x.end ? "ext1" : "ext0"] = ext;
    }
  }
}

export class AtelierEngine {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = { quality: "auto", walls: "cut", view: "3d", hotspots: true, editing: false, ...opts };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
    host.appendChild(this.renderer.domElement);
    // the browser can take the graphics away (too many 3D views, a driver hiccup): say so, so the view can be rebuilt
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; this.emit("lost"); });
    this.quality = this.opts.quality === "auto" ? pickQuality(this.renderer) : this.opts.quality;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
    this.camera.position.set(14, 16, 18);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.09, screenSpacePanning: true, maxPolarAngle: Math.PI * 0.47, minDistance: 2, maxDistance: 80, zoomToCursor: true });
    this.controls.addEventListener("change", () => this.request(true));
    this.controls.addEventListener("start", () => { this.userMoved = true; this.interacting(true); });
    this.controls.addEventListener("end", () => this.interacting(false));

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pm.dispose();

    this.hemi = new THREE.HemisphereLight("#ffffff", "#b8ad9c", 0.6);
    this.sun = new THREE.DirectionalLight("#fff2dc", 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT);
    this.devices = new Map(); this.anims = new Set(); this.hot = [];
    this.states = {}; this.dirty = true; this.shadowsDirty = true; this.alive = true; this.visible = true;
    this.listeners = {};
    // if the light can't be worked out here, go back to the simple light
    this.on("bake", ({ state }) => { if ((state === "failed" || state === "waiting") && this.rebaking) { this.rebaking = false; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; for (const r of this.devices.values()) this.lightIntensity(r); this.fitSun(); } });
    // a real texture arrived from Home Assistant: show it (the baked copies of the material follow)
    this._offTex = onTextures((m) => { refreshBaked(m); this.request(false); });
    this.bakeMgr = new BakeManager(this); this.clearSky = 1; this.location = opts.location || null;
    this.setupComposer();
    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(host);
    this.resize();
    this.renderer.domElement.addEventListener("pointerdown", (e) => this.pointerDown(e));
    this.renderer.domElement.addEventListener("pointerup", (e) => this.pointerUp(e));
    this.renderer.domElement.addEventListener("pointermove", (e) => this.walkLook(e));
    // arrow keys (or W A S D) walk through the home; only after the 3D view was used, so they don't steal keys elsewhere
    this.keys = new Set(); this._fc = 0;
    const WK = { ArrowUp: "f", KeyW: "f", ArrowDown: "b", KeyS: "b", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
    this._kd = (e) => {
      const k = WK[e.code]; if (!k || this.view !== "walk" || !this.kbActive || !this.alive || !this.host.isConnected) return;
      if (e.composedPath().some((n) => n.matches?.("input,select,textarea,[contenteditable]"))) return;
      e.preventDefault(); if (!this.keys.has(k)) { this.keys.add(k); this.interacting(true); this.request(true); }
    };
    this._ku = (e) => { const k = WK[e.code]; if (!k || !this.keys.delete(k)) return; if (!this.keys.size) this.interacting(false); };
    this._blur = () => { if (this.keys.size) { this.keys.clear(); this.interacting(false); } };
    this._pd = (e) => { this.kbActive = e.composedPath().includes(this.renderer.domElement); };
    window.addEventListener("keydown", this._kd); window.addEventListener("keyup", this._ku); window.addEventListener("blur", this._blur); window.addEventListener("pointerdown", this._pd, true);
    this._t = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }

  // ---------------------------------------------------------------- quality and drawing
  baseRatio() { return Math.min(window.devicePixelRatio || 1, { low: 1, medium: 1.5, high: 2 }[this.quality]); }
  setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    // the soft-shadow pass draws the home itself, so the plain drawing pass only runs when it is off
    this.renderPass = new RenderPass(this.scene, this.camera); this.composer.addPass(this.renderPass);
    if (this.quality !== "low") {
      this.ao = new N8AOPass(this.scene, this.camera, 2, 2);
      Object.assign(this.ao.configuration, { aoRadius: 0.6, distanceFalloff: 0.6, intensity: 2.2, halfRes: this.quality === "medium", denoiseSamples: this.quality === "medium" ? 4 : 8, screenSpaceRadius: false });
      this.ao.setQualityMode(this.quality === "medium" ? "Low" : "Medium");
      this.composer.addPass(this.ao); this.renderPass.enabled = false;
    }
    if (this.quality === "high") { this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.25, 0.4, 0.92); this.composer.addPass(this.bloom); }
    this.composer.addPass(new OutputPass());
    // smooth edges (no jagged stair-steps on walls and furniture)
    this.smaa = new SMAAPass(); this.composer.addPass(this.smaa);
  }
  resize() {
    const w = this.host.clientWidth || 300, h = this.host.clientHeight || 200;
    this.size = [w, h];
    const r = this.baseRatio() * (this.lowRes ? 0.6 * (this.scale || 1) : 1);
    this.renderer.setPixelRatio(r); this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(r); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // keep the whole home in view until someone moves the camera themselves
    if (!this.userMoved && this.plan && !this.tween && !this.busy && this.view !== "walk") this.frame(this.view || "3d", true);
    this.request(true);
  }
  interacting(on) {
    this.busy = on; this.photo?.stop();
    clearTimeout(this._idle);
    // while moving: lower resolution and no soft shadows or glow; the full picture returns when still
    if (on) { if (!this.lowRes) { this.lowRes = true; this.fx(false); this.resize(); } }
    else this._idle = setTimeout(() => { this.lowRes = false; this.fx(true); this.resize(); if (this.opts.photo) this.startPhoto(); }, 250);
  }
  fx(on) { if (this.ao) { this.ao.enabled = on; this.renderPass.enabled = !on; } if (this.bloom) this.bloom.enabled = on; this.request(false);
  }
  request(camMoved) { this.dirty = true; if (camMoved) { this.camMoved = true; this.photo?.stop(); } }
  loop() {
    if (!this.alive) return;
    requestAnimationFrame(this.loop);
    const now = performance.now(), dt = Math.min(0.05, (now - this._t) / 1000); this._t = now;
    if (!this.visible) return;
    if (this.tween) this.stepTween(dt);
    const damping = this.controls.enabled && this.controls.update();
    if (this.anims.size) { for (const a of [...this.anims]) if (a(dt) === false) this.anims.delete(a); this.dirty = true; }
    if (this.view === "walk" && this.keys.size) this.stepWalk(dt);
    // the light mix only changes when something changes; otherwise it is checked twice a second
    if (this.baked && (this.dirty || damping || this.anims.size || this.tween || this.keys.size || this._expoMoving || now - (this._wT || 0) > 500)) { this._wT = now; this.bakeWeights(dt); }
    if (this.photo?.active) { try { this.photo.step(); } catch (err) { console.warn("Roost Atelier photo mode:", err); this.photo.stop(); this.opts.photo = false; this.emit("photo", { progress: -2, error: String(err?.message || err) }); } return; }
    if (!this.dirty && !damping) return;
    // moving things alone (AC air, a fan, the TV) are drawn at most 30 times a second
    if (this.anims.size && !this.busy && !this.tween && !this.camMoved && !damping && now - (this._lastR || 0) < 32) return;
    this.dirty = false;
    // if the computer can't keep up, draw fewer pixels; give them back when it can
    const gap = now - (this._lastR || 0); this._lastR = now;
    if (gap < 120) {
      this._ft = this._ft ? this._ft * 0.9 + gap * 0.1 : gap;
      if (++this._fc % 30 === 0) {
        if (this._ft > 40 && (this.scale || 1) > 0.5) { this.scale = Math.max(0.5, (this.scale || 1) * 0.85); this.resize(); }
        else if (this._ft < 21 && (this.scale || 1) < 1) { this.scale = Math.min(1, (this.scale || 1) / 0.85); this.resize(); }
      }
    }
    // the garden's sun, in the camera's frame
    if (this.baked) { GARDEN.gSunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize().transformDirection(this.camera.matrixWorldInverse); }
    if (this.shadowsDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowsDirty = false; }
    this.composer.render();
    if (this.camMoved || this.anims.size) { this.camMoved = false; this.projectHotspots(); }
  }
  setVisible(v) { this.visible = v; if (v) this.request(true); }

  // ---------------------------------------------------------------- building the home
  setPlan(plan, floorIndex = 0) {
    // the same home again (a save that changed nothing here, another level edited): nothing to rebuild
    const { time: _time, ...looks } = plan.settings || {}, sig = JSON.stringify([plan.id, floorIndex, plan.settings?.levels ? plan.floors : plan.floors[floorIndex] || plan.floors[0], looks, plan.north]);
    void _time;
    if (sig === this._sig && this.floor) { this.plan = plan; this.floor = plan.floors[floorIndex] || plan.floors[0]; this.fitSun(); this.request(true); return; }
    this._sig = sig;
    this.plan = plan; this.floorIndex = floorIndex; this.version = (this.version || 0) + 1;
    // after a change the light is worked out again; meanwhile the same real-world units and exposure are kept,
    // so the picture doesn't jump to a brighter, flatter look
    this.rebaking = this.baked || this.rebaking;
    this.baked = false; this.bakeMgr.active = false; this.renderer.toneMapping = this.rebaking ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    const floor = plan.floors[floorIndex] || plan.floors[0];
    this.floor = floor;
    this.clear();
    const H = floor.height || 2.8;
    this.H = H;
    this.rooms = new THREE.Group(); this.wallsG = new THREE.Group(); this.items = new THREE.Group(); this.devG = new THREE.Group(); this.ceilings = new THREE.Group();
    this.root.add(this.rooms, this.wallsG, this.items, this.devG, this.ceilings);
    // stairs: those arriving from the level below open this floor; those going up from here open the ceiling
    const arriving = stairsArriving(plan, floorIndex), leaving = floor.items.filter((i) => i.kind === "stairs" && i.link != null && plan.floors[i.link]);
    const upHoles = arriving.map(stairHole), downHoles = leaving.map(stairHole);
    for (const r of floor.rooms) this.addRoom(r, H, upHoles, downHoles);
    const ws = walls(floor); joinEnds(ws);
    for (const w of ws) this.addWall(w, floor, H);
    for (const it of floor.items) this.addItem(it, H);
    for (const d of floor.devices) this.addDevice(d, H);
    // the stairs coming up from below, seen through their opening, and the railing round it
    for (const it of arriving) {
      const rise = riseTo(plan, floorIndex - 1), g = buildItem({ ...it, h: rise }); g.position.set(it.x, -rise, it.y); g.rotation.y = ((it.rot || 0) * Math.PI) / 180;
      // only the top of the flight shows (through the opening), so nothing hangs under the house seen from outside
      const keep = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.4)];
      g.userData.item = undefined; g.traverse((o) => { if (o.isMesh) { o.userData.stairs = it.id; o.userData.noBake = true; o.material = o.material.clone(); o.material.clippingPlanes = keep; } }); this.items.add(g); this.items.add(holeRails(it));
    }
    // the floor between the levels: 30 cm thick, with the stair openings through it, so their edges look solid
    if (arriving.length) {
      const holes = arriving.map(stairHole), slabM = noLamps(solid("#E4DED4", { rough: 0.9 }).clone());
      for (const r of floor.rooms) {
        const shape = new THREE.Shape(r.pts.map(([x, y]) => new THREE.Vector2(x, -y)));
        for (const h of holes.map((h) => clipTo(h, r.pts)).filter(Boolean)) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, -y))));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, slabM); m.position.y = -0.302; m.receiveShadow = true; m.castShadow = true; m.userData.noBake = true; this.root.add(m);
      }
    }
    this.addGround(floor, arriving.length > 0);
    for (const [k, g] of this._shapes || []) if (!this._shapesNext?.has(k)) g.dispose();
    this._shapes = this._shapesNext || new Map(); this._shapesNext = null;
    if (plan.settings?.levels && plan.floors.length > 1) this.addLevelsBelow(plan, floorIndex);
    this.applyWalls();
    this.fitSun();
    if (!this._framed) { this.frame(this.opts.view || "3d", true); this._framed = true; }
    this.updateDevices(true);
    this.shadowsDirty = true; this.request(true);
    this.emit("built");
    this.bakeMgr.onBuilt();
  }
  clear() {
    // shapes and the materials made only for this build are freed; shared materials stay for the next build
    const gone = new Set();
    for (const c of [...this.root.children]) { this.root.remove(c); this.collect(c, gone); }
    this.free(gone);
    for (const d of this.devices.values()) { if (d.light) { this.scene.remove(d.light); if (d.light.target) this.scene.remove(d.light.target); } }
    this.devices.clear(); this.anims.clear(); this.hot = [];
  }
  collect(obj, gone) {
    const mats = (m) => (Array.isArray(m) ? m : m ? [m] : []);
    obj.traverse?.((o) => {
      if (o.geometry && !o.geometry.parameters?.shared && !o.geometry.userData?.kept) o.geometry.dispose?.();
      for (const k of ["fullGeo", "cutGeo"]) if (o.userData?.[k] && o.userData[k] !== o.geometry) o.userData[k].dispose();
      for (const m of [...mats(o.material), ...mats(o.userData?.liveMaterial)]) if (!m.userData?.shared && !m.userData?.sharedBaked && !m.userData?.keep) gone.add(m);
    });
    return gone;
  }
  free(gone) { for (const m of gone) { if (m.emissiveMap === this._tv) m.emissiveMap = null; m.envMap = null; m.dispose(); } }
  // the levels under this one, drawn simply (floors and walls, no furniture), so the home reads as one building
  addLevelsBelow(plan, fi) {
    const elev = (j) => (j === 0 || plan.floors[j].elevation ? plan.floors[j].elevation || 0 : plan.floors.slice(0, j).reduce((a, f) => a + (f.height || 2.8) + 0.3, 0));
    const here = elev(fi), g = new THREE.Group(); g.name = "levels";
    const slab = new THREE.MeshStandardMaterial({ color: "#D9D4CB", roughness: 0.95 }), wall = new THREE.MeshStandardMaterial({ color: "#EAE6DF", roughness: 0.95 });
    plan.floors.forEach((f, j) => {
      const dy = elev(j) - here; if (j === fi || dy >= 0) return;
      const H = f.height || 2.8;
      for (const r of f.rooms) { const m = new THREE.Mesh(fineShape(r.pts, false), slab); m.position.y = dy; m.receiveShadow = true; g.add(m); }
      const ws = walls(f); joinEnds(ws);
      for (const w of ws) {
        const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); if (len < 0.05) continue;
        const h = w.parapet ? 1 : H, m = new THREE.Mesh(new THREE.BoxGeometry(len + w.thick, h, w.thick), wall);
        m.position.set((w.a[0] + w.b[0]) / 2, dy + h / 2, (w.a[1] + w.b[1]) / 2); m.rotation.y = -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
        m.castShadow = false; m.receiveShadow = true; g.add(m);
      }
    });
    g.traverse((o) => { o.userData.noBake = true; });
    this.root.add(g);
  }
  // floor and ceiling shapes are kept between rebuilds: an unchanged room reuses its own (cutting them is slow)
  shape(pts, flip, holes = []) {
    const k = (flip ? "c" : "f") + JSON.stringify(pts) + (holes.length ? JSON.stringify(holes) : "");
    let g = this._shapes?.get(k);
    if (!g) { g = fineShape(pts, flip, holes); g.userData.kept = true; }
    (this._shapesNext ||= new Map()).set(k, g);
    return g;
  }
  addRoom(r, H, up = [], down = []) {
    const cut = (list) => list.map((h) => clipTo(h, r.pts)).filter(Boolean);
    const geo = this.shape(r.pts, false, cut(up));
    const type = ROOM_TYPES[r.type] || ROOM_TYPES.other;
    const m = new THREE.Mesh(geo, floorMaterial(r.floor || type.floor));
    m.receiveShadow = true; m.userData.room = r.id; m.name = "floor";
    this.rooms.add(m);
    if (!type.outdoor) {
      const c = new THREE.Mesh(this.shape(r.pts, true, cut(down)), solid("#F7F5F1", { rough: 0.95 })); c.position.y = H; c.receiveShadow = true; c.name = "ceiling";
      this.ceilings.add(c);
    }
  }
  sideRoom(w, side, floor) {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const mx = (w.a[0] + w.b[0]) / 2 + nx * side * 0.2, my = (w.a[1] + w.b[1]) / 2 + ny * side * 0.2;
    return floor.rooms.find((r) => inside([mx, my], r.pts));
  }
  addWall(w, floor, H) {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), t = w.thick;
    if (w.parapet) { this.wallBox(w, 0, len, 0, 1.0, solid("#E9E4DA", { rough: 0.9 }), solid("#E9E4DA", { rough: 0.9 }), ang, t * 0.6, true); return; }
    const left = this.sideRoom(w, 1, floor), right = this.sideRoom(w, -1, floor);
    const ext = solid("#E7DFD2", { rough: 0.95 });
    const matL = left && !ROOM_TYPES[left.type]?.outdoor ? wallMaterial(left.wall || "warm-white") : ext;
    const matR = right && !ROOM_TYPES[right.type]?.outdoor ? wallMaterial(right.wall || "warm-white") : ext;
    const ops = openingsOn(w, floor.openings);
    let pos = 0;
    for (const { op, t0, t1 } of ops) {
      if (t0 > pos) this.wallBox(w, pos, t0, 0, H, matL, matR, ang, t);
      const top = op.sill + op.height;
      if (op.sill > 0) this.wallBox(w, t0, t1, 0, op.sill, matL, matR, ang, t);
      if (top < H) this.wallBox(w, t0, t1, top, H, matL, matR, ang, t);
      this.addOpening(op, w, t0, t1, ang, t, floor);
      pos = t1;
    }
    if (pos < len) this.wallBox(w, pos, len, 0, H, matL, matR, ang, t);
  }
  wallBox(w, s0, s1, y0, y1, matL, matR, ang, t, low = false) {
    const len = s1 - s0; if (len < 0.01 || y1 - y0 < 0.01) return;
    const atEnd0 = s0 < 0.001, atEnd1 = Math.abs(s1 - Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])) < 0.001;
    // wall ends meet without overlapping, so no two surfaces share the same spot (clean photos)
    const ext0 = atEnd0 ? w.ext0 ?? t / 2 : 0, ext1 = atEnd1 ? w.ext1 ?? t / 2 : 0;
    const geo = wallGeo(len + ext0 + ext1, y1 - y0, t);
    const capTop = solid("#2A2F45", { rough: 0.85 });
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. +z faces the left side of a→b in plan (y down) after rotation.
    // faces: +x, -x, +y (top), -y, +z (left side of a->b), -z (right side)
    const m = new THREE.Mesh(geo, [matL, matR, capTop, matL, matL, matR]);
    const cx = (s0 - ext0 + s1 + ext1) / 2, ux = Math.cos(ang), uy = Math.sin(ang);
    m.position.set(w.a[0] + ux * cx, (y0 + y1) / 2, w.a[1] + uy * cx);
    m.rotation.y = -ang;
    m.castShadow = true; m.receiveShadow = true; m.userData.wall = true; m.userData.y1 = y1; m.userData.y0 = y0; m.userData.low = low;
    m.userData.fullGeo = geo; m.userData.fullY = (y0 + y1) / 2;
    if (y0 < CUT && y1 > CUT) { m.userData.cutGeo = wallGeo(len + ext0 + ext1, CUT - y0, t); m.userData.cutY = y0 + (CUT - y0) / 2; }
    this.wallsG.add(m);
    return m;
  }
  addOpening(op, w, t0, t1, ang, t, floor) {
    const ux = Math.cos(ang), uy = Math.sin(ang), mid = (t0 + t1) / 2, cx = w.a[0] + ux * mid, cz = w.a[1] + uy * mid, width = t1 - t0;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = -ang; g.userData.opening = op.id; g.userData.exterior = !!w.exterior; g.userData.width = width;
    const frameM = op.type === "window" || op.type === "slider" ? metal("#2B2D33", 0.4) : solid("#F3F1EC", { rough: 0.6 });
    const fw = 0.05;
    const top = op.sill + op.height;
    if (op.type !== "arch") {
      for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(fw, op.height, t + 0.02), frameM); f.position.set(s * (width / 2 - fw / 2), op.sill + op.height / 2, 0); f.castShadow = true; g.add(f); }
      const head = new THREE.Mesh(new THREE.BoxGeometry(width, fw, t + 0.02), frameM); head.position.set(0, top - fw / 2, 0); g.add(head);
    }
    if (op.type === "window") {
      // the sill sits just above the wall under the window (never at exactly the same height, which flickers) and is
      // split into small pieces so its stored light is smooth instead of dark blotches from its hidden ends
      const sill = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, t + 0.08, seg(width) * 2, 1, 2), solid("#EDEAE4", { rough: 0.3 })); sill.position.set(0, op.sill + 0.005, 0); g.add(sill);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(width - fw * 2, op.height - fw * 2), glass()); pane.position.set(0, op.sill + op.height / 2, 0); pane.userData.glass = true; g.add(pane);
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.03, op.height - fw * 2, 0.04), frameM); mull.position.set(0, op.sill + op.height / 2, 0); if (width > 1.2) g.add(mull);
    } else if (op.type === "slider") {
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(width / 2 - fw, op.height - fw * 2, 0.02), glass()); p.position.set(s * width / 4, op.sill + op.height / 2, s * 0.02); p.name = s < 0 ? "slideL" : "slideR"; p.userData.glass = true; g.add(p); const fr = new THREE.Mesh(new THREE.BoxGeometry(width / 2 - fw, op.height - fw * 2, 0.025), frameM); fr.scale.set(1, 1, 1); }
    } else if (op.type === "door") {
      const leaves = op.double ? [[-1, width / 2], [1, width / 2]] : [[op.swing >= 0 ? -1 : 1, width]];
      const mat = op.main ? wood("walnut") : solid("#F7F5F1", { rough: 0.5 });
      for (const [side, lw] of leaves) {
        const hinge = new THREE.Group(); hinge.position.set(side * (width / 2 - fw), 0, 0); hinge.name = "leaf"; hinge.userData.side = side; hinge.userData.swing = op.swing >= 0 ? 1 : -1;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw - fw * (op.double ? 1 : 2), op.height - fw, 0.04), mat); leaf.position.set(-side * (lw - fw * (op.double ? 1 : 2)) / 2, (op.height - fw) / 2, 0); leaf.castShadow = true; leaf.receiveShadow = true;
        hinge.add(leaf);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.05), metal("#C9A35A", 0.3)); handle.position.set(-side * (lw - 0.14), 1.0, 0.04); hinge.add(handle);
        g.add(hinge);
      }
    }
    // each opening gets its own materials so it can be cut at waist height with the walls
    g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.userData.cuttable = true; } });
    this.wallsG.add(g);
  }
  addItem(it, H) {
    // stairs joined to the level above are exactly as tall as the climb to it
    const g = buildItem(it.kind === "stairs" && it.link != null && this.plan?.floors[it.link] ? { ...it, h: riseTo(this.plan, this.floorIndex) } : it), d = dims(it);
    const y = d.mount === "ceiling" ? H : d.mount === "wall" ? d.z : 0;
    g.position.set(it.x, y, it.y); g.rotation.y = ((it.rot || 0) * Math.PI) / 180;
    g.traverse((o) => { if (o.isMesh) o.userData.item = it.id; });
    Object.assign(g.userData, { item: it.id, w: d.w, d: d.d, h: d.h, color: it.color });
    this.items.add(g);
  }
  // change one piece (size, colour, a new piece) without rebuilding the whole home
  replaceItem(it) {
    if (!this.items || !this.floor?.items.includes(it)) return false;
    const old = this.items.children.find((c) => c.userData.item === it.id); if (old) { this.items.remove(old); this.free(this.collect(old, new Set())); }
    this.addItem(it, this.H);
    for (const o of this.floor.items) if (o !== it) this.moveItem(o);
    // the light is worked out again once you stop changing things
    clearTimeout(this._rebake); this._rebake = setTimeout(() => this.bakeMgr.onBuilt(), 1500);
    this.shadowsDirty = true; this.request(false); return true;
  }
  // move one piece without rebuilding the whole home (smooth dragging)
  moveItem(it) {
    const g = this.items?.children.find((c) => c.userData.item === it.id); if (!g) return false;
    const d = dims(it); if (d.w !== g.userData.w || d.d !== g.userData.d || d.h !== g.userData.h || it.color !== g.userData.color) return false;
    const y = d.mount === "ceiling" ? this.H : d.mount === "wall" ? d.z : 0;
    g.position.set(it.x, y, it.y); g.rotation.y = ((it.rot || 0) * Math.PI) / 180;
    this.shadowsDirty = true; this.request(false); return true;
  }
  addGround(floor, open = false) {
    const b = planBounds(floor), w = b.x1 - b.x0 + 40, d = b.y1 - b.y0 + 40;
    const garden = this.plan?.settings?.garden !== false, ground = -elevOf(this.plan || { floors: [floor] }, this.floorIndex || 0);
    if (garden) this.addGarden(b, ground);
    else {
      const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.ShadowMaterial({ opacity: 0.18 })); m.position.set((b.x0 + b.x1) / 2, ground - 0.005, (b.y0 + b.y1) / 2); m.receiveShadow = true; m.userData.noBake = true;
      this.root.add(m);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 0.4, 0.12, b.y1 - b.y0 + 0.4), noLamps(solid("#D6D0C6", { rough: 0.9 }).clone()));
    slab.position.set((b.x0 + b.x1) / 2, -0.07, (b.y0 + b.y1) / 2); slab.receiveShadow = true; slab.userData.noBake = true; if (!open) this.root.add(slab);
    this.bounds = b;
  }
  // the garden round the house: a lawn, a paved terrace along the walls, olive trees and cypresses, so windows and
  // pictures look out onto something. Lit by the sun and sky only (lamps never shine through a wall onto it).
  addGarden(b, y) {
    const g = new THREE.Group(); g.name = "garden";
    const cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + 16;
    const lawnGeo = new THREE.CircleGeometry(R, 72); lawnGeo.rotateX(-Math.PI / 2);
    { const p = lawnGeo.attributes.position, uv = lawnGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + cx, -(p.getZ(i) + cz)); }
    const lawnM = floorMaterial("grass"); if (!lawnM.userData.garden) { gardenLit(lawnM); lawnM.userData.garden = true; }
    const lawn = new THREE.Mesh(lawnGeo, lawnM); lawn.position.set(cx, y - 0.02, cz); lawn.receiveShadow = true; g.add(lawn);
    // the terrace: 1.4 m of paving all round
    const T = 1.4, shape = new THREE.Shape([[b.x0 - T, b.y0 - T], [b.x1 + T, b.y0 - T], [b.x1 + T, b.y1 + T], [b.x0 - T, b.y1 + T]].map(([x, z]) => new THREE.Vector2(x, -z)));
    const terrM = terraceMaterial(); if (!terrM.userData.garden) { gardenLit(terrM); terrM.userData.garden = true; }
    const terr = new THREE.Mesh(new THREE.ShapeGeometry(shape), terrM); terr.geometry.rotateX(-Math.PI / 2); terr.position.y = y - 0.012; terr.receiveShadow = true; g.add(terr);
    // trees: always in the same places for the same home, never on the terrace
    let seed = Math.round((b.x1 - b.x0) * 97 + (b.y1 - b.y0) * 61) || 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bark = gardenLit(solid("#6B5440", { rough: 0.95 }).clone()), leaves = gardenLit(solid("#6E7F4A", { rough: 0.85 }).clone()), dark = gardenLit(solid("#3F5233", { rough: 0.9 }).clone()), shade = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.22, depthWrite: false });
    const placed = [];
    for (let i = 0; i < 14 && placed.length < 9; i++) {
      const a = rnd() * Math.PI * 2, rx = (b.x1 - b.x0) / 2 + T + 1.8 + rnd() * 6, rz = (b.y1 - b.y0) / 2 + T + 1.8 + rnd() * 6, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
      if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3)) continue; placed.push([x, z]);
      const t = new THREE.Group(); t.position.set(x, y, z); t.rotation.y = rnd() * 6;
      if (placed.length % 3 === 0) {
        // a cypress: tall and narrow
        const h = 4.5 + rnd() * 2.5, c = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 10), dark); c.position.y = h / 2 + 0.3; c.scale.set(1, 1, 1); t.add(c);
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), bark); tr.position.y = 0.25; t.add(tr);
      } else {
        // an olive tree: a crooked trunk and a soft round crown of leaf clumps
        const h = 2.2 + rnd() * 1.2, tr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, h, 7), bark); tr.position.y = h / 2; tr.rotation.z = (rnd() - 0.5) * 0.25; t.add(tr);
        for (let k = 0; k < 7; k++) { const r = 0.7 + rnd() * 0.6, l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaves); l.position.set((rnd() - 0.5) * 2.2, h + (rnd() - 0.3) * 0.9, (rnd() - 0.5) * 2.2); l.scale.y = 0.7; t.add(l); }
      }
      t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // a soft shadow on the grass under the crown
      const sh = new THREE.Mesh(new THREE.CircleGeometry(placed.length % 3 === 0 ? 0.8 : 1.6, 24), shade); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.castShadow = false; t.add(sh); g.add(t);
    }
    g.traverse((o) => { o.userData.noBake = true; o.userData.exterior = true; });
    this.root.add(g);
  }
  applyWalls() {
    const mode = this.view === "walk" ? "full" : (this._wallsOverride || this.plan?.settings?.walls || this.opts.walls);
    this.wallsG.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.wall && mode === "cut" && o.userData.y0 >= CUT) { o.visible = false; return; }
      o.visible = true;
      // walls are cut at waist height so you can see into every room; the cut shows as a dark top
      if (o.userData.wall && mode === "cut" && o.userData.cutGeo) { o.geometry = o.userData.cutGeo; o.position.y = o.userData.cutY; }
      else if (o.userData.fullGeo) { o.geometry = o.userData.fullGeo; o.position.y = o.userData.fullY; }
      if (o.userData.cuttable) o.material.clippingPlanes = mode === "cut" ? [this.cutPlane] : null;
    });
    this.ceilings.visible = this.view === "walk";
    if (this.baked) this.fitSun();
    for (const d of this.devices.values()) if (d.mount === "ceiling" && d.obj) d.obj.visible = this.view === "walk" || mode !== "cut" || d.look === "pendant" || d.look === "chandelier";
    this.shadowsDirty = true; this.request(true);
  }

  // ---------------------------------------------------------------- devices
  addDevice(dv, H) {
    const kind = dv.kind || deviceKind(dv.entity), rec = { dv, kind, mount: "floor" };
    const g = new THREE.Group(); g.userData.device = dv.id; rec.obj = g;
    if (kind === "light") {
      const look = dv.look || lightLook(dv);
      rec.look = look;
      const em = emittersFor(dv, look, H, this.floor.rooms.find((r) => inside([dv.x, dv.y], r.pts)));
      let l;
      if (em) {
        // recessed spots, track lights, linear and cove lights, focus lights: exact emitters
        const model = lampModel(dv, look), an = anchorOf(dv, look, H); g.add(model); g.position.set(dv.x, an.y, dv.y); rec.mount = an.mount;
        const lip = model.getObjectByName("lip");
        if (lip) { model.remove(lip); lip.material = solid("#F7F5F1", { rough: 0.95 }); lip.position.set(dv.x, H - 0.125, dv.y); lip.rotation.y = ((dv.rot || 0) * Math.PI) / 180; this.ceilings.add(lip); }
        if (an.turn) g.rotation.y = ((dv.rot || 0) * Math.PI) / 180;
        aimModel(g, dv, look, em);
        rec.emitters = em; rec.lmScale = em.reduce((a, e) => a + (e.w ?? 1), 0);
        const c = em.reduce((a, e) => a.map((v, i) => v + e.p[i] / em.length), [0, 0, 0]), dsum = new THREE.Vector3(...em.reduce((a, e) => a.map((v, i) => v + e.dir[i]), [0, 0, 0])), dir = dsum.clone().normalize();
        rec.lightPos = new THREE.Vector3(...c);
        // a lamp shining two ways at once (up and down wall lights) is one soft point light in the live view
        if (em[0].cone && dsum.length() > 0.3 * em.length) { l = new THREE.SpotLight("#ffd29a", 0, 0, Math.min(1.3, em[0].cone * 1.25), 0.6, 2); l.target.position.copy(rec.lightPos).add(dir); this.scene.add(l.target); rec.cone = em[0].cone; }
        else l = new THREE.PointLight("#ffd29a", 0, 9, 2);
      } else {
        const mk = DEVICE_LOOKS[look] || DEVICE_LOOKS.flush;
        g.add(mk({ style: dv.style }));
        if (look === "floor") { g.position.set(dv.x, 0, dv.y); rec.lightPos = new THREE.Vector3(dv.x, 1.45, dv.y); }
        else { g.position.set(dv.x, H, dv.y); rec.mount = "ceiling"; rec.lightPos = new THREE.Vector3(dv.x, look === "pendant" ? H - 0.79 : look === "chandelier" ? H - 0.85 : H - 0.15, dv.y); }
        l = new THREE.PointLight("#ffd29a", 0, 9, 2);
      }
      l.userData.lamp = true; l.position.copy(rec.lightPos); rec.light = l; this.scene.add(l);
    } else if (kind === "ac") {
      g.add(DEVICE_LOOKS.ac({})); g.position.set(dv.x, H - 0.45, dv.y); g.rotation.y = ((dv.rot || 0) * Math.PI) / 180; rec.mount = "wall";
      rec.air = this.airStream(g);
    } else if (kind === "fan") { g.add(DEVICE_LOOKS.fan({})); g.position.set(dv.x, H, dv.y); rec.mount = "ceiling"; }
    else if (kind === "person") { g.add(DEVICE_LOOKS.person({ color: dv.color })); g.position.set(dv.x, 0, dv.y); }
    else if (kind === "speaker") { g.add(DEVICE_LOOKS.speaker({})); g.position.set(dv.x, dv.z ?? 0.8, dv.y); }
    else if (kind === "vacuum") { g.add(DEVICE_LOOKS.vacuum({})); g.position.set(dv.x, 0, dv.y); }
    else if (kind === "radar") {
      // the small sensor box on the wall, and up to three people walking where it sees them
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), solid("#F3F1EC", { rough: 0.5 })); box.position.z = 0.015; g.add(box);
      g.position.set(dv.x, dv.z ?? 1.9, dv.y); g.rotation.y = ((dv.rot || 0) * Math.PI) / 180; rec.mount = "wall";
      rec.people = [0, 1, 2].map(() => { const p = DEVICE_LOOKS.person({ color: dv.color || "#E86FB0" }); p.visible = false; p.userData.device = dv.id; this.devG.add(p); return p; });
    }
    else if (kind === "curtain") rec.window = this.attachCurtain(dv, H);
    else if (kind === "door" || kind === "lock") rec.door = this.findOpening(dv, ["door"]);
    else if (kind === "tv") rec.screen = this.findScreen(dv);
    else { g.position.set(dv.x, 1.2, dv.y); }
    this.devG.add(g);
    this.devices.set(dv.id, rec);
  }
  // radar targets (left/right and ahead, from the sensor) to spots in the home; people glide there smoothly
  placePeople(rec, people) {
    const dv = rec.dv, a = ((dv.rot || 0) * Math.PI) / 180, flip = dv.flip ? -1 : 1;
    const fx = Math.sin(a), fz = Math.cos(a), rx = Math.cos(a) * flip, rz = -Math.sin(a) * flip;
    rec.people.forEach((p, i) => {
      const t = people[i];
      if (!t) { p.visible = false; p.userData.goal = null; return; }
      const gx = dv.x + fx * t[1] - rx * t[0], gz = dv.y + fz * t[1] - rz * t[0];
      if (!p.visible) p.position.set(gx, 0, gz);
      p.visible = true; p.userData.goal = [gx, gz];
    });
    this.animate(`r${dv.id}`, (dt) => {
      let moving = false;
      for (const p of rec.people) {
        const g = p.userData.goal; if (!g || !p.visible) continue;
        const dx = g[0] - p.position.x, dz = g[1] - p.position.z, d = Math.hypot(dx, dz); if (d < 0.01) continue;
        const k = Math.min(1, dt * 4); p.position.x += dx * k; p.position.z += dz * k; moving = true;
        if (d > 0.05) p.rotation.y = Math.atan2(dx, dz);
      }
      this.shadowsDirty = true;
      return moving;
    });
  }
  findOpening(dv, types) {
    let best = null, bd = 1.2;
    this.wallsG.traverse((o) => { if (!o.userData.opening) return; const op = this.floor.openings.find((p) => p.id === o.userData.opening); if (!op || !types.includes(op.type)) return; const d = Math.hypot(op.x - dv.x, op.y - dv.y); if (d < bd) { bd = d; best = o; } });
    return best;
  }
  findScreen(dv) {
    let best = null, bd = 1.5;
    this.items.traverse((o) => { if (o.name === "screen") { const p = o.getWorldPosition(new THREE.Vector3()); const d = Math.hypot(p.x - dv.x, p.z - dv.y); if (d < bd) { bd = d; best = o; } } });
    if (best) { best.material = best.material.clone(); best.material.emissive = new THREE.Color("#ffffff"); best.material.emissiveMap = this.tvTexture(); best.material.emissiveIntensity = 0; }
    return best;
  }
  tvTexture() {
    if (this._tv) return this._tv;
    const c = document.createElement("canvas"); c.width = 256; c.height = 144; this._tvc = c;
    this._tv = new THREE.CanvasTexture(c); this._tv.colorSpace = THREE.SRGBColorSpace; this.paintTv(0); return this._tv;
  }
  paintTv(t) {
    const x = this._tvc.getContext("2d"), g = x.createLinearGradient(0, 0, 256, 144);
    const h = (t * 12) % 360;
    g.addColorStop(0, `hsl(${h + 330},70%,45%)`); g.addColorStop(0.5, `hsl(${h + 260},70%,40%)`); g.addColorStop(1, `hsl(${h + 200},75%,45%)`);
    x.fillStyle = g; x.fillRect(0, 0, 256, 144); x.fillStyle = "rgba(255,255,255,.15)"; x.beginPath(); x.arc(70 + Math.sin(t) * 20, 60, 40, 0, Math.PI * 2); x.fill();
    this._tv.needsUpdate = true;
  }
  attachCurtain(dv, H) {
    const win = this.findOpening(dv, ["window", "slider"]); if (!win) return null;
    const op = this.floor.openings.find((p) => p.id === win.userData.opening);
    const width = op.width + 0.4, drop = Math.min(H - 0.08, op.sill + op.height + 0.25);
    const panels = [];
    const mat = fabric(dv.color || "#E6DCCB").clone(); mat.side = THREE.DoubleSide; mat.transparent = true; mat.opacity = 0.96;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, width + 0.1, 8), metal("#2B2D33")); rail.rotation.z = Math.PI / 2; rail.position.set(0, drop + 0.04, 0.16); rail.material = rail.material.clone(); rail.userData.cuttable = true; rail.userData.noBake = true; win.add(rail);
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(width / 2, drop, 40, 1), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / (width / 2)) * Math.PI * 9) * 0.03);
      geo.computeVertexNormals(); geo.translate(s * width / 4, drop / 2, 0);
      const m = new THREE.Mesh(geo, mat); m.position.set(0, 0, 0.16); m.castShadow = true; m.userData.side = s; m.userData.cuttable = true; m.userData.noBake = true;
      win.add(m); panels.push(m);
    }
    return { panels, width, open: 1, target: 1, opening: win.userData.opening };
  }
  airStream(g) {
    const n = 60, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: "#9fdcff", size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat); pts.visible = false; pts.frustumCulled = false; g.add(pts);
    return { pts, seeds, t: 0 };
  }
  // switch a device that has no working entity, just here on the screen (for trying the home out)
  // want: true (on / open), false (off / closed) or undefined (the other way round from now)
  pretend(id, want) {
    const rec = this.devices.get(id); if (!rec) return false;
    this.pretends ||= new Map();
    const now = stateOf(rec, this.states, this.opts.editing, this.pretends.get(id));
    if (want === undefined || isOn(rec.kind, now) !== want) this.pretends.set(id, pretendNext(rec.kind, now));
    this.updateDevices(false); this.updateHot?.(); this.request(false);
    return true;
  }
  // is a device on right now (as shown)
  isOn(id) { const rec = this.devices.get(id); return rec ? isOn(rec.kind, stateOf(rec, this.states, this.opts.editing, this.pretends?.get(id))) : false; }
  setStates(states) {
    this.states = states || {}; this.updateDevices(false);
    // a light changed while the photo was being made: start the photo again with the new light
    if (this.photo?.active) { this.photo.stop(); clearTimeout(this._pt); this._pt = setTimeout(() => this.startPhoto(), 900); }
  }
  updateDevices(first) {
    let lightsChanged = false;
    const lightsOn = [];
    for (const rec of this.devices.values()) {
      const s = stateOf(rec, this.states, this.opts.editing, this.pretends?.get(rec.dv.id));
      const key = JSON.stringify(s);
      if (!first && key === rec.key) { if (rec.kind === "light" && s.on) lightsOn.push([rec, s]); continue; }
      rec.key = key;
      if (rec.kind === "light") {
        lightsChanged = true;
        if (s.on) lightsOn.push([rec, s]);
        this.fadeLight(rec, s);
      } else if (rec.kind === "curtain" && rec.window) {
        rec.window.target = s.open; this.animate(`c${rec.dv.id}`, (dt) => { const w = rec.window; w.open += Math.sign(w.target - w.open) * Math.min(Math.abs(w.target - w.open), dt * 0.6); for (const p of w.panels) { const sc = 0.18 + 0.82 * (1 - w.open); p.scale.x = sc; p.position.x = p.userData.side * (w.width / 4) * (1 - sc) * 1.05; } this.shadowsDirty = true; return Math.abs(w.target - w.open) > 0.001; });
      } else if ((rec.kind === "door" || rec.kind === "lock") && rec.door) {
        const target = s.open ? 1.4 : 0;
        this.animate(`d${rec.dv.id}`, (dt) => { let done = true; rec.door.traverse((o) => { if (o.name !== "leaf") return; const tgt = target * o.userData.side * o.userData.swing; const cur = o.rotation.y; const nx = cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), dt * 2.2); o.rotation.y = nx; if (Math.abs(tgt - nx) > 0.001) done = false; }); this.shadowsDirty = true; return !done; });
      } else if (rec.kind === "ac") {
        rec.air.pts.visible = s.on;
        const led = rec.obj.getObjectByName("glow"); if (led) led.material.emissiveIntensity = s.on ? 4 : 0;
        if (s.on) this.animate(`a${rec.dv.id}`, (dt) => this.stepAir(rec, dt)); else this.anims.delete(this._anim?.[`a${rec.dv.id}`]);
        const louver = rec.obj.getObjectByName("louver"); if (louver) louver.rotation.x = s.on ? 0.7 : 0;
      } else if (rec.kind === "tv" && rec.screen) {
        rec.screen.material.emissiveIntensity = s.on ? 1.6 : 0;
        if (s.on) this.animate(`t${rec.dv.id}`, (dt) => { this._tvT = (this._tvT || 0) + dt * 0.3; if (((this._tvF = (this._tvF || 0) + 1) % 6) === 0) this.paintTv(this._tvT); return this.states && rec.screen.material.emissiveIntensity > 0; });
      } else if (rec.kind === "fan") {
        const spin = rec.obj.getObjectByName("spin");
        if (s.on && spin) this.animate(`f${rec.dv.id}`, (dt) => { spin.rotation.y += dt * 6 * (s.speed || 0.7); return rec.key === key; });
      } else if (rec.kind === "person") { rec.obj.visible = s.on; this.shadowsDirty = true; }
      else if (rec.kind === "radar") this.placePeople(rec, s.people || []);
    }
    if (lightsChanged || first) this.assignShadows(lightsOn);
    if (lightsChanged && !first) this.reflectSoon(2000);
    this.updateHot();
    this.request(false);
  }
  fadeLight(rec, s) {
    rec.s = s; rec.f ??= 0;
    const target = s.on ? 1 : 0, col = new THREE.Color(s.color || "#ffd29a");
    rec.light.color.copy(col);
    const glows = []; rec.obj.traverse((o) => { if (o.name === "glow") glows.push(o); });
    this.animate(`l${rec.dv.id}`, (dt) => {
      rec.f += (target - rec.f) * Math.min(1, dt * 7); if (Math.abs(rec.f - target) < 0.01) rec.f = target;
      this.lightIntensity(rec);
      for (const gw of glows) { gw.material.emissive.copy(col); gw.material.emissiveIntensity = rec.f > 0.01 ? 2.5 * Math.max(0.15, rec.f) * (this.baked ? 1.5 : 1) : 0; }
      return rec.f !== target;
    });
    this.shadowsDirty = true;
  }
  // live: the old simple lights; baked: the real candela (only for the shine, the light itself is baked)
  lightIntensity(rec) {
    const s = rec.s || {}; if (!rec.light) return;
    const lm = (s.lm || 0) * (rec.lmScale || 1);
    if (this.baked || this.rebaking) { rec.light.distance = 0; rec.light.decay = 2; rec.light.intensity = (rec.cone ? lm / (2 * Math.PI * (1 - Math.cos(rec.cone))) : lm / (4 * Math.PI)) * rec.f * 0.5; }
    else { rec.light.distance = 9; rec.light.intensity = (s.intensity || 0) * rec.f * 0.6; }
  }
  // Real reflections on floors: once the light is ready, each room is photographed in all directions from its
  // middle (a small cube picture) and its floor reflects that, blurred as much as the floor is matt.
  // Done again only when the light changes (lamps, time of day), never every frame.
  reflectSoon(ms = 1500) { clearTimeout(this._refT); if (this.baked && this.quality !== "low") this._refT = setTimeout(() => this.captureReflections(), ms); }
  captureReflections() {
    if (!this.baked || !this.rooms || this.busy) { if (this.baked) this.reflectSoon(1500); return; }
    const size = this.quality === "high" ? 256 : 128;
    this._pmrem ||= new THREE.PMREMGenerator(this.renderer);
    this._refl ||= new Map();
    // everything as it stands in the room: full walls and the ceiling
    const prevOverride = this._wallsOverride, prevCeil = this.ceilings.visible;
    this._wallsOverride = "full"; const v = this.view; this.view = "walk"; this.applyWalls(); this.view = v; this.ceilings.visible = true;
    const tm = this.renderer.toneMapping; this.renderer.toneMapping = THREE.NoToneMapping;
    for (const floor of this.rooms.children) {
      if (floor.name !== "floor" || !floor.userData.room) continue;
      const room = this.floor.rooms.find((r) => r.id === floor.userData.room); if (!room || ROOM_TYPES[room.type]?.outdoor) continue;
      let rec = this._refl.get(room.id);
      if (!rec) { const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType }); rec = { rt, cam: new THREE.CubeCamera(0.05, 60, rt) }; this._refl.set(room.id, rec); }
      const [cx, cz] = centroid(room.pts); rec.cam.position.set(cx, 1.2, cz);
      floor.visible = false; rec.cam.update(this.renderer, this.scene); floor.visible = true;
      rec.env?.dispose(); rec.env = this._pmrem.fromCubemap(rec.rt.texture);
      const m = floor.material; if (m && !Array.isArray(m)) { const had = !!m.envMap; m.envMap = rec.env.texture; m.envMapIntensity = 1; if (!had) m.needsUpdate = true; }
    }
    this.renderer.toneMapping = tm;
    // rooms that are gone give their reflection memory back
    const here = new Set(this.floor.rooms.map((r) => r.id));
    for (const [id, rec] of this._refl) if (!here.has(id)) { rec.env?.dispose(); rec.rt.dispose(); this._refl.delete(id); }
    this._wallsOverride = prevOverride; this.applyWalls(); this.ceilings.visible = prevCeil;
    this.request(false);
  }
  // the overview cuts the walls and hides the ceilings: there the sun comes from the bake (which had them)
  cutView() { return this.view !== "walk" && (this.plan?.settings?.walls || this.opts.walls) === "cut"; }
  // called when stored light was put on the home
  onBaked() {
    this.rebaking = false; this.reflectSoon(400);
    for (const rec of this.devices.values()) if (rec.light) { this.lightIntensity(rec); rec.light.castShadow = false; }
    this.hemi.intensity = 0; this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.fitSun(); this.shadowsDirty = true; this.request(false);
  }
  setWeather(st) {
    // how clear the sky is, from the weather entity
    const c = st?.state || "", cov = st?.attributes?.cloud_coverage;
    let clear = { sunny: 1, "clear-night": 1, windy: 0.9, partlycloudy: 0.55, cloudy: 0.12, fog: 0.08, rainy: 0.1, pouring: 0.05, snowy: 0.1, "snowy-rainy": 0.08, hail: 0.08, lightning: 0.05, "lightning-rainy": 0.05, exceptional: 0.5 }[c] ?? 1;
    if (typeof cov === "number") clear = Math.min(clear, 1 - 0.85 * (cov / 100));
    if (Math.abs(clear - this.clearSky) > 0.01) { this.clearSky = clear; this.fitSun(); }
  }
  // camera-style mixing: how strongly each lamp, window and the sun shine right now
  bakeWeights(dt = 0) {
    const mgr = this.bakeMgr; if (!mgr.active) return;
    const adapt = (hex, k = 0.55) => { const c = new THREE.Color(hex), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return [c.r + (l - c.r) * k, c.g + (l - c.g) * k, c.b + (l - c.b) * k].map((v) => v / Math.max(l, 1e-3)); };
    const lights = {}, windows = {};
    let cSum = 0, cN = 0;
    for (const rec of this.devices.values()) {
      if (rec.kind === "light" && rec.s) { const c = adapt(rec.s.color); lights[rec.dv.id] = c.map((v) => v * (rec.s.lm || 0) * (rec.f || 0)); }
      if (rec.kind === "curtain" && rec.window) { const f = 0.12 + 0.88 * rec.window.open; windows[rec.window.opening] = f; cSum += f; cN++; }
    }
    const sk = this.skyNow || { L: 0, E: 0, sky: [1, 1, 1], sun: [1, 1, 1] };
    const room = this.view === "walk" && this.walkRoomId ? (mgr.data.meta.rooms.indexOf(this.walkRoomId)) : -1;
    const gains = [1, ...this.floor.rooms.map((r) => r.gain || 1)];
    // the eye adapts to daylight colour too (like a camera's white balance), not only to lamps
    const hexOf = (c) => "#" + c.map((v) => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, "0")).join("");
    const skyC = adapt(hexOf(sk.sky.map((v) => v ** (1 / 2.2))), 0.85), sunC = adapt(hexOf(sk.sun.map((v) => v ** (1 / 2.2))), 0.5);
    const accents = new Set(); for (const rec of this.devices.values()) if (rec.kind === "light" && rec.look === "focus") accents.add(rec.dv.id);
    mgr.update({ accents, lights, windows, sky: skyC.map((v) => v * sk.L), sun: sunC.map((v) => v * sk.E), sunKeyW: mgr.sunKeyWeights(sk.az, sk.el), curtainAvg: cN ? cSum / cN : 1, room, roomGain: gains, cut: this.cutView() });
    // One steady exposure, set by the daylight only (never by the lamps), like a photographer who sets the camera
    // once for the room. At night it rests on a fixed evening level, so switching lamps never makes the picture jump.
    // Lamps then add a soft, capped pool and their warmth on top (see bakeLampCap): more lamps feel cosier, not glaring.
    const NIGHT = 45, mood = this.plan?.settings?.mood ?? 1;
    const Lb = Math.max(0, (0.45 * (mgr.Ebase || 0)) / Math.PI), Lref = Math.sqrt(Lb * Lb + NIGHT * NIGHT);
    const target = 5.2 / Lref;
    // the strongest a lamp's light can get on a surface (lux): a bright pool near the lamp, softer further away
    mgr.U.bakeLampCap.value = 170 * mood;
    // the dark is never pitch black: a soft, slightly cool fill (moonlight and the glow of other rooms) that only
    // matters when there is little daylight, so corners and the outside of the house stay readable at night
    const fill = (3.6 * mood * NIGHT) / Lref; mgr.U.bakeFill.value.set(fill * 0.86, fill * 0.92, fill);
    // adapts gently (about a second) when daylight changes or you walk into another room, at once after a big jump
    const now = performance.now(), el = Math.min(1, (now - (this._expoT || now)) / 1000); this._expoT = now;
    const ratio = this.expo ? Math.max(target / this.expo, this.expo / target) : 99;
    this.expo = ratio > 4 ? target : this.expo + (target - this.expo) * Math.min(1, el * 1.5);
    this.renderer.toneMappingExposure = this.expo * (this.plan?.settings?.exposure || 1);
    this._expoMoving = Math.abs(target - this.expo) > target * 0.01;
    if (this._expoMoving) this.dirty = true;
    // reflections of the sky follow the daylight only (no glare at night)
    this.scene.environmentIntensity = Math.max(0.03, Lb) * 0.9;
    // the garden: its own sun (the live sun is off in the overview) and the sky, both toned down to sit with the rooms
    // (like a camera metering for the garden: bright noon and soft evening both land at a pleasant level; night stays dark)
    const sn = this.skyNow || { E: 0, L: 0, sun: [1, 1, 1] }, live = this.sun.intensity > 0, ex = Math.max(1e-6, this.renderer.toneMappingExposure);
    const OUT = Math.min(0.1, 10.7 / (ex * (sn.E * 0.5 * Math.max(0.25, Math.sin(((sn.el || 0) * Math.PI) / 180)) + Math.PI * (sn.L || 0)) + 1e-6));
    GARDEN.gEnvK.value = OUT; GARDEN.gSunCol.value.setRGB(...sn.sun).multiplyScalar(live ? 0 : sn.E * 0.5 * OUT); GARDEN.gFill.value.setRGB(fill * 0.7, fill * 0.8, fill);
  }
  assignShadows(on) {
    const max = { low: 0, medium: 2, high: 4 }[this.quality], size = { low: 256, medium: 512, high: 1024 }[this.quality];
    on.sort((a, b) => b[1].intensity - a[1].intensity);
    for (const rec of this.devices.values()) if (rec.light) rec.light.castShadow = false;
    if (this.baked) return;
    on.slice(0, max).forEach(([rec]) => { rec.light.castShadow = true; rec.light.shadow.mapSize.set(size, size); rec.light.shadow.bias = -0.002; rec.light.shadow.radius = 4; rec.light.shadow.camera.near = 0.1; });
    this.shadowsDirty = true;
  }
  stepAir(rec, dt) {
    const a = rec.air; a.t += dt; const p = a.pts.geometry.attributes.position;
    for (let i = 0; i < a.seeds.length; i++) {
      const k = (a.seeds[i] + a.t * 0.35) % 1;
      p.setXYZ(i, (a.seeds[i] - 0.5) * 0.85, -0.05 - k * 1.1 - Math.sin(k * 3 + i) * 0.04, 0.1 + k * 1.5);
    }
    p.needsUpdate = true; a.pts.material.opacity = 0.5;
    return rec.air.pts.visible;
  }
  animate(id, fn) { this._anim ||= {}; if (this._anim[id]) this.anims.delete(this._anim[id]); this._anim[id] = fn; this.anims.add(fn); this.request(false); }

  // ---------------------------------------------------------------- sun and sky
  setSun(sunState) { this.sunState = sunState; this.fitSun(); this.reflectSoon(3000); }
  fitSun() {
    const b = this.bounds || { x0: 0, y0: 0, x1: 10, y1: 8 }, cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, r = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    const s = this.sunState, north = ((this.plan?.north || 0) * Math.PI) / 180;
    let el = s ? Number(s.attributes?.elevation ?? 35) : 35, az = s ? Number(s.attributes?.azimuth ?? 200) : 200;
    // a chosen time of day (in the home's settings) instead of the real sun right now
    const ft = this.opts.forceTime || this.plan?.settings?.time;
    if (ft === "night") el = -10; else if (ft === "day" || ft === "noon") { el = 62; az = 190; } else if (ft === "evening" || ft === "golden") { el = 7; az = 262; } else if (ft === "morning") { el = 18; az = 100; }
    const day = Math.max(0, Math.min(1, (el + 4) / 14));
    const e = (Math.max(el, 4) * Math.PI) / 180, a = (az * Math.PI) / 180 + north;
    this.sun.position.set(cx + Math.sin(a) * Math.cos(e) * r * 2, Math.sin(e) * r * 2, cz - Math.cos(a) * Math.cos(e) * r * 2);
    this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera; Object.assign(sc, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: r * 5 }); sc.updateProjectionMatrix();
    const ms = { low: 1024, medium: 2048, high: 4096 }[this.quality]; if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.sun.intensity = 1.8 * day; this.sun.color.set(el < 12 ? "#ffcf9e" : "#fff4e2");
    // real sun and sky (lux and cd/m²) for the baked light
    const clear = this.clearSky ?? 1, se = Math.sin((Math.max(el, 0) * Math.PI) / 180);
    const Esun = el > 0 ? 95000 * clear * se ** 0.35 * Math.min(1, el / 4) : 0;
    const Lsky = el > -6 ? (3200 + 1800 * clear) * Math.max(0, Math.sin(((el + 6) * Math.PI) / 180)) ** 0.9 + 0.05 : 0.04;
    const sunCol = new THREE.Color(el < 8 ? "#ffb877" : el < 20 ? "#ffd9b0" : "#fff3e3"), skyCol = new THREE.Color(el < 3 ? (el > -6 ? "#c7b4d8" : "#5d6fa8") : clear > 0.5 ? "#dfe9ff" : "#eef0f2");
    this.skyNow = { E: Esun, L: Lsky, az, el, sun: [sunCol.r, sunCol.g, sunCol.b], sky: [skyCol.r, skyCol.g, skyCol.b] };
    for (const rec of this.devices.values()) if (rec.kind === "light") rec.ctx = { night: el < 0 };
    if (this._night !== (el < 0)) { const first = this._night === undefined; this._night = el < 0; if (!first && this.devices.size) this.updateDevices(false); }
    // sun patches on the floor stay bright but never blinding (the eye squints, the camera rolls off)
    if (this.baked) { this.sun.intensity = this.cutView() ? 0 : Esun * 0.5; this.sun.color.copy(sunCol); this.hemi.intensity = 0; }
    if (this.rebaking) { this.sun.intensity = this.cutView() ? 0 : Esun * 0.5; this.sun.color.copy(sunCol); }
    this.hemi.intensity = this.rebaking ? 0 : 0.1 + 0.3 * day; this.hemi.color.set(day > 0.3 ? "#eaf2ff" : "#5c6aa8"); this.hemi.groundColor.set(day > 0.3 ? "#b8ad9c" : "#151830");
    const kind = el > 14 ? "day" : el > -5 ? "sunset" : "night";
    // the outdoor panoramas are much brighter than a room, so they are toned down indoors
    if (!this.baked && !this.rebaking) this.scene.environmentIntensity = 0.1 + 0.28 * day;
    this.useSky(kind);
    if (!this.baked && !this.rebaking) this.renderer.toneMappingExposure = 0.55 + (1 - day) * 0.25;
    this.isDay = day > 0.3;
    this.emit("sky", { day });
    this.shadowsDirty = true; this.request(false);
  }

  // the panorama for this time of day; the studio light stays until it has loaded
  // the panorama is only used for photos, so it is only downloaded when a photo is made (it is 1.5 MB)
  useSky(kind) { this.skyKind = kind; if (this._skyWanted) this.loadSky(kind); }
  ensureSky() {
    this._skyWanted = true;
    const kind = this.skyKind || "day";
    if (this._skies?.[kind]?.equirect) return Promise.resolve();
    return new Promise((res) => { this._skyWait = res; this.loadSky(kind); setTimeout(res, 8000); });
  }
  loadSky(kind) {
    this._skies ||= {};
    // the live view keeps its soft studio light; the panorama lights the photo, as in a studio render
    const apply = () => { if (this.skyKind !== kind) return; this.skyTexture = this._skies[kind].equirect; this.skyMean = this._skies[kind].mean; this._skyWait?.(); this._skyWait = null; };
    if (this._skies[kind]?.equirect) return apply();
    if (this._skies[kind]) return;
    this._skies[kind] = {};
    new HDRLoader().load(`${ENV_BASE.url}${kind}.hdr`, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      // average brightness of the sky picture (to scale it to the real sky in photos)
      let sum = 0, cnt = 0; const d = tex.image.data, half = d instanceof Uint16Array;
      for (let i = 0; i < d.length; i += 4 * 37) { const f = (v) => (half ? THREE.DataUtils.fromHalfFloat(v) : v); sum += 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); cnt++; }
      this._skies[kind] = { equirect: tex, mean: sum / Math.max(1, cnt) };
      apply();
    }, undefined, () => { delete this._skies[kind]; });
  }

  // ---------------------------------------------------------------- views
  center() { const b = this.bounds || { x0: 0, y0: 0, x1: 10, y1: 8 }; return new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.y0 + b.y1) / 2); }
  // where the camera stands for a view (also used by the background photo studio, with its own camera)
  pose(view, walkRoom, aspect = this.camera.aspect) {
    const c = this.center(), b = this.bounds || { x0: 0, y0: 0, x1: 10, y1: 8 };
    let pos, target = c.clone(), fov = 32, room = null;
    if (view === "top") { const half = Math.tan((30 * Math.PI) / 360); pos = new THREE.Vector3(c.x, Math.max((b.x1 - b.x0) / aspect, b.y1 - b.y0) * 1.12 / (2 * half), c.z + 0.01); fov = 30; }
    else if (view === "walk") {
      room = walkRoom || this.floor.rooms.find((x) => x.type === "living") || this.floor.rooms[0];
      const [x, y] = centroid(room.pts), bb = room.pts;
      const far = bb.reduce((m, p) => (Math.hypot(p[0] - x, p[1] - y) > Math.hypot(m[0] - x, m[1] - y) ? p : m), bb[0]);
      // eye level, looking straight ahead so walls stay upright like in a professional interior photo
      pos = new THREE.Vector3(x + (far[0] - x) * 0.72, 1.35, y + (far[1] - y) * 0.72); target = new THREE.Vector3(x - (far[0] - x) * 0.4, 1.35, y - (far[1] - y) * 0.4); fov = 60;
    } else {
      // far enough that the whole home fits, seen from the south-east at about 45°
      const R = 0.5 * Math.hypot(b.x1 - b.x0, b.y1 - b.y0) + 0.5, v = (fov * Math.PI) / 360, hh = Math.atan(Math.tan(v) * aspect);
      const dist = (R / Math.sin(Math.min(v, hh))) * (aspect < 1 ? 0.95 : 0.8);
      pos = new THREE.Vector3(c.x + dist * 0.38, dist * 0.72, c.z + dist * 0.62);
    }
    return { pos, target, fov, room };
  }
  frame(view, instant = false) {
    this.view = view;
    const { pos, target, fov, room } = this.pose(view, this.walkRoom);
    if (view === "walk" && room) { this.walkRoomId = room.id; this.kbActive = true; }
    this.controls.enabled = view !== "walk";
    this.controls.maxPolarAngle = view === "top" ? 0.15 : Math.PI * 0.47;
    this.controls.minPolarAngle = 0;
    this.controls.enableRotate = view !== "top";
    // seen from above, one finger or the left button moves the plan around (there is nothing to turn)
    this.controls.mouseButtons.LEFT = view === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = view === "top" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    this.tweenTo(pos, target, fov, instant ? 0 : 0.9);
    this.applyWalls();
    if (this.devices.size) this.updateHot();
    this.emit("view", view);
  }
  tweenTo(pos, target, fov, dur = 0.9) {
    if (!dur) { this.camera.position.copy(pos); this.controls.target.copy(target); this.camera.fov = fov; this.camera.updateProjectionMatrix(); this.camera.lookAt(target); this.request(true); return; }
    this.tween = { t: 0, dur, p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target, f0: this.camera.fov, f1: fov };
  }
  stepTween(dt) {
    const tw = this.tween; tw.t = Math.min(1, tw.t + dt / tw.dur); const k = ease(tw.t);
    this.camera.position.lerpVectors(tw.p0, tw.p1, k); this.controls.target.lerpVectors(tw.t0, tw.t1, k);
    this.camera.fov = tw.f0 + (tw.f1 - tw.f0) * k; this.camera.updateProjectionMatrix(); this.camera.lookAt(this.controls.target);
    this.request(true);
    if (tw.t >= 1) this.tween = null;
  }
  // one step of walking with the keys; walls and closed doors stop you
  stepWalk(dt) {
    const k = this.keys, fast = 1.4, turn = (k.has("l") ? 1 : 0) - (k.has("r") ? 1 : 0), go = (k.has("f") ? 1 : 0) - (k.has("b") ? 1 : 0);
    if (this.tween) this.tween = null;
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
    if (turn) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn * 1.7 * dt);
    if (go) {
      const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(go), step = fast * dt;
      this._walkRay ||= new THREE.Raycaster();
      const from = new THREE.Vector3(this.camera.position.x, 1.0, this.camera.position.z);
      this._walkRay.set(from, flat); this._walkRay.far = step + 0.3;
      const hit = this._walkRay.intersectObjects([this.wallsG], true).some((h) => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return !h.object.material?.transparent; });
      if (!hit) this.camera.position.addScaledVector(flat, step);
    }
    this.controls.target.copy(this.camera.position).add(dir); this.camera.lookAt(this.controls.target);
    const room = this.roomOf(this.camera.position); if (room && room !== this.walkRoomId) { this.walkRoomId = room; this.walkRoom = this.floor.rooms.find((r) => r.id === room); }
    this.request(true);
  }
  home() { this.userMoved = false; this.frame(this.view === "walk" ? "3d" : this.view || "3d"); }
  // walk to a spot (from a tap on the plan), still looking the same way
  walkToPoint(x, y) {
    const room = this.floor?.rooms.find((r) => inside([x, y], r.pts)); if (!room) return false;
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position), to = new THREE.Vector3(x, 1.35, y);
    this.walkRoomId = room.id; this.walkRoom = room; this.kbActive = true;
    this.tweenTo(to, to.clone().add(dir), this.camera.fov, 0.7); this.updateHot(); return true;
  }
  walkTo(roomId) { this.walkRoom = this.floor.rooms.find((r) => r.id === roomId); this.frame("walk"); }
  walkLook(e) {
    if (this.view !== "walk" || !this._drag) return;
    const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y; this._drag.x = e.clientX; this._drag.y = e.clientY; this._drag.moved += Math.abs(dx) + Math.abs(dy);
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
    const sph = new THREE.Spherical().setFromVector3(dir); sph.theta -= dx * 0.005; sph.phi = Math.max(0.6, Math.min(2.4, sph.phi - dy * 0.004));
    this.controls.target.copy(this.camera.position).add(new THREE.Vector3().setFromSpherical(sph)); this.camera.lookAt(this.controls.target);
    if (!this.lowRes) this.interacting(true);
    this.request(true);
  }

  // ---------------------------------------------------------------- tapping things
  pointerDown(e) { this._drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() }; this._holdT = setTimeout(() => { if (this._drag && this._drag.moved < 8) { const hit = this.pick(e); if (hit) { this._held = true; this.emit("hold", hit); } } }, 550); }
  pointerUp(e) {
    clearTimeout(this._holdT);
    const d = this._drag; this._drag = null;
    if (this.view === "walk" && d && d.moved > 6) this.interacting(false);
    if (this._held) { this._held = false; return; }
    if (!d || d.moved > 8 || performance.now() - d.t > 500) return;
    const hit = this.pick(e);
    if (hit) this.emit("tap", hit);
    if (this.view === "walk" && hit?.room && !hit.device) {
      const p = hit.point, dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
      const to = new THREE.Vector3(p.x, 1.35, p.z); this.tweenTo(to, to.clone().add(dir), this.camera.fov, 0.7);
    }
  }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, this.camera);
    const hits = ray.intersectObjects([this.devG, this.wallsG, this.items, this.rooms], true).filter((h) => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
    for (const h of hits) {
      let o = h.object; while (o && !o.userData.device && !o.userData.item && !o.userData.room && !o.userData.opening) o = o.parent;
      if (!o) continue;
      if (o.userData.device) return { device: o.userData.device, point: h.point };
      if (o.userData.opening) { const rec = [...this.devices.values()].find((x) => x.door === o || x.window?.panels?.[0]?.parent === o); if (rec) return { device: rec.dv.id, point: h.point }; continue; }
      if (o.userData.item) { const sc = [...this.devices.values()].find((x) => x.screen && x.screen.parent?.parent === o.parent?.parent); if (sc) return { device: sc.dv.id, point: h.point }; return { item: o.userData.item, point: h.point }; }
      if (o.userData.room) return { room: o.userData.room, point: h.point };
    }
    return null;
  }
  updateHot() {
    this.hot = [];
    for (const rec of this.devices.values()) {
      const dv = rec.dv;
      const y = rec.kind === "light" ? (rec.mount === "ceiling" ? Math.min(CUT + 0.6, this.H - 0.3) : 1.6) : rec.kind === "ac" ? (this.view === "walk" ? this.H - 0.62 : Math.min(CUT + 0.5, this.H - 0.45)) : rec.kind === "curtain" ? 1.6 : rec.kind === "tv" ? 1.4 : rec.kind === "door" || rec.kind === "lock" ? 1.2 : rec.kind === "person" ? 1.9 : 1.0;
      this.hot.push({ id: dv.id, kind: rec.kind, entity: dv.entity, name: dv.name, pos: new THREE.Vector3(dv.x, this.view === "walk" && rec.kind === "light" ? this.H - 0.3 : y, dv.y), state: stateOf(rec, this.states, this.opts.editing, this.pretends?.get(dv.id)) });
    }
    this.projectHotspots();
  }
  projectHotspots() {
    if (!this.opts.hotspots) return;
    const [w, h] = this.size, out = [], v = new THREE.Vector3(), camDir = new THREE.Vector3(); this.camera.getWorldDirection(camDir);
    for (const hs of this.hot) {
      v.copy(hs.pos).project(this.camera);
      const toP = hs.pos.clone().sub(this.camera.position);
      const vis = v.z < 1 && toP.dot(camDir) > 0 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && (this.view !== "walk" || this.roomOf(hs.pos) === this.walkRoomId || toP.length() < 4);
      out.push({ ...hs, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: vis });
    }
    // buttons that land on top of each other (lights in a row seen from the side, two TVs on one wall) are
    // spread round their middle so every one of them can be pressed
    const shown = out.filter((o) => o.visible), done = new Set(), GAP = 40;
    for (const a of shown) {
      if (done.has(a)) continue;
      const group = [a]; done.add(a);
      for (let k = 0; k < group.length; k++) for (const b of shown) if (!done.has(b) && Math.hypot(b.x - group[k].x, b.y - group[k].y) < GAP) { group.push(b); done.add(b); }
      if (group.length < 2) continue;
      const cx = group.reduce((t, o) => t + o.x, 0) / group.length, cy = group.reduce((t, o) => t + o.y, 0) / group.length;
      const r = Math.max(GAP * 0.62, (GAP * group.length) / (2 * Math.PI));
      group.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx) || String(p.id).localeCompare(String(q.id)));
      group.forEach((o, i) => { const t = -Math.PI / 2 + (i / group.length) * Math.PI * 2; o.x = cx + r * Math.cos(t); o.y = cy + r * Math.sin(t); });
    }
    this.emit("hotspots", out);
  }
  roomOf(p) { return this.floor.rooms.find((r) => inside([p.x, p.z], r.pts))?.id; }

  // ---------------------------------------------------------------- photo mode
  async startPhoto() {
    if (this.busy || this.tween || !this.opts.photo) return;
    try {
      if (!this.photo) { const { PhotoMode } = await import("./photo.js"); this.photo = new PhotoMode(this); }
      await this.ensureSky();
      if (!this.opts.photo || this.busy) return;
      this.photo.start();
    } catch (err) {
      // some tablets can't run the light tracer: say so instead of failing quietly
      console.warn("Roost Atelier photo mode:", err); this.photo?.stop?.(); this.opts.photo = false;
      this.emit("photo", { progress: -2, error: String(err?.message || err) });
    }
  }
  // every lamp's emitters as lights for the photo tracer (tracks get all their heads, strips their length)
  photoLamps() {
    const out = [];
    for (const rec of this.devices.values()) {
      if (rec.kind !== "light" || !rec.s || !(rec.f > 0.01) || !rec.light) continue;
      const pr = { pendant: { down: 0.75 }, chandelier: { down: 0.35 }, spots: { cone: 0.55 }, flush: { down: 1 }, floor: { down: 0.45 } }[rec.look] || { down: 1 };
      const em = rec.emitters || [{ p: rec.lightPos.toArray(), dir: [0, -1, 0], w: 1, ...pr }];
      for (const e of em) out.push({ p: e.p, dir: e.dir || [0, -1, 0], cone: e.cone, down: e.down ?? 1, lm: (rec.s.lm || 0) * rec.f * (e.w ?? 1), color: rec.light.color.clone() });
    }
    return out;
  }
  // the AI clean-up needs WebGPU
  async photoReady() { try { const { aiAvailable } = await import("./ai/denoise.js"); return await aiAvailable(); } catch { return false; } }
  // make one finished photo of the current view and give it back as a JPEG
  async takePhoto(aborted = () => false) {
    this.opts.photo = true; await this.startPhoto();
    const t0 = performance.now();
    while (!aborted()) {
      await new Promise((r) => setTimeout(r, 300));
      const p = this.photo; if (!p?.active) return null;
      if (p.cleaned || (p.done && !p.cleaning) || performance.now() - t0 > 600000) break;
    }
    if (aborted() || !this.photo?.active) return null;
    if (this.photo.cleaned) this.photo.show();
    const src = this.renderer.domElement, c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d").drawImage(src, 0, 0);
    this.setPhoto(false);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  }
  setPhoto(on) { this.opts.photo = on; if (on) this.startPhoto(); else this.photo?.stop(); this.request(true); }
  snapshot() { this.composer.render(); return this.renderer.domElement.toDataURL("image/jpeg", 0.92); }

  dispose() {
    this._offTex?.();
    this.bakeMgr.dispose(); clearTimeout(this._rebake);
    window.removeEventListener("keydown", this._kd); window.removeEventListener("keyup", this._ku); window.removeEventListener("blur", this._blur); window.removeEventListener("pointerdown", this._pd, true);
    for (const rec of this._refl?.values() || []) { rec.env?.dispose(); rec.rt.dispose(); } this._refl?.clear(); this._pmrem?.dispose();
    for (const s of Object.values(this._skies || {})) s.equirect?.dispose(); this._tv?.dispose();
    for (const g of this._shapes?.values() || []) g.dispose(); this._shapes = null;
    this.alive = false; this.resizeObs.disconnect(); this.photo?.dispose(); this.controls.dispose(); this.composer.dispose?.();
    this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.renderer.domElement.remove();
  }
}
