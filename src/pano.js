// A room in 360°: the realistic all-round picture of the room, dragged to look around, with every device of
// the room sitting where it really is. Tapping one opens the same small controls as the 3D home.
import * as THREE from "three";
import { inside, panoSpot } from "./model.js";
import { KINDS } from "./devices.js";
import { CONTROLS_CSS, controlsHtml, bindControls, isOn } from "./controls.js";
import { t } from "./i18n.js";

const COLORS = { light: "#F5B041", ac: "#2EC4B6", curtain: "#4E8CFF", tv: "#8B6CFF", door: "#FF7A59", lock: "#FF7A59", fan: "#2EC4B6", speaker: "#8B6CFF", vacuum: "#5FBF77", sensor: "#7C86B8" };

export const PANO_CSS = `
.pv360{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:#0B0D17;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.pv360 canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.pv360 .hs{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;-webkit-tap-highlight-color:transparent}
.pv360 .hs.hide{display:none}
.pv360 .hs button{all:unset;cursor:pointer;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(20,24,49,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 14px rgba(0,0,0,.3);transition:transform .12s}
.pv360 .hs button:active{transform:scale(.9)}
.pv360 .hs.on button{background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 70%,#fff));border-color:transparent;box-shadow:0 0 18px color-mix(in srgb,var(--c) 70%,transparent)}
.pv360 .hs ha-icon{--mdc-icon-size:18px}
.pv360 .hs span{font:600 10px/1.2 Inter,sans-serif;color:#fff;background:rgba(11,13,23,.55);padding:2px 6px;border-radius:8px;white-space:nowrap}
.pv360 .pop{position:absolute;z-index:6;width:min(268px,calc(100% - 24px));padding:12px;border-radius:20px;background:rgba(20,24,49,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.4);box-sizing:border-box;cursor:default}
.pv360 .msg{position:absolute;inset:0;display:grid;place-items:center;color:#9AA3D9;font:500 14px Inter,sans-serif;text-align:center;padding:20px}
.pv360 .name{position:absolute;left:14px;top:12px;padding:6px 12px;border-radius:12px;background:rgba(11,13,23,.55);color:#fff;font:600 13px Inter,sans-serif;backdrop-filter:blur(8px)}
${CONTROLS_CSS}
`;

// where each device is, for its button: real height in the room
function devicePoint(dv, floor, H) {
  const kind = dv.kind || "light", look = dv.look || "flush";
  if (kind === "light") return [dv.x, look === "floor" ? 1.45 : look === "wall" ? dv.z ?? (dv.style === "reading" ? 1.1 : 1.8) : look === "step" ? dv.z ?? 0.3 : look === "flood" ? dv.z ?? Math.min(2.6, H - 0.2) : look === "table" ? (dv.z ?? 0.55) + 0.4 : look === "bollard" ? 0.75 : look === "uplight" ? 0.05 : look === "linear" && dv.style === "washer" ? 0.1 : look === "linear" && dv.style === "pendant" ? H - (dv.drop ?? 0.7) : look === "pendant" ? H - 0.85 : look === "chandelier" ? H - 0.9 : H - 0.04, dv.y];
  if (kind === "ac") return [dv.x, H - 0.45, dv.y];
  if (kind === "fan") return [dv.x, H - 0.4, dv.y];
  if (kind === "curtain" || kind === "door" || kind === "lock") {
    const ops = (floor.openings || []).filter((o) => (kind === "curtain" ? o.type !== "door" : o.type === "door")).sort((a, b) => Math.hypot(a.x - dv.x, a.y - dv.y) - Math.hypot(b.x - dv.x, b.y - dv.y));
    const o = ops[0]; if (o && Math.hypot(o.x - dv.x, o.y - dv.y) < 1.5) return [o.x, (o.sill || 0) + (o.height || 2) * 0.55, o.y];
    return [dv.x, 1.3, dv.y];
  }
  if (kind === "tv") return [dv.x, 1.2, dv.y];
  return [dv.x, dv.z ?? 1.0, dv.y];
}

export class PanoViewer {
  // host: an element; image: a URL of the 360° picture; plan, floorIndex, roomId: whose room
  constructor(host, { image, plan, floorIndex = 0, roomId, onMoreInfo }) {
    this.host = host; this.onMoreInfo = onMoreInfo;
    host.innerHTML = `<div class="pv360"><div class="hot"></div></div>`;
    this.root = host.firstElementChild; this.hotEl = this.root.querySelector(".hot");
    this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.insertBefore(this.renderer.domElement, this.hotEl);
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(75, 1, 0.05, 100);
    this.yaw = 0; this.pitch = 0; this.hs = new Map();
    this.setRoom(plan, floorIndex, roomId);
    new THREE.TextureLoader().load(image, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace; this.scene.background = tex; this.draw();
    }, undefined, () => this.message(t("The 360° view of this room isn't made yet. In the Atelier, open the home settings and press Make 360° views.")));
    this.bind();
    this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(this.root);
  }
  setRoom(plan, fi, roomId) {
    const floor = plan.floors[fi] || plan.floors[0], room = floor.rooms.find((r) => r.id === roomId);
    this.floor = floor; this.room = room;
    if (!room) return this.message(t("Choose a room for this card"));
    const p = panoSpot(room); this.cam.position.set(p[0], p[1], p[2]);
    const H = floor.height || 2.8;
    this.devices = floor.devices.filter((d) => d.entity && inside([d.x, d.y], room.pts)).map((d) => ({ d, p: new THREE.Vector3(...devicePoint(d, floor, H)) }));
    // start looking towards most of the devices
    if (this.devices.length) { const c = this.devices.reduce((a, x) => a.add(x.p), new THREE.Vector3()).divideScalar(this.devices.length); this.yaw = Math.atan2(-(c.x - p[0]), -(c.z - p[2])); }
    this.root.querySelector(".name")?.remove();
    if (room.name) { const n = document.createElement("div"); n.className = "name"; n.textContent = room.name; this.root.appendChild(n); }
  }
  message(text) { let m = this.root.querySelector(".msg"); if (!m) { m = document.createElement("div"); m.className = "msg"; this.root.appendChild(m); } m.textContent = text; }
  set hass(h) { this._hass = h; this.draw(); if (this.openId != null && !this.popEl?.querySelector(".ctl[data-busy]")) this.drawPop(); }
  bind() {
    const el = this.root, ptrs = new Map(); let start = null, moved = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.composedPath().some((n) => n.classList?.contains?.("hs") || n.classList?.contains?.("pop"))) return;
      this.closePop(); ptrs.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); moved = false;
      start = { yaw: this.yaw, pitch: this.pitch, fov: this.cam.fov, x: e.clientX, y: e.clientY, d: ptrs.size === 2 ? dist(ptrs) : 0 };
    });
    el.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId) || !start) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { if (!start.d) { start.d = dist(ptrs); start.fov = this.cam.fov; } this.cam.fov = Math.max(35, Math.min(95, start.fov * (start.d / dist(ptrs)))); this.draw(); return; }
      const k = (this.cam.fov / el.clientHeight) * (Math.PI / 180), dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > 3) moved = true;
      this.yaw = start.yaw + dx * k; this.pitch = Math.max(-1.35, Math.min(1.35, start.pitch + dy * k)); this.draw();
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (!ptrs.size) start = null; else start = { yaw: this.yaw, pitch: this.pitch, fov: this.cam.fov, x: [...ptrs.values()][0][0], y: [...ptrs.values()][0][1], d: 0 }; void moved; };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.cam.fov = Math.max(35, Math.min(95, this.cam.fov * (e.deltaY > 0 ? 1.08 : 0.93))); this.draw(); }, { passive: false });
  }
  draw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      const W = this.root.clientWidth, H = this.root.clientHeight; if (!W || !H) return;
      this.renderer.setSize(W, H, false); this.cam.aspect = W / H;
      this.cam.rotation.set(this.pitch, this.yaw, 0, "YXZ"); this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld();
      this.renderer.render(this.scene, this.cam);
      this.drawHot(W, H);
      if (this.popEl) this.placePop();
    });
  }
  drawHot(W, H) {
    const v = new THREE.Vector3(), fwd = new THREE.Vector3(); this.cam.getWorldDirection(fwd);
    for (const { d, p } of this.devices || []) {
      let el = this.hs.get(d.id);
      if (!el) {
        el = document.createElement("div"); el.className = "hs"; el.innerHTML = `<button><ha-icon></ha-icon></button><span></span>`;
        el.firstElementChild.addEventListener("click", (e) => { e.stopPropagation(); this.openId === d.id && this.popEl ? this.closePop() : this.open(d.id); });
        this.hotEl.appendChild(el); this.hs.set(d.id, el);
      }
      const ahead = v.copy(p).sub(this.cam.position).dot(fwd) > 0.1;
      v.copy(p).project(this.cam);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H, show = ahead && x > -20 && x < W + 20 && y > -20 && y < H + 20;
      el.classList.toggle("hide", !show); if (!show) continue;
      el.style.left = `${x}px`; el.style.top = `${y}px`;
      const st = this._hass?.states[d.entity], on = isOn(st), kind = d.kind || "light";
      el.classList.toggle("on", on); el.style.setProperty("--c", COLORS[kind] || "#8B6CFF");
      const icon = kind === "light" ? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline") : kind === "curtain" ? (on ? "mdi:curtains" : "mdi:curtains-closed") : KINDS[kind]?.icon || "mdi:circle";
      const ic = el.querySelector("ha-icon"); if (ic.getAttribute("icon") !== icon) ic.setAttribute("icon", icon);
      el.dataset.x = x; el.dataset.y = y;
    }
  }
  open(id) { this.openId = id; this.drawPop(); }
  closePop() { this.popEl?.remove(); this.popEl = null; this.openId = null; }
  drawPop() {
    const dv = this.devices?.find((x) => x.d.id === this.openId)?.d; if (!dv || !this._hass) return;
    if (!this.popEl) { this.popEl = document.createElement("div"); this.popEl.className = "pop"; this.root.appendChild(this.popEl); }
    this.popEl.innerHTML = controlsHtml(this._hass, dv.entity, dv.name, COLORS[dv.kind || "light"] || "#8B6CFF");
    bindControls(this.popEl, () => this._hass, (e) => { this.closePop(); this.onMoreInfo?.(e); });
    this.placePop();
  }
  placePop() {
    const el = this.popEl, hs = this.hs.get(this.openId); if (!el || !hs) return;
    const W = this.root.clientWidth, H = this.root.clientHeight, w = el.offsetWidth, h = el.offsetHeight, x = +hs.dataset.x, y = +hs.dataset.y;
    el.style.left = `${Math.max(12, Math.min(W - w - 12, x - w / 2))}px`; el.style.top = `${Math.max(8, y - h - 28 > 8 ? y - h - 28 : Math.min(H - h - 8, y + 28))}px`;
  }
  // the direction the view looks, to check a 360° picture lines up (yaw 0 looks along -z)
  look(yaw, pitch = 0) { this.yaw = yaw; this.pitch = pitch; this.draw(); }
  dispose() { this.ro.disconnect(); cancelAnimationFrame(this._raf); this.scene.background?.dispose?.(); this.renderer.dispose(); this.host.innerHTML = ""; }
}
const dist = (m) => { const [a, b] = [...m.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
