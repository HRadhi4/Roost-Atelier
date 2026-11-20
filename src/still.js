// The dashboard card as pictures, not a 3D program: the finished photo of the whole floor and a 360° picture
// of every room, made once in the Atelier. Devices sit on the pictures as buttons; tapping one opens its
// controls, and lights that are on glow. Tap a room (or a door arrow inside a room) to step into it, like
// walking through a street-view tour. No 3D engine is loaded, so it opens fast on any phone or tablet.
import { inside, centroid, panoSpot } from "./model.js";
import { KINDS, kelvinToHex } from "./devices.js";
import { CONTROLS_CSS, controlsHtml, bindControls, isOn } from "./controls.js";
import { t } from "./i18n.js";

const COLORS = { light: "#F5B041", ac: "#2EC4B6", curtain: "#4E8CFF", tv: "#8B6CFF", door: "#FF7A59", lock: "#FF7A59", fan: "#2EC4B6", speaker: "#8B6CFF", vacuum: "#5FBF77", sensor: "#7C86B8" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const STILL_CSS = `
.st{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:#0B0D17;touch-action:none;user-select:none;-webkit-user-select:none;font-family:Inter,sans-serif}
.st .stage{position:absolute;inset:0}
.st .stage img,.st .stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}
.st .stage.pano{cursor:grab}
.st .glow{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen}
.st .glow i{position:absolute;border-radius:50%;transform:translate(-50%,-50%);transition:opacity .4s}
.st .hot{position:absolute;inset:0;pointer-events:none}
.st .hs{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.st .hs.hide{display:none}
.st .hs button{all:unset;cursor:pointer;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(20,24,49,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 14px rgba(0,0,0,.3);transition:transform .12s}
.st .hs button:active{transform:scale(.9)}
.st .hs.on button{background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 70%,#fff));border-color:transparent;box-shadow:0 0 18px color-mix(in srgb,var(--c) 70%,transparent)}
.st .hs ha-icon{--mdc-icon-size:18px}
.st .hs span{font:600 10px/1.2 Inter,sans-serif;color:#fff;background:rgba(11,13,23,.55);padding:2px 6px;border-radius:8px;white-space:nowrap}
.st .hs.room button{width:auto;height:30px;padding:0 12px;border-radius:15px;font:600 12px Inter,sans-serif;gap:6px;display:flex}
.st .hs.door button{background:rgba(255,255,255,.88);color:#141831}
.st .pop{position:absolute;z-index:6;width:min(268px,calc(100% - 24px));padding:12px;border-radius:20px;background:rgba(20,24,49,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.4);box-sizing:border-box}
.st .msg{position:absolute;inset:0;display:grid;place-items:center;color:#9AA3D9;font:500 14px Inter,sans-serif;text-align:center;padding:24px;line-height:1.5}
.st .bar{position:absolute;left:10px;right:10px;bottom:10px;display:flex;align-items:center;gap:6px;z-index:5;pointer-events:none}
.st .bar button{all:unset;pointer-events:auto;cursor:pointer;height:38px;min-width:38px;padding:0 12px;box-sizing:border-box;border-radius:19px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:#fff;font:600 13px Inter,sans-serif;background:rgba(11,13,23,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14)}
.st .bar button.name{flex:1;max-width:240px;margin:0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st .bar button ha-icon{--mdc-icon-size:18px}
.st .bar .sp{flex:1}
.st .menu{position:absolute;left:50%;bottom:56px;transform:translateX(-50%);z-index:7;max-height:60%;overflow:auto;padding:6px;border-radius:18px;background:rgba(20,24,49,.94);border:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;min-width:180px}
.st .menu button{all:unset;cursor:pointer;padding:10px 14px;border-radius:12px;color:#EEF0FF;font:500 14px Inter,sans-serif}
.st .menu button.cur{background:rgba(139,108,255,.25)}
${CONTROLS_CSS}
`;

// ---------------------------------------------------------------- the camera a picture was taken with
// The Atelier writes it into the photo itself (a JPEG comment), so a picture always carries its own camera.
export function withCamera(blob, cam) {
  return blob.arrayBuffer().then((buf) => {
    const text = new TextEncoder().encode("roost:" + JSON.stringify(cam)), len = text.length + 2;
    if (len > 65535) return blob;
    const head = new Uint8Array([0xff, 0xd8, 0xff, 0xfe, len >> 8, len & 255]);
    return new Blob([head, text, new Uint8Array(buf, 2)], { type: "image/jpeg" });
  });
}
export function readCamera(buf) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff || b[3] !== 0xfe) return null;
  const len = (b[4] << 8) | b[5], text = new TextDecoder().decode(b.subarray(6, 4 + len));
  if (!text.startsWith("roost:")) return null;
  try { return JSON.parse(text.slice(6)); } catch { return null; }
}

// how the card gets a picture from Home Assistant: its address and the camera written inside it
export function photoFetcher(hass, planId, fi) {
  return async (key) => {
    const r = await hass().fetchWithAuth(`/api/roost_atelier/photo/${planId}_${fi}_${key}`);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return { url: URL.createObjectURL(new Blob([buf], { type: "image/jpeg" })), camera: readCamera(buf) };
  };
}

// ---------------------------------------------------------------- small vector helpers (no 3D library)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// a flat photo: where a point of the home lands on the picture, 0..1 across and down (null when behind)
export function projectFlat(cam, p) {
  const f = norm(sub(cam.target, cam.pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(p, cam.pos), z = dot(d, f);
  if (z < 0.1) return null;
  const k = Math.tan((cam.fov * Math.PI) / 360);
  return [0.5 + dot(d, r) / (z * k * cam.aspect) / 2, 0.5 - dot(d, u) / (z * k) / 2];
}
// a 360° view looking (yaw, pitch) with a vertical field of view fov: where a point lands on the screen
export function projectPano(eye, yaw, pitch, fov, aspect, p) {
  let [x, y, z] = sub(p, eye);
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw); [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cp = Math.cos(-pitch), sp = Math.sin(-pitch); [y, z] = [y * cp - z * sp, y * sp + z * cp];
  if (z > -0.1) return null;
  const k = Math.tan((fov * Math.PI) / 360);
  return [0.5 + x / (-z * k * aspect) / 2, 0.5 - y / (-z * k) / 2];
}

// where each device is, for its button: real height in the room
export function devicePoint(dv, floor, H) {
  const kind = dv.kind || "light", look = dv.look || "flush";
  if (kind === "light") return [dv.x, look === "floor" ? 1.45 : look === "pendant" ? H - 0.85 : look === "chandelier" ? H - 0.9 : H - 0.04, dv.y];
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

// the rooms a door leads to from a room: [{ room, at: [x, y] }]
export function doorsFrom(floor, room) {
  const out = [];
  for (const o of floor.openings || []) {
    if (o.type !== "door") continue;
    const near = [];
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, p = [o.x + Math.cos(a) * 0.35, o.y + Math.sin(a) * 0.35]; for (const r of floor.rooms) if (inside(p, r.pts) && !near.includes(r)) near.push(r); }
    if (!near.includes(room)) continue;
    for (const r of near) if (r !== room && !out.some((x) => x.room === r)) out.push({ room: r, at: [o.x, o.y] });
  }
  return out;
}

// the colour and strength of a light's glow from its state
function glowOf(st) {
  if (!st || st.state !== "on") return null;
  const a = st.attributes || {};
  const c = a.rgb_color ? `rgb(${a.rgb_color.join(",")})` : kelvinToHex(a.color_temp_kelvin || 2900);
  return { c, k: a.brightness != null ? 0.35 + 0.65 * (a.brightness / 255) : 1 };
}

// ---------------------------------------------------------------- the 360° picture, drawn with a tiny shader
const VS = `attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}`;
const FS = `precision highp float;varying vec2 v;uniform sampler2D tex;uniform mat3 rot;uniform vec2 k;
void main(){vec3 d=normalize(rot*vec3(v.x*k.x,v.y*k.y,-1.));float u=atan(d.z,d.x)*0.15915494+0.5;float w=asin(clamp(d.y,-1.,1.))*0.31830989+0.5;gl_FragColor=texture2D(tex,vec2(u,w));}`;
class Sphere {
  constructor(canvas) {
    const gl = (this.gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false }));
    if (!gl) throw new Error("no WebGL");
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = (this.pr = gl.createProgram()); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.uRot = gl.getUniformLocation(pr, "rot"); this.uK = gl.getUniformLocation(pr, "k");
    this.tex = gl.createTexture();
  }
  image(img) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // big pictures are cut down to what the device can hold
    let src = img; const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (img.naturalWidth > max) { const c = document.createElement("canvas"); c.width = max; c.height = max / 2; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); src = c; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.ready = true;
  }
  draw(W, H, yaw, pitch, fov) {
    const gl = this.gl, c = gl.canvas; if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    gl.viewport(0, 0, W, H);
    if (!this.ready) { gl.clearColor(0.043, 0.051, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    // camera turned by yaw (around up) then pitch (around its side), like Euler "YXZ"
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    gl.uniformMatrix3fv(this.uRot, false, new Float32Array([cy, 0, -sy, sy * sp, cp, cy * sp, sy * cp, -sp, cy * cp]));
    const k = Math.tan((fov * Math.PI) / 360); gl.uniform2f(this.uK, k * (W / H), k);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  dispose() { this.gl.deleteTexture(this.tex); this.gl.deleteProgram(this.pr); this.gl.getExtension("WEBGL_lose_context")?.loseContext(); }
}

// ---------------------------------------------------------------- the card
export class StillViewer {
  // photo(key) -> Promise<{ url, camera } | null>; room: start in this room's 360° (else the whole floor)
  constructor(host, { plan, floorIndex = 0, room, photo, onMoreInfo, tap = "controls", nav = true, devices = true }) {
    this.host = host; this.showDevices = devices; this.photo = photo; this.onMoreInfo = onMoreInfo; this.tap = tap; this.nav = nav;
    host.innerHTML = `<div class="st"><div class="stage"></div><div class="glow"></div><div class="hot"></div><div class="bar"></div></div>`;
    this.root = host.firstElementChild; this.stage = this.root.querySelector(".stage"); this.glowEl = this.root.querySelector(".glow"); this.hotEl = this.root.querySelector(".hot"); this.barEl = this.root.querySelector(".bar");
    this.yaw = 0; this.pitch = 0; this.fov = 75; this.cache = new Map();
    this.bind();
    this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(this.root);
    this.setPlan(plan, floorIndex, room);
  }
  setPlan(plan, fi = 0, room = this.roomId) {
    this.plan = plan; this.fi = fi; this.floor = plan.floors[fi] || plan.floors[0];
    for (const v of this.cache.values()) v.then((x) => x && URL.revokeObjectURL(x.url));
    this.cache.clear();
    this.go(this.floor.rooms.some((r) => r.id === room) ? room : null);
  }
  get(key) { if (!this.cache.has(key)) this.cache.set(key, this.photo(key).catch(() => null)); return this.cache.get(key); }
  set hass(h) { this._hass = h; this.draw(); if (this.openId != null && !this.popEl?.querySelector(".ctl[data-busy]")) this.drawPop(); }

  // go to a room (its 360° picture, or its photo when there is no 360° yet) or, with null, the whole floor
  async go(roomId) {
    const token = (this.token = (this.token || 0) + 1);
    this.closePop(); this.closeMenu();
    this.roomId = roomId; this.room = this.floor.rooms.find((r) => r.id === roomId) || null;
    this.hs?.forEach((el) => el.remove()); this.hs = new Map(); this.glowEl.innerHTML = ""; this.glows = new Map();
    this.root.querySelector(".msg")?.remove();
    this.drawBar();
    const H = this.floor.height || 2.8, devices = this.showDevices ? this.floor.devices.filter((d) => d.entity) : [];
    let pic = null, kind = "flat";
    if (this.room) {
      pic = await this.get(`pano_${this.room.id}`); kind = "pano";
      if (!pic) { pic = await this.get(this.room.id); kind = "flat"; }
    } else pic = await this.get("all");
    if (token !== this.token) return;
    this.kind = kind; this.cam = pic?.camera || null;
    this.spots = devices.filter((d) => !this.room || inside([d.x, d.y], this.room.pts)).map((d) => ({ id: d.id, d, p: devicePoint(d, this.floor, H) }));
    if (!this.room) for (const r of this.floor.rooms) { const [x, y] = centroid(r.pts); this.spots.push({ id: `room_${r.id}`, room: r, p: [x, 0.9, y] }); }
    else for (const { room, at } of doorsFrom(this.floor, this.room)) this.spots.push({ id: `door_${room.id}`, room, door: true, p: [at[0], 1.1, at[1]] });
    this.stage.innerHTML = ""; this.stage.className = "stage"; this.sphere?.dispose(); this.sphere = null; this.img = null;
    if (!pic) return this.message(this.room ? t("This room's pictures aren't made yet. In the Atelier, open the home settings and press Make dashboard pictures.") : t("The pictures of this home aren't made yet. In the Atelier, open the home settings and press Make dashboard pictures."));
    if (kind === "pano") {
      this.stage.classList.add("pano");
      const canvas = document.createElement("canvas"); this.stage.appendChild(canvas);
      try { this.sphere = new Sphere(canvas); } catch { return this.message(t("This device can't show 360° pictures")); }
      this.eye = this.cam?.pos || panoSpot(this.room);
      // start looking towards most of the devices
      const pts = this.spots.filter((s) => s.d).map((s) => s.p);
      if (pts.length) { const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, 0, a[2] + p[2] / pts.length], [0, 0, 0]); this.yaw = Math.atan2(-(c[0] - this.eye[0]), -(c[2] - this.eye[2])); } else this.yaw = 0;
      this.pitch = 0; this.fov = 75;
      const img = new Image(); img.onload = () => { if (token === this.token && this.sphere) { this.sphere.image(img); this.draw(); } }; img.src = pic.url;
    } else {
      const img = (this.img = new Image()); img.onload = () => this.draw(); img.src = pic.url; this.stage.appendChild(img);
    }
    this.draw();
  }
  message(text) { let m = this.root.querySelector(".msg"); if (!m) { m = document.createElement("div"); m.className = "msg"; this.root.insertBefore(m, this.barEl); } m.textContent = text; }

  drawBar() {
    if (!this.nav) { this.barEl.innerHTML = ""; return; }
    const rooms = this.floor.rooms, i = rooms.indexOf(this.room);
    this.barEl.innerHTML = this.room
      ? `<button data-b="home" aria-label="${esc(t("Whole home"))}"><ha-icon icon="mdi:home-outline"></ha-icon></button><button data-b="prev" aria-label="${esc(t("Previous room"))}"><ha-icon icon="mdi:chevron-left"></ha-icon></button><button class="name" data-b="menu">${esc(this.room.name || t("Room"))}</button><button data-b="next" aria-label="${esc(t("Next room"))}"><ha-icon icon="mdi:chevron-right"></ha-icon></button>`
      : `<span class="sp"></span><button class="name" data-b="menu"><ha-icon icon="mdi:door-open"></ha-icon>${esc(t("Rooms"))}</button><span class="sp"></span>`;
    this.barEl.querySelectorAll("button").forEach((b) => (b.onclick = (e) => {
      e.stopPropagation(); const k = b.dataset.b;
      if (k === "home") this.go(null);
      else if (k === "prev") this.go(rooms[(i - 1 + rooms.length) % rooms.length].id);
      else if (k === "next") this.go(rooms[(i + 1) % rooms.length].id);
      else this.menuEl ? this.closeMenu() : this.openMenu();
    }));
  }
  openMenu() {
    this.closePop();
    const m = (this.menuEl = document.createElement("div")); m.className = "menu";
    m.innerHTML = `<button data-r="" class="${this.room ? "" : "cur"}">${esc(t("Whole home"))}</button>` + this.floor.rooms.map((r) => `<button data-r="${esc(r.id)}" class="${r === this.room ? "cur" : ""}">${esc(r.name || t("Room"))}</button>`).join("");
    m.querySelectorAll("button").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.go(b.dataset.r || null); }));
    this.root.appendChild(m);
  }
  closeMenu() { this.menuEl?.remove(); this.menuEl = null; }

  bind() {
    const el = this.stage, ptrs = new Map(); let start = null;
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    this.root.addEventListener("pointerdown", (e) => { if (!e.composedPath().some((n) => n.classList?.contains?.("pop") || n.classList?.contains?.("hs") || n.classList?.contains?.("bar") || n.classList?.contains?.("menu"))) { this.closePop(); this.closeMenu(); } });
    el.addEventListener("pointerdown", (e) => {
      if (this.kind !== "pano") return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId);
      start = { yaw: this.yaw, pitch: this.pitch, fov: this.fov, x: e.clientX, y: e.clientY, d: ptrs.size === 2 ? dist() : 0 };
    });
    el.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId) || !start) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { if (!start.d) { start.d = dist(); start.fov = this.fov; } this.fov = Math.max(35, Math.min(95, start.fov * (start.d / dist()))); return this.draw(); }
      const k = (this.fov / el.clientHeight) * (Math.PI / 180);
      this.yaw = start.yaw + (e.clientX - start.x) * k; this.pitch = Math.max(-1.35, Math.min(1.35, start.pitch + (e.clientY - start.y) * k)); this.draw();
    });
    const up = (e) => { ptrs.delete(e.pointerId); start = ptrs.size ? { yaw: this.yaw, pitch: this.pitch, fov: this.fov, x: [...ptrs.values()][0][0], y: [...ptrs.values()][0][1], d: 0 } : null; };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => { if (this.kind !== "pano") return; e.preventDefault(); this.fov = Math.max(35, Math.min(95, this.fov * (e.deltaY > 0 ? 1.08 : 0.93))); this.draw(); }, { passive: false });
  }

  // where a point of the home is on the card, in pixels (null when it is out of sight)
  where(p, W, H) {
    if (this.kind === "pano") { const q = projectPano(this.eye, this.yaw, this.pitch, this.fov, W / H, p); return q && [q[0] * W, q[1] * H]; }
    if (!this.cam || !this.img?.naturalWidth) return null;
    const q = projectFlat(this.cam, p); if (!q) return null;
    // the picture fills the card (cropped at the sides or top and bottom)
    const iw = this.img.naturalWidth, ih = this.img.naturalHeight, s = Math.max(W / iw, H / ih);
    return [(W - iw * s) / 2 + q[0] * iw * s, (H - ih * s) / 2 + q[1] * ih * s];
  }
  draw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      const W = this.root.clientWidth, H = this.root.clientHeight; if (!W || !H) return;
      if (this.sphere) this.sphere.draw(Math.round(W * Math.min(2, devicePixelRatio || 1)), Math.round(H * Math.min(2, devicePixelRatio || 1)), this.yaw, this.pitch, this.fov);
      this.drawHot(W, H);
      if (this.popEl) this.placePop();
    });
  }
  drawHot(W, H) {
    const scale = this.kind === "pano" ? 75 / this.fov : 1;
    for (const s of this.spots || []) {
      let el = this.hs.get(s.id);
      if (!el) {
        el = document.createElement("div"); el.className = `hs${s.room ? " room" : ""}${s.door ? " door" : ""}`;
        el.innerHTML = s.room ? `<button><ha-icon icon="${s.door ? "mdi:arrow-up-bold-circle-outline" : "mdi:door-open"}"></ha-icon>${esc(s.room.name || t("Room"))}</button>` : `<button aria-label="${esc(s.d.name || s.d.entity)}"><ha-icon></ha-icon></button>`;
        el.firstElementChild.addEventListener("click", (e) => { e.stopPropagation(); this.tapSpot(s); });
        this.hotEl.appendChild(el); this.hs.set(s.id, el);
      }
      const at = this.where(s.p, W, H), show = !!at && at[0] > -20 && at[0] < W + 20 && at[1] > -20 && at[1] < H - 40;
      el.classList.toggle("hide", !show);
      const glow = this.glows.get(s.id);
      if (!show) { if (glow) glow.style.opacity = 0; continue; }
      el.style.left = `${at[0]}px`; el.style.top = `${at[1]}px`; el.dataset.x = at[0]; el.dataset.y = at[1];
      if (!s.d) continue;
      const st = this._hass?.states[s.d.entity], on = isOn(st), kind = s.d.kind || "light";
      el.classList.toggle("on", on); el.style.setProperty("--c", COLORS[kind] || "#8B6CFF");
      const icon = kind === "light" ? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline") : kind === "curtain" ? (on ? "mdi:curtains" : "mdi:curtains-closed") : KINDS[kind]?.icon || "mdi:circle";
      const ic = el.querySelector("ha-icon"); if (ic.getAttribute("icon") !== icon) ic.setAttribute("icon", icon);
      // a light that is on glows on the picture, in its own colour and brightness
      if (kind === "light") {
        const g = glowOf(st);
        let gi = glow; if (!gi) { gi = document.createElement("i"); this.glowEl.appendChild(gi); this.glows.set(s.id, gi); }
        const r = (this.room ? 0.42 : 0.16) * Math.min(W, H) * scale * (g ? 0.7 + 0.3 * g.k : 1);
        gi.style.left = `${at[0]}px`; gi.style.top = `${at[1]}px`; gi.style.width = gi.style.height = `${2 * r}px`;
        gi.style.opacity = g ? (0.55 * g.k).toFixed(2) : 0;
        if (g) gi.style.background = `radial-gradient(circle, ${g.c} 0%, color-mix(in srgb, ${g.c} 35%, transparent) 30%, transparent 70%)`;
      }
    }
  }
  tapSpot(s) {
    if (s.room) return this.go(s.room.id);
    if (this.tap === "toggle") { this._hass?.callService("homeassistant", "toggle", { entity_id: s.d.entity }); return; }
    this.openId === s.id && this.popEl ? this.closePop() : this.open(s.id);
  }
  open(id) { this.closeMenu(); this.openId = id; this.drawPop(); }
  closePop() { this.popEl?.remove(); this.popEl = null; this.openId = null; }
  drawPop() {
    const dv = this.spots?.find((x) => x.id === this.openId)?.d; if (!dv || !this._hass) return;
    if (!this.popEl) { this.popEl = document.createElement("div"); this.popEl.className = "pop"; this.popEl.addEventListener("pointerdown", (e) => e.stopPropagation()); this.root.appendChild(this.popEl); }
    this.popEl.innerHTML = controlsHtml(this._hass, dv.entity, dv.name, COLORS[dv.kind || "light"] || "#8B6CFF");
    bindControls(this.popEl, () => this._hass, (e) => { this.closePop(); this.onMoreInfo?.(e); });
    this.placePop();
  }
  placePop() {
    const el = this.popEl, hs = this.hs.get(this.openId); if (!el || !hs) return;
    const W = this.root.clientWidth, H = this.root.clientHeight, w = el.offsetWidth, h = el.offsetHeight, x = +hs.dataset.x, y = +hs.dataset.y;
    el.style.left = `${Math.max(12, Math.min(W - w - 12, x - w / 2))}px`; el.style.top = `${Math.max(8, y - h - 28 > 8 ? y - h - 28 : Math.min(H - h - 56, y + 28))}px`;
  }
  look(yaw, pitch = 0) { this.yaw = yaw; this.pitch = pitch; this.draw(); }
  dispose() {
    this.ro.disconnect(); cancelAnimationFrame(this._raf); this.sphere?.dispose();
    for (const v of this.cache.values()) v.then((x) => x && URL.revokeObjectURL(x.url));
    this.host.innerHTML = "";
  }
}
