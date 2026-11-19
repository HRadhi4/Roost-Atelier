// The Atelier: draw your home on the left, see it in 3D on the right. Everything is drag and drop,
// sliders and switches; nothing needs typing except names.
import { t, isRtl } from "./i18n.js";
import { ROOM_TYPES, uid, clone, snap, round, rect, area, centroid, bounds, inside, walls, openingsOn, nearestWall, snapTargets, snapTo, planBounds, validate, newPlan } from "./model.js";
import { SAMPLES } from "./samples.js";
import { LIBRARY, CATEGORIES, dims } from "./furniture.js";
import { FLOORS, WALLS, FABRICS, swatchColor, swatchCanvas } from "./materials.js";
import { KINDS, LIGHT_LOOKS, deviceKind, LUMENS, KELVIN, RULES, kelvinToHex } from "./devices.js";
import { matchPhoto } from "./calibrate.js";
import { RoomPhotographer } from "./photos.js";
import { settle } from "./collide.js";
import { AtelierView, VIEW_CSS } from "./view.js";
import { check } from "./check.js";
import { ItemPreview } from "./preview.js";

const LIVE_KEYS = new Set(["lumens", "kelvin", "gain", "power"]);
const ws = (hass, msg) => hass.connection.sendMessagePromise(msg);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ICON_ROOM = Object.fromEntries(Object.entries(ROOM_TYPES).map(([k, v]) => [k, v.icon]));
const DEV_COL = { light: "#F5B041", ac: "#2EC4B6", curtain: "#4E8CFF", tv: "#8B6CFF", door: "#FF7A59", lock: "#FF7A59", fan: "#2EC4B6", person: "#E86FB0", speaker: "#8B6CFF", vacuum: "#5FBF77", sensor: "#7C86B8" };
const TOOLS = [
  ["select", "mdi:cursor-default-outline", "Select"], ["room", "mdi:vector-square-plus", "Rooms"], ["door", "mdi:door", "Door"], ["window", "mdi:window-closed-variant", "Window"],
  ["slider", "mdi:door-sliding", "Slider"], ["arch", "mdi:gate-arrow-right", "Arch"], ["furniture", "mdi:sofa-outline", "Furniture"], ["devices", "mdi:lightbulb-group-outline", "Devices"],
  ["import", "mdi:file-image-plus-outline", "Import"], ["check", "mdi:check-decagram-outline", "Check the home"],
];
const thumbs = new Map();
function floorThumb(name) { if (!thumbs.has(name)) { const c = swatchCanvas(name); const s = document.createElement("canvas"); s.width = s.height = 64; s.getContext("2d").drawImage(c, 0, 0, 64, 64); thumbs.set(name, s.toDataURL("image/jpeg", 0.8)); } return thumbs.get(name); }

const CSS = `
:host{display:block;height:100vh;height:100dvh;position:relative}
.ed{--bg:#0B0D17;--panel:rgba(20,24,49,.92);--border:#242A4D;--text:#EEF0FF;--muted:#9AA3D9;--inset:#1D2244;--track:#262C52;--grid:rgba(154,163,217,.08);--wall:#C9CEF0;--acc1:#6D4BFF;--acc2:#8B6CFF;
  position:absolute;inset:0;display:grid;grid-template-columns:64px 1fr 300px;grid-template-rows:56px 1fr;background:var(--bg);color:var(--text);font:500 13px/1.35 Inter,var(--paper-font-body1_-_font-family,system-ui,sans-serif);overflow:hidden;-webkit-tap-highlight-color:transparent;user-select:none}
.ed.light{--bg:#EEF1FA;--panel:rgba(255,255,255,.95);--border:#E2E5F2;--text:#161936;--muted:#5E668F;--inset:#EEF0FA;--track:#DDE1F0;--grid:rgba(94,102,143,.10);--wall:#2A2F45}
.ed[data-layout=plan] .three,.ed[data-layout=three] .plan{display:none}
.ed[data-layout=plan] main,.ed[data-layout=three] main{grid-template-columns:1fr}
header{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--border);background:var(--panel);z-index:3}
header .title{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
header h1{all:unset;font:600 17px "Space Grotesk",Inter,sans-serif;white-space:nowrap}
button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;height:40px;min-width:40px;padding:0 10px;color:var(--text);transition:background .12s,transform .12s}
button:active{transform:scale(.96)}
button:hover{background:var(--inset)}
button.on,button.primary{color:#fff;background:linear-gradient(135deg,var(--acc1),var(--acc2));box-shadow:0 0 14px rgba(109,75,255,.35)}
button[disabled]{opacity:.35;pointer-events:none}
button.danger{color:#FF7A7A}
ha-icon{--mdc-icon-size:20px;display:inline-flex}
.seg{display:flex;gap:2px;padding:3px;border-radius:14px;background:var(--inset)}
.seg button{height:34px;border-radius:11px}
.status{color:var(--muted);font-size:12px;min-width:64px;text-align:center}
nav{grid-row:2;display:flex;flex-direction:column;gap:6px;padding:10px 8px;border-inline-end:1px solid var(--border);background:var(--panel);overflow:auto;z-index:2}
nav button{width:48px;height:48px;border-radius:14px}
nav .sep{height:1px;background:var(--border);margin:4px 6px}
main{grid-row:2;display:grid;grid-template-columns:1.2fr 1fr;min-width:0;min-height:0}
.plan{position:relative;overflow:hidden;touch-action:none;background:var(--bg)}
.plan svg{position:absolute;inset:0;width:100%;height:100%}
.plan .devs{position:absolute;inset:0;pointer-events:none}
.plan .dv{position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--c);box-shadow:0 0 12px color-mix(in srgb,var(--c) 60%,transparent);pointer-events:auto;cursor:grab;border:2px solid transparent}
.plan .dv.sel{border-color:#fff;box-shadow:0 0 0 3px var(--acc1)}
.plan .dv ha-icon{--mdc-icon-size:16px}
.plan .hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:var(--panel);border:1px solid var(--border);color:var(--muted);font-size:12px;pointer-events:none;white-space:nowrap}
.plan .zoom{position:absolute;bottom:12px;inset-inline-start:12px;display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:14px;background:var(--panel);border:1px solid var(--border)}
.three{position:relative;border-inline-start:1px solid var(--border);min-width:0}
aside{grid-row:2;border-inline-start:1px solid var(--border);background:var(--panel);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px;z-index:2}
aside>*{flex:none}
aside h2{all:unset;font:600 15px "Space Grotesk",Inter,sans-serif;display:flex;align-items:center;gap:8px}
aside h3{all:unset;font:600 11px Inter,sans-serif;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.row.between{justify-content:space-between}
.field{display:flex;flex-direction:column;gap:6px}
input[type=text],select{all:unset;box-sizing:border-box;height:40px;padding:0 12px;border-radius:12px;background:var(--inset);color:var(--text);border:1px solid var(--border);width:100%}
input[type=range]{width:100%;accent-color:var(--acc1);height:28px}
.sl{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center}
.sl b{font:600 13px "Space Grotesk",Inter,sans-serif;min-width:52px;text-align:end}
.sl input{grid-column:1/-1}
.chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}
.chips button{height:auto;min-height:58px;flex-direction:column;gap:4px;padding:8px 4px;border-radius:14px;background:var(--inset);font-size:11px;text-align:center}
.chips button.on{background:linear-gradient(135deg,var(--acc1),var(--acc2))}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:6px}
.sw button{height:40px;padding:0;border-radius:12px;background-size:cover;border:2px solid transparent}
.sw button.on{border-color:var(--acc2);box-shadow:0 0 0 2px var(--acc1)}
.lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
.lib .tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:14px;background:var(--inset);cursor:grab;touch-action:none;font-size:11px;text-align:center}
.lib .tile svg{width:56px;height:40px}
.tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.tabs button{height:32px;border-radius:10px;background:var(--inset);font-size:12px;white-space:nowrap}
.tabs button.on{background:linear-gradient(135deg,var(--acc1),var(--acc2))}
.tip{color:var(--muted);font-size:12px}
.card{padding:12px;border-radius:16px;background:var(--inset);display:flex;flex-direction:column;gap:8px}
.list button{width:100%;justify-content:flex-start;height:auto;min-height:48px;padding:8px 12px;border-radius:14px;background:var(--inset);margin-bottom:6px;text-align:start}
.list small{display:block;color:var(--muted);font-size:11px}
.pv{height:190px;margin:2px 0 4px;border-radius:16px;overflow:hidden;background:radial-gradient(120% 90% at 50% 30%,#2a2f52,#12152a)}
.pv3{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
.shots{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.shots .shot{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)}
.shots img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;background:var(--inset)}
.issue{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;background:var(--inset)}
.issue ha-icon{color:#F5B041}.issue.ok ha-icon{color:#5FBF77}
.ghost{position:fixed;z-index:20;pointer-events:none;transform:translate(-50%,-50%);padding:8px 12px;border-radius:12px;background:linear-gradient(135deg,var(--acc1),var(--acc2));color:#fff;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.menu{position:absolute;top:52px;inset-inline-start:12px;width:320px;max-height:70vh;overflow:auto;padding:12px;border-radius:18px;background:var(--panel);border:1px solid var(--border);box-shadow:0 18px 50px rgba(0,0,0,.4);z-index:10;display:flex;flex-direction:column;gap:10px}
.dialog{position:fixed;inset:0;background:rgba(5,6,14,.55);display:grid;place-items:center;z-index:30}
.dialog>div{width:min(360px,90vw);padding:18px;border-radius:20px;background:var(--panel);border:1px solid var(--border);display:flex;flex-direction:column;gap:12px}
@media (max-width:900px){
 .ed{grid-template-columns:minmax(0,1fr);grid-template-rows:56px minmax(0,1fr) auto 64px}
 header{gap:4px;padding:0 6px;overflow-x:auto;scrollbar-width:none}
 header h1{max-width:34vw;overflow:hidden;text-overflow:ellipsis}
 header .status{display:none}
 main{min-width:0}
 .ed:not(.sheet) aside{display:none}
 nav{grid-row:4;flex-direction:row;border:0;border-top:1px solid var(--border);padding:8px;overflow-x:auto}
 nav .sep{width:1px;height:auto;margin:6px 4px}
 main{grid-row:2;grid-template-columns:1fr}
 .ed[data-layout=split] main{grid-template-columns:1fr;grid-template-rows:1fr 1fr}
 .ed[data-layout=split] .three{border:0;border-top:1px solid var(--border)}
 aside{grid-row:3;max-height:38vh;border:0;border-top:1px solid var(--border);border-radius:20px 20px 0 0;min-width:0}
 aside:empty{display:none}
}
${VIEW_CSS}
`;

export class AtelierEditor {
  constructor(root, panelEl, { rtl } = {}) {
    this.root = root; this.panelEl = panelEl;
    this.tool = "select"; this.sel = null; this.layout = "split"; this.z = 40; this.px = 60; this.py = 60; this.cat = "Living";
    this.undoStack = []; this.redoStack = []; this.status = "";
    root.innerHTML = `<style>${CSS}</style><div class="ed" dir="${rtl ? "rtl" : "ltr"}" data-layout="split">
      <header><div class="title"><button class="homes" title="${t("Homes")}"><ha-icon icon="mdi:home-outline"></ha-icon><h1></h1><ha-icon icon="mdi:chevron-down"></ha-icon></button></div>
        <button data-a="undo" title="${t("Undo")}"><ha-icon icon="mdi:undo"></ha-icon></button><button data-a="redo" title="${t("Redo")}"><ha-icon icon="mdi:redo"></ha-icon></button>
        <div class="seg floors"></div><span class="status"></span>
        <div class="seg layout"><button data-l="plan" title="Plan"><ha-icon icon="mdi:floor-plan"></ha-icon></button><button data-l="split" title="Split"><ha-icon icon="mdi:view-split-vertical"></ha-icon></button><button data-l="three" title="${t("3D")}"><ha-icon icon="mdi:cube-outline"></ha-icon></button></div>
        <button data-a="settings" title="${t("Settings")}"><ha-icon icon="mdi:tune-variant"></ha-icon></button></header>
      <nav></nav><main><div class="plan"><svg xmlns="http://www.w3.org/2000/svg"><defs></defs><g class="w"></g></svg><div class="devs"></div><div class="hint"></div>
        <div class="zoom"><button data-z="in"><ha-icon icon="mdi:plus"></ha-icon></button><button data-z="fit"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon></button><button data-z="out"><ha-icon icon="mdi:minus"></ha-icon></button></div></div>
        <div class="three"></div></main><aside></aside></div>`;
    this.ed = root.querySelector(".ed"); this.svg = root.querySelector("svg"); this.g = root.querySelector("svg .w"); this.devsEl = root.querySelector(".devs");
    this.planEl = root.querySelector(".plan"); this.aside = root.querySelector("aside");
    this.drawNav();
    root.querySelector(".homes").onclick = () => this.homesMenu();
    root.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => this.setLayout(b.dataset.l)));
    root.querySelector('[data-a="undo"]').onclick = () => this.undo();
    root.querySelector('[data-a="redo"]').onclick = () => this.redo();
    root.querySelector('[data-a="settings"]').onclick = () => { this.sel = null; this.tool = "select"; this.drawNav(); this.inspector("settings"); this.draw(); };
    root.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => { const z = b.dataset.z; if (z === "fit") { this.fit(); this._userView = false; } else this.zoomAt(this.planEl.clientWidth / 2, this.planEl.clientHeight / 2, z === "in" ? 1.25 : 0.8); }));
    this.bindPlan();
    this.ro = new ResizeObserver(() => { if (!this._userView && this.plan) this.fit(); this.draw(); }); this.ro.observe(this.planEl);
    this.keys = (e) => this.key(e); window.addEventListener("keydown", this.keys);
  }
  set narrow(n) { this._narrow = n; }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    this.ed.classList.toggle("light", h.themes?.darkMode === false);
    if (this.view) this.view.hass = h;
    if (first) this.start();
  }
  pause(p) { this.view?.engine.setVisible(!p); }
  async start() {
    this.view = new AtelierView(this.root.querySelector(".three"), { editing: true, canBake: true, onMoreInfo: () => {} });
    this.view.hass = this._hass;
    this.view.onPick = (hit) => { if (hit.item) this.select({ t: "item", id: hit.item }); else if (hit.room) this.select({ t: "room", id: hit.room }); };
    this.view.onDemo = (d) => this.select({ t: "dev", id: d.id });
    // light is baked here (this computer), then room photos are made when nobody is using it
    this.photographer = new RoomPhotographer(this);
    this.emitPhotos = () => { if (!this.sel && this.tool === "select") this.homePanel(); };
    this.view.engine.on("bake", ({ state }) => { if (state === "ready") this.photographer.schedule(); else if (state === "baking") this.photographer.reset(); });
    this.view.engine.on("hold", (hit) => { if (hit.device) this.select({ t: "dev", id: hit.device }); });
    let list = [];
    try { list = await ws(this._hass, { type: "roost_atelier/plans" }); } catch (e) { console.warn(e); }
    this.plans = list;
    const last = localStorage.getItem("roost-atelier-last");
    const id = list.find((p) => p.id === last)?.id || list[0]?.id;
    if (id) await this.open(id); else this.load(SAMPLES[0].make(), true);
    if (!id) this.homesMenu(true);
  }
  async open(id) { const p = await ws(this._hass, { type: "roost_atelier/plan", plan_id: id }); this.load(validate(p)); }
  load(plan, unsaved = false) {
    this.plan = plan; this.fi = 0; this.floor = plan.floors[0]; this.sel = null; this.undoStack = []; this.redoStack = []; this._fitted = false; this._userView = false;
    this.root.querySelector("h1").textContent = plan.name;
    if (plan.id) localStorage.setItem("roost-atelier-last", plan.id);
    this.drawFloors(); this.view.setPlan(plan, 0); this.view.engine._framed = false; this.view.engine.frame("3d", true);
    this.fit(); this.draw(); this.inspector(); this.setStatus(unsaved ? "" : t("Saved"));
    if (unsaved) this.save();
  }

  // ------------------------------------------------------------ changes, undo and saving
  snapshot() { this.undoStack.push(JSON.stringify(this.plan)); if (this.undoStack.length > 80) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(this.plan)); this.restore(this.undoStack.pop()); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(this.plan)); this.restore(this.redoStack.pop()); }
  restore(json) { const id = this.plan.id; this.plan = JSON.parse(json); this.plan.id = id; this.fi = Math.min(this.fi, this.plan.floors.length - 1); this.floor = this.plan.floors[this.fi]; if (this.sel && !this.find(this.sel)) this.sel = null; this.changed(true); this.inspector(); }
  changed(rebuild = true, light = false, item = false) {
    this.draw();
    if (light && this.sel?.t === "item") { const it = this.find(this.sel); if (it && this.view.engine.moveItem(it)) rebuild = false; }
    // a change to one piece of furniture only redraws that piece, not the whole home
    if (rebuild && item && this.sel?.t === "item") { const it = this.find(this.sel); if (it && this.view.engine.replaceItem(it)) rebuild = false; }
    if (this.sel?.t === "item") this.preview?.set(this.find(this.sel));
    if (rebuild) { clearTimeout(this._rb); const now = performance.now(); const go = () => { this._lastRb = performance.now(); this.view.setPlan(this.plan, this.fi); }; if (this._dragging && now - (this._lastRb || 0) < 450) this._rb = setTimeout(go, 450); else if (this._dragging) go(); else this._rb = setTimeout(go, 60); }
    this.setStatus(t("Saving")); clearTimeout(this._sv); this._sv = setTimeout(() => this.save(), 1200);
    this.root.querySelector('[data-a="undo"]').toggleAttribute("disabled", !this.undoStack.length);
    this.root.querySelector('[data-a="redo"]').toggleAttribute("disabled", !this.redoStack.length);
  }
  async save() {
    clearTimeout(this._sv);
    try {
      const res = await ws(this._hass, { type: "roost_atelier/save", plan: this.plan });
      if (!this.plan.id) { this.plan.id = res.id; localStorage.setItem("roost-atelier-last", res.id); this.plans = await ws(this._hass, { type: "roost_atelier/plans" }); }
      this.setStatus(t("Saved"));
    } catch (e) { this.setStatus(t("Offline")); console.warn(e); }
  }
  setStatus(s) { this.root.querySelector(".status").textContent = s; }

  // ------------------------------------------------------------ finding things
  find(s) { if (!s) return null; const f = this.floor; return (s.t === "room" ? f.rooms : s.t === "op" ? f.openings : s.t === "item" ? f.items : f.devices).find((x) => x.id === s.id); }
  select(s) { this.sel = s; if (this.tool !== "select" && s) { this.tool = "select"; this.drawNav(); } this.draw(); this.inspector(); }
  remove(s) { this.snapshot(); const f = this.floor, k = s.t === "room" ? "rooms" : s.t === "op" ? "openings" : s.t === "item" ? "items" : "devices"; f[k] = f[k].filter((x) => x.id !== s.id); this.sel = null; this.changed(); this.inspector(); }

  // ------------------------------------------------------------ floors
  drawFloors() {
    const el = this.root.querySelector(".floors"), fl = this.plan.floors;
    el.innerHTML = fl.map((f, i) => `<button data-fl="${i}" class="${i === this.fi ? "on" : ""}" title="${esc(f.name)}">${i === 0 ? "G" : i}</button>`).join("") + `<button data-fl="add" title="${t("Add level")}"><ha-icon icon="mdi:plus"></ha-icon></button>`;
    el.querySelectorAll("[data-fl]").forEach((b) => (b.onclick = () => (b.dataset.fl === "add" ? this.addFloor() : this.useFloor(+b.dataset.fl))));
  }
  useFloor(i) { this.fi = i; this.floor = this.plan.floors[i]; this.sel = null; this.view.setPlan(this.plan, i); this._userView = false; this.fit(); this.drawFloors(); this.inspector(); }
  addFloor() {
    this.snapshot();
    const top = this.plan.floors[this.plan.floors.length - 1];
    // the new floor starts with the same outline as the one below, ready to divide
    const rooms = top.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor).map((r) => ({ id: uid("r"), type: r.type === "majlis" || r.type === "entrance" ? "living" : r.type, name: "", pts: clone(r.pts), floor: r.floor, wall: r.wall }));
    this.plan.floors.push({ id: uid("f"), name: `Floor ${this.plan.floors.length}`, height: top.height, elevation: (top.elevation || 0) + top.height + 0.3, rooms, openings: [], items: [], devices: [], walls: [] });
    this.changed(false); this.useFloor(this.plan.floors.length - 1);
  }
  removeFloor() {
    if (this.plan.floors.length < 2) return;
    this.confirm(`${t("Delete")} “${this.floor.name}”?`, () => { this.snapshot(); this.plan.floors.splice(this.fi, 1); this.changed(false); this.useFloor(Math.max(0, this.fi - 1)); });
  }

  // ------------------------------------------------------------ the left rail
  drawNav() {
    const nav = this.root.querySelector("nav");
    nav.innerHTML = TOOLS.map(([k, i, l], n) => `${n === 6 || n === 8 ? '<div class="sep"></div>' : ""}<button data-t="${k}" class="${this.tool === k ? "on" : ""}" title="${t(l)}"><ha-icon icon="${i}"></ha-icon></button>`).join("");
    nav.querySelectorAll("button").forEach((b) => (b.onclick = () => this.setTool(b.dataset.t)));
  }
  setTool(k) { this.tool = k; if (k !== "select") this.sel = null; this.drawNav(); this.draw(); this.inspector(); }
  setLayout(l) { this.layout = l; this.ed.dataset.layout = l; this.root.querySelectorAll("[data-l]").forEach((b) => b.classList.toggle("on", b.dataset.l === l)); requestAnimationFrame(() => { this.view.engine.resize(); this.view.engine.frame(this.view.engine.view || "3d"); if (l !== "three") this.fit(); this.draw(); }); }

  // ------------------------------------------------------------ the 2D plan
  toPlan(cx, cy) { const r = this.svg.getBoundingClientRect(); return [(cx - r.left - this.px) / this.z, (cy - r.top - this.py) / this.z]; }
  toScreen(x, y) { return [x * this.z + this.px, y * this.z + this.py]; }
  fit() {
    const w = this.planEl.clientWidth, h = this.planEl.clientHeight; if (!w || !this.floor) return;
    const b = planBounds(this.floor), pad = Math.min(48, w * 0.06);
    this.z = Math.min((w - pad * 2) / Math.max(1, b.x1 - b.x0), (h - pad * 2) / Math.max(1, b.y1 - b.y0));
    this.px = (w - (b.x1 - b.x0) * this.z) / 2 - b.x0 * this.z; this.py = (h - (b.y1 - b.y0) * this.z) / 2 - b.y0 * this.z;
    this._fitted = true; this.draw();
  }
  zoomAt(sx, sy, k) { this._userView = true; const z = Math.max(8, Math.min(400, this.z * k)); k = z / this.z; this.px = sx - (sx - this.px) * k; this.py = sy - (sy - this.py) * k; this.z = z; this.draw(); }
  draw() {
    if (!this.floor) return;
    this.root.querySelector(".layout").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.l === this.layout));
    const f = this.floor, z = this.z, s = this.sel, light = this.ed.classList.contains("light");
    const ws_ = walls(f);
    this.g.setAttribute("transform", `translate(${this.px} ${this.py}) scale(${z})`);
    const px = 1 / z;
    let out = "";
    // grid
    const W = this.planEl.clientWidth, H = this.planEl.clientHeight, [gx0, gy0] = [-this.px / z, -this.py / z], [gx1, gy1] = [(W - this.px) / z, (H - this.py) / z];
    const step = z > 60 ? 0.5 : z > 18 ? 1 : 5;
    let grid = "";
    for (let x = Math.floor(gx0 / step) * step; x < gx1; x += step) grid += `M${x} ${gy0}V${gy1}`;
    for (let y = Math.floor(gy0 / step) * step; y < gy1; y += step) grid += `M${gx0} ${y}H${gx1}`;
    out += `<path d="${grid}" stroke="var(--grid)" stroke-width="${px}" fill="none"/>`;
    // rooms
    for (const r of f.rooms) {
      const type = ROOM_TYPES[r.type] || ROOM_TYPES.other, fill = swatchColor("floor", r.floor || type.floor);
      out += `<polygon data-room="${r.id}" points="${r.pts.map((p) => p.join(",")).join(" ")}" fill="${fill}" fill-opacity="${light ? 0.55 : 0.42}" stroke="none"/>`;
    }
    // furniture footprints
    for (const it of f.items) {
      const d = dims(it), L = LIBRARY[it.kind], on = s?.t === "item" && s.id === it.id;
      const isRound = /round|plant|tree|ottoman|bar_stool|pendant|chandelier/.test(it.kind);
      out += `<g transform="translate(${it.x} ${it.y}) rotate(${-(it.rot || 0)})" data-item="${it.id}">`;
      out += isRound ? `<ellipse rx="${d.w / 2}" ry="${d.d / 2}" fill="${light ? "#fff" : "#2A3060"}" fill-opacity=".9" stroke="${on ? "var(--acc2)" : light ? "#9AA3C9" : "#5E668F"}" stroke-width="${(on ? 2.5 : 1) * px}" ${d.mount === "ceiling" ? `stroke-dasharray="${4 * px} ${3 * px}" fill-opacity=".2"` : ""}/>`
        : `<rect x="${-d.w / 2}" y="${-d.d / 2}" width="${d.w}" height="${d.d}" rx="${Math.min(0.08, d.w / 6)}" fill="${it.kind === "rug" ? it.color || "#C9B79C" : light ? "#fff" : "#2A3060"}" fill-opacity="${it.kind === "rug" ? 0.45 : 0.92}" stroke="${on ? "var(--acc2)" : light ? "#9AA3C9" : "#5E668F"}" stroke-width="${(on ? 2.5 : 1) * px}"/>`;
      if (!isRound && it.kind !== "rug") out += `<line x1="${-d.w / 2 + 0.05}" x2="${d.w / 2 - 0.05}" y1="${d.d / 2 - 0.04}" y2="${d.d / 2 - 0.04}" stroke="${light ? "#C9CEF0" : "#4A5190"}" stroke-width="${2 * px}"/>`;
      if (z > 34 && d.w * z > 46 && L) out += `<text transform="rotate(${it.rot || 0})" font-size="${10 * px}" text-anchor="middle" dominant-baseline="middle" fill="var(--muted)" pointer-events="none">${esc(t(L[0]))}</text>`;
      out += `</g>`;
    }
    // walls
    let wallPath = "", wallThin = "";
    for (const w of ws_) {
      const ops = openingsOn(w, f.openings), dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      let pos = 0;
      const seg = (a, b) => { const p = `M${w.a[0] + ux * a} ${w.a[1] + uy * a}L${w.a[0] + ux * b} ${w.a[1] + uy * b}`; if (w.parapet) wallThin += p; else out += `<path d="${p}" stroke="var(--wall)" stroke-width="${w.thick}" stroke-linecap="square" fill="none" pointer-events="none"/>`; };
      for (const { t0, t1 } of ops) { if (t0 > pos) seg(pos, t0); pos = t1; }
      if (pos < len) seg(pos, len);
    }
    if (wallThin) out += `<path d="${wallThin}" stroke="var(--wall)" stroke-opacity=".6" stroke-width="0.08" fill="none"/>`;
    // openings
    for (const op of f.openings) {
      const nw = nearestWall(f, [op.x, op.y], 0.3); if (!nw) continue;
      const a = nw.angle, deg = (a * 180) / Math.PI, on = s?.t === "op" && s.id === op.id, w = op.width, th = nw.w.thick;
      out += `<g transform="translate(${op.x} ${op.y}) rotate(${deg})" data-op="${op.id}">`;
      out += `<rect x="${-w / 2}" y="${-th / 2 - 0.05}" width="${w}" height="${th + 0.1}" fill="transparent"/>`;
      if (op.type === "window") out += `<rect x="${-w / 2}" y="${-th / 2}" width="${w}" height="${th}" fill="${light ? "#fff" : "#141831"}" stroke="#4E8CFF" stroke-width="${1.5 * px}"/><line x1="${-w / 2}" x2="${w / 2}" stroke="#4E8CFF" stroke-width="${1.5 * px}"/>`;
      else if (op.type === "slider") out += `<line x1="${-w / 2}" x2="${0.05}" y1="-0.03" y2="-0.03" stroke="#4E8CFF" stroke-width="${3 * px}"/><line x1="${-0.05}" x2="${w / 2}" y1="0.03" y2="0.03" stroke="#4E8CFF" stroke-width="${3 * px}"/>`;
      else if (op.type === "door") {
        const sw = op.swing >= 0 ? 1 : -1, leaves = op.double ? [[-w / 2, w / 2, 1], [w / 2, w / 2, -1]] : [[-w / 2, w, 1]];
        for (const [hx, lw, dir] of leaves) { const ex = hx + dir * lw; out += `<path d="M${hx} 0L${hx} ${sw * lw}M${ex} 0A${lw} ${lw} 0 0 ${(dir * sw > 0) ? 1 : 0} ${hx} ${sw * lw}" stroke="${op.main ? "#FF7A59" : "var(--muted)"}" stroke-width="${1.5 * px}" fill="none" stroke-dasharray="${op.main ? "" : `${3 * px} ${2 * px}`}"/>`; }
      } else out += `<path d="M${-w / 2} ${-th / 2}Q0 ${-th}${w / 2} ${-th / 2}" stroke="var(--muted)" stroke-width="${1.5 * px}" fill="none"/>`;
      if (on) out += `<rect x="${-w / 2 - 0.04}" y="${-th / 2 - 0.06}" width="${w + 0.08}" height="${th + 0.12}" rx="0.04" fill="none" stroke="var(--acc2)" stroke-width="${2.5 * px}"/>`;
      out += `</g>`;
    }
    // room labels
    for (const r of f.rooms) {
      const [cx, cy] = centroid(r.pts), b = bounds(r.pts); if ((b.x1 - b.x0) * z < 60) continue;
      out += `<text x="${cx}" y="${cy}" font-size="${12 * px}" font-weight="600" text-anchor="middle" fill="var(--text)" pointer-events="none" font-family="Space Grotesk,Inter,sans-serif">${esc(r.name || t(ROOM_TYPES[r.type]?.name || "Room"))}</text><text x="${cx}" y="${cy + 15 * px}" font-size="${10 * px}" text-anchor="middle" fill="var(--muted)" pointer-events="none">${round(Math.abs(area(r.pts)), 1)} m²</text>`;
    }
    // selected room handles and sizes
    if (s?.t === "room") {
      const r = this.find(s);
      if (r) {
        out += `<polygon points="${r.pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--acc2)" stroke-width="${2.5 * px}" pointer-events="none"/>`;
        r.pts.forEach((p, i) => {
          const q = r.pts[(i + 1) % r.pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len, sgn = inside([mx + nx * 0.1, my + ny * 0.1], r.pts) ? -1 : 1;
          out += `<text x="${mx + nx * sgn * 22 * px}" y="${my + ny * sgn * 22 * px}" font-size="${11 * px}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="var(--acc2)" pointer-events="none">${round(len, 2)} m</text>`;
          out += `<rect data-e="${i}" x="${mx - 9 * px}" y="${my - 9 * px}" width="${18 * px}" height="${18 * px}" rx="${5 * px}" fill="#fff" stroke="var(--acc1)" stroke-width="${2 * px}" transform="rotate(${(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI} ${mx} ${my})"/>`;
        });
        r.pts.forEach((p, i) => (out += `<circle data-v="${i}" cx="${p[0]}" cy="${p[1]}" r="${10 * px}" fill="var(--acc1)" stroke="#fff" stroke-width="${2.5 * px}"/>`));
      }
    }
    if (s?.t === "item") {
      const it = this.find(s);
      if (it) { const d = dims(it), a = ((it.rot || 0) * Math.PI) / 180, hx = it.x - Math.sin(a) * (d.d / 2 + 26 * px), hy = it.y - Math.cos(a) * (d.d / 2 + 26 * px); out += `<line x1="${it.x}" y1="${it.y}" x2="${hx}" y2="${hy}" stroke="var(--acc1)" stroke-width="${1.5 * px}" pointer-events="none"/><circle data-rot="1" cx="${hx}" cy="${hy}" r="${11 * px}" fill="#fff" stroke="var(--acc1)" stroke-width="${2.5 * px}"/>`; }
    }
    if (this.drawRect) { const [a, b] = this.drawRect; out += `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="rgba(109,75,255,.18)" stroke="var(--acc2)" stroke-width="${2 * px}"/><text x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2}" font-size="${13 * px}" font-weight="600" text-anchor="middle" fill="var(--text)">${round(Math.abs(b[0] - a[0]), 2)} × ${round(Math.abs(b[1] - a[1]), 2)} m</text>`; }
    if (this.guide) out += `<path d="${this.guide}" stroke="#F5B041" stroke-width="${1 * px}" stroke-dasharray="${4 * px} ${3 * px}" fill="none" pointer-events="none"/>`;
    this.g.innerHTML = out;
    // devices as icons on top
    const seen = new Set();
    for (const d of f.devices) {
      seen.add(d.id);
      let el = this.devsEl.querySelector(`[data-dev="${d.id}"]`);
      if (!el) { el = document.createElement("div"); el.className = "dv"; el.dataset.dev = d.id; el.innerHTML = `<ha-icon></ha-icon>`; this.devsEl.appendChild(el); }
      const kind = d.kind || deviceKind(d.entity), [sx, sy] = this.toScreen(d.x, d.y);
      el.style.left = `${sx}px`; el.style.top = `${sy}px`; el.style.transform = `translate(-50%,-50%) scale(${Math.max(0.6, Math.min(1, z / 45))})`; el.style.setProperty("--c", DEV_COL[kind] || "#8B6CFF");
      el.classList.toggle("sel", s?.t === "dev" && s.id === d.id);
      el.querySelector("ha-icon").setAttribute("icon", KINDS[kind]?.icon || "mdi:circle");
      el.title = d.name || "";
    }
    this.devsEl.querySelectorAll(".dv").forEach((el) => { if (!seen.has(el.dataset.dev)) el.remove(); });
    const hints = { select: "Drag to move. Pull a corner or a wall to resize.", room: "Tap and drag on the plan to draw a room.", door: "Tap a wall to add it.", window: "Tap a wall to add it.", slider: "Tap a wall to add it.", arch: "Tap a wall to add it.", furniture: "Drag a piece onto the plan.", devices: "Drag a piece onto the plan." };
    const hint = this.root.querySelector(".hint"); hint.textContent = t(hints[this.tool] || ""); hint.style.display = hints[this.tool] && !(this.tool === "select" && s) ? "" : "none";
  }

  // ------------------------------------------------------------ touching the plan
  bindPlan() {
    const el = this.planEl, ptrs = new Map();
    el.addEventListener("wheel", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    el.addEventListener("pointerdown", (e) => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId);
      if (ptrs.size === 2) { this.drag = { kind: "pinch", d0: this.pinchDist(ptrs), z0: this.z, c0: this.pinchMid(ptrs), px0: this.px, py0: this.py }; return; }
      this.down(e);
    });
    el.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const d = this.drag; if (!d) return;
      if (d.kind === "pinch") { if (ptrs.size < 2) return; const r = el.getBoundingClientRect(), c = this.pinchMid(ptrs), k = this.pinchDist(ptrs) / d.d0; this.z = d.z0; this.px = d.px0 + (c[0] - d.c0[0]); this.py = d.py0 + (c[1] - d.c0[1]); this.zoomAt(c[0] - r.left, c[1] - r.top, k); return; }
      this.move(e);
    });
    const up = (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (this.drag?.kind === "pinch") { if (!ptrs.size) this.drag = null; return; } this.up(e); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }
  pinchDist(p) { const [a, b] = [...p.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  pinchMid(p) { const [a, b] = [...p.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  down(e) {
    const tgt = e.target, P = this.toPlan(e.clientX, e.clientY), f = this.floor, ds = tgt.closest?.("[data-dev]");
    const start = { x: e.clientX, y: e.clientY, P, moved: false };
    if (this.tool === "room") { this.drag = { ...start, kind: "draw" }; this.drawRect = [this.snapPt(P), this.snapPt(P)]; return; }
    if (["door", "window", "slider", "arch"].includes(this.tool)) { this.drag = { ...start, kind: "addop" }; return; }
    if (ds) { const d = f.devices.find((x) => x.id === ds.dataset.dev); this.drag = { ...start, kind: "dev", obj: d, off: [d.x - P[0], d.y - P[1]] }; this.selectQuiet({ t: "dev", id: d.id }); return; }
    const a = tgt.closest?.("[data-v],[data-e],[data-rot],[data-op],[data-item],[data-room]");
    if (a?.dataset.v != null) { const r = this.find(this.sel); this.drag = { ...start, kind: "vertex", room: r, i: +a.dataset.v, links: this.linked(r.pts[+a.dataset.v]) }; return; }
    if (a?.dataset.e != null) { const r = this.find(this.sel), i = +a.dataset.e, p = r.pts[i], q = r.pts[(i + 1) % r.pts.length]; this.drag = { ...start, kind: "edge", room: r, i, a0: [...p], b0: [...q], la: this.linked(p), lb: this.linked(q), ops: f.openings.filter((o) => this.onEdge([o.x, o.y], p, q)).map((o) => [o, o.x, o.y]) }; return; }
    if (a?.dataset.rot) { this.drag = { ...start, kind: "rot", obj: this.find(this.sel) }; return; }
    if (a?.dataset.op) { const o = f.openings.find((x) => x.id === a.dataset.op); this.drag = { ...start, kind: "op", obj: o }; this.selectQuiet({ t: "op", id: o.id }); return; }
    if (a?.dataset.item) { const it = f.items.find((x) => x.id === a.dataset.item); this.drag = { ...start, kind: "item", obj: it, off: [it.x - P[0], it.y - P[1]] }; this.selectQuiet({ t: "item", id: it.id }); return; }
    if (a?.dataset.room) {
      const r = f.rooms.find((x) => x.id === a.dataset.room);
      const was = this.sel?.t === "room" && this.sel.id === r.id;
      this.drag = was ? { ...start, kind: "room", room: r, pts0: clone(r.pts), items: f.items.filter((i) => inside([i.x, i.y], r.pts)).map((i) => [i, i.x, i.y]), devs: f.devices.filter((d) => inside([d.x, d.y], r.pts)).map((d) => [d, d.x, d.y]), ops: f.openings.filter((o) => r.pts.some((p, k) => this.onEdge([o.x, o.y], p, r.pts[(k + 1) % r.pts.length]))).map((o) => [o, o.x, o.y]) } : { ...start, kind: "pan", px0: this.px, py0: this.py, tapRoom: r };
      return;
    }
    this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py, tapEmpty: true };
  }
  selectQuiet(s) { const same = this.sel?.t === s.t && this.sel.id === s.id; this.sel = s; if (!same) this.inspector(); this.draw(); }
  move(e) {
    const d = this.drag, P = this.toPlan(e.clientX, e.clientY), f = this.floor;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    if (!d.moved) { d.moved = true; if (!["pan", "draw", "addop"].includes(d.kind)) { this.snapshot(); this._dragging = true; } }
    const dx = P[0] - d.P[0], dy = P[1] - d.P[1];
    this.guide = "";
    if (d.kind === "pan") { this._userView = true; this.px = d.px0 + e.clientX - d.x; this.py = d.py0 + e.clientY - d.y; this.draw(); return; }
    if (d.kind === "draw") { this.drawRect[1] = this.snapPt(P); this.draw(); return; }
    if (d.kind === "room") {
      let ox = snap(dx), oy = snap(dy);
      const tg = snapTargets(f, d.room.id), b = bounds(d.pts0);
      const sx = [b.x0 + ox, b.x1 + ox].map((v) => [v, snapTo(v, tg.xs, 0.2)]).find(([v, s]) => Math.abs(s - v) < 0.2 && tg.xs.includes(s)); if (sx) ox += sx[1] - sx[0];
      const sy = [b.y0 + oy, b.y1 + oy].map((v) => [v, snapTo(v, tg.ys, 0.2)]).find(([v, s]) => Math.abs(s - v) < 0.2 && tg.ys.includes(s)); if (sy) oy += sy[1] - sy[0];
      d.room.pts = d.pts0.map(([x, y]) => [round(x + ox, 3), round(y + oy, 3)]);
      for (const [o, x, y] of [...d.items, ...d.devs, ...d.ops]) { o.x = round(x + ox, 3); o.y = round(y + oy, 3); }
      return this.changed();
    }
    if (d.kind === "vertex") {
      const tg = snapTargets(f, null), x = snapTo(P[0], tg.xs.filter((v) => !d.links.some(([r, i]) => r.pts[i][0] === v)), 0.15), y = snapTo(P[1], tg.ys.filter((v) => !d.links.some(([r, i]) => r.pts[i][1] === v)), 0.15);
      for (const [r, i] of d.links) r.pts[i] = [round(x, 3), round(y, 3)];
      return this.changed();
    }
    if (d.kind === "edge") {
      const ex = d.b0[0] - d.a0[0], ey = d.b0[1] - d.a0[1], len = Math.hypot(ex, ey), nx = -ey / len, ny = ex / len;
      let off = dx * nx + dy * ny;
      const tg = snapTargets(f, null);
      if (Math.abs(nx) > 0.99) { const v = snapTo(d.a0[0] + off * nx, tg.xs.filter((v) => Math.abs(v - d.a0[0]) > 1e-3), 0.15); off = (v - d.a0[0]) / nx; }
      else if (Math.abs(ny) > 0.99) { const v = snapTo(d.a0[1] + off * ny, tg.ys.filter((v) => Math.abs(v - d.a0[1]) > 1e-3), 0.15); off = (v - d.a0[1]) / ny; }
      else off = snap(off);
      const na = [round(d.a0[0] + nx * off, 3), round(d.a0[1] + ny * off, 3)], nb = [round(d.b0[0] + nx * off, 3), round(d.b0[1] + ny * off, 3)];
      for (const [r, i] of d.la) r.pts[i] = [...na];
      for (const [r, i] of d.lb) r.pts[i] = [...nb];
      for (const [o, x, y] of d.ops) { o.x = round(x + nx * off, 3); o.y = round(y + ny * off, 3); }
      return this.changed();
    }
    if (d.kind === "op") {
      const nw = nearestWall(f, P, 1.5); if (!nw) return;
      const half = d.obj.width / 2, t = Math.max(half, Math.min(nw.len - half, nw.t * nw.len)), ux = Math.cos(nw.angle), uy = Math.sin(nw.angle);
      d.obj.x = round(nw.w.a[0] + ux * snap(t), 3); d.obj.y = round(nw.w.a[1] + uy * snap(t), 3);
      return this.changed();
    }
    if (d.kind === "item") {
      const it = d.obj, dm = dims(it); let x = snap(P[0] + d.off[0]), y = snap(P[1] + d.off[1]);
      if (dm.mount !== "ceiling" && it.kind !== "rug") {
        // pieces near a wall turn to face the room and sit flat against it
        const back = [x - Math.sin((it.rot * Math.PI) / 180) * dm.d / 2, y - Math.cos((it.rot * Math.PI) / 180) * dm.d / 2];
        const nw = nearestWall(f, [x, y], Math.max(dm.d, dm.w) / 2 + 0.25);
        if (nw && nw.d > 1e-3 && !nw.w.parapet) {
          const nx = (x - nw.q[0]) / nw.d, ny = (y - nw.q[1]) / nw.d, wallRot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI);
          const gap = dm.d / 2 + nw.w.thick / 2 + (dm.mount === "wall" ? 0 : 0.01);
          if (nw.d < gap + 0.3) { it.rot = wallRot; x = round(nw.q[0] + nx * gap, 3); y = round(nw.q[1] + ny * gap, 3); this.guide = `M${nw.w.a[0]} ${nw.w.a[1]}L${nw.w.b[0]} ${nw.w.b[1]}`; }
        }
        void back;
      }
      it.x = x; it.y = y;
      // solid furniture: slide out of anything it would sink into, or stay where it last fitted
      if (settle(it, f.items)) d.ok = [it.x, it.y, it.rot]; else if (d.ok) [it.x, it.y, it.rot] = d.ok;
      return this.changed(true, true);
    }
    if (d.kind === "rot") { const it = d.obj; let a = (Math.atan2(-(P[0] - it.x), -(P[1] - it.y)) * 180) / Math.PI; it.rot = (Math.round(a / 15) * 15 + 360) % 360; if (settle(it, f.items)) d.ok = [it.x, it.y, it.rot]; else if (d.ok) [it.x, it.y, it.rot] = d.ok; return this.changed(true, true); }
    if (d.kind === "dev") { d.obj.x = round(snap(P[0] + d.off[0]), 3); d.obj.y = round(snap(P[1] + d.off[1]), 3); return this.changed(); }
  }
  up(e) {
    const d = this.drag; this.drag = null; this._dragging = false; this.guide = "";
    if (!d) return;
    if (d.kind === "draw") {
      const [a, b] = this.drawRect; this.drawRect = null;
      const w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
      if (w >= 0.6 && h >= 0.6) { this.snapshot(); const r = { id: uid("r"), type: "other", name: "", pts: rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), w, h) }; this.floor.rooms.push(r); this.tool = "select"; this.drawNav(); this.sel = { t: "room", id: r.id }; this.changed(); this.inspector(); }
      else this.draw();
      return;
    }
    if (d.kind === "addop") { this.addOpening(this.tool, d.P); return; }
    if (!d.moved) {
      if (d.tapRoom) return this.select({ t: "room", id: d.tapRoom.id });
      if (d.tapEmpty) return this.select(null);
      return;
    }
    if (d.kind !== "pan") { this.changed(); this.inspector(); }
  }
  linked(p) { const out = []; for (const r of this.floor.rooms) r.pts.forEach((q, i) => { if (Math.abs(q[0] - p[0]) < 1e-3 && Math.abs(q[1] - p[1]) < 1e-3) out.push([r, i]); }); return out; }
  onEdge(o, p, q) { const len = Math.hypot(q[0] - p[0], q[1] - p[1]), t = ((o[0] - p[0]) * (q[0] - p[0]) + (o[1] - p[1]) * (q[1] - p[1])) / (len * len), d = Math.abs((q[0] - p[0]) * (o[1] - p[1]) - (q[1] - p[1]) * (o[0] - p[0])) / len; return t > 0 && t < 1 && d < 0.12; }
  snapPt(P) { const tg = snapTargets(this.floor, null); return [snapTo(P[0], tg.xs, 0.2), snapTo(P[1], tg.ys, 0.2)]; }
  addOpening(type, P) {
    const nw = nearestWall(this.floor, P, 0.8); if (!nw) return;
    const width = { door: 0.9, window: 1.4, slider: 2.4, arch: 1.2 }[type], half = width / 2;
    if (nw.len < width + 0.1) return;
    const tt = Math.max(half + 0.05, Math.min(nw.len - half - 0.05, nw.t * nw.len)), ux = Math.cos(nw.angle), uy = Math.sin(nw.angle);
    const op = { id: uid("o"), type, x: round(nw.w.a[0] + ux * snap(tt), 3), y: round(nw.w.a[1] + uy * snap(tt), 3), width, height: type === "window" ? 1.5 : type === "door" ? 2.1 : 2.2, sill: type === "window" ? 0.9 : 0, swing: 1 };
    this.snapshot(); this.floor.openings.push(op); this.sel = { t: "op", id: op.id }; this.changed(); this.inspector();
  }
  addThing(kind, P, isDevice) {
    this.snapshot();
    if (isDevice) {
      const d = { id: uid("d"), kind, entity: "", x: round(snap(P[0]), 3), y: round(snap(P[1]), 3), name: t(KINDS[kind].name) };
      if (kind === "light") d.look = "flush";
      if (kind === "ac") { const nw = nearestWall(this.floor, P, 3); if (nw) { const nx = (P[0] - nw.q[0]) / (nw.d || 1), ny = (P[1] - nw.q[1]) / (nw.d || 1); d.rot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI); d.x = round(nw.q[0] + nx * (nw.w.thick / 2 + 0.13), 3); d.y = round(nw.q[1] + ny * (nw.w.thick / 2 + 0.13), 3); } }
      if (kind === "curtain" || kind === "door") { const o = this.floor.openings.filter((o) => (kind === "door" ? o.type === "door" : o.type === "window" || o.type === "slider")).sort((a, b) => Math.hypot(a.x - P[0], a.y - P[1]) - Math.hypot(b.x - P[0], b.y - P[1]))[0]; if (o) { d.x = o.x; d.y = o.y; } }
      this.floor.devices.push(d); this.sel = { t: "dev", id: d.id };
    } else {
      const L = LIBRARY[kind], it = { id: uid("i"), kind, x: round(snap(P[0]), 3), y: round(snap(P[1]), 3), rot: 0 };
      if (L[6] === "ceiling") it.mount = "ceiling";
      this.floor.items.push(it); settle(it, this.floor.items); this.sel = { t: "item", id: it.id };
    }
    this.tool = "select"; this.drawNav(); this.changed(true, false, !isDevice); this.inspector();
  }

  // ------------------------------------------------------------ the right side
  inspector(mode) {
    const a = this.aside, s = this.sel, obj = this.find(s);
    // on narrow screens the panel is a sheet that opens only for a selection, a tool or the settings
    this.ed.classList.toggle("sheet", !!obj || this.tool !== "select" || mode === "settings");
    requestAnimationFrame(() => this.view?.engine.resize());
    if (this.tool === "furniture") return this.library();
    if (this.tool === "devices") return this.deviceLibrary();
    if (this.tool === "import") return this.importPanel();
    if (this.tool === "check") return this.checkPanel();
    if (this.tool === "room") { a.innerHTML = `<h2><ha-icon icon="mdi:vector-square-plus"></ha-icon>${t("Rooms")}</h2><p class="tip">${t("Tap and drag on the plan to draw a room.")}</p>`; return; }
    if (["door", "window", "slider", "arch"].includes(this.tool)) { a.innerHTML = `<h2>${t(TOOLS.find((x) => x[0] === this.tool)[2])}</h2><p class="tip">${t("Tap a wall to add it.")}</p>`; return; }
    if (!obj) return this.homePanel(mode === "settings");
    const head = (icon, title) => `<div class="row between"><h2><ha-icon icon="${icon}"></ha-icon>${esc(title)}</h2><button data-close title="${t("Close")}"><ha-icon icon="mdi:close"></ha-icon></button></div>`;
    const slider = (key, label, min, max, step, val, unit = " m") => `<label class="sl"><span>${t(label)}</span><b data-out="${key}">${round(val, 2)}${unit}</b><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
    let h = "";
    if (s.t === "room") {
      const b = bounds(obj.pts), isRect = obj.pts.length === 4, type = ROOM_TYPES[obj.type] || ROOM_TYPES.other;
      h += head(type.icon, obj.name || t(type.name));
      h += `<div class="field"><h3>${t("Name")}</h3><input type="text" data-k="name" value="${esc(obj.name)}" placeholder="${esc(t(type.name))}"></div>`;
      h += `<div class="field"><h3>${t("Type")}</h3><div class="chips">${Object.entries(ROOM_TYPES).map(([k, v]) => `<button data-type="${k}" class="${obj.type === k ? "on" : ""}"><ha-icon icon="${v.icon}"></ha-icon>${t(v.name)}</button>`).join("")}</div></div>`;
      if (isRect) h += slider("rw", "Width", 1, 20, 0.05, b.x1 - b.x0) + slider("rd", "Depth", 1, 20, 0.05, b.y1 - b.y0);
      h += `<div class="field"><h3>${t("Floor")}</h3><div class="sw">${Object.entries(FLOORS).map(([k, v]) => `<button data-floor="${k}" title="${esc(v[0])}" class="${(obj.floor || type.floor) === k ? "on" : ""}" style="background-image:url(${floorThumb(k)})"></button>`).join("")}</div></div>`;
      if (!type.outdoor) h += `<div class="field"><h3>${t("Walls")}</h3><div class="sw">${Object.entries(WALLS).map(([k, v]) => `<button data-wall="${k}" title="${esc(v[0])}" class="${(obj.wall || "warm-white") === k ? "on" : ""}" style="background:${v[1]}"></button>`).join("")}</div></div>`;
      h += slider("gain", "Room brightness", 0.4, 2, 0.05, obj.gain || 1, "×");
      h += `<div class="row"><label><button data-match><ha-icon icon="mdi:camera-image"></ha-icon>${t("Match a photo of this room")}</button><input type="file" data-photo accept="image/*" hidden></label></div><span class="tip" data-match-out></span>`;
      h += `<div class="row"><button data-dup><ha-icon icon="mdi:content-copy"></ha-icon>${t("Duplicate")}</button><button class="danger" data-del><ha-icon icon="mdi:delete-outline"></ha-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "op") {
      h += head(obj.type === "window" ? "mdi:window-closed-variant" : obj.type === "slider" ? "mdi:door-sliding" : obj.type === "arch" ? "mdi:gate-arrow-right" : "mdi:door", t(obj.type[0].toUpperCase() + obj.type.slice(1)));
      h += `<div class="seg">${["door", "window", "slider", "arch"].map((k) => `<button data-otype="${k}" class="${obj.type === k ? "on" : ""}">${t(k[0].toUpperCase() + k.slice(1))}</button>`).join("")}</div>`;
      h += slider("width", "Width", 0.4, 5, 0.05, obj.width) + slider("height", "Height", 0.4, 2.8, 0.05, obj.height);
      if (obj.type === "window") h += slider("sill", "Sill", 0, 1.8, 0.05, obj.sill);
      if (obj.type === "door") h += `<div class="row"><button data-flip><ha-icon icon="mdi:swap-vertical"></ha-icon>${t("Flip")}</button><button data-tog="double" class="${obj.double ? "on" : ""}"><ha-icon icon="mdi:door-open"></ha-icon>Double</button><button data-tog="main" class="${obj.main ? "on" : ""}"><ha-icon icon="mdi:home-import-outline"></ha-icon>Main</button></div>`;
      h += `<div class="row"><button class="danger" data-del><ha-icon icon="mdi:delete-outline"></ha-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "item") {
      const L = LIBRARY[obj.kind], d = dims(obj);
      h += head("mdi:sofa-outline", t(L?.[0] || obj.kind));
      h += `<div class="pv" title="${esc(t("Drag to turn"))}"></div>`;
      h += slider("w", "Width", 0.2, 6, 0.05, d.w) + slider("d", "Depth", 0.05, 4, 0.05, d.d) + slider("h", "Height", 0.05, 3, 0.05, d.h);
      if (d.mount === "wall") h += slider("z", "Sill", 0, 2.4, 0.05, d.z);
      h += `<div class="field"><h3>${t("Rotate")}</h3><div class="row"><button data-rotby="-90"><ha-icon icon="mdi:rotate-left"></ha-icon></button><button data-rotby="-15">−15°</button><b>${obj.rot || 0}°</b><button data-rotby="15">+15°</button><button data-rotby="90"><ha-icon icon="mdi:rotate-right"></ha-icon></button></div></div>`;
      h += `<div class="field"><h3>${t("Colour")}</h3><div class="sw">${Object.entries(FABRICS).map(([k, c]) => `<button data-color="${c}" title="${k}" class="${obj.color === c ? "on" : ""}" style="background:${c}"></button>`).join("")}</div></div>`;
      h += `<div class="row"><button data-dup><ha-icon icon="mdi:content-copy"></ha-icon>${t("Duplicate")}</button><button class="danger" data-del><ha-icon icon="mdi:delete-outline"></ha-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "dev") {
      const kind = obj.kind || deviceKind(obj.entity), K = KINDS[kind];
      h += head(K.icon, obj.name || t(K.name));
      h += `<div class="field"><h3>${t("Name")}</h3><input type="text" data-k="name" value="${esc(obj.name)}"></div>`;
      h += `<div class="field"><h3>${t("Entity")}</h3><select data-k="entity"><option value="">${t("Not linked")}</option>${Object.keys(this._hass.states).filter((e) => K.domains.includes(e.split(".")[0])).sort().map((e) => `<option value="${e}" ${obj.entity === e ? "selected" : ""}>${esc(this._hass.states[e].attributes.friendly_name || e)}</option>`).join("")}</select></div>`;
      if (kind === "light") h += `<div class="field"><h3>${t("Look")}</h3><div class="chips">${Object.entries(LIGHT_LOOKS).map(([k, v]) => `<button data-look="${k}" class="${(obj.look || "flush") === k ? "on" : ""}">${t(v)}</button>`).join("")}</div></div>` 
        + slider("lumens", "Light output", 100, 5000, 50, obj.lumens || LUMENS[obj.look || "flush"], " lm")
        + `<label class="sl"><span>${t("Warmth")}</span><b data-out="kelvin">${obj.kelvin || KELVIN[obj.look || "flush"]} K</b><input type="range" data-k="kelvin" min="2200" max="6500" step="100" value="${obj.kelvin || KELVIN[obj.look || "flush"]}" style="accent-color:${kelvinToHex(obj.kelvin || KELVIN[obj.look || "flush"])}"></label>`
        + (obj.entity ? "" : `<div class="field"><h3>${t("Not smart: when is it on?")}</h3><div class="chips">${Object.entries(RULES).filter(([k]) => k !== "demo").map(([k, v]) => `<button data-rule="${k}" class="${(obj.rule || "on") === k ? "on" : ""}">${t(v)}</button>`).join("")}</div>${obj.rule === "schedule" ? `<div class="row"><input type="text" data-k="from" value="${esc(obj.from || "18:00")}" style="width:90px"> – <input type="text" data-k="to" value="${esc(obj.to || "23:00")}" style="width:90px"></div>` : ""}</div>`);
      if (kind === "ac") h += `<div class="field"><h3>${t("Rotate")}</h3><div class="row"><button data-rotby="-90"><ha-icon icon="mdi:rotate-left"></ha-icon></button><b>${obj.rot || 0}°</b><button data-rotby="90"><ha-icon icon="mdi:rotate-right"></ha-icon></button></div></div>`;
      if (kind === "person") h += `<div class="field"><h3>${t("Colour")}</h3><div class="sw">${["#6D4BFF", "#4E8CFF", "#E86FB0", "#FF7A59", "#2EC4B6", "#F5B041"].map((c) => `<button data-color="${c}" class="${obj.color === c ? "on" : ""}" style="background:${c}"></button>`).join("")}</div></div>`;
      h += `<div class="row"><button class="danger" data-del><ha-icon icon="mdi:delete-outline"></ha-icon>${t("Delete")}</button></div>`;
    }
    a.innerHTML = h;
    const pv = a.querySelector(".pv"); if (pv) (this.preview ||= new ItemPreview()).mount(pv, obj);
    this.bindInspector(obj, s);
  }
  bindInspector(obj, s) {
    const a = this.aside;
    const set = (fn, rebuild = true) => { if (!this._editing) { this.snapshot(); this._editing = true; } clearTimeout(this._edT); this._edT = setTimeout(() => (this._editing = false), 700); fn(); this.changed(rebuild, false, s.t === "item"); };
    a.querySelector("[data-close]")?.addEventListener("click", () => this.select(null));
    a.querySelector("[data-del]")?.addEventListener("click", () => this.remove(s));
    a.querySelectorAll("input[type=text][data-k]").forEach((i) => i.addEventListener("input", () => set(() => (obj[i.dataset.k] = i.value), false)));
    a.querySelectorAll("select[data-k]").forEach((i) => i.addEventListener("change", () => set(() => { obj[i.dataset.k] = i.value; if (i.value && !obj.name) obj.name = this._hass.states[i.value]?.attributes.friendly_name || ""; })));
    a.querySelectorAll("input[type=range]").forEach((i) => i.addEventListener("input", () => {
      const k = i.dataset.k, v = parseFloat(i.value), out = a.querySelector(`[data-out="${k}"]`); if (out) out.textContent = `${round(v, 2)}${{ power: "×", lumens: " lm", kelvin: " K", gain: "×" }[k] ?? " m"}`;
      set(() => {
        if (k === "rw" || k === "rd") { const b = bounds(obj.pts); for (const p of obj.pts) { if (k === "rw" && Math.abs(p[0] - b.x1) < 1e-3) { for (const [r, j] of this.linked(p)) if (r !== obj) r.pts[j][0] = round(b.x0 + v, 3); p[0] = round(b.x0 + v, 3); } if (k === "rd" && Math.abs(p[1] - b.y1) < 1e-3) { for (const [r, j] of this.linked(p)) if (r !== obj) r.pts[j][1] = round(b.y0 + v, 3); p[1] = round(b.y0 + v, 3); } } }
        else obj[k] = v;
      }, !LIVE_KEYS.has(k));
      // light output, warmth and room brightness change instantly: no rebuild, no new light bake
      if (LIVE_KEYS.has(k)) { if (k === "kelvin") i.style.accentColor = kelvinToHex(v); this.view.engine.updateDevices(true); this.view.engine.request(false); }
    }));
    a.querySelectorAll("[data-type]").forEach((b) => (b.onclick = () => { set(() => { obj.type = b.dataset.type; }); this.inspector(); }));
    a.querySelectorAll("[data-floor]").forEach((b) => (b.onclick = () => { set(() => (obj.floor = b.dataset.floor)); this.inspector(); }));
    a.querySelectorAll("[data-wall]").forEach((b) => (b.onclick = () => { set(() => (obj.wall = b.dataset.wall)); this.inspector(); }));
    a.querySelectorAll("[data-otype]").forEach((b) => (b.onclick = () => { set(() => { obj.type = b.dataset.otype; if (obj.type === "window") { obj.sill = obj.sill || 0.9; obj.height = Math.min(obj.height, 1.6); } else obj.sill = 0; }); this.inspector(); }));
    a.querySelector("[data-match]")?.addEventListener("click", () => a.querySelector("[data-photo]").click());
    a.querySelector("[data-photo]")?.addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const out = a.querySelector("[data-match-out]"); out.textContent = "…";
      const res = await matchPhoto(f, obj, this.floor);
      if (!res) { out.textContent = t("Could not read this photo"); return; }
      this.snapshot(); res.apply(); this.changed(false); this.view.engine.updateDevices(true); this.inspector();
      this.aside.querySelector("[data-match-out]").textContent = res.text;
    });
    a.querySelector("[data-flip]")?.addEventListener("click", () => set(() => (obj.swing = (obj.swing || 1) * -1)));
    a.querySelectorAll("[data-tog]").forEach((b) => (b.onclick = () => { set(() => (obj[b.dataset.tog] = !obj[b.dataset.tog])); this.inspector(); }));
    a.querySelectorAll("[data-rotby]").forEach((b) => (b.onclick = () => { set(() => (obj.rot = (((obj.rot || 0) + +b.dataset.rotby) % 360 + 360) % 360)); this.inspector(); }));
    a.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { set(() => (obj.color = b.dataset.color)); this.inspector(); }));
    a.querySelectorAll("[data-rule]").forEach((b) => (b.onclick = () => { set(() => (obj.rule = b.dataset.rule), false); this.view.engine.updateDevices(true); this.inspector(); }));
    a.querySelectorAll("[data-look]").forEach((b) => (b.onclick = () => { set(() => (obj.look = b.dataset.look)); this.inspector(); }));
    a.querySelector("[data-dup]")?.addEventListener("click", () => {
      this.snapshot(); const c = clone(obj); c.id = uid(s.t === "room" ? "r" : "i");
      if (s.t === "room") { const b = bounds(c.pts); c.pts = c.pts.map(([x, y]) => [x + (b.x1 - b.x0), y]); this.floor.rooms.push(c); } else { c.x += 0.3; c.y += 0.3; this.floor.items.push(c); }
      this.sel = { t: s.t, id: c.id }; this.changed(true, false, s.t === "item"); this.inspector();
    });
  }
  libSvg(kind) { const L = LIBRARY[kind], k = 50 / Math.max(L[3], L[4] * 1.4), w = L[3] * k, d = L[4] * k; return `<svg viewBox="-30 -22 60 44"><rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`; }
  library() {
    const a = this.aside, items = Object.entries(LIBRARY).filter(([, L]) => L[1] === this.cat);
    a.innerHTML = `<h2><ha-icon icon="mdi:sofa-outline"></ha-icon>${t("Furniture")}</h2><div class="tabs">${CATEGORIES.map((c) => `<button data-cat="${c}" class="${this.cat === c ? "on" : ""}">${t(c)}</button>`).join("")}</div>
      <p class="tip">${t("Drag a piece onto the plan.")}</p><div class="lib">${items.map(([k, L]) => `<div class="tile" data-kind="${k}">${this.libSvg(k)}<span>${t(L[0])}</span><small class="tip">${L[3]} × ${L[4]} m</small></div>`).join("")}</div>`;
    a.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { this.cat = b.dataset.cat; this.library(); }));
    a.querySelectorAll(".tile").forEach((el) => this.dragNew(el, el.dataset.kind, false, LIBRARY[el.dataset.kind][0]));
  }
  deviceLibrary() {
    const a = this.aside;
    a.innerHTML = `<h2><ha-icon icon="mdi:lightbulb-group-outline"></ha-icon>${t("Devices")}</h2><p class="tip">${t("Drag a piece onto the plan.")}</p><div class="lib">${Object.entries(KINDS).filter(([k]) => k !== "lock").map(([k, K]) => `<div class="tile" data-kind="${k}"><ha-icon icon="${K.icon}" style="--mdc-icon-size:28px;color:${DEV_COL[k]}"></ha-icon><span>${t(K.name)}</span></div>`).join("")}</div>`;
    a.querySelectorAll(".tile").forEach((el) => this.dragNew(el, el.dataset.kind, true, KINDS[el.dataset.kind].name));
  }
  dragNew(el, kind, isDevice, label) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const ghost = document.createElement("div"); ghost.className = "ghost"; ghost.textContent = t(label); ghost.style.display = "none"; this.root.querySelector(".ed").appendChild(ghost);
      const sx = e.clientX, sy = e.clientY; let moved = false;
      const mv = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true; ghost.style.display = moved ? "" : "none"; ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`; };
      const done = (ev) => {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", done); window.removeEventListener("pointercancel", done); ghost.remove();
        const r = this.planEl.getBoundingClientRect();
        if (moved && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom && this.layout !== "three") this.addThing(kind, this.toPlan(ev.clientX, ev.clientY), isDevice);
        else if (!moved) { const room = this.floor.rooms.find((x) => x.id === this.sel?.id) || this.floor.rooms.find((x) => !ROOM_TYPES[x.type]?.outdoor); this.addThing(kind, room ? centroid(room.pts) : this.toPlan(r.left + r.width / 2, r.top + r.height / 2), isDevice); }
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", done); window.addEventListener("pointercancel", done);
    });
  }
  homePanel(settings) {
    const a = this.aside, p = this.plan, f = this.floor, st = p.settings;
    const total = f.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor).reduce((s, r) => s + Math.abs(area(r.pts)), 0);
    a.innerHTML = `<h2><ha-icon icon="mdi:home-outline"></ha-icon>${esc(p.name)}</h2>
      <div class="card"><div class="row between"><span class="tip">${t("Rooms")}</span><b>${f.rooms.length}</b></div><div class="row between"><span class="tip">m²</span><b>${round(total, 1)}</b></div><div class="row between"><span class="tip">${t("Furniture")}</span><b>${f.items.length}</b></div><div class="row between"><span class="tip">${t("Devices")}</span><b>${f.devices.length}</b></div></div>
      <div class="field"><h3>${t("Name")}</h3><input type="text" data-name value="${esc(p.name)}"></div>
      <div class="field"><h3>${t("Walls")}</h3><div class="seg"><button data-walls="cut" class="${st.walls !== "full" ? "on" : ""}">${t("Cut walls")}</button><button data-walls="full" class="${st.walls === "full" ? "on" : ""}">${t("Full walls")}</button></div></div>
      <label class="sl"><span>${t("Height")}</span><b data-out="fh">${f.height} m</b><input type="range" data-fh min="2.4" max="4.5" step="0.05" value="${f.height}"></label>
      <label class="sl"><span>${t("North")}</span><b data-out="north">${p.north || 0}°</b><input type="range" data-north min="0" max="359" step="1" value="${p.north || 0}"></label>
      <label class="sl"><span>${t("Overall brightness")}</span><b data-out="ex">${round(st.exposure || 1, 2)}×</b><input type="range" data-ex min="0.5" max="2" step="0.05" value="${st.exposure || 1}"></label>
      <div class="row between"><span>${t("Real sun")}</span><button data-sun class="${st.sun !== false ? "on" : ""}"><ha-icon icon="mdi:white-balance-sunny"></ha-icon></button></div>
      <div class="field"><h3>${t("Quality")}</h3><div class="seg">${["auto", "low", "medium", "high"].map((q) => `<button data-q="${q}" class="${(st.quality || "auto") === q ? "on" : ""}">${t(q[0].toUpperCase() + q.slice(1))}</button>`).join("")}</div></div>
      <div class="field"><h3>${t("Level")}</h3><input type="text" data-fname value="${esc(f.name)}">${p.floors.length > 1 ? `<div class="row"><button class="danger" data-delfloor><ha-icon icon="mdi:delete-outline"></ha-icon>${t("Delete")}</button></div>` : ""}</div>
      <div class="field"><h3>${t("Room photos")}</h3><div class="shots" data-shots><span class="tip">${t("Made by themselves when the computer is free")}</span></div></div>
      <p class="tip">${t("Drag to move. Pull a corner or a wall to resize.")}</p>`;
    this.drawShots(a.querySelector("[data-shots]"));
    const set = (fn, rebuild = true) => { this.snapshot(); fn(); this.changed(rebuild); };
    a.querySelector("[data-fname]").addEventListener("change", (e) => set(() => { f.name = e.target.value || f.name; this.drawFloors(); }, false));
    a.querySelector("[data-delfloor]")?.addEventListener("click", () => this.removeFloor());
    a.querySelector("[data-name]").addEventListener("change", (e) => set(() => { p.name = e.target.value || p.name; this.root.querySelector("h1").textContent = p.name; }, false));
    a.querySelectorAll("[data-walls]").forEach((b) => (b.onclick = () => { set(() => (st.walls = b.dataset.walls)); this.homePanel(); }));
    a.querySelector("[data-fh]").addEventListener("change", (e) => set(() => (f.height = +e.target.value)));
    a.querySelector("[data-fh]").addEventListener("input", (e) => (a.querySelector('[data-out="fh"]').textContent = `${e.target.value} m`));
    a.querySelector("[data-ex]").addEventListener("input", (e) => { a.querySelector('[data-out="ex"]').textContent = `${e.target.value}×`; st.exposure = +e.target.value; this.view.engine.request(false); });
    a.querySelector("[data-ex]").addEventListener("change", () => this.changed(false));
    a.querySelector("[data-north]").addEventListener("input", (e) => { a.querySelector('[data-out="north"]').textContent = `${e.target.value}°`; p.north = +e.target.value; this.view.engine.fitSun(); });
    a.querySelector("[data-north]").addEventListener("change", () => this.changed(false));
    a.querySelector("[data-sun]").onclick = () => { set(() => (st.sun = st.sun === false)); this.homePanel(); this.view.hass = this._hass; this.view._sun = undefined; this.view.hass = this._hass; };
    a.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { set(() => (st.quality = b.dataset.q), false); this.homePanel(); }));
  }
  async drawShots(el) {
    if (!this.plan?.id || !el) return;
    let list = [];
    try { list = await ws(this._hass, { type: "roost_atelier/photos", plan_id: this.plan.id }); } catch { return; }
    list = list.filter((p) => p.key.startsWith(`${this.plan.id}_${this.fi}_`));
    if (!list.length) return;
    this._shotUrls ||= new Map();
    el.innerHTML = "";
    for (const p of list) {
      const rid = p.key.split("_").slice(2).join("_"), room = this.floor.rooms.find((r) => r.id === rid);
      const k = `${p.key}@${p.updated}`;
      if (!this._shotUrls.has(k)) { const r = await this._hass.fetchWithAuth(`/api/roost_atelier/photo/${p.key}`); if (!r.ok) continue; this._shotUrls.set(k, URL.createObjectURL(await r.blob())); }
      const b = document.createElement("button"); b.className = "shot"; b.innerHTML = `<img src="${this._shotUrls.get(k)}" alt=""><span>${esc(room?.name || t(ROOM_TYPES[room?.type]?.name || "Room"))}</span>`;
      b.onclick = () => { const d = document.createElement("div"); d.className = "dialog"; d.innerHTML = `<img src="${this._shotUrls.get(k)}" style="max-width:94vw;max-height:88vh;border-radius:16px">`; d.onclick = () => d.remove(); this.root.querySelector(".ed").appendChild(d); };
      el.appendChild(b);
    }
  }
  checkPanel() {
    const a = this.aside, issues = check(this.plan, this.floor);
    a.innerHTML = `<h2><ha-icon icon="mdi:check-decagram-outline"></ha-icon>${t("Check the home")}</h2>${issues.length ? issues.map((i, n) => `<div class="issue" data-n="${n}"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div>${esc(i.text)}${i.fix ? `<div class="row" style="margin-top:6px"><button class="primary" data-fix="${n}">${esc(i.fixLabel || "Fix")}</button></div>` : ""}</div></div>`).join("") : `<div class="issue ok"><ha-icon icon="mdi:check-circle-outline"></ha-icon><div>${t("Looks good")}</div></div>`}`;
    a.querySelectorAll(".issue[data-n]").forEach((el) => (el.onclick = (e) => { if (e.target.closest("[data-fix]")) return; const i = issues[+el.dataset.n]; if (i.sel) { this.sel = i.sel; this.draw(); } }));
    a.querySelectorAll("[data-fix]").forEach((b) => (b.onclick = () => { this.snapshot(); issues[+b.dataset.fix].fix(); this.changed(); this.checkPanel(); }));
  }
  async importPanel() {
    const { importPanel } = await import("./importer.js");
    importPanel(this, this.aside);
  }

  // ------------------------------------------------------------ homes menu
  homesMenu(firstRun = false) {
    this.root.querySelector(".menu")?.remove();
    const m = document.createElement("div"); m.className = "menu";
    const plans = this.plans || [];
    m.innerHTML = `${plans.length ? `<h3>${t("Homes")}</h3><div class="list">${plans.map((p) => `<button data-open="${p.id}" class="${p.id === this.plan?.id ? "on" : ""}"><ha-icon icon="mdi:home-outline"></ha-icon><span>${esc(p.name)}<small>${p.rooms ?? ""} ${t("Rooms").toLowerCase()}</small></span></button>`).join("")}</div>` : ""}
      <h3>${t("New home")} · ${t("Start from")}</h3><div class="list"><button data-new="blank"><ha-icon icon="mdi:vector-square"></ha-icon><span>${t("Blank")}</span></button>${SAMPLES.map((s) => `<button data-new="${s.id}"><ha-icon icon="mdi:floor-plan"></ha-icon><span>${esc(s.name)}<small>${s.size}</small></span></button>`).join("")}<button data-new="import"><ha-icon icon="mdi:file-image-plus-outline"></ha-icon><span>${t("From CAD or PDF")}<small>DXF · PDF · JPG · PNG</small></span></button></div>
      ${this.plan?.id ? `<div class="row"><button class="danger" data-delhome><ha-icon icon="mdi:delete-outline"></ha-icon>${t("Delete")} “${esc(this.plan.name)}”</button></div>` : ""}`;
    this.root.querySelector(".ed").appendChild(m);
    const close = (e) => { if (!m.contains(e.target) && !e.composedPath().includes(this.root.querySelector(".homes"))) { m.remove(); this.root.removeEventListener("pointerdown", close, true); } };
    setTimeout(() => this.root.addEventListener("pointerdown", close, true));
    m.querySelectorAll("[data-open]").forEach((b) => (b.onclick = async () => { m.remove(); await this.open(b.dataset.open); }));
    m.querySelectorAll("[data-new]").forEach((b) => (b.onclick = () => {
      m.remove(); const k = b.dataset.new;
      if (k === "import") { const p = newPlan(t("New home")); this.load(p, true); this.setTool("import"); return; }
      const p = k === "blank" ? newPlan(t("New home")) : SAMPLES.find((s) => s.id === k).make();
      this.load(p, true);
      if (k === "blank") this.setTool("room");
    }));
    m.querySelector("[data-delhome]")?.addEventListener("click", () => this.confirm(`${t("Delete")} “${this.plan.name}”? This can't be undone.`, async () => {
      m.remove(); await ws(this._hass, { type: "roost_atelier/delete", plan_id: this.plan.id }); this.plans = await ws(this._hass, { type: "roost_atelier/plans" });
      if (this.plans[0]) await this.open(this.plans[0].id); else { this.load(newPlan(t("New home")), false); this.homesMenu(); }
    }));
    void firstRun;
  }
  confirm(text, yes) {
    const d = document.createElement("div"); d.className = "dialog";
    d.innerHTML = `<div><b>${esc(text)}</b><div class="row" style="justify-content:flex-end"><button data-no>${t("Cancel")}</button><button class="danger" data-yes>${t("Delete")}</button></div></div>`;
    this.root.querySelector(".ed").appendChild(d);
    d.querySelector("[data-no]").onclick = () => d.remove(); d.querySelector("[data-yes]").onclick = () => { d.remove(); yes(); };
  }
  key(e) {
    if (e.target.closest?.("input,select,textarea") || e.composedPath()[0]?.matches?.("input,select,textarea")) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && this.sel) this.remove(this.sel);
    else if (e.key === "Escape") this.select(null);
  }
}
