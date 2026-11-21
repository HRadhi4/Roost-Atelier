// The Atelier: draw your home on the left, see it in 3D on the right. Everything is drag and drop,
// sliders and switches; nothing needs typing except names.
import { t, isRtl, LANGS, savedLang, saveLang } from "./i18n.js";
import { ROOM_TYPES, uid, clone, snap, round, rect, area, centroid, bounds, inside, walls, openingsOn, nearestWall, snapTargets, snapTo, planBounds, validate, newPlan } from "./model.js";
import { SAMPLES } from "./samples.js";
import { LIBRARY, CATEGORIES, dims } from "./furniture.js";
import { FLOORS, WALLS, FABRICS, FEATURES, WOODS, METALS, swatchColor, swatchCanvas, featureSwatch, setOwnMaterials } from "./materials.js";
import { KINDS, LIGHT_LOOKS, LIGHT_SUBS, LIGHT_GROUPS, deviceKind, LUMENS, KELVIN, RULES, kelvinToHex, radarTargets } from "./devices.js";
import { WALL_LOOKS } from "./lights.js";
import { autoPlace } from "./autoplace.js";
import { matchPhoto } from "./calibrate.js";
import { RoomPhotographer } from "./photos.js";
import { settle } from "./collide.js";
import { AtelierView, VIEW_CSS } from "./view.js";
import { check } from "./check.js";
import { ItemPreview } from "./preview.js";
import { hasIcon } from "./icons.js";
import { drawLine, onWall, meet } from "./areas.js";
import { STAIR_STYLES, SPIRAL_TURN, stairFrom, riseTo, stairSvg, stairHole, stairsArriving, minRun } from "./stairs.js";

const LIVE_KEYS = new Set(["lumens", "kelvin", "gain", "power"]);
const ws = (hass, msg) => hass.connection.sendMessagePromise(msg);
const PENDING = "roost-atelier-pending-";
function writePending(id, v) { try { localStorage.setItem(PENDING + id, JSON.stringify(v)); } catch (e) { /* full: Home Assistant still has the last save */ } }
function readPending(id) { try { return JSON.parse(localStorage.getItem(PENDING + id) || "null"); } catch (e) { return null; } }
function clearPending(id) { try { localStorage.removeItem(PENDING + id); } catch (e) { /* fine */ } }
function when(ms) { if (!ms) return ""; const d = new Date(ms < 1e12 ? ms * 1000 : ms); return d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ICON_ROOM = Object.fromEntries(Object.entries(ROOM_TYPES).map(([k, v]) => [k, v.icon]));
const DEV_COL = { light: "#F5B041", ac: "#2EC4B6", curtain: "#4E8CFF", tv: "#8B6CFF", door: "#FF7A59", lock: "#FF7A59", fan: "#2EC4B6", person: "#E86FB0", speaker: "#8B6CFF", vacuum: "#5FBF77", sensor: "#7C86B8" };
// which fitting from the library a light on the plan is (for its icon)
function lightSub(d) {
  const look = d.look || "flush";
  for (const [k, [lk, opts]] of Object.entries(LIGHT_SUBS)) if (lk === look && Object.entries(opts).every(([a, v]) => d[a] === v)) return k;
  return { spots: "downlight", downlight: "downlight", linear: "linear", wall: "wall", table: "table", floor: "floor", pendant: "pendant", chandelier: "chandelier", panel: "panel", flush: "flush", track: "track", focus: "focus", step: "step", bollard: "bollard", uplight: "uplight", flood: "flood" }[look] || "flush";
}
const TOOLS = [
  ["select", "mdi:cursor-default-outline", "Select"], ["room", "mdi:vector-square-plus", "Rooms"], ["door", "mdi:door", "Door"], ["window", "mdi:window-closed-variant", "Window"],
  ["slider", "mdi:door-sliding", "Slider"], ["arch", "mdi:gate-arrow-right", "Arch"], ["stairs", "mdi:stairs-up", "Stairs"], ["furniture", "mdi:sofa-outline", "Furniture"], ["devices", "mdi:lightbulb-group-outline", "Devices"],
  ["measure", "mdi:tape-measure", "Measure"], ["note", "mdi:note-text-outline", "Note"],
  ["import", "mdi:file-image-plus-outline", "Import"], ["check", "mdi:check-decagram-outline", "Check the home"],
];
// pieces that stand with their back to a wall, which can be made to fit it exactly
const BACKED = new Set(["fitted_wardrobe", "tv_wall", "wardrobe", "kitchen_base", "kitchen_sink", "tall_cabinet", "tv_unit", "sideboard", "bookshelf", "console", "shoe_cabinet", "dresser", "desk", "cube_shelf", "display_cabinet", "vanity"]);
const thumbs = new Map();
function floorThumb(name) { if (String(name).startsWith("own:")) return ""; if (!thumbs.has(name)) { const c = swatchCanvas(name); const s = document.createElement("canvas"); s.width = s.height = 64; s.getContext("2d").drawImage(c, 0, 0, 64, 64); thumbs.set(name, s.toDataURL("image/jpeg", 0.8)); } return thumbs.get(name); }

const CSS = `
:host{display:block;height:100vh;height:100dvh;position:relative}
.ed{--bg:#0B0D17;--panel:rgba(20,24,49,.92);--border:#242A4D;--text:#EEF0FF;--muted:#9AA3D9;--inset:#1D2244;--track:#262C52;--grid:rgba(154,163,217,.08);--wall:#C9CEF0;--acc1:#6D4BFF;--acc2:#8B6CFF;
  position:absolute;inset:0;display:grid;grid-template-columns:64px 1fr 300px;grid-template-rows:56px 1fr;background:var(--bg);color:var(--text);font:500 13px/1.35 Inter,var(--paper-font-body1_-_font-family,system-ui,sans-serif);overflow:hidden;-webkit-tap-highlight-color:transparent;user-select:none}
.ed.light{--bg:#EEF1FA;--panel:rgba(255,255,255,.95);--border:#E2E5F2;--text:#161936;--muted:#5E668F;--inset:#EEF0FA;--track:#DDE1F0;--grid:rgba(94,102,143,.10);--wall:#2A2F45}
.ed[data-layout=plan] .three,.ed[data-layout=three] .plan{display:none}
.ed[data-layout=plan] main,.ed[data-layout=three] main{grid-template-columns:1fr}
header{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--border);background:var(--panel);z-index:3}
header .title{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
header .test{display:flex;align-items:center;gap:6px;padding:0 12px}header .test.on{background:var(--acc1);color:#FFFFFF}
.ed.testing nav{opacity:.35;pointer-events:none}.ed.testing .plan .hint{display:none}
header h1{all:unset;font:600 17px "Space Grotesk",Inter,-apple-system,'Segoe UI',Roboto,sans-serif;white-space:nowrap}
button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;height:auto;min-height:40px;min-width:40px;padding:6px 12px;text-align:center;line-height:1.25;overflow-wrap:anywhere;color:var(--text);transition:background .12s,transform .12s}
button:active{transform:scale(.96)}
button:hover{background:var(--inset)}
button.on,button.primary{color:#fff;background:linear-gradient(135deg,var(--acc1),var(--acc2));box-shadow:0 0 14px rgba(109,75,255,.35)}
button[disabled]{opacity:.35;pointer-events:none}
button.danger{color:#FF7A7A}
ra-icon{--mdc-icon-size:20px;display:inline-flex}
.seg{display:flex;gap:2px;padding:3px;border-radius:14px;background:var(--inset)}
.seg button{min-height:34px;border-radius:11px}
.seg.wrap{flex-wrap:wrap}.seg.wrap button{flex:1 1 auto;white-space:nowrap;padding:6px 12px}
/* rule: text is always inside a visible button: plain buttons in the side panel get their own background */
aside button:not(.on):not(.primary):not(.danger):not(.x):not([data-close]):not(.tile){background:var(--inset)}
aside button.danger{background:color-mix(in srgb,#FF7A7A 14%,var(--inset))}
.status{color:var(--muted);font-size:12px;min-width:64px;text-align:center}
nav{grid-row:2;display:flex;flex-direction:column;gap:6px;padding:10px 8px;border-inline-end:1px solid var(--border);background:var(--panel);overflow:auto;z-index:2}
nav button{width:48px;height:48px;border-radius:14px}
nav .sep{height:1px;background:var(--border);margin:4px 6px}
main{grid-row:2;display:grid;grid-template-columns:1.2fr 1fr;min-width:0;min-height:0}
.plan{position:relative;overflow:hidden;touch-action:none;background:var(--bg)}
.plan>svg{position:absolute;inset:0;width:100%;height:100%}
.plan .devs{position:absolute;inset:0;pointer-events:none}
.plan .dv{position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--c);box-shadow:0 0 12px color-mix(in srgb,var(--c) 60%,transparent);pointer-events:auto;cursor:grab;border:2px solid transparent}
.plan .dv.sel{border-color:#fff;box-shadow:0 0 0 3px var(--acc1)}
.plan .dv ra-icon{--mdc-icon-size:16px}
.plan .dv.off{background:#3A3F63;box-shadow:none;color:#9AA3D9}
.plan .hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:var(--panel);border:1px solid var(--border);color:var(--muted);font-size:12px;pointer-events:none;white-space:nowrap}
.plan .ceil{position:absolute;bottom:12px;inset-inline-end:12px;display:flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:14px;background:var(--panel);border:1px solid var(--border);color:var(--text);font:600 12px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;z-index:2}
.plan .ceil.on{background:linear-gradient(135deg,var(--acc1),var(--acc2));color:#fff;border-color:transparent}
.ceilmode .plan .dv:not(.lamp){opacity:.18;pointer-events:none}
.plan .dv.lamp{width:20px;height:20px}.plan .dv.lamp ra-icon{--mdc-icon-size:12px}
.plan .zoom button.on{background:var(--acc1);color:#FFFFFF}
.plan .zoom{position:absolute;bottom:12px;inset-inline-start:12px;display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:14px;background:var(--panel);border:1px solid var(--border)}
.three{position:relative;border-inline-start:1px solid var(--border);min-width:0}
aside{grid-row:2;border-inline-start:1px solid var(--border);background:var(--panel);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px;z-index:2}
aside>*{flex:none}
aside h2{all:unset;font:600 15px "Space Grotesk",Inter,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;gap:8px}
aside h3{all:unset;font:600 11px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.row.between{justify-content:space-between}
.field{display:flex;flex-direction:column;gap:6px}
input[type=text],input[type=number],input[type=search],input:not([type]),textarea,select{all:unset;box-sizing:border-box;height:40px;padding:0 12px;border-radius:12px;background:var(--inset);color:var(--text);border:1px solid var(--border);width:100%;font:inherit;font-weight:600}
input[type=number]{-moz-appearance:textfield;text-align:center}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input:focus-visible,textarea:focus-visible,select:focus-visible{border-color:var(--acc2);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc1) 30%,transparent)}
textarea{height:auto;min-height:80px;padding:10px 12px}
input[type=range]{width:100%;accent-color:var(--acc1);height:28px}
.sl{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center}
.sl input[type=range]{grid-column:1/-1}
.nv{display:flex;align-items:center;gap:4px}.nv i{font-style:normal;font-weight:500;color:var(--muted,#9AA3D9)}
.nv input{width:64px;height:28px;padding:0 6px;border-radius:8px;border:1px solid var(--border);background:var(--inset);color:inherit;font:inherit;font-weight:700;text-align:end;-moz-appearance:textfield}
.nv input::-webkit-inner-spin-button,.nv input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.sl b{font:600 13px "Space Grotesk",Inter,-apple-system,'Segoe UI',Roboto,sans-serif;min-width:52px;text-align:end}
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
/* icons instead of names: the name shows on hover (and on a long press on a phone) */
.lib.icons{grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:6px}
.lib.icons .tile{position:relative;aspect-ratio:1;justify-content:center;padding:8px;--mdc-icon-size:30px;color:var(--text)}
.lib.icons .tile.on{background:linear-gradient(135deg,var(--acc1),var(--acc2));color:#fff}
.lib.icons .tile:hover{outline:2px solid var(--acc2)}
.lib.icons .tile svg{width:100%;height:100%}.lib.icons .tile ra-icon{--mdc-icon-size:32px}
.tipbox{position:fixed;z-index:20;pointer-events:none;padding:6px 10px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--text);font-size:12px;font-weight:600;box-shadow:0 6px 18px rgba(0,0,0,.35);white-space:nowrap;transform:translate(-50%,-100%)}
.tabs{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px}
.tabs button{flex:0 0 auto;padding:0 12px;height:32px;border-radius:10px;background:var(--inset);font-size:12px;white-space:nowrap}
.tabs button.on{background:linear-gradient(135deg,var(--acc1),var(--acc2))}
.tip{color:var(--muted);font-size:12px}
.card{padding:12px;border-radius:16px;background:var(--inset);display:flex;flex-direction:column;gap:8px}
.list button{width:100%;justify-content:flex-start;height:auto;min-height:48px;padding:8px 12px;border-radius:14px;background:var(--inset);margin-bottom:6px;text-align:start}
.list small{display:block;color:var(--muted);font-size:11px}
.pv{height:190px;margin:2px 0 4px;border-radius:16px;overflow:hidden;background:radial-gradient(120% 90% at 50% 30%,#2a2f52,#12152a)}
.pv3{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
.studio{position:absolute;bottom:16px;inset-inline-start:80px;z-index:6;display:flex;align-items:center;gap:8px;max-width:min(460px,70%);height:40px;padding:0 14px;border-radius:14px;background:rgba(20,24,49,.92);border:1px solid var(--border);color:var(--text);font:600 12px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer}
.studio.hide{display:none}
.studio span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.studio i{flex:0 0 90px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.studio b{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--acc1),var(--acc2));transition:width .4s}
.studio.ok b{background:#2EC4B6}
h3.sub{margin:8px 0 0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.shots{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.shots .shot{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted)}
.shots img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;background:var(--inset)}
.issue{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;background:var(--inset)}
.issue ra-icon{color:#F5B041}.issue.ok ra-icon{color:#5FBF77}
.ghost{position:fixed;z-index:20;pointer-events:none;transform:translate(-50%,-50%);padding:8px 12px;border-radius:12px;background:linear-gradient(135deg,var(--acc1),var(--acc2));color:#fff;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.menu{position:absolute;top:52px;inset-inline-start:12px;width:320px;max-height:70vh;overflow:auto;padding:12px;border-radius:18px;background:var(--panel);border:1px solid var(--border);box-shadow:0 18px 50px rgba(0,0,0,.4);z-index:10;display:flex;flex-direction:column;gap:10px}
.dialog .col{display:flex;flex-direction:column;gap:8px;margin-top:14px}.dialog .col button{min-height:44px}
.toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:40;padding:10px 16px;border-radius:14px;background:var(--panel);border:1px solid var(--border);box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:13px;max-width:80%}
.ed.unsaved .homes::after{content:"";width:8px;height:8px;border-radius:50%;background:#F5B041;margin-inline-start:4px}
.menu .muted{color:var(--muted);font-size:13px;margin:0}
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
 .studio{bottom:76px;inset-inline-start:10px;max-width:calc(100% - 20px)}
}
${VIEW_CSS}
`;

export class AtelierEditor {
  constructor(root, panelEl, { rtl } = {}) {
    this.root = root; this.panelEl = panelEl;
    try { this.roomMode = localStorage.getItem("roost-atelier-room-mode") || "rect"; } catch { this.roomMode = "rect"; }
    this.tool = "select"; this.sel = null; this.layout = "split"; this.z = 40; this.px = 60; this.py = 60; this.cat = "Living";
    this.undoStack = []; this.redoStack = []; this.status = "";
    root.innerHTML = `<style>${CSS}</style><div class="ed" dir="${rtl ? "rtl" : "ltr"}" data-layout="split">
      <header><div class="title"><button class="homes" title="${t("Homes")}"><ra-icon icon="mdi:home-outline"></ra-icon><h1></h1><ra-icon icon="mdi:chevron-down"></ra-icon></button></div>
        <button data-a="undo" title="${t("Undo")}"><ra-icon icon="mdi:undo"></ra-icon></button><button data-a="redo" title="${t("Redo")}"><ra-icon icon="mdi:redo"></ra-icon></button>
        <div class="seg floors"></div><span class="status"></span>
        <div class="seg layout"><button data-l="plan" title="Plan"><ra-icon icon="mdi:floor-plan"></ra-icon></button><button data-l="split" title="Split"><ra-icon icon="mdi:view-split-vertical"></ra-icon></button><button data-l="three" title="${t("3D")}"><ra-icon icon="mdi:cube-outline"></ra-icon></button></div>
        <button data-a="test" class="test" title="${t("Try it: tap devices to switch them, without editing")}"><ra-icon icon="mdi:gesture-tap-button"></ra-icon><span>${t("Try it")}</span></button>
        <button data-a="settings" title="${t("Settings")}"><ra-icon icon="mdi:tune-variant"></ra-icon></button></header>
      <nav></nav><main><div class="plan"><svg xmlns="http://www.w3.org/2000/svg"><defs></defs><g class="w"></g></svg><div class="devs"></div><div class="hint"></div>
        <button class="ceil" data-ceiling title="Ceiling"><ra-icon icon="mdi:ceiling-light-outline"></ra-icon><span></span></button><div class="zoom"><button data-sizes title="Sizes"><ra-icon icon="mdi:ruler"></ra-icon></button><button data-print title="Print"><ra-icon icon="mdi:printer-outline"></ra-icon></button><button data-z="in"><ra-icon icon="mdi:plus"></ra-icon></button><button data-z="fit"><ra-icon icon="mdi:fit-to-screen-outline"></ra-icon></button><button data-z="out"><ra-icon icon="mdi:minus"></ra-icon></button></div></div>
        <div class="three"></div></main><aside></aside></div>`;
    this.ed = root.querySelector(".ed"); this.svg = root.querySelector(".plan>svg"); this.g = root.querySelector(".plan>svg .w"); this.devsEl = root.querySelector(".devs");
    this.planEl = root.querySelector(".plan"); this.aside = root.querySelector("aside");
    this.drawNav();
    root.querySelector(".homes").onclick = () => this.homesMenu();
    root.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => this.setLayout(b.dataset.l)));
    root.querySelector('[data-a="undo"]').onclick = () => this.undo();
    root.querySelector('[data-a="redo"]').onclick = () => this.redo();
    root.querySelector('[data-a="test"]').onclick = () => this.setTesting(!this.testing);
    root.querySelector('[data-a="settings"]').onclick = () => { this.sel = null; this.tool = "select"; this.drawNav(); this.inspector("settings"); this.draw(); };
    // ceiling mode: furniture fades, only the lights stay, ready to place and line up
    const cb = root.querySelector("[data-ceiling]"); cb.querySelector("span").textContent = t("Ceiling");
    cb.onclick = () => { this.ceiling = !this.ceiling; cb.classList.toggle("on", this.ceiling); this.ed.classList.toggle("ceilmode", this.ceiling); this.draw(); };
    root.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => { const z = b.dataset.z; if (z === "fit") { this.fit(); this._userView = false; } else this.zoomAt(this.planEl.clientWidth / 2, this.planEl.clientHeight / 2, z === "in" ? 1.25 : 0.8); }));
    root.querySelector("[data-sizes]").onclick = (e) => { this.sizes = this.sizes === false; e.currentTarget.classList.toggle("on", this.sizes !== false); this.draw(); };
    root.querySelector("[data-sizes]").classList.add("on");
    root.querySelector("[data-print]").onclick = () => this.printPlan();
    this.bindPlan();
    this.ro = new ResizeObserver(() => { if (!this._userView && this.plan) this.fit(); this.draw(); }); this.ro.observe(this.planEl);
    this.keys = (e) => this.key(e); window.addEventListener("keydown", this.keys);
    // names of icons: shown while the pointer rests on one (or a finger presses it a moment)
    const tip = document.createElement("div"); tip.className = "tipbox"; tip.hidden = true; root.querySelector(".ed").appendChild(tip);
    let tipT = 0;
    const showTip = (el) => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false; const w = tip.offsetWidth, x = Math.max(w / 2 + 6, Math.min(window.innerWidth - w / 2 - 6, r.left + r.width / 2)); tip.style.left = `${x}px`; tip.style.top = `${Math.max(tip.offsetHeight + 6, r.top - 6)}px`; };
    root.addEventListener("pointerover", (e) => { const el = e.target.closest?.("[data-tip]"); clearTimeout(tipT); if (!el) { tip.hidden = true; return; } tipT = setTimeout(() => showTip(el), e.pointerType === "mouse" ? 250 : 450); });
    root.addEventListener("pointerout", (e) => { if (!e.relatedTarget?.closest?.("[data-tip]")) { clearTimeout(tipT); tip.hidden = true; } });
    root.addEventListener("pointerdown", () => { clearTimeout(tipT); tip.hidden = true; }, true);
    window.addEventListener("keyup", (e) => { if (e.key === " ") this._space = false; });
  }
  set narrow(n) { this._narrow = n; }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    this.ed.classList.toggle("light", h.themes?.darkMode === false);
    if (this.view) this.view.hass = h;
    if (this._tourCard) this._tourCard.hass = h;
    // trying it out: the plan's device icons follow the real devices going on and off
    if (this.testing && !this._testRaf) this._testRaf = requestAnimationFrame(() => { this._testRaf = 0; this.draw(); });
    if (first) this.start();
    // people seen by a presence radar move on the plan too (a few times a second at most)
    else if (this.floor?.devices.some((d) => d.kind === "radar") && !this.drag && performance.now() - (this._rdT || 0) > 600) { this._rdT = performance.now(); this.draw(); }
  }
  pause(p) { this.view?.engine.setVisible(!p); if (p && this._unsaved) this.save(); }
  async start() {
    this.view = new AtelierView(this.root.querySelector(".three"), { editing: true, canBake: true, onMoreInfo: () => {} });
    this.view.hass = this._hass;
    this.view.onPick = (hit) => { if (this.testing) return; if (hit.item) this.select({ t: "item", id: hit.item }); else if (hit.room) this.select({ t: "room", id: hit.room }); };
    this.view.onDemo = (d) => { if (!this.testing) this.select({ t: "dev", id: d.id }); };
    // light is baked here (this computer), then photos of the whole floor and every room are made in the background
    this.photographer = new RoomPhotographer(this);
    this.emitPhotos = () => { if (!this.sel && this.tool === "select") this.homePanel(); };
    // photos are only made when asked (Make dashboard pictures): making them by themselves slowed the editor down
    this.view.engine.on("bake", ({ state }) => { if (state === "baking" || state === "queued") this.photographer.reset(); });
    this.view.engine.on("hold", (hit) => { if (hit.device) this.select({ t: "dev", id: hit.device }); });
    let list = [];
    try { list = await ws(this._hass, { type: "roost_atelier/plans" }); } catch (e) { console.warn(e); }
    this.plans = list;
    this.watch();
    this._leave = (e) => { if (this._unsaved) { this.save(); e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", this._leave);
    const last = localStorage.getItem("roost-atelier-last");
    const id = list.find((p) => p.id === last)?.id || list[0]?.id;
    if (id) await this.open(id); else this.load(SAMPLES[0].make(), true);
    if (!id) this.homesMenu(true);
  }
  async open(id) {
    const p = await ws(this._hass, { type: "roost_atelier/plan", plan_id: id });
    // changes that never reached Home Assistant (closed tab, lost connection) are kept on this device
    const left = readPending(id);
    if (left && left.base === p.updated) { this.load(validate(left.plan)); this._base = p.updated; this.markUnsaved(); this.save(); this.toast(t("Brought back changes that were not saved")); return; }
    this.load(validate(p));
    if (left) this.ask(t("This device has changes to this home that were not saved, but it was changed elsewhere since."), [
      [t("Keep the saved home"), () => clearPending(id)],
      [t("Use this device's changes"), () => { this.load(validate(left.plan)); this._base = p.updated; this.markUnsaved(); this.save(true); }],
    ]);
  }
  load(plan, unsaved = false) {
    setOwnMaterials(plan.materials || []);
    this.plan = plan; this.fi = 0; this.floor = plan.floors[0]; this.sel = null; this.measure = null; this.edgePick = null; this.undoStack = []; this.redoStack = []; this._fitted = false; this._userView = false;
    this._base = plan.updated ?? null; this._unsaved = false; this._tries = 0; clearTimeout(this._retry); this.ed.classList.remove("unsaved");
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
    this.markUnsaved(); this.setStatus(t("Saving")); clearTimeout(this._sv); this._sv = setTimeout(() => this.save(), 1200);
    // once rooms are drawn and named, Home Assistant's devices go into the rooms with the same names, by themselves
    clearTimeout(this._ap); this._ap = setTimeout(() => { if (!this.drag) this.placeFromHA(true); }, 2500);
    this.root.querySelector('[data-a="undo"]').toggleAttribute("disabled", !this.undoStack.length);
    this.root.querySelector('[data-a="redo"]').toggleAttribute("disabled", !this.redoStack.length);
  }
  markUnsaved() { this._unsaved = true; this.ed.classList.add("unsaved"); }
  async save(force = false) {
    clearTimeout(this._sv); clearTimeout(this._retry);
    if (this._saving) { this._again = true; return; }
    this._saving = true;
    const plan = this.plan, base = this._base;
    if (plan.id) writePending(plan.id, { base, plan });
    try {
      const res = await ws(this._hass, { type: "roost_atelier/save", plan, base: plan.id ? base : null, force });
      if (!plan.id) { plan.id = res.id; localStorage.setItem("roost-atelier-last", res.id); this.plans = await ws(this._hass, { type: "roost_atelier/plans" }); }
      plan.updated = res.updated; this._base = res.updated; this._mine = res.updated; this._tries = 0;
      if (plan === this.plan && !this._again) { this._unsaved = false; this.ed.classList.remove("unsaved"); clearPending(plan.id); this.setStatus(t("Saved")); }
    } catch (e) {
      if (e?.code === "conflict") { this.setStatus(t("Not saved")); this.conflict(); }
      else {
        // Home Assistant restarting or the connection dropped: keep trying, the changes are safe on this device meanwhile
        this._tries = (this._tries || 0) + 1;
        this.setStatus(t("Not saved, trying again"));
        this._retry = setTimeout(() => this.save(force), Math.min(30000, 2000 * this._tries));
        console.warn("Roost Atelier save:", e);
      }
    } finally {
      this._saving = false;
      if (this._again) { this._again = false; this.save(force); }
    }
  }
  conflict() {
    this.ask(t("This home was changed on another screen after you opened it."), [
      [t("Load the other screen's version"), () => { clearPending(this.plan.id); this.open(this.plan.id); }],
      [t("Keep mine and replace theirs"), () => this.save(true)],
    ]);
  }
  // another screen saved this home while it is open here
  async watch() {
    try {
      this._unwatch = await this._hass.connection.subscribeMessage((m) => {
        if (!this.plan?.id || m.plan_id !== this.plan.id || !m.updated || m.updated === this._mine || m.updated === this._base) return;
        // Home Assistant announces a save a moment before it answers it: our own save in flight is not "another screen"
        // (if another screen really saved in between, the next save is refused and the choice is offered then)
        if (this._saving) return;
        if (!this._unsaved) { this.open(this.plan.id); this.toast(t("Updated from another screen")); }
        else this.conflict();
      }, { type: "roost_atelier/subscribe" });
    } catch (e) { /* older Home Assistant: the save check still protects */ }
  }
  ask(text, choices) {
    this.root.querySelector(".dialog.ask")?.remove();
    const d = document.createElement("div"); d.className = "dialog ask";
    d.innerHTML = `<div><b>${esc(text)}</b><div class="col">${choices.map((c, i) => `<button data-i="${i}" class="${i === 0 ? "" : "alt"}">${esc(c[0])}</button>`).join("")}</div></div>`;
    this.root.querySelector(".ed").appendChild(d);
    d.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { d.remove(); choices[+b.dataset.i][1](); }));
  }
  toast(text) {
    const el = document.createElement("div"); el.className = "toast"; el.textContent = text;
    this.root.querySelector(".ed").appendChild(el); setTimeout(() => el.remove(), 3500);
  }
  // several pieces selected together: line them up, spread them evenly, copy or remove them as one
  multiPanel() {
    const a = this.aside, list = this.sel.list.map((x) => this.find(x)).filter(Boolean);
    const b = (k, icon, label) => `<button data-al="${k}" title="${t(label)}"><ra-icon icon="${icon}"></ra-icon></button>`;
    a.innerHTML = `<div class="row between"><h2><ra-icon icon="mdi:selection-multiple"></ra-icon>${list.length} ${t("selected")}</h2><button data-close title="${t("Close")}"><ra-icon icon="mdi:close"></ra-icon></button></div>
      <p class="tip">${t("Drag any of them to move them all. Shift or Ctrl + tap adds or removes one.")}</p>
      <div class="field"><h3>${t("Line up")}</h3><div class="row">${b("left", "mdi:align-horizontal-left", "Left edges")}${b("cx", "mdi:align-horizontal-center", "Centres, up and down")}${b("right", "mdi:align-horizontal-right", "Right edges")}${b("top", "mdi:align-vertical-top", "Top edges")}${b("cy", "mdi:align-vertical-center", "Centres, side to side")}${b("bottom", "mdi:align-vertical-bottom", "Bottom edges")}</div></div>
      ${list.length > 2 ? `<div class="field"><h3>${t("Spread evenly")}</h3><div class="row">${b("sx", "mdi:distribute-horizontal-center", "Side to side")}${b("sy", "mdi:distribute-vertical-center", "Up and down")}</div></div>` : ""}
      ${(() => { const devs = list.filter((o) => this.floor.devices.includes(o)), g = devs[0]?.group; return devs.length > 1 ? `<div class="field"><h3>${t("Switch together")}</h3><div class="row">${g && devs.every((d) => d.group === g) ? `<button data-ungroup="${esc(g)}"><ra-icon icon="mdi:link-variant-off"></ra-icon>${t("Ungroup")}</button>` : `<button class="primary" data-group><ra-icon icon="mdi:link-variant"></ra-icon>${t("Group these devices")}</button>`}</div></div>` : ""; })()}
      <div class="field"><h3>${t("Pick")}</h3><div class="row"><button data-invert><ra-icon icon="mdi:select-inverse"></ra-icon>${t("Everything else")}</button><button data-alldev><ra-icon icon="mdi:lightbulb-group-outline"></ra-icon>${t("All devices")}</button></div></div>
      <div class="row"><button data-mdup><ra-icon icon="mdi:content-copy"></ra-icon>${t("Duplicate")}</button><button class="danger" data-mdel><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    const half = (o) => { if (!o.kind || !LIBRARY[o.kind]) return [0, 0]; const d = dims(o), r = ((o.rot || 0) % 180 + 180) % 180 === 90; return r ? [d.d / 2, d.w / 2] : [d.w / 2, d.d / 2]; };
    const items = () => this.sel.list.map((x) => [x, this.find(x)]).filter(([, o]) => o);
    a.querySelector("[data-close]").onclick = () => { this.picking = false; this.select(null); };
    a.querySelectorAll("[data-al]").forEach((btn) => (btn.onclick = () => {
      const k = btn.dataset.al, objs = items().map(([, o]) => o); this.snapshot();
      const ext = (o) => { const [hx, hy] = half(o); return { l: o.x - hx, r: o.x + hx, t: o.y - hy, b: o.y + hy }; };
      if (k === "left") { const v = Math.min(...objs.map((o) => ext(o).l)); objs.forEach((o) => (o.x = round(v + half(o)[0], 3))); }
      if (k === "right") { const v = Math.max(...objs.map((o) => ext(o).r)); objs.forEach((o) => (o.x = round(v - half(o)[0], 3))); }
      if (k === "top") { const v = Math.min(...objs.map((o) => ext(o).t)); objs.forEach((o) => (o.y = round(v + half(o)[1], 3))); }
      if (k === "bottom") { const v = Math.max(...objs.map((o) => ext(o).b)); objs.forEach((o) => (o.y = round(v - half(o)[1], 3))); }
      if (k === "cx") { const v = objs.reduce((t, o) => t + o.x, 0) / objs.length; objs.forEach((o) => (o.x = round(v, 3))); }
      if (k === "cy") { const v = objs.reduce((t, o) => t + o.y, 0) / objs.length; objs.forEach((o) => (o.y = round(v, 3))); }
      if (k === "sx" || k === "sy") {
        const c = k === "sx" ? "x" : "y", sorted = [...objs].sort((p, q) => p[c] - q[c]), a0 = sorted[0][c], a1 = sorted[sorted.length - 1][c];
        sorted.forEach((o, i) => (o[c] = round(a0 + ((a1 - a0) * i) / (sorted.length - 1), 3)));
      }
      this.changed();
    }));
    a.querySelector("[data-mdup]").onclick = () => {
      this.snapshot(); const f = this.floor, next = [];
      for (const [x, o] of items()) { const c = { ...clone(o), id: uid(x.t === "item" ? "i" : "d"), x: round(o.x + 0.5, 3), y: round(o.y + 0.5, 3) }; (x.t === "item" ? f.items : f.devices).push(c); next.push({ t: x.t, id: c.id }); }
      this.sel = { t: "multi", list: next }; this.changed(); this.inspector();
    };
    a.querySelector("[data-mdel]").onclick = () => this.remove(this.sel);
    a.querySelector("[data-group]")?.addEventListener("click", () => this.groupDevices(list.filter((o) => this.floor.devices.includes(o))));
    a.querySelector("[data-ungroup]")?.addEventListener("click", (e) => this.ungroup(e.currentTarget.dataset.ungroup));
    a.querySelector("[data-invert]").onclick = () => this.invertSel();
    a.querySelector("[data-alldev]").onclick = () => this.selectMany((x) => x.t === "dev");
  }
  // a clean plan on white paper: walls, doors, windows, furniture, room names and areas, wall lengths, a scale bar
  printPlan() {
    const keep = { sel: this.sel, ceiling: this.ceiling, z: this.z, px: this.px, py: this.py, sizes: this.sizes };
    this.sel = null; this.ceiling = false; this.sizes = true;
    const b = planBounds(this.floor), W = 1000, m = 1.2, z = W / (b.x1 - b.x0 + 2 * m);
    this.z = z; this.px = 0; this.py = 0; this.draw();
    const body = this.g.innerHTML;
    Object.assign(this, keep); this.draw();
    const H = (b.y1 - b.y0 + 2 * m) * z, today = new Date().toLocaleDateString();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(this.plan.name)}</title><style>
      @page{size:A4 landscape;margin:12mm}body{margin:0;font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;color:#161936}
      svg{width:100%;height:auto;--wall:#2A2F45;--text:#161936;--muted:#5E668F;--grid:transparent;--inset:#EEF0FA;--border:#C9CEF0;--acc1:#6D4BFF;--acc2:#8B6CFF;--panel:#fff;--track:#DDE1F0}
      header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #C9CEF0;padding-bottom:6px;margin-bottom:8px}h1{font-size:18px;margin:0}small{color:#5E668F}
      .hs,[data-rot],[data-aim]{display:none}</style></head><body>
      <header><h1>${esc(this.plan.name)} · ${esc(this.floor.name || "")}</h1><small>${today}</small></header>
      <svg viewBox="${b.x0 - m} ${b.y0 - m} ${b.x1 - b.x0 + 2 * m} ${b.y1 - b.y0 + 2 * m}" xmlns="http://www.w3.org/2000/svg">${body}
        <g transform="translate(${b.x0 - m + 0.4} ${b.y1 + m - 0.4})"><rect width="1" height="0.08" fill="#161936"/><rect x="1" width="1" height="0.08" fill="#fff" stroke="#161936" stroke-width="0.01"/><text y="-0.12" font-size="${11 / z}" fill="#161936">0</text><text x="2" y="-0.12" font-size="${11 / z}" text-anchor="middle" fill="#161936">2 m</text></g></svg>
      <script>setTimeout(() => print(), 300)<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { this.toast(t("Allow pop-ups to print the plan")); return; }
    w.document.write(html); w.document.close();
    void H;
  }
  // ------------------------------------------------------------ backups: a file, earlier versions, deleted homes
  exportFile() {
    const blob = new Blob([JSON.stringify({ roost_atelier: 1, saved: new Date().toISOString(), plan: this.plan }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(this.plan.name || "home").replace(/[^\w\u0600-\u06FF -]+/g, "").trim() || "home"}.roost.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  importFile() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        const plan = validate(data.plan || data);
        if (!plan.floors?.length) throw new Error("no floors");
        delete plan.id; delete plan.updated;
        plan.name = plan.name || t("New home");
        this.load(plan, true); this.toast(t("Home loaded from the file"));
      } catch (e) { this.toast(t("That file is not a Roost Atelier home")); }
    };
    inp.click();
  }
  async versionsMenu() {
    const m = this.root.querySelector(".menu"); if (!m) return;
    let list = [];
    try { list = await ws(this._hass, { type: "roost_atelier/versions", plan_id: this.plan.id }); } catch (e) { /* none */ }
    m.innerHTML = `<h3>${t("Earlier versions")} · ${esc(this.plan.name)}</h3>${list.length ? `<div class="list">${list.map((v) => `<button data-v="${v.updated}"><ra-icon icon="mdi:history"></ra-icon><span>${esc(when(v.updated))}<small>${v.rooms} ${t("Rooms").toLowerCase()} · ${v.items} ${t("Furniture").toLowerCase()}</small></span></button>`).join("")}</div>` : `<p class="muted">${t("No earlier versions yet. One is kept each time you save, up to 10.")}</p>`}`;
    m.querySelectorAll("[data-v]").forEach((b) => (b.onclick = async () => {
      m.remove();
      const p = await ws(this._hass, { type: "roost_atelier/version", plan_id: this.plan.id, updated: +b.dataset.v });
      this.snapshot(); const id = this.plan.id, base = this._base;
      this.plan = validate({ ...p, id, updated: base }); this.fi = 0; this.floor = this.plan.floors[0]; this.sel = null;
      this.drawFloors(); this.changed(true); this.inspector(); this.toast(t("Earlier version brought back. Undo takes it away again."));
    }));
  }
  async deletedMenu() {
    const m = this.root.querySelector(".menu"); if (!m) return;
    let list = [];
    try { list = await ws(this._hass, { type: "roost_atelier/deleted" }); } catch (e) { /* none */ }
    m.innerHTML = `<h3>${t("Deleted homes")}</h3>${list.length ? `<div class="list">${list.map((v) => `<button data-u="${esc(v.id)}"><ra-icon icon="mdi:delete-restore"></ra-icon><span>${esc(v.name)}<small>${t("Deleted")} ${esc(when(v.deleted_at))}</small></span></button>`).join("")}</div>` : `<p class="muted">${t("Nothing deleted.")}</p>`}`;
    m.querySelectorAll("[data-u]").forEach((b) => (b.onclick = async () => {
      m.remove();
      const r = await ws(this._hass, { type: "roost_atelier/undelete", plan_id: b.dataset.u });
      this.plans = await ws(this._hass, { type: "roost_atelier/plans" }); await this.open(r.id); this.toast(t("Home brought back"));
    }));
  }
  setStatus(s) { this.root.querySelector(".status").textContent = s; }

  // ------------------------------------------------------------ finding things
  find(s) { if (!s) return null; if (s.t === "multi") return s; const f = this.floor; return (s.t === "room" ? f.rooms : s.t === "op" ? f.openings : s.t === "item" ? f.items : s.t === "note" ? f.notes || [] : f.devices).find((x) => x.id === s.id); }
  select(s) { this.sel = s; if (this.tool !== "select" && s) { this.tool = "select"; this.drawNav(); } this.draw(); this.inspector(); }
  remove(s) {
    if (s.t === "multi") { this.snapshot(); const f = this.floor; for (const x of s.list) { const k = x.t === "item" ? "items" : "devices"; f[k] = f[k].filter((o) => o.id !== x.id || o.locked); } this.sel = null; this.picking = false; this.changed(); this.inspector(); return; }
    if (this.find(s)?.locked) { this.toast(t("Locked: unlock it first")); return; }
    this.snapshot(); const f = this.floor, k = s.t === "room" ? "rooms" : s.t === "op" ? "openings" : s.t === "item" ? "items" : s.t === "note" ? "notes" : "devices"; f[k] = (f[k] || []).filter((x) => x.id !== s.id); this.sel = null; this.changed(s.t !== "note"); this.inspector(); }

  // ------------------------------------------------------------ floors
  drawFloors() {
    const el = this.root.querySelector(".floors"), fl = this.plan.floors;
    el.innerHTML = fl.map((f, i) => `<button data-fl="${i}" class="${i === this.fi ? "on" : ""}" title="${esc(f.name)}">${i === 0 ? "G" : i}</button>`).join("") + `<button data-fl="add" title="${t("Add level")}"><ra-icon icon="mdi:plus"></ra-icon></button>`;
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
    nav.innerHTML = TOOLS.map(([k, i, l], n) => `${n === 7 || n === 9 || n === 11 ? '<div class="sep"></div>' : ""}<button data-t="${k}" class="${this.tool === k ? "on" : ""}" title="${t(l)}"><ra-icon icon="${i}"></ra-icon></button>`).join("");
    nav.querySelectorAll("button").forEach((b) => (b.onclick = () => this.setTool(b.dataset.t)));
  }
  setTool(k) { if (k !== "room") { this.line = null; this.refMode = ""; this.refCal = []; } this.tool = k; if (k !== "select") this.sel = null; if (k !== "stairs") this.stairPick = null; else this.stairPick ||= { step: 0, from: this.fi }; this.drawNav(); this.draw(); this.inspector(); }

  // trying the home out: tapping a device switches it (for real, or just here when it has no working entity);
  // nothing opens for editing and nothing in the home is changed
  setTesting(on) {
    this.testing = on; this.ed.classList.toggle("testing", on);
    this.root.querySelector('[data-a="test"]').classList.toggle("on", on);
    this.view.testing = on;
    if (on) { this.tool = "select"; this.stairPick = null; this.sel = null; this.drawNav(); }
    this.draw(); this.inspector();
  }

  // ------------------------------------------------------------ stairs between two levels
  // 1. pick a style  2. tap where they start on this level  3. tap where they arrive on the level above
  startStairs(style, edit) {
    this.tool = "stairs"; this.sel = null; this.stairPick = { style, step: 1, from: this.fi, edit }; this.stairHover = null;
    this.drawNav(); this.draw(); this.inspector();
  }
  // the bottom and top of a stair on the plan
  stairEnds(it) {
    const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    if (STAIR_STYLES[it.style]?.[2]) { const e = a + (SPIRAL_TURN * Math.PI) / 180; return [[it.x, it.y], [it.x + Math.sin(e), it.y + Math.cos(e)]]; }
    const h = (it.d || 3.6) / 2; return [[it.x + h * sn, it.y + h * c], [it.x - h * sn, it.y - h * c]];
  }
  pickStair(P) {
    const sp = this.stairPick; if (!sp) return;
    if (sp.step === 1) {
      sp.start = P; sp.step = 2;
      if (!this.plan.floors[sp.from + 1]) { this.addFloor(); this.toast(t("Added a level above for the stairs")); }
      else this.useFloor(sp.from + 1);
      this.tool = "stairs"; this.drawNav(); this.draw(); this.inspector(); return;
    }
    const below = this.plan.floors[sp.from], rise = riseTo(this.plan, sp.from), spec = stairFrom(sp.start, P, sp.style, rise, below.rooms);
    this.snapshot();
    const old = sp.edit && below.items.find((i) => i.id === sp.edit);
    const it = Object.assign(old || { id: uid("i"), kind: "stairs" }, { x: spec.x, y: spec.y, w: old && !STAIR_STYLES[sp.style][2] && !STAIR_STYLES[old.style]?.[2] ? old.w : spec.w, d: spec.d, h: spec.h, rot: spec.rot, style: sp.style, link: sp.from + 1 });
    if (!old) below.items.push(it);
    if (spec.short) this.toast(`${t("Made longer so the steps are comfortable")} (${round(minRun(rise), 1)} m)`);
    else if (spec.steep) this.toast(t("These stairs are steep: there is not room for a gentler flight here"));
    this.stairPick = null; this.tool = "select"; this.useFloor(sp.from); this.sel = { t: "item", id: it.id };
    this.changed(true); this.drawNav(); this.draw(); this.inspector();
  }
  stairPanel(a) {
    const sp = this.stairPick || { step: 0 };
    const styles = Object.entries(STAIR_STYLES).map(([k, S]) => `<div class="tile${sp.style === k ? " on" : ""}" data-stair="${k}" data-tip="${esc(t(S[0]))}" aria-label="${esc(t(S[0]))}" role="button"><ra-icon icon="stair:${k}"></ra-icon></div>`).join("");
    const lv = (i) => esc(this.plan.floors[i]?.name || t("Level"));
    const say = sp.step === 0 ? t("Pick a style of stairs.") : sp.step === 1 ? `${t("Tap where the stairs start on")} ${lv(sp.from)}.` : `${t("Now tap where the stairs arrive on")} ${lv(sp.from + 1)}. ${t("The level below is shown faintly.")}`;
    a.innerHTML = `<h2><ra-icon icon="mdi:stairs-up"></ra-icon>${t("Stairs")}</h2><p class="tip">${say}</p>${sp.step === 2 ? "" : `<div class="lib icons">${styles}</div>`}<div class="row"><button data-cancel>${t("Cancel")}</button></div>`;
    a.querySelectorAll("[data-stair]").forEach((el) => (el.onclick = () => this.startStairs(el.dataset.stair, sp.edit)));
    a.querySelector("[data-cancel]").onclick = () => { const back = sp.from; this.stairPick = null; this.tool = "select"; if (back !== this.fi && this.plan.floors[back]) this.useFloor(back); this.drawNav(); this.draw(); this.inspector(); };
  }
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
    // the drawing to trace over (under everything, on this level only)
    const ref = f.ref, refUrl = ref && this.refUrl(ref.file);
    if (ref && refUrl) out += `<image href="${refUrl}" x="${ref.x}" y="${ref.y}" width="${ref.w}" height="${ref.w / ref.aspect}" preserveAspectRatio="none" opacity="${ref.opacity ?? 0.6}" pointer-events="none"/>`;
    if (this.refCal?.length) out += this.refCal.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${5 * px}" fill="#F5B041" stroke="#fff" stroke-width="${1.5 * px}" pointer-events="none"/>`).join("") + (this.refCal.length === 2 ? `<line x1="${this.refCal[0][0]}" y1="${this.refCal[0][1]}" x2="${this.refCal[1][0]}" y2="${this.refCal[1][1]}" stroke="#F5B041" stroke-width="${2.5 * px}" pointer-events="none"/>` : "");
    // rooms
    for (const r of f.rooms) {
      const type = ROOM_TYPES[r.type] || ROOM_TYPES.other, fill = swatchColor("floor", r.floor || type.floor);
      out += `<polygon data-room="${esc(r.id)}" points="${r.pts.map((p) => p.join(",")).join(" ")}" fill="${fill}" fill-opacity="${ref ? 0.22 : light ? 0.55 : 0.42}" stroke="none"/>`;
    }
    // furniture footprints (faded in ceiling mode)
    if (this.ceiling) out += `<g opacity=".22" pointer-events="none">`;
    for (const it of f.items) {
      if (it.kind === "stairs") {
        const on = (s?.t === "item" && s.id === it.id) || (s?.t === "multi" && s.list.some((x) => x.t === "item" && x.id === it.id));
        out += `<g transform="translate(${it.x} ${it.y}) rotate(${-(it.rot || 0)})" data-item="${esc(it.id)}">${stairSvg(it, px * (on ? 2.2 : 1.2), on ? "var(--acc2)" : light ? "#7E87B5" : "#8A93C8", light ? "#fff" : "#2A3060")}</g>`;
        if (z > 30 && it.link != null && this.plan.floors[it.link]) out += `<text x="${it.x}" y="${it.y}" font-size="${10 * px}" text-anchor="middle" dominant-baseline="middle" fill="var(--text)" pointer-events="none" paint-order="stroke" stroke="${light ? "#fff" : "#141831"}" stroke-width="${3 * px}">${esc(t("Up to"))} ${esc(this.plan.floors[it.link].name || "")}</text>`;
        continue;
      }
      const d = dims(it), L = LIBRARY[it.kind], on = (s?.t === "item" && s.id === it.id) || (s?.t === "multi" && s.list.some((x) => x.t === "item" && x.id === it.id));
      const isRound = /round|plant|tree|ottoman|bar_stool|pendant|chandelier/.test(it.kind);
      if (it.kind === "column" || it.kind === "round_column" || it.kind === "beam") {
        // structure: columns drawn solid like walls, beams dashed (they are overhead)
        const beamS = it.kind === "beam", stroke = on ? "var(--acc2)" : "var(--wall)";
        out += `<g transform="translate(${it.x} ${it.y}) rotate(${-(it.rot || 0)})" data-item="${esc(it.id)}">` + (it.kind === "round_column" ? `<circle r="${d.w / 2}" fill="var(--wall)" stroke="${stroke}" stroke-width="${(on ? 2.5 : 1) * px}"/>`
          : `<rect x="${-d.w / 2}" y="${-d.d / 2}" width="${d.w}" height="${d.d}" fill="${beamS ? "transparent" : "var(--wall)"}" stroke="${stroke}" stroke-width="${(on ? 2.5 : 1.5) * px}" ${beamS ? `stroke-dasharray="${8 * px} ${4 * px}"` : ""}/>`) + `</g>`;
        continue;
      }
      out += `<g transform="translate(${it.x} ${it.y}) rotate(${-(it.rot || 0)})" data-item="${esc(it.id)}">`;
      out += isRound ? `<ellipse rx="${d.w / 2}" ry="${d.d / 2}" fill="${light ? "#fff" : "#2A3060"}" fill-opacity=".9" stroke="${on ? "var(--acc2)" : light ? "#9AA3C9" : "#5E668F"}" stroke-width="${(on ? 2.5 : 1) * px}" ${d.mount === "ceiling" ? `stroke-dasharray="${4 * px} ${3 * px}" fill-opacity=".2"` : ""}/>`
        : `<rect x="${-d.w / 2}" y="${-d.d / 2}" width="${d.w}" height="${d.d}" rx="${Math.min(0.08, d.w / 6)}" fill="${it.kind === "rug" ? it.color || "#C9B79C" : light ? "#fff" : "#2A3060"}" fill-opacity="${it.kind === "rug" ? 0.45 : 0.92}" stroke="${on ? "var(--acc2)" : light ? "#9AA3C9" : "#5E668F"}" stroke-width="${(on ? 2.5 : 1) * px}"/>`;
      if (!isRound && it.kind !== "rug") out += `<line x1="${-d.w / 2 + 0.05}" x2="${d.w / 2 - 0.05}" y1="${d.d / 2 - 0.04}" y2="${d.d / 2 - 0.04}" stroke="${light ? "#C9CEF0" : "#4A5190"}" stroke-width="${2 * px}"/>`;
      if (z > 34 && d.w * z > 46 && L) out += `<text transform="rotate(${it.rot || 0})" font-size="${10 * px}" text-anchor="middle" dominant-baseline="middle" fill="var(--muted)" pointer-events="none">${esc(t(L[0]))}</text>`;
      out += `</g>`;
    }
    if (this.ceiling) out += `</g>`;
    // the shape of linear lights, tracks and where focus lights point
    for (const d of f.devices) {
      if (d.kind === "radar") {
        // where the presence radar looks: a soft fan, 6 m deep and 120° wide
        const a = ((d.rot || 0) * Math.PI) / 180, R = 6, w = Math.PI / 3, fx = Math.sin(a), fy = Math.cos(a);
        const p1 = [d.x + R * Math.sin(a - w), d.y + R * Math.cos(a - w)], p2 = [d.x + R * Math.sin(a + w), d.y + R * Math.cos(a + w)];
        out += `<path d="M${d.x} ${d.y}L${p1[0]} ${p1[1]}A${R} ${R} 0 0 0 ${p2[0]} ${p2[1]}Z" fill="#E86FB0" fill-opacity=".06" stroke="#E86FB0" stroke-opacity=".35" stroke-width="${1 * px}" stroke-dasharray="${4 * px} ${3 * px}" pointer-events="none"/><line x1="${d.x}" y1="${d.y}" x2="${d.x + fx * 0.6}" y2="${d.y + fy * 0.6}" stroke="#E86FB0" stroke-width="${2 * px}" pointer-events="none"/>`;
        for (const [tx, ty] of radarTargets(d, this._hass?.states)) { const rx = Math.cos(a) * (d.flip ? -1 : 1), ry = -Math.sin(a) * (d.flip ? -1 : 1); out += `<circle cx="${d.x + fx * ty - rx * tx}" cy="${d.y + fy * ty - ry * tx}" r="${7 * px}" fill="#E86FB0" pointer-events="none"/>`; }
        continue;
      }
      if ((d.kind || deviceKind(d.entity)) !== "light") continue;
      const look = d.look || "flush", on = s?.t === "dev" && s.id === d.id, col = "#F5B041";
      if (look === "track" || look === "linear") {
        const len = d.len || (look === "track" ? 1.5 : 1.2), a = ((d.rot || 0) * Math.PI) / 180, ux = Math.cos(a), uy = -Math.sin(a);
        out += `<line x1="${d.x - ux * len / 2}" y1="${d.y - uy * len / 2}" x2="${d.x + ux * len / 2}" y2="${d.y + uy * len / 2}" stroke="${look === "track" ? (light ? "#2A2F45" : "#C9CEF0") : col}" stroke-width="${(look === "track" ? 5 : 4) * px}" stroke-linecap="round" opacity="${on ? 1 : 0.85}" pointer-events="none"/>`;
        if (look === "track") { const n = Math.max(1, Math.min(8, d.heads || 3)); for (let i = 0; i < n; i++) { const sx = (i - (n - 1) / 2) * (len / n); out += `<circle cx="${d.x + ux * sx}" cy="${d.y + uy * sx}" r="${4 * px}" fill="${col}" pointer-events="none"/>`; } }
      }
      if (look === "focus") {
        const tx = d.tx ?? d.x + 0.8, ty = d.ty ?? d.y;
        out += `<line x1="${d.x}" y1="${d.y}" x2="${tx}" y2="${ty}" stroke="${col}" stroke-width="${1.5 * px}" stroke-dasharray="${4 * px} ${3 * px}" pointer-events="none"/><circle data-aim="${esc(d.id)}" cx="${tx}" cy="${ty}" r="${(on ? 9 : 6) * px}" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="${2 * px}" style="cursor:grab"/>`;
      }
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
    // wall lengths, written along each wall on its outer side (inside length for walls between rooms);
    // a picked room shows its own sizes instead along its walls
    const picked = s?.t === "room" ? this.find(s) : null;
    const onPicked = (m) => picked && picked.pts.some((p, i) => { const q = picked.pts[(i + 1) % picked.pts.length], ex = q[0] - p[0], ey = q[1] - p[1], L = ex * ex + ey * ey || 1, k = Math.max(0, Math.min(1, ((m[0] - p[0]) * ex + (m[1] - p[1]) * ey) / L)); return Math.hypot(p[0] + k * ex - m[0], p[1] + k * ey - m[1]) < 0.2; });
    if (this.sizes !== false && !this.ceiling) for (const w of ws_) {
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy); if (len * z < 70 || w.parapet || onPicked([(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2])) continue;
      let nx = -dy / len, ny = dx / len;
      const mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2;
      if (f.rooms.some((r) => inside([mx + nx * 0.3, my + ny * 0.3], r.pts)) && !f.rooms.some((r) => inside([mx - nx * 0.3, my - ny * 0.3], r.pts))) { nx = -nx; ny = -ny; }
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI; if (deg > 90) deg -= 180; if (deg < -90) deg += 180;
      const off = w.thick / 2 + 9 * px, tx = mx + nx * off, ty = my + ny * off;
      out += `<text class="dim" transform="translate(${tx} ${ty}) rotate(${deg})" font-size="${10 * px}" text-anchor="middle" dominant-baseline="middle" fill="var(--muted)" pointer-events="none">${len.toFixed(2)} m</text>`;
    }
    // openings
    for (const op of f.openings) {
      const nw = nearestWall(f, [op.x, op.y], 0.3); if (!nw) continue;
      const a = nw.angle, deg = (a * 180) / Math.PI, on = s?.t === "op" && s.id === op.id, w = op.width, th = nw.w.thick;
      out += `<g transform="translate(${op.x} ${op.y}) rotate(${deg})" data-op="${esc(op.id)}">`;
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
    // notes and dimension lines kept on the plan (they print with it)
    const ink = light ? "#161936" : "#EEF0FF", halo = light ? "#fff" : "#141831";
    const dimLine = (a, b, col, wpx, label, attrs = "") => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-3) return "";
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * 6 * px, ny = ux * 6 * px;
      let deg = (Math.atan2(uy, ux) * 180) / Math.PI; if (deg > 90) deg -= 180; if (deg < -90) deg += 180;
      return `<g ${attrs}><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="transparent" stroke-width="${14 * px}"/><path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${a[0] - nx} ${a[1] - ny}L${a[0] + nx} ${a[1] + ny}M${b[0] - nx} ${b[1] - ny}L${b[0] + nx} ${b[1] + ny}" stroke="${col}" stroke-width="${wpx * px}" fill="none"/>`
        + `<text transform="translate(${(a[0] + b[0]) / 2 - uy * 12 * px} ${(a[1] + b[1]) / 2 + ux * 12 * px}) rotate(${deg})" font-size="${11 * px}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="${col}" paint-order="stroke" stroke="${halo}" stroke-width="${3 * px}">${label ?? `${L.toFixed(2)} m`}</text></g>`;
    };
    for (const n of f.notes || []) {
      const on = s?.t === "note" && s.id === n.id;
      if (n.type === "dim") { out += dimLine(n.a, n.b, on ? "var(--acc2)" : n.color || ink, on ? 2 : 1.2, null, `data-note="${esc(n.id)}"`); continue; }
      const lines = String(n.text || "").split("\n"), fs = n.size || 0.22;
      out += `<g data-note="${esc(n.id)}"><text x="${n.x}" y="${n.y}" font-size="${fs}" font-weight="600" fill="${n.color || ink}" paint-order="stroke" stroke="${halo}" stroke-width="${fs * 0.18}" ${on ? `text-decoration="underline"` : ""} style="cursor:move">${lines.map((l, i) => `<tspan x="${n.x}" dy="${i ? fs * 1.2 : 0}">${esc(l) || " "}</tspan>`).join("")}</text></g>`;
    }
    if (this.measure) out += dimLine(this.measure.a, this.measure.b, "#F5B041", 2, null, `pointer-events="none"`);
    // the wall of the picked room whose finish is being set
    if (s?.t === "room" && this.edgePick != null) { const r = this.find(s), p = r?.pts[this.edgePick], q = r?.pts[(this.edgePick + 1) % (r?.pts.length || 1)]; if (p && q) out += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#F5B041" stroke-width="${7 * px}" stroke-linecap="round" opacity=".8" pointer-events="none"/>`; }
    // room labels
    for (const r of f.rooms) {
      const [cx, cy] = centroid(r.pts), b = bounds(r.pts); if ((b.x1 - b.x0) * z < 60) continue;
      out += `<text x="${cx}" y="${cy}" font-size="${12 * px}" font-weight="600" text-anchor="middle" fill="var(--text)" pointer-events="none" font-family="Space Grotesk,Inter,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(r.name || t(ROOM_TYPES[r.type]?.name || "Room"))}</text><text x="${cx}" y="${cy + 15 * px}" font-size="${10 * px}" text-anchor="middle" fill="var(--muted)" pointer-events="none">${round(Math.abs(area(r.pts)), 1)} m²</text>`;
    }
    // selected room handles and sizes
    if (s?.t === "room") {
      const r = this.find(s);
      if (r) {
        out += `<polygon points="${r.pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--acc2)" stroke-width="${2.5 * px}" pointer-events="none"/>`;
        r.pts.forEach((p, i) => {
          const q = r.pts[(i + 1) % r.pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len, sgn = inside([mx + nx * 0.1, my + ny * 0.1], r.pts) ? -1 : 1;
          out += `<text x="${mx + nx * sgn * 26 * px}" y="${my + ny * sgn * 26 * px}" font-size="${11 * px}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="var(--acc2)" pointer-events="none">${round(len, 2)} m</text>`;
          out += `<rect data-e="${i}" x="${mx - 9 * px}" y="${my - 9 * px}" width="${18 * px}" height="${18 * px}" rx="${5 * px}" fill="#fff" stroke="var(--acc1)" stroke-width="${2 * px}" transform="rotate(${(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI} ${mx} ${my})"/>`;
        });
        r.pts.forEach((p, i) => (out += `<circle data-v="${i}" cx="${p[0]}" cy="${p[1]}" r="${10 * px}" fill="var(--acc1)" stroke="#fff" stroke-width="${2.5 * px}"/>`));
      }
    }
    if (s?.t === "item") {
      const it = this.find(s);
      if (it) { const d = dims(it), a = ((it.rot || 0) * Math.PI) / 180, hx = it.x - Math.sin(a) * (d.d / 2 + 26 * px), hy = it.y - Math.cos(a) * (d.d / 2 + 26 * px); out += `<line x1="${it.x}" y1="${it.y}" x2="${hx}" y2="${hy}" stroke="var(--acc1)" stroke-width="${1.5 * px}" pointer-events="none"/><circle data-rot="1" cx="${hx}" cy="${hy}" r="${11 * px}" fill="#fff" stroke="var(--acc1)" stroke-width="${2.5 * px}"/>`; }
    }
    if (this.line?.length) out += this.lineSvg(px);
    if (this.drawRect) { const [a, b] = this.drawRect; out += `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="rgba(109,75,255,.18)" stroke="var(--acc2)" stroke-width="${2 * px}"/><text x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2}" font-size="${13 * px}" font-weight="600" text-anchor="middle" fill="var(--text)">${round(Math.abs(b[0] - a[0]), 2)} × ${round(Math.abs(b[1] - a[1]), 2)} m</text>`; }
    // stairs coming up from the level below: their opening in this floor
    for (const it of stairsArriving(this.plan, this.fi)) {
      const hole = stairHole(it);
      out += `<g opacity=".7" pointer-events="none"><g transform="translate(${it.x} ${it.y}) rotate(${-(it.rot || 0)})">${stairSvg(it, px, light ? "#9AA3C9" : "#5E668F", "none")}</g><polygon points="${hole.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--acc2)" stroke-width="${1.5 * px}" stroke-dasharray="${5 * px} ${3 * px}"/></g>`;
      if (z > 30) out += `<text x="${it.x}" y="${it.y}" font-size="${10 * px}" text-anchor="middle" dominant-baseline="middle" fill="var(--text)" pointer-events="none" paint-order="stroke" stroke="${light ? "#fff" : "#141831"}" stroke-width="${3 * px}">${esc(t("Stairs down"))}</text>`;
    }
    // placing stairs: the level below faintly, where they start, and how they would run to the pointer
    const sp = this.tool === "stairs" ? this.stairPick : null;
    if (sp?.step === 2 && this.plan.floors[sp.from]) {
      out += `<g opacity=".45" pointer-events="none">${this.plan.floors[sp.from].rooms.map((r) => `<polygon points="${r.pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--muted)" stroke-width="${1.2 * px}" stroke-dasharray="${6 * px} ${4 * px}"/>`).join("")}</g>`;
      out += `<circle cx="${sp.start[0]}" cy="${sp.start[1]}" r="${7 * px}" fill="var(--acc1)" stroke="#fff" stroke-width="${2 * px}" pointer-events="none"/>`;
      if (this.stairHover) { const it = stairFrom(sp.start, this.stairHover, sp.style, riseTo(this.plan, sp.from), this.plan.floors[sp.from].rooms); out += `<g transform="translate(${it.x} ${it.y}) rotate(${-(it.rot || 0)})" opacity=".85" pointer-events="none">${stairSvg(it, 1.4 * px, "var(--acc2)", "rgba(109,75,255,.15)")}</g>`; }
    }
    if (sp?.step === 1 && this.stairHover) out += `<circle cx="${this.stairHover[0]}" cy="${this.stairHover[1]}" r="${7 * px}" fill="var(--acc1)" fill-opacity=".6" pointer-events="none"/>`;
    if (this.boxRect) { const [a, b] = this.boxRect; out += `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="rgba(109,75,255,.12)" stroke="var(--acc2)" stroke-width="${1.5 * px}" stroke-dasharray="${5 * px} ${3 * px}" pointer-events="none"/>`; }
    if (this.guide) out += `<path d="${this.guide}" stroke="#F5B041" stroke-width="${1 * px}" stroke-dasharray="${4 * px} ${3 * px}" fill="none" pointer-events="none"/>`;
    this.g.innerHTML = out;
    // devices as icons on top
    const seen = new Set();
    // devices on the same spot (two TVs on one wall) are spread a little so each can be picked and pressed
    const at = new Map(), spot = new Map();
    for (const d of f.devices) { const [sx, sy] = this.toScreen(d.x, d.y), k = `${Math.round(sx / 22)}:${Math.round(sy / 22)}`; (at.get(k) || at.set(k, []).get(k)).push(d); spot.set(d.id, [sx, sy]); }
    for (const list of at.values()) if (list.length > 1) list.forEach((d, i) => { const [sx, sy] = spot.get(d.id), a = -Math.PI / 2 + (i / list.length) * Math.PI * 2; spot.set(d.id, [sx + 18 * Math.cos(a), sy + 18 * Math.sin(a)]); });
    const hotNow = new Map((this.view?.engine.hot || []).map((h) => [h.id, h.state]));
    for (const d of f.devices) {
      seen.add(d.id);
      let el = this.devsEl.querySelector(`[data-dev="${esc(d.id)}"]`);
      if (!el) { el = document.createElement("div"); el.className = "dv"; el.dataset.dev = d.id; el.innerHTML = `<ra-icon></ra-icon>`; this.devsEl.appendChild(el); }
      const kind = d.kind || deviceKind(d.entity), [sx, sy] = spot.get(d.id), st = hotNow.get(d.id);
      el.classList.toggle("off", !!this.testing && !!st && !(st.on || st.open === true || (kind === "curtain" && st.open > 0.05)));
      el.style.left = `${sx}px`; el.style.top = `${sy}px`; el.style.transform = `translate(-50%,-50%) scale(${Math.max(0.6, Math.min(1, z / 45))})`; el.style.setProperty("--c", DEV_COL[kind] || "#8B6CFF");
      el.classList.toggle("sel", (s?.t === "dev" && s.id === d.id) || (s?.t === "multi" && s.list.some((x) => x.t === "dev" && x.id === d.id)));
      el.classList.toggle("lamp", kind === "light" && ["downlight", "focus", "track", "linear", "spots", "panel"].includes(d.look));
      el.querySelector("ra-icon").setAttribute("icon", kind === "light" ? (hasIcon(`light:${lightSub(d)}`) ? `light:${lightSub(d)}` : "dev:light") : `dev:${kind}`);
      el.title = d.name || "";
    }
    this.devsEl.querySelectorAll(".dv").forEach((el) => { if (!seen.has(el.dataset.dev)) el.remove(); });
    const hints = { select: "Drag a piece to move it. Drag on an empty spot to pick several. Right-drag or Space + drag moves the plan.", room: "Tap and drag on the plan to draw a room.", door: "Tap a wall to add it.", window: "Tap a wall to add it.", slider: "Tap a wall to add it.", arch: "Tap a wall to add it.", furniture: "Drag a piece onto the plan.", devices: "Drag a piece onto the plan." };
    const hint = this.root.querySelector(".hint"); hint.textContent = t(hints[this.tool] || ""); hint.style.display = hints[this.tool] && !(this.tool === "select" && s) ? "" : "none";
  }

  // ------------------------------------------------------------ touching the plan
  bindPlan() {
    const el = this.planEl, ptrs = new Map();
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("wheel", (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    // placing stairs: show where they would go as the pointer moves
    el.addEventListener("pointermove", (e) => {
      this._mouse = [e.clientX, e.clientY];
      if (this.tool === "room" && this.roomMode === "line" && this.line?.length && !this.drag) {
        this.lineHover = this.linePoint(this.toPlan(e.clientX, e.clientY), e.altKey).p;
        if (!this._hovRaf) this._hovRaf = requestAnimationFrame(() => { this._hovRaf = 0; this.draw(); });
        return;
      }
      if (this.tool !== "stairs" || !this.stairPick?.step || this.drag) return;
      this.stairHover = this.snapPt(this.toPlan(e.clientX, e.clientY));
      if (!this._hovRaf) this._hovRaf = requestAnimationFrame(() => { this._hovRaf = 0; this.draw(); });
    });
    el.addEventListener("pointerleave", () => (this._mouse = null));
    el.addEventListener("pointerdown", (e) => {
      // the plan's own buttons (zoom, ceiling, sizes, print) keep their taps: never start a drag from them
      if (e.composedPath().some((n) => n.tagName === "BUTTON" || n.classList?.contains("zoom"))) return;
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
    if (e.pointerType === "mouse" && (e.button === 1 || e.button === 2 || (this._space && e.button === 0))) { this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py }; return; }
    if (this.testing) { this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py, testDev: ds?.dataset.dev }; return; }
    if (this.tool === "stairs") { this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py, stairTap: this.stairPick?.step > 0 }; return; }
    // the drawing to trace over: moved by dragging, or two taps to set its size
    if (this.refMode === "move" && f.ref) { this.drag = { ...start, kind: "refmove", r0: [f.ref.x, f.ref.y] }; return; }
    if (this.refMode === "size" && f.ref) { this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py, refTap: true }; return; }
    // drawing with lines: a tap adds a corner (a drag still moves the plan)
    if (this.tool === "room" && this.roomMode === "line") { this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py, linePt: true }; return; }
    if (this.tool === "room") { this.drag = { ...start, kind: "draw" }; this.drawRect = [this.snapPt(P), this.snapPt(P)]; return; }
    // the tape measure: drag from one point to another (it snaps to walls and corners)
    if (this.tool === "measure") { const a = this.snapPt(P); this.measure = { a, b: [...a] }; this.drag = { ...start, kind: "measure" }; return; }
    if (this.tool === "note") { this.drag = { ...start, kind: "addnote" }; return; }
    if (["door", "window", "slider", "arch"].includes(this.tool)) { this.drag = { ...start, kind: "addop" }; return; }
    const nt = tgt.closest?.("[data-note]");
    if (nt) { const n = (f.notes || []).find((x) => x.id === nt.dataset.note); if (n) { this.drag = n.locked ? { ...start, kind: "locked" } : { ...start, kind: "note", obj: n, o0: clone(n) }; this.selectQuiet({ t: "note", id: n.id }); return; } }
    const aim = tgt.closest?.("[data-aim]");
    if (aim) { const d = f.devices.find((x) => x.id === aim.dataset.aim); this.drag = { ...start, kind: "aim", obj: d }; this.selectQuiet({ t: "dev", id: d.id }); return; }
    // several at once: Shift or Ctrl + tap (or "Select several" on a phone) adds or removes; dragging moves them all
    const hitItem = tgt.closest?.("[data-item]"), hitObj = ds ? { t: "dev", id: ds.dataset.dev } : hitItem ? { t: "item", id: hitItem.dataset.item } : null;
    if (hitObj && (e.shiftKey || e.ctrlKey || e.metaKey || this.picking)) {
      const list = this.sel?.t === "multi" ? this.sel.list : this.sel && (this.sel.t === "item" || this.sel.t === "dev") ? [this.sel] : [];
      const i = list.findIndex((x) => x.t === hitObj.t && x.id === hitObj.id);
      const next = i >= 0 ? list.filter((_, k) => k !== i) : [...list, hitObj];
      this.sel = next.length > 1 ? { t: "multi", list: next } : next[0] || null;
      this.drag = null; this.draw(); this.inspector(); return;
    }
    if (hitObj && this.sel?.t === "multi" && this.sel.list.some((x) => x.t === hitObj.t && x.id === hitObj.id)) {
      const objs = this.sel.list.map((x) => this.find(x)).filter((o) => o && !o.locked);
      this.drag = { ...start, kind: "group", objs: objs.map((o) => [o, o.x, o.y]) }; return;
    }
    if (ds) { const d = f.devices.find((x) => x.id === ds.dataset.dev); this.drag = d.locked ? { ...start, kind: "locked" } : { ...start, kind: "dev", obj: d, off: [d.x - P[0], d.y - P[1]] }; this.selectQuiet({ t: "dev", id: d.id }); return; }
    const a = tgt.closest?.("[data-v],[data-e],[data-rot],[data-op],[data-item],[data-room]");
    // locked: it can be picked (to see or unlock it) but not moved, turned or resized
    const lockedHit = a?.dataset.item ? f.items.find((x) => x.id === a.dataset.item) : a?.dataset.op ? f.openings.find((x) => x.id === a.dataset.op) : (a?.dataset.v != null || a?.dataset.e != null || a?.dataset.rot) ? this.find(this.sel) : null;
    if (lockedHit?.locked) { if (a.dataset.item) this.selectQuiet({ t: "item", id: lockedHit.id }); else if (a.dataset.op) this.selectQuiet({ t: "op", id: lockedHit.id }); this.drag = { ...start, kind: "locked" }; return; }
    if (a?.dataset.v != null) { const r = this.find(this.sel); this.drag = { ...start, kind: "vertex", room: r, i: +a.dataset.v, links: this.linked(r.pts[+a.dataset.v]) }; return; }
    if (a?.dataset.e != null) { const r = this.find(this.sel), i = +a.dataset.e, p = r.pts[i], q = r.pts[(i + 1) % r.pts.length]; this.drag = { ...start, kind: "edge", room: r, i, a0: [...p], b0: [...q], la: this.linked(p), lb: this.linked(q), ops: f.openings.filter((o) => this.onEdge([o.x, o.y], p, q)).map((o) => [o, o.x, o.y]) }; return; }
    if (a?.dataset.rot) { this.drag = { ...start, kind: "rot", obj: this.find(this.sel) }; return; }
    if (a?.dataset.op) { const o = f.openings.find((x) => x.id === a.dataset.op); this.drag = { ...start, kind: "op", obj: o }; this.selectQuiet({ t: "op", id: o.id }); return; }
    if (a?.dataset.item) { const it = f.items.find((x) => x.id === a.dataset.item); this.drag = { ...start, kind: "item", obj: it, off: [it.x - P[0], it.y - P[1]] }; this.selectQuiet({ t: "item", id: it.id }); return; }
    if (a?.dataset.room) {
      const r = f.rooms.find((x) => x.id === a.dataset.room);
      const was = this.sel?.t === "room" && this.sel.id === r.id && !r.locked;
      this.drag = was ? { ...start, kind: "room", room: r, pts0: clone(r.pts), items: f.items.filter((i) => inside([i.x, i.y], r.pts)).map((i) => [i, i.x, i.y]), devs: f.devices.filter((d) => inside([d.x, d.y], r.pts)).map((d) => [d, d.x, d.y]), ops: f.openings.filter((o) => r.pts.some((p, k) => this.onEdge([o.x, o.y], p, r.pts[(k + 1) % r.pts.length]))).map((o) => [o, o.x, o.y]) } : (this.boxable(e) ? { ...start, kind: "box", add: e.shiftKey || e.ctrlKey || e.metaKey, tapRoom: r } : { ...start, kind: "pan", px0: this.px, py0: this.py, tapRoom: r });
      return;
    }
    // with a mouse, dragging on an empty spot draws a box that picks everything inside it (Shift adds to what is
    // picked); the plan is moved with the right or middle button, the wheel, or Space + drag. Fingers move the plan.
    if (this.boxable(e)) { this.drag = { ...start, kind: "box", add: e.shiftKey || e.ctrlKey || e.metaKey, tapEmpty: true }; return; }
    this.drag = { ...start, kind: "pan", px0: this.px, py0: this.py, tapEmpty: true };
  }
  boxable(e) { return this.tool === "select" && !this.testing && e.pointerType === "mouse" && e.button === 0 && !this._space && !e.altKey; }
  selectQuiet(s) { const same = this.sel?.t === s.t && this.sel.id === s.id; this.sel = s; if (!same) this.inspector(); this.draw(); }
  move(e) {
    const d = this.drag, P = this.toPlan(e.clientX, e.clientY), f = this.floor;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    if (!d.moved) { d.moved = true; if (!["pan", "draw", "addop"].includes(d.kind)) { this.snapshot(); this._dragging = true; } }
    const dx = P[0] - d.P[0], dy = P[1] - d.P[1];
    this.guide = "";
    if (d.kind === "pan") { this._userView = true; this.px = d.px0 + e.clientX - d.x; this.py = d.py0 + e.clientY - d.y; this.g.setAttribute("transform", `translate(${this.px} ${this.py}) scale(${this.z})`); if (!this._panRaf) this._panRaf = requestAnimationFrame(() => { this._panRaf = 0; this.draw(); }); return; }
    if (d.kind === "draw") { this.drawRect[1] = this.snapPt(P); this.draw(); return; }
    if (d.kind === "refmove") { f.ref.x = round(d.r0[0] + P[0] - d.P[0], 3); f.ref.y = round(d.r0[1] + P[1] - d.P[1], 3); this.draw(); return; }
    if (d.kind === "measure") { let b = this.snapPt(P); if (e.shiftKey) { const a = this.measure.a; if (Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])) b = [b[0], a[1]]; else b = [a[0], b[1]]; } this.measure.b = b; this.draw(); this.measureOut(); return; }
    if (d.kind === "locked" || d.kind === "addnote") return;
    if (d.kind === "note") { const ox = snap(dx), oy = snap(dy), n = d.obj, o = d.o0; if (n.type === "dim") { n.a = [round(o.a[0] + ox, 3), round(o.a[1] + oy, 3)]; n.b = [round(o.b[0] + ox, 3), round(o.b[1] + oy, 3)]; } else { n.x = round(o.x + ox, 3); n.y = round(o.y + oy, 3); } this.draw(); return; }
    if (d.kind === "box") { this.boxRect = [d.P, P]; this.draw(); return; }
    if (d.kind === "group") { const ox = snap(dx), oy = snap(dy); for (const [o, x, y] of d.objs) { o.x = round(x + ox, 3); o.y = round(y + oy, 3); } return this.changed(); }
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
    if (d.kind === "aim") { d.obj.tx = round(P[0], 3); d.obj.ty = round(P[1], 3); return this.changed(); }
    if (d.kind === "dev") {
      let x = round(snap(P[0] + d.off[0]), 3), y = round(snap(P[1] + d.off[1]), 3);
      // lights line up with other lights and with the middle of their room (shown as guides)
      if ((d.obj.kind || deviceKind(d.obj.entity)) === "light") {
        const tol = 10 / this.z, others = f.devices.filter((o) => o !== d.obj && (o.kind || deviceKind(o.entity)) === "light");
        const room = f.rooms.find((r) => inside([x, y], r.pts)), rb = room && bounds(room.pts);
        const xs = [...others.map((o) => o.x), ...(rb ? [(rb.x0 + rb.x1) / 2] : [])], ys = [...others.map((o) => o.y), ...(rb ? [(rb.y0 + rb.y1) / 2] : [])];
        const bx = xs.reduce((m, v) => (Math.abs(v - x) < Math.abs(m - x) ? v : m), Infinity), by = ys.reduce((m, v) => (Math.abs(v - y) < Math.abs(m - y) ? v : m), Infinity);
        let g = "";
        if (Math.abs(bx - x) < tol) { x = round(bx, 3); g += `M${x} ${rb ? rb.y0 : y - 3}V${rb ? rb.y1 : y + 3}`; }
        if (Math.abs(by - y) < tol) { y = round(by, 3); g += `M${rb ? rb.x0 : x - 3} ${y}H${rb ? rb.x1 : x + 3}`; }
        // equal spacing: if two other lights sit on the same line, offer the spot that makes three even steps
        this.guide = g;
      }
      // a focus light keeps pointing at the same spot while it moves
      d.obj.x = x; d.obj.y = y; return this.changed();
    }
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
    if (d.kind === "refmove") { if (d.moved) { const to = [this.floor.ref.x, this.floor.ref.y]; this.floor.ref.x = d.r0[0]; this.floor.ref.y = d.r0[1]; this.snapshot(); this.floor.ref.x = to[0]; this.floor.ref.y = to[1]; this.changed(false); } return; }
    if (d.kind === "measure") { const m = this.measure; if (!d.moved || Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) < 0.02) this.measure = null; this.draw(); this.inspector(); return; }
    if (d.kind === "addnote") { this.snapshot(); const n = { id: uid("n"), type: "text", x: round(snap(d.P[0]), 3), y: round(snap(d.P[1]), 3), text: t("Note"), size: 0.22 }; (this.floor.notes ||= []).push(n); this.tool = "select"; this.drawNav(); this.sel = { t: "note", id: n.id }; this.changed(false); this.inspector(); setTimeout(() => { const i = this.aside.querySelector("textarea[data-k=text]"); i?.focus(); i?.select(); }, 30); return; }
    if (d.kind === "note") { if (d.moved) this.changed(false); return; }
    if (d.kind === "locked") { if (d.moved) this.toast(t("Locked: unlock it first")); return; }
    if (d.kind === "box" && d.moved) {
      const [a, b] = this.boxRect || [d.P, d.P]; this.boxRect = null;
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      const base = d.add ? (this.sel?.t === "multi" ? this.sel.list : this.sel && (this.sel.t === "item" || this.sel.t === "dev") ? [this.sel] : []) : [];
      this.selectMany((x) => x.o.x >= x0 && x.o.x <= x1 && x.o.y >= y0 && x.o.y <= y1, base);
      if (!this.sel) this.draw();
      return;
    }
    if (!d.moved) {
      // in walk-through, tapping a spot on the plan walks you there
      const eng = this.view?.engine, P = this.toPlan(e.clientX, e.clientY);
      if (eng?.view === "walk" && (d.tapRoom || d.tapEmpty) && eng.walkToPoint(P[0], P[1])) return;
      if (d.testDev) { this.view.toggle(d.testDev); setTimeout(() => this.draw(), 60); return; }
      if (d.linePt) return this.addLinePoint(d.P, e.altKey);
      if (d.refTap) return this.refSizeTap(d.P);
      if (this.testing) return;
      if (d.stairTap) return this.pickStair(this.snapPt(d.P));
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
      const sub = kind.startsWith("light:") ? kind.slice(6) : null; if (sub) kind = "light";
      const d = { id: uid("d"), kind, entity: "", x: round(snap(P[0]), 3), y: round(snap(P[1]), 3), name: t(KINDS[kind].name) };
      if (kind === "light") d.look = "flush";
      if (sub) {
        // every kind of fitting a lighting shop sells: [look, options, name]
        const SUB = LIGHT_SUBS[sub] || [sub, {}, LIGHT_LOOKS[sub] || "Light"];
        d.look = SUB[0]; Object.assign(d, clone(SUB[1])); d.name = t(SUB[2]);
        if (sub === "focus") this.aimAtWall(d);
      }
      if (kind === "light" && WALL_LOOKS.has(d.look)) { const nw = nearestWall(this.floor, P, 3); if (nw) { const nx = (P[0] - nw.q[0]) / (nw.d || 1), ny = (P[1] - nw.q[1]) / (nw.d || 1); d.rot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI); d.x = round(nw.q[0] + nx * (nw.w.thick / 2 + 0.005), 3); d.y = round(nw.q[1] + ny * (nw.w.thick / 2 + 0.005), 3); } }
      if (kind === "light" && d.look === "linear" && d.style === "washer") { const nw = nearestWall(this.floor, P, 3); if (nw) { const nx = (P[0] - nw.q[0]) / (nw.d || 1), ny = (P[1] - nw.q[1]) / (nw.d || 1); d.rot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI); d.x = round(nw.q[0] + nx * (nw.w.thick / 2 + 0.12), 3); d.y = round(nw.q[1] + ny * (nw.w.thick / 2 + 0.12), 3); } }
      if (kind === "ac" || kind === "radar") { const nw = nearestWall(this.floor, P, 3); if (nw) { const nx = (P[0] - nw.q[0]) / (nw.d || 1), ny = (P[1] - nw.q[1]) / (nw.d || 1); d.rot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI); d.x = round(nw.q[0] + nx * (nw.w.thick / 2 + (kind === "ac" ? 0.13 : 0.02)), 3); d.y = round(nw.q[1] + ny * (nw.w.thick / 2 + (kind === "ac" ? 0.13 : 0.02)), 3); } }
      if (kind === "curtain" || kind === "door") { const o = this.floor.openings.filter((o) => (kind === "door" ? o.type === "door" : o.type === "window" || o.type === "slider")).sort((a, b) => Math.hypot(a.x - P[0], a.y - P[1]) - Math.hypot(b.x - P[0], b.y - P[1]))[0]; if (o) { d.x = o.x; d.y = o.y; } }
      this.floor.devices.push(d); this.sel = { t: "dev", id: d.id };
    } else {
      const L = LIBRARY[kind], it = { id: uid("i"), kind, x: round(snap(P[0]), 3), y: round(snap(P[1]), 3), rot: 0 };
      if (kind === "stairs") it.h = this.floor.height || 2.8;
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
    if (this.testing) {
      a.innerHTML = `<h2><ra-icon icon="mdi:gesture-tap-button"></ra-icon>${t("Trying it out")}</h2><p class="tip">${t("Tap lights, TVs, ACs, fans, curtains and doors on the plan or in 3D to switch them. Devices without a working entity switch only here. Nothing in your home plan changes.")}</p><div class="row"><button class="primary" data-stoptest>${t("Back to editing")}</button></div>`;
      a.querySelector("[data-stoptest]").onclick = () => this.setTesting(false); return;
    }
    if (this.tool === "stairs") return this.stairPanel(a);
    if (this.tool === "measure") return this.measurePanel(a);
    if (this.tool === "note") { a.innerHTML = `<h2><ra-icon icon="mdi:note-text-outline"></ra-icon>${t("Note")}</h2><p class="tip">${t("Tap the plan where the note goes. Notes print with the plan.")}</p>`; return; }
    if (this.tool === "room") return this.roomToolPanel(a);
    if (["door", "window", "slider", "arch"].includes(this.tool)) { a.innerHTML = `<h2>${t(TOOLS.find((x) => x[0] === this.tool)[2])}</h2><p class="tip">${t("Tap a wall to add it.")}</p>`; return; }
    if (!obj) return this.homePanel(mode === "settings");
    if (s.t === "multi") return this.multiPanel();
    const head = (icon, title) => `<div class="row between"><h2><ra-icon icon="${icon}"></ra-icon>${esc(title)}</h2><button data-close title="${t("Close")}"><ra-icon icon="mdi:close"></ra-icon></button></div>`;
    // every slider also takes a typed number
    const slider = (key, label, min, max, step, val, unit = " m") => `<div class="sl"><span>${t(label)}</span><b class="nv"><input type="number" inputmode="decimal" data-num="${key}" min="${min}" step="${step}" value="${round(val, 2)}"><i>${unit.trim()}</i></b><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
    let h = "";
    const lockBtn = `<button data-lock class="${obj.locked ? "on" : ""}" title="${t(obj.locked ? "Allow moving" : "Lock in place")}"><ra-icon icon="${obj.locked ? "mdi:lock" : "mdi:lock-open-variant-outline"}"></ra-icon>${t(obj.locked ? "Locked in place" : "Lock in place")}</button>`;
    const swatches = (attr, list, cur) => `<div class="sw">${list.map(([k, title, style]) => `<button ${attr}="${esc(k)}" title="${esc(t(title))}" class="${cur === k ? "on" : ""}" style="${style}"></button>`).join("")}</div>`;
    const own = (this.plan.materials || []).map((m) => [`own:${m.id}`, m.name, `background:url(${m.thumb}) center/cover`]);
    if (s.t === "note") {
      h += head(obj.type === "dim" ? "mdi:ruler" : "mdi:note-text-outline", t(obj.type === "dim" ? "Dimension" : "Note"));
      if (obj.type === "dim") h += `<div class="card"><div class="row between"><span class="tip">${t("Length")}</span><b>${Math.hypot(obj.b[0] - obj.a[0], obj.b[1] - obj.a[1]).toFixed(2)} m</b></div></div>`;
      else h += `<div class="field"><h3>${t("Text")}</h3><textarea data-k="text" rows="3">${esc(obj.text || "")}</textarea></div>` + slider("size", "Text size", 0.1, 1, 0.02, obj.size || 0.22);
      h += `<div class="field"><h3>${t("Colour")}</h3><div class="sw">${["", "#6D4BFF", "#E5484D", "#2EC4B6", "#F5B041"].map((c) => `<button data-color="${c}" class="${(obj.color || "") === c ? "on" : ""}" style="background:${c || "var(--text)"}"></button>`).join("")}</div></div>`;
      h += `<div class="row">${lockBtn}<button class="danger" data-del><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "room") {
      const b = bounds(obj.pts), isRect = obj.pts.length === 4, type = ROOM_TYPES[obj.type] || ROOM_TYPES.other;
      h += head(type.icon, obj.name || t(type.name));
      h += `<div class="field"><h3>${t("Name")}</h3><input type="text" data-k="name" value="${esc(obj.name)}" placeholder="${esc(t(type.name))}"></div>`;
      h += `<div class="field"><h3>${t("Type")}</h3><div class="chips">${Object.entries(ROOM_TYPES).map(([k, v]) => `<button data-type="${k}" class="${obj.type === k ? "on" : ""}"><ra-icon icon="${v.icon}"></ra-icon>${t(v.name)}</button>`).join("")}</div></div>`;
      h += slider("rw", "Width", 0.5, 30, 0.05, round(b.x1 - b.x0, 2)) + slider("rd", "Length", 0.5, 30, 0.05, round(b.y1 - b.y0, 2));
      h += `<div class="field"><h3>${t("Floor")}</h3><div class="sw">${Object.entries(FLOORS).map(([k, v]) => `<button data-floor="${k}" title="${esc(v[0])}" class="${(obj.floor || type.floor) === k ? "on" : ""}" style="background-image:url(${floorThumb(k)})"></button>`).join("")}${own.map(([k, n, st]) => `<button data-floor="${esc(k)}" title="${esc(n)}" class="${obj.floor === k ? "on" : ""}" style="${st}"></button>`).join("")}</div></div>`;
      if (!type.outdoor) h += `<div class="field"><h3>${t("Walls")}</h3><div class="sw">${Object.entries(WALLS).map(([k, v]) => `<button data-wall="${k}" title="${esc(v[0])}" class="${(obj.wall || "warm-white") === k ? "on" : ""}" style="background:${v[1]}"></button>`).join("")}</div></div>`;
      if (!type.outdoor) {
        const fh = this.floor.height || 2.8, cs = obj.ceil?.style || "flat";
        h += slider("height", "Ceiling height", 2, fh, 0.05, Math.min(fh, obj.height || fh));
        h += `<div class="field"><h3>${t("Ceiling")}</h3><div class="chips">${[["flat", "Flat"], ["border", "Gypsum border"], ["tray", "Border with hidden light"]].map(([k, l]) => `<button data-ceil="${k}" class="${cs === k ? "on" : ""}">${t(l)}</button>`).join("")}<button data-tog="cornice" class="${obj.cornice ? "on" : ""}">${t("Cornice")}</button></div></div>`;
        if (cs !== "flat") h += slider("cw", "Border width", 0.2, 1.5, 0.05, obj.ceil?.w ?? 0.6) + slider("cd", "Drop", 0.1, 0.6, 0.01, obj.ceil?.drop ?? 0.25);
        h += `<div class="field"><h3>${t("Skirting")}</h3><div class="chips">${[["", "None"], ["#F7F5F1", "White"], ["#2A2A2E", "Black"], ["wood:oak", "Light oak"], ["wood:walnut", "Walnut"], ["floor", "Match the floor"]].map(([k, l]) => `<button data-skirt="${k}" class="${(obj.skirt || "") === k ? "on" : ""}">${t(l)}</button>`).join("")}</div></div>`;
        // a feature wall: pick one of the room's walls, then its finish
        h += `<div class="field"><h3>${t("Feature wall")}</h3><div class="chips">${obj.pts.map((p, i) => { const q = obj.pts[(i + 1) % obj.pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); return L < 0.3 ? "" : `<button data-edge="${i}" class="${this.edgePick === i ? "on" : ""}">${obj.walls?.[i] ? "● " : ""}${t("Wall")} ${i + 1} · ${L.toFixed(2)} m</button>`; }).join("")}</div>`;
        if (this.edgePick != null && obj.pts[this.edgePick]) {
          const cur = obj.walls?.[this.edgePick] || "";
          h += `<p class="tip">${t("The wall shown in yellow on the plan.")}</p>` + swatches("data-efin", [["", "Same as the room", "background:linear-gradient(135deg,var(--inset) 45%,var(--muted) 50%,var(--inset) 55%)"], ...Object.entries(WALLS).map(([k, v]) => [k, v[0], `background:${v[1]}`]), ...Object.entries(FEATURES).map(([k, v]) => [k, v[0], v[1] ? `background:url(${featureSwatch(k)}) center/cover` : k === "slats" ? "background:repeating-linear-gradient(90deg,#6A4630 0 5px,#3A2A22 5px 7px)" : "background:#F3EFE8;box-shadow:inset 0 0 0 4px #F3EFE8,inset 0 0 0 6px #C9C2B6"]), ...own], cur);
          if (cur === "slats") h += `<div class="chips">${Object.entries(WOODS).map(([k, v]) => `<button data-slatwood="${k}" class="${(obj.slatWood || "walnut") === k ? "on" : ""}">${t(v[0])}</button>`).join("")}</div>`;
        }
        h += `</div>`;
      }
      h += slider("gain", "Room brightness", 0.4, 2, 0.05, obj.gain || 1, "×");
      h += `<div class="row"><label><button data-match><ra-icon icon="mdi:camera-image"></ra-icon>${t("Match a photo of this room")}</button><input type="file" data-photo accept="image/*" hidden></label></div><span class="tip" data-match-out></span>`;
      h += `<div class="row">${lockBtn}<button data-dup><ra-icon icon="mdi:content-copy"></ra-icon>${t("Duplicate")}</button><button class="danger" data-del><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "op") {
      h += head(obj.type === "window" ? "mdi:window-closed-variant" : obj.type === "slider" ? "mdi:door-sliding" : obj.type === "arch" ? "mdi:gate-arrow-right" : "mdi:door", t(obj.type[0].toUpperCase() + obj.type.slice(1)));
      h += `<div class="seg">${["door", "window", "slider", "arch"].map((k) => `<button data-otype="${k}" class="${obj.type === k ? "on" : ""}">${t(k[0].toUpperCase() + k.slice(1))}</button>`).join("")}</div>`;
      h += slider("width", "Width", 0.4, 5, 0.05, obj.width) + slider("height", "Height", 0.4, 2.8, 0.05, obj.height);
      if (obj.type === "window") h += slider("sill", "Sill", 0, 1.8, 0.05, obj.sill);
      if (obj.type === "door") h += `<div class="row"><button data-flip><ra-icon icon="mdi:swap-vertical"></ra-icon>${t("Flip")}</button><button data-tog="double" class="${obj.double ? "on" : ""}"><ra-icon icon="mdi:door-open"></ra-icon>Double</button><button data-tog="main" class="${obj.main ? "on" : ""}"><ra-icon icon="mdi:home-import-outline"></ra-icon>Main</button></div>`;
      const tints = [["", "As it is"], ["#F7F5F1", "White"], ["#1E1F23", "Black"], ["#6B5B4B", "Bronze"], ["wood:oak", "Light oak"], ["wood:walnut", "Walnut"]];
      if (obj.type !== "arch") h += `<div class="field"><h3>${t("Frame")}</h3><div class="chips">${tints.map(([k, l]) => `<button data-frame="${k}" class="${(obj.frame || "") === k ? "on" : ""}">${t(l)}</button>`).join("")}</div></div>`;
      if (obj.type === "door") h += `<div class="field"><h3>${t("Door colour")}</h3><div class="chips">${[...tints, ["#8E2F2F", "Red"], ["#2F3E5C", "Navy"]].map(([k, l]) => `<button data-leaf="${k}" class="${(obj.leaf || "") === k ? "on" : ""}">${t(l)}</button>`).join("")}</div></div>`;
      h += `<div class="row">${lockBtn}<button class="danger" data-del><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "item" && obj.kind === "stairs") {
      const S = STAIR_STYLES[obj.style || "wood"] || STAIR_STYLES.wood, up = this.plan.floors[obj.link];
      h += head("mdi:stairs-up", t(S[0]));
      h += `<div class="pv" title="${esc(t("Drag to turn"))}"></div>`;
      h += `<p class="tip">${up ? `${t("Goes up to")} ${esc(up.name || "")}` : t("Not joined to a level above yet")}</p>`;
      h += `<div class="field"><h3>${t("Style")}</h3><div class="chips">${Object.entries(STAIR_STYLES).map(([k, x]) => `<button data-stairstyle="${k}" class="${(obj.style || "wood") === k ? "on" : ""}">${t(x[0])}</button>`).join("")}</div></div>`;
      h += slider("w", S[2] ? "Size across" : "Width", S[2] ? 1.2 : 0.7, S[2] ? 2.6 : 3, 0.05, obj.w || S[1]);
      h += `<div class="row"><button data-restair><ra-icon icon="mdi:stairs-up"></ra-icon>${t(up ? "Change where they arrive" : "Join to the level above")}</button></div>`;
      h += `<div class="field"><h3>${t("Rotate")}</h3><div class="row"><button data-rotby="-90"><ra-icon icon="mdi:rotate-left"></ra-icon></button><button data-rotby="-15">−15°</button><b>${obj.rot || 0}°</b><button data-rotby="15">+15°</button><button data-rotby="90"><ra-icon icon="mdi:rotate-right"></ra-icon></button></div></div>`;
      h += `<div class="row"><button class="danger" data-del><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "item") {
      const L = LIBRARY[obj.kind], d = dims(obj);
      h += head("mdi:sofa-outline", t(L?.[0] || obj.kind));
      h += `<div class="pv" title="${esc(t("Drag to turn"))}"></div>`;
      h += slider("w", "Width", 0.2, 6, 0.05, d.w) + slider("d", "Depth", 0.05, 4, 0.05, d.d) + slider("h", "Height", 0.05, 3, 0.05, d.h);
      if (d.mount === "wall") h += slider("z", "Sill", 0, 2.4, 0.05, d.z);
      h += `<div class="field"><h3>${t("Rotate")}</h3><div class="row"><button data-rotby="-90"><ra-icon icon="mdi:rotate-left"></ra-icon></button><button data-rotby="-15">−15°</button><b>${obj.rot || 0}°</b><button data-rotby="15">+15°</button><button data-rotby="90"><ra-icon icon="mdi:rotate-right"></ra-icon></button></div></div>`;
      const structural = ["column", "round_column", "beam"].includes(obj.kind);
      if (BACKED.has(obj.kind) || LIBRARY[obj.kind]?.[6] === "wall") h += `<div class="row"><button data-fit><ra-icon icon="mdi:arrow-expand-horizontal"></ra-icon>${t("Fit to the wall")}</button>${obj.kind === "fitted_wardrobe" ? `<button data-tog="toCeiling" data-inv="1" class="${obj.toCeiling !== false ? "on" : ""}"><ra-icon icon="mdi:arrow-expand-vertical"></ra-icon>${t("Up to the ceiling")}</button>` : ""}</div>`;
      h += `<div class="field"><h3>${t(structural ? "Colour" : "Fabric")}</h3><div class="sw">${(structural ? [["#ECE8E0", "#ECE8E0"], ["#F7F5F1", "#F7F5F1"], ["#9E9C98", "#9E9C98"], ["#4A4B50", "#4A4B50"]] : Object.entries(FABRICS)).map(([k, c]) => `<button data-color="${c}" title="${k}" class="${obj.color === c && !obj.mat ? "on" : ""}" style="background:${c}"></button>`).join("")}${structural ? "" : own.map(([k, n, st]) => `<button data-mat="${esc(k.slice(4))}" title="${esc(n)}" class="${obj.mat === k.slice(4) ? "on" : ""}" style="${st}"></button>`).join("")}</div></div>`;
      if (!structural) {
        h += `<div class="field"><h3>${t("Wood")}</h3><div class="sw">${[["", "As it is", "background:linear-gradient(135deg,var(--inset) 45%,var(--muted) 50%,var(--inset) 55%)"], ...Object.entries(WOODS).map(([k, v]) => [k, v[0], `background:${v[1]}`])].map(([k, l, st]) => `<button data-wood="${k}" title="${esc(t(l))}" class="${(obj.wood || "") === k ? "on" : ""}" style="${st}"></button>`).join("")}</div></div>`;
        h += `<div class="field"><h3>${t("Metal")}</h3><div class="sw">${[["", "As it is", "background:linear-gradient(135deg,var(--inset) 45%,var(--muted) 50%,var(--inset) 55%)"], ...Object.entries(METALS).map(([k, v]) => [k, v, `background:${k}`])].map(([k, l, st]) => `<button data-metal="${k}" title="${esc(t(l))}" class="${(obj.metal || "") === k ? "on" : ""}" style="${st}"></button>`).join("")}</div></div>`;
      }
      h += `<div class="field"><h3>${t("Pick")}</h3><div class="row"><button data-samekind><ra-icon icon="mdi:shape-outline"></ra-icon>${t("All like this")}</button><button data-sameroom><ra-icon icon="mdi:floor-plan"></ra-icon>${t("All in this room")}</button></div></div>`;
      h += `<div class="row"><button data-pick class="${this.picking ? "on" : ""}"><ra-icon icon="mdi:selection-multiple"></ra-icon>${t("Select several")}</button>${lockBtn}<button data-dup><ra-icon icon="mdi:content-copy"></ra-icon>${t("Duplicate")}</button><button class="danger" data-del><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    } else if (s.t === "dev") {
      const kind = obj.kind || deviceKind(obj.entity), K = KINDS[kind];
      h += head(K.icon, obj.name || t(K.name));
      h += `<div class="field"><h3>${t("Name")}</h3><input type="text" data-k="name" value="${esc(obj.name)}"></div>`;
      h += `<div class="field"><h3>${t("Entity")}</h3><select data-k="entity"><option value="">${t("Not linked")}</option>${Object.keys(this._hass.states).filter((e) => K.domains.includes(e.split(".")[0]) && (!K.pick || K.pick(e))).sort().map((e) => `<option value="${e}" ${obj.entity === e ? "selected" : ""}>${esc(this._hass.states[e].attributes.friendly_name || e)}</option>`).join("")}</select></div>`;
      if (kind === "light") h += `<div class="field"><h3>${t("Look")}</h3><div class="chips">${Object.entries(LIGHT_LOOKS).map(([k, v]) => `<button data-look="${k}" class="${(obj.look || "flush") === k ? "on" : ""}">${t(v)}</button>`).join("")}</div></div>` 
        + slider("lumens", obj.look === "track" ? "Light output (each head)" : obj.look === "linear" ? "Light output (per metre)" : "Light output", 100, 5000, 50, obj.lumens || LUMENS[obj.look || "flush"], " lm")
        + `<label class="sl"><span>${t("Warmth")}</span><b data-out="kelvin">${obj.kelvin || KELVIN[obj.look || "flush"]} K</b><input type="range" data-k="kelvin" min="2200" max="6500" step="100" value="${obj.kelvin || KELVIN[obj.look || "flush"]}" style="accent-color:${kelvinToHex(obj.kelvin || KELVIN[obj.look || "flush"])}"></label>`
        + this.lampFields(obj, slider)
        + (this.floor.rooms.some((r) => inside([obj.x, obj.y], r.pts)) ? `<div class="row"><button data-linkroom><ra-icon icon="mdi:link-variant"></ra-icon>${t(obj.entity ? "Same switch for every light in this room" : "Same on and off for every light in this room")}</button></div>` : "")
        + (obj.entity ? "" : `<div class="field"><h3>${t("Not smart: when is it on?")}</h3><div class="chips">${Object.entries(RULES).filter(([k]) => k !== "demo").map(([k, v]) => `<button data-rule="${k}" class="${(obj.rule || "on") === k ? "on" : ""}">${t(v)}</button>`).join("")}</div>${obj.rule === "schedule" ? `<div class="row"><input type="text" data-k="from" value="${esc(obj.from || "18:00")}" style="width:90px"> – <input type="text" data-k="to" value="${esc(obj.to || "23:00")}" style="width:90px"></div>` : ""}</div>`);
      if (kind === "ac") h += `<div class="field"><h3>${t("Rotate")}</h3><div class="row"><button data-rotby="-90"><ra-icon icon="mdi:rotate-left"></ra-icon></button><b>${obj.rot || 0}°</b><button data-rotby="90"><ra-icon icon="mdi:rotate-right"></ra-icon></button></div></div>`;
      if (kind === "radar") h += `<div class="field"><h3>${t("Facing")}</h3><div class="row"><button data-rotby="-15">−15°</button><b>${obj.rot || 0}°</b><button data-rotby="15">+15°</button><button data-rotby="180">${t("Turn round")}</button></div><p class="note">${t("The arrow on the plan shows where the sensor looks. Walk in front of it: if the person moves the wrong way, flip left and right.")}</p><div class="row"><button data-tog="flip" class="${obj.flip ? "on" : ""}"><ra-icon icon="mdi:swap-horizontal"></ra-icon>${t("Flip left and right")}</button></div></div>`;
      if (kind === "person" || kind === "radar") h += `<div class="field"><h3>${t("Colour")}</h3><div class="sw">${["#6D4BFF", "#4E8CFF", "#E86FB0", "#FF7A59", "#2EC4B6", "#F5B041"].map((c) => `<button data-color="${c}" class="${obj.color === c ? "on" : ""}" style="background:${c}"></button>`).join("")}</div></div>`;
      if (obj.group) { const n = this.floor.devices.filter((d) => d.group === obj.group).length; h += `<div class="field"><h3>${t("Switch together")}</h3><p class="tip">${t("In a group of")} ${n}</p><div class="row"><button data-selgroup><ra-icon icon="mdi:select-group"></ra-icon>${t("Pick the group")}</button><button data-ungroup="${esc(obj.group)}"><ra-icon icon="mdi:link-variant-off"></ra-icon>${t("Ungroup")}</button></div></div>`; }
      h += `<div class="field"><h3>${t("Pick")}</h3><div class="row"><button data-samekind><ra-icon icon="mdi:shape-outline"></ra-icon>${t("All like this")}</button><button data-sameroom><ra-icon icon="mdi:floor-plan"></ra-icon>${t("All in this room")}</button></div></div>`;
      h += `<div class="row"><button data-pick class="${this.picking ? "on" : ""}"><ra-icon icon="mdi:selection-multiple"></ra-icon>${t("Select several")}</button>${lockBtn}<button class="danger" data-del><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>`;
    }
    a.innerHTML = h;
    a.querySelector("[data-pick]")?.addEventListener("click", () => { this.picking = !this.picking; this.toast(t(this.picking ? "Tap more pieces to add them" : "Done selecting")); this.inspector(); });
    const pv = a.querySelector(".pv"); if (pv) (this.preview ||= new ItemPreview()).mount(pv, obj);
    a.querySelector("[data-samekind]")?.addEventListener("click", () => this.sameKind(obj));
    a.querySelector("[data-sameroom]")?.addEventListener("click", () => this.sameRoom(obj));
    a.querySelector("[data-selgroup]")?.addEventListener("click", () => this.selectMany((x) => x.t === "dev" && x.o.group === obj.group));
    a.querySelector("[data-ungroup]")?.addEventListener("click", (e) => this.ungroup(e.currentTarget.dataset.ungroup));
    this.bindInspector(obj, s);
  }
  bindInspector(obj, s) {
    const a = this.aside;
    const set = (fn, rebuild = true) => { if (!this._editing) { this.snapshot(); this._editing = true; } clearTimeout(this._edT); this._edT = setTimeout(() => (this._editing = false), 700); fn(); this.changed(rebuild, false, s.t === "item"); };
    a.querySelector("[data-close]")?.addEventListener("click", () => { this.edgePick = null; this.select(null); });
    a.querySelector("[data-del]")?.addEventListener("click", () => this.remove(s));
    a.querySelectorAll("input[type=text][data-k],textarea[data-k]").forEach((i) => i.addEventListener("input", () => { set(() => (obj[i.dataset.k] = i.value), false); if (s.t === "note") this.draw(); }));
    a.querySelector("[data-lock]")?.addEventListener("click", () => { this.snapshot(); obj.locked = !obj.locked; if (!obj.locked) delete obj.locked; this.changed(false); this.inspector(); });
    a.querySelectorAll("[data-ceil]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.ceil === "flat") delete obj.ceil; else obj.ceil = { w: 0.6, drop: 0.25, ...(obj.ceil || {}), style: b.dataset.ceil }; }); this.inspector(); }));
    a.querySelectorAll("[data-skirt]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.skirt) obj.skirt = b.dataset.skirt; else delete obj.skirt; }); this.inspector(); }));
    a.querySelectorAll("[data-edge]").forEach((b) => (b.onclick = () => { this.edgePick = this.edgePick === +b.dataset.edge ? null : +b.dataset.edge; this.draw(); this.inspector(); }));
    a.querySelectorAll("[data-efin]").forEach((b) => (b.onclick = () => { set(() => { obj.walls = { ...(obj.walls || {}) }; if (b.dataset.efin) obj.walls[this.edgePick] = b.dataset.efin; else delete obj.walls[this.edgePick]; if (!Object.keys(obj.walls).length) delete obj.walls; }); this.inspector(); }));
    a.querySelectorAll("[data-slatwood]").forEach((b) => (b.onclick = () => { set(() => (obj.slatWood = b.dataset.slatwood)); this.inspector(); }));
    a.querySelectorAll("[data-frame]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.frame) obj.frame = b.dataset.frame; else delete obj.frame; }); this.inspector(); }));
    a.querySelectorAll("[data-leaf]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.leaf) obj.leaf = b.dataset.leaf; else delete obj.leaf; }); this.inspector(); }));
    a.querySelectorAll("[data-wood]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.wood) obj.wood = b.dataset.wood; else delete obj.wood; }); this.inspector(); }));
    a.querySelectorAll("[data-metal]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.metal) obj.metal = b.dataset.metal; else delete obj.metal; }); this.inspector(); }));
    a.querySelectorAll("[data-mat]").forEach((b) => (b.onclick = () => { set(() => { obj.mat = obj.mat === b.dataset.mat ? undefined : b.dataset.mat; if (!obj.mat) delete obj.mat; }); this.inspector(); }));
    a.querySelector("[data-fit]")?.addEventListener("click", () => { if (!this.fitToWall(obj)) this.toast(t("Move it against a wall first")); else { this.changed(true, false, true); this.inspector(); } });
    a.querySelectorAll("select[data-k]").forEach((i) => i.addEventListener("change", () => set(() => { obj[i.dataset.k] = i.value; if (i.value && !obj.name) obj.name = this._hass.states[i.value]?.attributes.friendly_name || ""; })));
    a.querySelectorAll("input[data-num]").forEach((n) => n.addEventListener("change", () => {
      const r = a.querySelector(`input[type=range][data-k="${n.dataset.num}"]`), v = parseFloat(n.value);
      if (!r || !isFinite(v)) { n.value = r?.value ?? n.value; return; }
      const val = Math.max(parseFloat(r.min), v); if (val > parseFloat(r.max)) r.max = String(val);
      r.value = String(val); r.dispatchEvent(new Event("input")); n.value = String(round(parseFloat(r.value), 2));
    }));
    a.querySelectorAll("input[type=range]").forEach((i) => i.addEventListener("input", () => {
      const num = a.querySelector(`input[data-num="${i.dataset.k}"]`); if (num && num !== a.getRootNode().activeElement) num.value = String(round(parseFloat(i.value), 2));
      const k = i.dataset.k, v = parseFloat(i.value), out = a.querySelector(`[data-out="${k}"]`); if (out) out.textContent = `${round(v, 2)}${{ power: "×", lumens: " lm", kelvin: " K", gain: "×" }[k] ?? " m"}`;
      set(() => {
        if ((k === "rw" || k === "rd") && obj.pts.length !== 4) {
          // a room of any shape: stretched to the new width or length, its corners shared with neighbours move too
          const b = bounds(obj.pts), f0 = k === "rw" ? b.x1 - b.x0 : b.y1 - b.y0, f = v / Math.max(0.01, f0);
          for (const p of obj.pts) { const n = k === "rw" ? round(b.x0 + (p[0] - b.x0) * f, 3) : round(b.y0 + (p[1] - b.y0) * f, 3); for (const [r, j] of this.linked(p)) if (r !== obj) r.pts[j][k === "rw" ? 0 : 1] = n; p[k === "rw" ? 0 : 1] = n; }
        } else if (k === "rw" || k === "rd") { const b = bounds(obj.pts); for (const p of obj.pts) { if (k === "rw" && Math.abs(p[0] - b.x1) < 1e-3) { for (const [r, j] of this.linked(p)) if (r !== obj) r.pts[j][0] = round(b.x0 + v, 3); p[0] = round(b.x0 + v, 3); } if (k === "rd" && Math.abs(p[1] - b.y1) < 1e-3) { for (const [r, j] of this.linked(p)) if (r !== obj) r.pts[j][1] = round(b.y0 + v, 3); p[1] = round(b.y0 + v, 3); } } }
        else if ((k === "wl" || k === "wt") && obj.x != null) { const rm = this.floor.rooms.find((r) => inside([obj.x, obj.y], r.pts)); if (rm) { const b = bounds(rm.pts); if (k === "wl") obj.x = round(b.x0 + v, 3); else obj.y = round(b.y0 + v, 3); } }
        else if (k === "cw" || k === "cd") obj.ceil = { ...(obj.ceil || { style: "border" }), [k === "cw" ? "w" : "drop"]: v };
        else if (k === "height" && s.t === "room") { if (v >= (this.floor.height || 2.8) - 0.001) delete obj.height; else obj.height = v; }
        else { obj[k] = k === "heads" || k === "bars" ? Math.round(v) : v; if (obj.kind === "stairs" && k === "w" && STAIR_STYLES[obj.style]?.[2]) obj.d = v; }
      }, !LIVE_KEYS.has(k) && s.t !== "note");
      if (s.t === "note") this.draw();
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
    a.querySelectorAll("[data-tog]").forEach((b) => (b.onclick = () => { set(() => { const k = b.dataset.tog; if (b.dataset.inv) { if (obj[k] === false) delete obj[k]; else obj[k] = false; } else { obj[k] = !obj[k]; if (!obj[k]) delete obj[k]; } }); this.inspector(); }));
    // stairs: a new style keeps where they start and arrive; or pick again where they arrive
    a.querySelectorAll("[data-stairstyle]").forEach((b) => (b.onclick = () => {
      const [from, to] = this.stairEnds(obj), st = b.dataset.stairstyle, spec = stairFrom(from, to, st, obj.link != null && this.plan.floors[obj.link] ? riseTo(this.plan, this.fi) : obj.h || this.floor.height || 2.8);
      set(() => Object.assign(obj, { style: st, x: spec.x, y: spec.y, w: spec.w, d: spec.d, rot: spec.rot, h: spec.h })); this.inspector();
    }));
    a.querySelector("[data-restair]")?.addEventListener("click", () => { const from = this.stairEnds(obj)[0]; this.startStairs(obj.style || "wood", obj.id); this.pickStair(from); });
    a.querySelectorAll("[data-rotby]").forEach((b) => (b.onclick = () => { set(() => (obj.rot = (((obj.rot || 0) + +b.dataset.rotby) % 360 + 360) % 360)); this.inspector(); }));
    a.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.color) obj.color = b.dataset.color; else delete obj.color; delete obj.mat; }, s.t !== "note"); if (s.t === "note") this.draw(); this.inspector(); }));
    a.querySelectorAll("[data-rule]").forEach((b) => (b.onclick = () => { set(() => (obj.rule = b.dataset.rule), false); this.view.engine.updateDevices(true); this.inspector(); }));
    a.querySelectorAll("[data-look]").forEach((b) => (b.onclick = () => { set(() => { obj.look = b.dataset.look; if (obj.look === "focus" && obj.tx == null) this.aimAtWall(obj); }); this.inspector(); }));
    // one switch for many lights: every light in this room follows the same entity (or the same on/off rule)
    a.querySelector("[data-linkroom]")?.addEventListener("click", () => {
      const room = this.floor.rooms.find((r) => inside([obj.x, obj.y], r.pts)); if (!room) return;
      set(() => { for (const d of this.floor.devices) if (d !== obj && (d.kind || deviceKind(d.entity)) === "light" && inside([d.x, d.y], room.pts)) { d.entity = obj.entity || ""; d.rule = obj.rule; d.from = obj.from; d.to = obj.to; } }, false);
      this.view.engine.updateDevices(true); this.view.hass = this._hass; this.inspector();
    });
    a.querySelectorAll("[data-aimby]").forEach((b) => (b.onclick = () => { set(() => (obj.aim = ((((obj.aim ?? (obj.rot || 0) - 90) + +b.dataset.aimby) % 360) + 360) % 360)); this.inspector(); }));
    a.querySelectorAll("[data-style]").forEach((b) => (b.onclick = () => { set(() => { obj.style = b.dataset.style; if (obj.style === "slot" && !obj.len) obj.len = 2.4; }); this.inspector(); }));
    a.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => { set(() => { obj[b.dataset.opt] = b.dataset.val; if (b.dataset.opt === "style" && b.dataset.val === "slot" && !obj.len) obj.len = 2.4; }); this.inspector(); }));
    a.querySelectorAll("[data-heads]").forEach((b) => (b.onclick = () => { set(() => (obj.heads = +b.dataset.heads)); this.inspector(); }));
    a.querySelectorAll("[data-shape]").forEach((b) => (b.onclick = () => { set(() => (obj.shape = b.dataset.shape)); this.inspector(); }));
    a.querySelector("[data-grid]")?.addEventListener("click", () => {
      const rows = Math.max(1, Math.min(10, +a.querySelector("[data-rows]").value || 1)), cols = Math.max(1, Math.min(10, +a.querySelector("[data-cols]").value || 1));
      const room = this.floor.rooms.find((r) => inside([obj.x, obj.y], r.pts)); if (!room) return;
      this.snapshot(); const b = bounds(room.pts), keep = { ...obj };
      // an even grid: each light in the middle of its own equal part of the room
      this.floor.devices = this.floor.devices.filter((x) => x !== obj);
      let first = null;
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const c = { ...clone(keep), id: uid("d"), x: round(b.x0 + ((j + 0.5) * (b.x1 - b.x0)) / cols, 3), y: round(b.y0 + ((i + 0.5) * (b.y1 - b.y0)) / rows, 3) };
        if (c.look === "focus") { delete c.tx; delete c.ty; }
        if (inside([c.x, c.y], room.pts)) { this.floor.devices.push(c); first ||= c; }
      }
      this.sel = first ? { t: "dev", id: first.id } : null; this.changed(); this.inspector();
    });
    a.querySelector("[data-dup]")?.addEventListener("click", () => {
      this.snapshot(); const c = clone(obj); c.id = uid(s.t === "room" ? "r" : "i");
      if (s.t === "room") { const b = bounds(c.pts); c.pts = c.pts.map(([x, y]) => [x + (b.x1 - b.x0), y]); this.floor.rooms.push(c); } else { c.x += 0.3; c.y += 0.3; this.floor.items.push(c); }
      this.sel = { t: s.t, id: c.id }; this.changed(true, false, s.t === "item"); this.inspector();
    });
  }
  // the settings each kind of lamp needs, nothing more
  lampFields(obj, slider) {
    // a row of choices for one setting (style by default); the first is what an unset value means
    const styles = (list, dflt, key = "style") => `<div class="seg wrap">${list.map(([v, n]) => `<button data-opt="${key}" data-val="${v}" class="${(obj[key] || dflt) === v ? "on" : ""}">${t(n)}</button>`).join("")}</div>`;
    const look = obj.look || "flush", room = this.floor.rooms.find((r) => inside([obj.x, obj.y], r.pts)), b = room && bounds(room.pts);
    const rot = `<div class="field"><h3>${t("Turn")}</h3><div class="row"><button data-rotby="-90"><ra-icon icon="mdi:rotate-left"></ra-icon></button><button data-rotby="-15">−15°</button><b>${obj.rot || 0}°</b><button data-rotby="15">+15°</button><button data-rotby="90"><ra-icon icon="mdi:rotate-right"></ra-icon></button></div></div>`;
    let h = "";
    if (look === "track") {
      h += slider("len", "Length", 0.5, 6, 0.05, obj.len || 1.5) + slider("heads", "Heads", 1, 8, 1, obj.heads || 3, "") + slider("tilt", "Tilt", 0, 60, 1, obj.tilt ?? 25, "°") + rot;
      h += `<div class="field"><h3>${t("Point the heads")}</h3><div class="row"><button data-aimby="-45"><ra-icon icon="mdi:rotate-left"></ra-icon></button><button data-aimby="180"><ra-icon icon="mdi:swap-horizontal"></ra-icon></button><button data-aimby="45"><ra-icon icon="mdi:rotate-right"></ra-icon></button></div></div>`;
    }
    if (look === "linear") {
      h += styles([["strip", "Strip"], ["slot", "Magnetic slot"], ["cove", "Hidden cove"], ["profile", "Aluminium profile"], ["neon", "Neon flex"], ["pendant", "Hanging bar"], ["washer", "Wall washer"]], "strip");
      if (obj.style === "pendant") h += slider("drop", "Hangs down", 0.2, 1.6, 0.05, obj.drop ?? 0.7);
      h += slider("len", "Length", 0.3, 10, 0.05, obj.len || 1.2) + (obj.style === "slot" ? slider("bars", "Lit bars", 0, 12, 1, obj.bars ?? 3, "") : "") + rot;
    }
    if (look === "downlight") h += styles([["recessed", "Recessed"], ["deep", "Anti-glare"], ["square", "Square frame"], ["surface", "Surface can"]], "recessed");
    if (look === "wall") h += styles([["updown", "Up and down"], ["up", "Up"], ["down", "Down"], ["reading", "Reading arm"]], "updown") + slider("z", "Height", 0.3, 2.6, 0.05, obj.z ?? (obj.style === "reading" ? 1.1 : 1.8)) + rot;
    if (look === "table") h += styles([["table", "Table lamp"], ["desk", "Desk lamp"]], "table") + slider("z", "Table height", 0, 1.2, 0.05, obj.z ?? (obj.style === "desk" ? 0.75 : 0.55)) + rot;
    if (look === "step" || look === "flood") h += slider("z", "Height", 0.1, 4, 0.05, obj.z ?? (look === "step" ? 0.3 : 2.6)) + rot;
    if (look === "uplight") h += slider("tilt", "Lean", 0, 40, 1, obj.tilt ?? 10, "°") + rot;
    if (["wall", "table", "bollard", "step", "flood", "downlight", "track", "linear"].includes(look)) h += styles([["white", "White"], ["black", "Black"], ["gold", "Brass"]], "white", "finish");
    if (look === "downlight") h += `<div class="seg"><button data-heads="1" class="${obj.heads !== 2 ? "on" : ""}">${t("Single")}</button><button data-heads="2" class="${obj.heads === 2 ? "on" : ""}">${t("Twin")}</button></div>` + (obj.heads === 2 ? rot : "");
    if (look === "panel") h += `<div class="seg"><button data-shape="square" class="${obj.shape !== "round" ? "on" : ""}">${t("Square")}</button><button data-shape="round" class="${obj.shape === "round" ? "on" : ""}">${t("Round")}</button></div>` + slider("size", "Size", 0.15, 1.2, 0.05, obj.size || 0.3) + (obj.shape !== "round" ? rot : "");
    if (look === "pendant") h += styles([["dome", "Metal dome"], ["basket", "Woven basket"], ["bulb", "Filament bulb"], ["glass", "Glass globe"]], "dome");
    if (look === "chandelier") h += `<div class="seg"><button data-style="crystal" class="${obj.style !== "candle" ? "on" : ""}">${t("Crystal ring")}</button><button data-style="candle" class="${obj.style === "candle" ? "on" : ""}">${t("Candle arms")}</button></div>`;
    if (look === "focus") h += `<p class="tip">${t("Drag the small target on the plan onto the painting or wall it should light.")}</p>` + slider("tz", "Aim height", 0.2, 2.6, 0.05, obj.tz ?? 1.4);
    if (b) h += slider("wl", "From the left wall", 0, round(b.x1 - b.x0, 2), 0.01, round(obj.x - b.x0, 2)) + slider("wt", "From the top wall", 0, round(b.y1 - b.y0, 2), 0.01, round(obj.y - b.y0, 2));
    if (b && look !== "floor") h += `<div class="field"><h3>${t("Fill the room evenly")}</h3><div class="row"><input type="number" data-rows min="1" max="10" value="2" style="width:56px"> × <input type="number" data-cols min="1" max="10" value="3" style="width:56px"><button class="primary" data-grid><ra-icon icon="mdi:grid"></ra-icon>${t("Make the grid")}</button></div></div>`;
    return h;
  }
  aimAtWall(obj) { const nw = nearestWall(this.floor, [obj.x, obj.y], 4); if (nw) { obj.tx = round(nw.q[0], 3); obj.ty = round(nw.q[1], 3); obj.tz = obj.tz ?? 1.4; } }
  libSvg(kind) { const L = LIBRARY[kind], k = 50 / Math.max(L[3], L[4] * 1.4), w = L[3] * k, d = L[4] * k; return `<svg viewBox="-30 -22 60 44"><rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`; }
  library() {
    const a = this.aside, items = Object.entries(LIBRARY).filter(([k, L]) => L[1] === this.cat && k !== "stairs");
    a.innerHTML = `<h2><ra-icon icon="mdi:sofa-outline"></ra-icon>${t("Furniture")}</h2><div class="tabs">${CATEGORIES.map((c) => `<button data-cat="${c}" class="${this.cat === c ? "on" : ""}">${t(c)}</button>`).join("")}</div>
      <p class="tip">${t("Drag a piece onto the plan.")}</p><div class="lib icons">${items.map(([k, L]) => `<div class="tile" data-kind="${k}" data-tip="${esc(t(L[0]))} · ${L[3]} × ${L[4]} m" aria-label="${esc(t(L[0]))}" role="button"><ra-icon icon="item:${k}"></ra-icon></div>`).join("")}</div>`;
    a.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { this.cat = b.dataset.cat; this.library(); }));
    a.querySelectorAll(".tile[data-kind]").forEach((el) => this.dragNew(el, el.dataset.kind, false, LIBRARY[el.dataset.kind][0]));
    if (this.cat === "Building") {
      const lib = a.querySelector(".lib"); lib.insertAdjacentHTML("afterbegin", Object.entries(STAIR_STYLES).map(([k, S]) => `<div class="tile" data-stair="${k}" data-tip="${esc(t(S[0]))} · ${esc(t("Joins two levels"))}" aria-label="${esc(t(S[0]))}" role="button"><ra-icon icon="stair:${k}"></ra-icon></div>`).join(""));
      lib.querySelectorAll("[data-stair]").forEach((el) => (el.onclick = () => this.startStairs(el.dataset.stair)));
    }
  }
  deviceLibrary() {
    const a = this.aside;
    const tiles = (list) => `<div class="lib icons">${list.map((k) => `<div class="tile" data-kind="light:${k}" data-name="${LIGHT_SUBS[k][2]}" data-tip="${esc(t(LIGHT_SUBS[k][2]))}" aria-label="${esc(t(LIGHT_SUBS[k][2]))}" role="button"><ra-icon icon="light:${k}" style="color:#F5B041"></ra-icon></div>`).join("")}</div>`;
    a.innerHTML = `<h2><ra-icon icon="mdi:lightbulb-group-outline"></ra-icon>${t("Devices")}</h2><p class="tip">${t("Drag a piece onto the plan.")}</p>${LIGHT_GROUPS.map(([title, list]) => `<h3 class="sub">${t(title)}</h3>${tiles(list)}`).join("")}<h3 class="sub">${t("Devices")}</h3><div class="lib icons">${Object.entries(KINDS).filter(([k]) => k !== "lock").map(([k, K]) => `<div class="tile" data-kind="${k}" data-tip="${esc(t(K.name))}" aria-label="${esc(t(K.name))}" role="button"><ra-icon icon="dev:${k}" style="color:${DEV_COL[k]}"></ra-icon></div>`).join("")}</div>`;
    a.querySelectorAll(".tile").forEach((el) => this.dragNew(el, el.dataset.kind, true, el.dataset.name || KINDS[el.dataset.kind].name));
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
  // put Home Assistant's devices in their rooms (by area). auto: quietly, only when something new fits
  placeFromHA(auto = false) {
    const h = this._hass; if (!h?.areas || !this.floor?.rooms.length) return null;
    const st = (this.plan.settings ||= {}), here = new Set(this.plan.floors.flatMap((f) => f.devices.map((d) => d.entity)).filter(Boolean));
    // devices placed before and taken out by the person since: never put back
    // (also remembered outside the undo history, so undoing a placement doesn't bring it straight back)
    this._haSeen ||= new Set();
    const skip = new Set([...(st.haPlaced || []), ...(auto ? this._haSeen : [])].filter((e) => !here.has(e)));
    const r = autoPlace(h, this.floor, { chosen: (st.areaRooms ||= {})[this.fi] || {}, skip });
    if (!r.add.length && !r.link.length) { if (!auto) this.toast(t("Everything from Home Assistant is already in its room")); return r; }
    this.snapshot();
    for (const l of r.link) { const d = this.floor.devices.find((x) => x.id === l.id); if (d) d.entity = l.entity; }
    for (const d of r.add) {
      const { room, needsWindow, wantsScreen, ...dv } = d; void room; void needsWindow;
      if (dv.kind === "light" || dv.kind === "ac") { dv.name = dv.name || t(KINDS[dv.kind].name); }
      if (wantsScreen && !this.floor.items.some((i) => /^tv/.test(i.kind) && Math.hypot(i.x - dv.x, i.y - dv.y) < 1.5)) this.floor.items.push({ id: uid("i"), kind: "tv", x: dv.x, y: dv.y, rot: dv.rot || 0 });
      this.floor.devices.push(dv);
    }
    st.haPlaced = [...new Set([...(st.haPlaced || []), ...r.add.map((d) => d.entity), ...r.link.map((l) => l.entity)])];
    for (const e of st.haPlaced) this._haSeen.add(e);
    this.changed();
    const rooms = new Set(r.add.map((d) => d.room)).size || 1;
    this.toast(`${t("Placed from Home Assistant")}: ${r.add.length + r.link.length} · ${rooms} ${t(rooms === 1 ? "room" : "rooms")}`);
    return r;
  }
  homePanel(settings) {
    const a = this.aside, p = this.plan, f = this.floor, st = p.settings;
    const total = f.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor).reduce((s, r) => s + Math.abs(area(r.pts)), 0);
    a.innerHTML = `<h2><ra-icon icon="mdi:home-outline"></ra-icon>${esc(p.name)}</h2>
      <div class="card"><div class="row between"><span class="tip">${t("Rooms")}</span><b>${f.rooms.length}</b></div><div class="row between"><span class="tip">m²</span><b>${round(total, 1)}</b></div><div class="row between"><span class="tip">${t("Furniture")}</span><b>${f.items.length}</b></div><div class="row between"><span class="tip">${t("Devices")}</span><b>${f.devices.length}</b></div></div>
      <div class="field"><h3>${t("Name")}</h3><input type="text" data-name value="${esc(p.name)}"></div>
      <div class="field"><h3>${t("Walls")}</h3><div class="seg"><button data-walls="cut" class="${st.walls !== "full" ? "on" : ""}">${t("Cut walls")}</button><button data-walls="full" class="${st.walls === "full" ? "on" : ""}">${t("Full walls")}</button></div></div>
      ${p.floors.length > 1 ? `<div class="row"><button data-levels class="${st.levels ? "on" : ""}"><ra-icon icon="mdi:layers-outline"></ra-icon>${t("Show the levels below in 3D")}</button></div>` : ""}
      <label class="sl"><span>${t("Height")}</span><b data-out="fh">${f.height} m</b><input type="range" data-fh min="2.4" max="4.5" step="0.05" value="${f.height}"></label>
      <label class="sl"><span>${t("North")}</span><b data-out="north">${p.north || 0}°</b><input type="range" data-north min="0" max="359" step="1" value="${p.north || 0}"></label>
      <label class="sl"><span>${t("Overall brightness")}</span><b data-out="ex">${round(st.exposure || 1, 2)}×</b><input type="range" data-ex min="0.5" max="2" step="0.05" value="${st.exposure || 1}"></label>
      <label class="sl"><span>${t("Lamp glow")}</span><b data-out="mood">${round(st.mood || 1, 2)}×</b><input type="range" data-mood min="0.5" max="2" step="0.05" value="${st.mood || 1}"></label>
      <div class="row between"><span>${t("Real sun")}</span><button data-sun class="${st.sun !== false ? "on" : ""}"><ra-icon icon="mdi:white-balance-sunny"></ra-icon></button></div>
      <div class="row between"><span>${t("Real sky")}</span><button data-hdr class="${st.hdr !== false ? "on" : ""}"><ra-icon icon="mdi:weather-partly-cloudy"></ra-icon></button></div>
      <div class="field"><h3>${t("Time of day")}</h3><div class="chips">${[["", "Now"], ["morning", "Morning"], ["noon", "Noon"], ["golden", "Golden hour"], ["night", "Night"]].map(([k, l]) => `<button data-time="${k}" class="${(st.time || "") === k ? "on" : ""}">${t(l)}</button>`).join("")}</div></div>
      <div class="field"><h3>${t("Quality")}</h3><div class="seg">${["auto", "low", "medium", "high"].map((q) => `<button data-q="${q}" class="${(st.quality || "auto") === q ? "on" : ""}">${t(q[0].toUpperCase() + q.slice(1))}</button>`).join("")}</div></div>
      <div class="field"><h3>${t("Language")}</h3><select data-lang>${LANGS.map(([k, l]) => `<option value="${k}" ${savedLang() === k ? "selected" : ""}>${k === "auto" ? t("Auto") : l}</option>`).join("")}</select></div>
      <div class="field"><h3>${t("Level")}</h3><input type="text" data-fname value="${esc(f.name)}">${p.floors.length > 1 ? `<div class="row"><button class="danger" data-delfloor><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")}</button></div>` : ""}</div>
      <div class="field"><h3>${t("Devices from Home Assistant")}</h3><p class="tip">${t("Each device goes into the room with the same name as its area in Home Assistant. New ones are placed by themselves.")}</p><div class="row"><button class="primary" data-ha-place><ra-icon icon="mdi:home-import-outline"></ra-icon>${t("Place them now")}</button></div><div data-ha-areas></div></div>
      <div class="field"><h3>${t("Outside the windows")}</h3><div data-outside></div></div>
      <div class="field"><h3>${t("Your materials")}</h3><div data-own></div></div>
      <div class="field"><h3>${t("Room photos")}</h3><div class="shots" data-shots><span class="tip">${t("Made when you press Make dashboard pictures")}</span></div></div>
      <div class="field"><h3>${t("Dashboard pictures")}</h3><p class="tip">${t("Pictures of the whole floor and every room in 360°, for the Roost Home Tour card in Roost Cards. Make them again after changing the home. Made on this computer; it takes a few minutes per room.")}</p><div class="row"><button class="primary" data-publish ${this.view.engine.baked ? "" : "disabled"}><ra-icon icon="mdi:image-multiple-outline"></ra-icon>${t("Make dashboard pictures")}</button><button data-preview><ra-icon icon="mdi:eye-outline"></ra-icon>${t("Preview")}</button></div>${this.view.engine.baked ? "" : `<span class="tip">${t("Waiting for the light to be ready")}</span>`}<div class="shots" data-panos></div></div>
      <p class="tip">${t("Drag to move. Pull a corner or a wall to resize.")}</p>`;
    this.drawShots(a.querySelector("[data-shots]"));
    this.ownPanel(a.querySelector("[data-own]"));
    this.outsidePanel(a.querySelector("[data-outside]"));
    this.drawAreas(a.querySelector("[data-ha-areas]"));
    a.querySelector("[data-ha-place]")?.addEventListener("click", () => { this.placeFromHA(false); this.drawAreas(a.querySelector("[data-ha-areas]")); });
    this.drawPanos(a.querySelector("[data-panos]"));
    a.querySelector("[data-publish]")?.addEventListener("click", () => this.photographer.publish());
    a.querySelector("[data-preview]")?.addEventListener("click", () => this.showPano(null, null));
    const set = (fn, rebuild = true) => { this.snapshot(); fn(); this.changed(rebuild); };
    a.querySelector("[data-fname]").addEventListener("change", (e) => set(() => { f.name = e.target.value || f.name; this.drawFloors(); }, false));
    a.querySelector("[data-delfloor]")?.addEventListener("click", () => this.removeFloor());
    a.querySelector("[data-name]").addEventListener("change", (e) => set(() => { p.name = e.target.value || p.name; this.root.querySelector("h1").textContent = p.name; }, false));
    a.querySelectorAll("[data-walls]").forEach((b) => (b.onclick = () => { set(() => (st.walls = b.dataset.walls)); this.homePanel(); }));
    a.querySelector("[data-levels]")?.addEventListener("click", () => { set(() => (st.levels = !st.levels)); this.homePanel(); });
    a.querySelector("[data-fh]").addEventListener("change", (e) => set(() => (f.height = +e.target.value)));
    a.querySelector("[data-fh]").addEventListener("input", (e) => (a.querySelector('[data-out="fh"]').textContent = `${e.target.value} m`));
    a.querySelector("[data-ex]").addEventListener("input", (e) => { a.querySelector('[data-out="ex"]').textContent = `${e.target.value}×`; st.exposure = +e.target.value; this.view.engine.request(false); });
    a.querySelector("[data-ex]").addEventListener("change", () => this.changed(false));
    a.querySelector("[data-mood]").addEventListener("input", (e) => { a.querySelector('[data-out="mood"]').textContent = `${e.target.value}×`; st.mood = +e.target.value; this.view.engine.request(false); });
    a.querySelector("[data-mood]").addEventListener("change", () => this.changed(false));
    a.querySelector("[data-north]").addEventListener("input", (e) => { a.querySelector('[data-out="north"]').textContent = `${e.target.value}°`; p.north = +e.target.value; this.view.engine.fitSun(); });
    a.querySelector("[data-north]").addEventListener("change", () => this.changed(false));
    a.querySelector("[data-lang]").onchange = async (e) => { saveLang(e.target.value); try { await this.save(true); } catch {} location.reload(); };
    a.querySelector("[data-hdr]").onclick = () => { set(() => { if (st.hdr === false) delete st.hdr; else st.hdr = false; }, false); this.view.engine.dirty = true; this.view.engine.request(true); this.homePanel(); };
    a.querySelectorAll("[data-time]").forEach((b) => (b.onclick = () => { set(() => { if (b.dataset.time) st.time = b.dataset.time; else delete st.time; }, false); this.view.engine.fitSun(); this.view.engine.request(true); this.homePanel(); }));
    a.querySelector("[data-sun]").onclick = () => { set(() => (st.sun = st.sun === false)); this.homePanel(); this.view.hass = this._hass; this.view._sun = undefined; this.view.hass = this._hass; };
    a.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { set(() => (st.quality = b.dataset.q), false); this.homePanel(); }));
  }
  // areas with devices but no room of the same name: pick a room for each (or leave it out)
  drawAreas(el) {
    const h = this._hass; if (!el || !h?.areas) return;
    const st = (this.plan.settings ||= {}), mine = ((st.areaRooms ||= {})[this.fi] ||= {});
    const r = autoPlace(h, this.floor, { chosen: mine }), list = [...r.unmatched, ...Object.entries(mine).filter(([id]) => h.areas[id]).map(([id]) => ({ id, name: h.areas[id].name, chosen: true }))];
    if (!list.length) { el.innerHTML = ""; return; }
    const rooms = this.floor.rooms;
    el.innerHTML = `<p class="tip">${t("These areas have devices but no room with the same name. Choose a room:")}</p>` + list.map((u) => `<div class="row between"><span>${esc(u.name)}${u.count ? ` <small class="tip">${u.count}</small>` : ""}</span><select data-area="${esc(u.id)}"><option value="">${t("Leave out")}</option>${rooms.map((x) => `<option value="${esc(x.id)}" ${mine[u.id] === x.id ? "selected" : ""}>${esc(x.name || t(ROOM_TYPES[x.type]?.name || "Room"))}</option>`).join("")}</select></div>`).join("");
    el.querySelectorAll("[data-area]").forEach((sel) => (sel.onchange = () => { mine[sel.dataset.area] = sel.value; this.changed(false); this.placeFromHA(false); this.drawAreas(el); }));
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
      if (rid !== "all" && !room) continue;
      const k = `${p.key}@${p.updated}`;
      if (!this._shotUrls.has(k)) { const r = await this._hass.fetchWithAuth(`/api/roost_atelier/photo/${p.key}`); if (!r.ok) continue; this._shotUrls.set(k, URL.createObjectURL(await r.blob())); }
      const b = document.createElement("button"); b.className = "shot"; b.innerHTML = `<img src="${this._shotUrls.get(k)}" alt=""><span>${esc(rid === "all" ? t("Whole floor") : room?.name || t(ROOM_TYPES[room?.type]?.name || "Room"))}</span>`;
      b.onclick = () => { const d = document.createElement("div"); d.className = "dialog"; d.innerHTML = `<img src="${this._shotUrls.get(k)}" style="max-width:94vw;max-height:88vh;border-radius:16px">`; d.onclick = () => d.remove(); this.root.querySelector(".ed").appendChild(d); };
      el.appendChild(b);
    }
  }
  async drawPanos(el) {
    if (!this.plan?.id || !el) return;
    let list = [];
    try { list = await ws(this._hass, { type: "roost_atelier/photos", plan_id: this.plan.id }); } catch { return; }
    const pre = `${this.plan.id}_${this.fi}_pano_`;
    this._shotUrls ||= new Map();
    for (const p of list.filter((x) => x.key.startsWith(pre))) {
      const room = this.floor.rooms.find((r) => r.id === p.key.slice(pre.length)); if (!room) continue;
      const k = `${p.key}@${p.updated}`;
      if (!this._shotUrls.has(k)) { const r = await this._hass.fetchWithAuth(`/api/roost_atelier/photo/${p.key}`); if (!r.ok) continue; this._shotUrls.set(k, URL.createObjectURL(await r.blob())); }
      const b = document.createElement("button"); b.className = "shot"; b.innerHTML = `<img src="${this._shotUrls.get(k)}" alt=""><span>${esc(room.name || t(ROOM_TYPES[room.type]?.name || "Room"))}</span>`;
      b.onclick = () => this.showPano(this._shotUrls.get(k), room.id);
      el.appendChild(b);
    }
  }
  // the dashboard card as it will look, in a window: Roost Cards' own Roost Home Tour card when Roost Cards is
  // installed (the whole floor, or straight into one room), otherwise the Atelier's own picture viewer
  async showPano(url, roomId) {
    void url;
    const d = document.createElement("div"); d.className = "dialog";
    d.innerHTML = `<div style="width:min(96vw,1100px);display:flex;flex-direction:column;gap:10px"><div class="row" style="justify-content:space-between;align-items:center"><b>${t("How the Roost Home Tour card will look")}</b><button data-x style="background:var(--panel)"><ra-icon icon="mdi:close"></ra-icon></button></div><div style="height:min(76vh,620px);border-radius:22px;overflow:hidden;position:relative;background:#0B0D17" data-host></div><span class="tip" data-note></span></div>`;
    this.root.querySelector(".ed").appendChild(d);
    const host = d.querySelector("[data-host]");
    let close = () => d.remove();
    d.onclick = (e) => { if (e.target === d) close(); };
    d.querySelector("[data-x]").onclick = () => close();
    if (await this.roostCards()) {
      const card = document.createElement("roost-tour");
      card.setConfig({ plan: this.plan.id, floor: this.fi, room: roomId || "", height: Math.max(320, host.clientHeight || 560) });
      card.style.cssText = "display:block;height:100%"; host.appendChild(card); card.hass = this._hass;
      this._tourCard = card; close = () => { this._tourCard = null; d.remove(); };
      return;
    }
    d.querySelector("[data-note]").textContent = t("Install Roost Cards to see the Roost Home Tour card itself. This is a simple preview of the pictures.");
    const { StillViewer, STILL_CSS, photoFetcher } = await import("./still.js");
    host.insertAdjacentHTML("beforebegin", `<style>${STILL_CSS}</style>`);
    const v = new StillViewer(host, { plan: this.plan, floorIndex: this.fi, room: roomId, photo: photoFetcher(() => this._hass, this.plan.id, this.fi), onMoreInfo: (e) => this.panelEl.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: e }, bubbles: true, composed: true })) });
    v.hass = this._hass;
    close = () => { v.dispose(); d.remove(); };
  }
  // Roost Cards on this page: already loaded by a dashboard, or loaded from Home Assistant's dashboard resources
  async roostCards() {
    if (customElements.get("roost-tour")) return true;
    try {
      const res = await this._hass.callWS({ type: "lovelace/resources" });
      const r = res.find((x) => /roost-cards?\.js/i.test(x.url)); if (!r) return false;
      await import(/* @vite-ignore */ new URL(r.url, location.origin).href);
      await Promise.race([customElements.whenDefined("roost-tour"), new Promise((ok) => setTimeout(ok, 4000))]);
    } catch (e) { return false; }
    return !!customElements.get("roost-tour");
  }
  checkPanel() {
    const a = this.aside, issues = check(this.plan, this.floor);
    a.innerHTML = `<h2><ra-icon icon="mdi:check-decagram-outline"></ra-icon>${t("Check the home")}</h2>${issues.length ? issues.map((i, n) => `<div class="issue" data-n="${n}"><ra-icon icon="mdi:alert-circle-outline"></ra-icon><div>${esc(i.text)}${i.fix ? `<div class="row" style="margin-top:6px"><button class="primary" data-fix="${n}">${esc(i.fixLabel || "Fix")}</button></div>` : ""}</div></div>`).join("") : `<div class="issue ok"><ra-icon icon="mdi:check-circle-outline"></ra-icon><div>${t("Looks good")}</div></div>`}`;
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
    m.innerHTML = `${plans.length ? `<h3>${t("Homes")}</h3><div class="list">${plans.map((p) => `<button data-open="${esc(p.id)}" class="${p.id === this.plan?.id ? "on" : ""}"><ra-icon icon="mdi:home-outline"></ra-icon><span>${esc(p.name)}<small>${p.rooms ?? ""} ${t("Rooms").toLowerCase()}</small></span></button>`).join("")}</div>` : ""}
      <h3>${t("New home")} · ${t("Start from")}</h3><div class="list"><button data-new="blank"><ra-icon icon="mdi:vector-square"></ra-icon><span>${t("Blank")}</span></button>${SAMPLES.map((s) => `<button data-new="${esc(s.id)}"><ra-icon icon="mdi:floor-plan"></ra-icon><span>${esc(s.name)}<small>${s.size}</small></span></button>`).join("")}<button data-new="import"><ra-icon icon="mdi:file-image-plus-outline"></ra-icon><span>${t("From CAD or PDF")}<small>DXF · PDF · JPG · PNG</small></span></button></div>
      <h3>${t("Backups")}</h3><div class="list"><button data-x="export"><ra-icon icon="mdi:file-download-outline"></ra-icon><span>${t("Save to a file")}<small>${t("A copy of this home on this device")}</small></span></button><button data-x="import"><ra-icon icon="mdi:file-upload-outline"></ra-icon><span>${t("Load from a file")}</span></button>${this.plan?.id ? `<button data-x="versions"><ra-icon icon="mdi:history"></ra-icon><span>${t("Earlier versions")}</span></button>` : ""}<button data-x="deleted"><ra-icon icon="mdi:delete-restore"></ra-icon><span>${t("Deleted homes")}</span></button></div>
      ${this.plan?.id ? `<div class="row"><button class="danger" data-delhome><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Delete")} “${esc(this.plan.name)}”</button></div>` : ""}`;
    this.root.querySelector(".ed").appendChild(m);
    const close = (e) => { if (!m.contains(e.target) && !e.composedPath().includes(this.root.querySelector(".homes"))) { m.remove(); this.root.removeEventListener("pointerdown", close, true); } };
    setTimeout(() => this.root.addEventListener("pointerdown", close, true));
    m.querySelectorAll("[data-open]").forEach((b) => (b.onclick = async () => { m.remove(); await this.open(b.dataset.open); }));
    m.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { const x = b.dataset.x; if (x === "export") { m.remove(); this.exportFile(); } else if (x === "import") { m.remove(); this.importFile(); } else if (x === "versions") this.versionsMenu(); else this.deletedMenu(); }));
    m.querySelectorAll("[data-new]").forEach((b) => (b.onclick = () => {
      m.remove(); const k = b.dataset.new;
      if (k === "import") { const p = newPlan(t("New home")); this.load(p, true); this.setTool("import"); return; }
      const p = k === "blank" ? newPlan(t("New home")) : SAMPLES.find((s) => s.id === k).make();
      this.load(p, true);
      if (k === "blank") this.setTool("room");
    }));
    m.querySelector("[data-delhome]")?.addEventListener("click", () => this.confirm(`${t("Delete")} “${this.plan.name}”? ${t("It can be brought back from Deleted homes.")}`, async () => {
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
    else if (this.line && e.key === "Escape") { this.line = null; this.lineHover = null; this.draw(); this.inspector(); }
    else if (this.line && e.key === "Enter") { e.preventDefault(); this.finishLine(false); }
    else if (this.line && e.key === "Backspace") { e.preventDefault(); this.undoLinePoint(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && this.sel) this.remove(this.sel);
    else if (e.key === "Escape") { this.picking = false; this.measure = null; this.edgePick = null; this.select(null); }
    // Ctrl+A: every device on this level; Ctrl+Shift+A: every device and piece of furniture
    else if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && !this.testing) { e.preventDefault(); this.selectMany((x) => x.t === "dev" || (e.shiftKey && x.t === "item")); }
    // Ctrl+C / Ctrl+X / Ctrl+V: copy, cut and paste devices and furniture (also onto another level)
    else if ((e.ctrlKey || e.metaKey) && /^[cC]$/.test(e.key) && !this.testing) { if (this.copySel()) e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && /^[xX]$/.test(e.key) && !this.testing) { if (this.copySel()) { e.preventDefault(); this.remove(this.sel); this.toast(t("Cut")); } }
    else if ((e.ctrlKey || e.metaKey) && /^[vV]$/.test(e.key) && !this.testing) { if (this.clip?.length) { e.preventDefault(); this.paste(); } }
    else if (e.key === " " && !e.repeat) this._space = true;
  }
  // ------------------------------------------------------------ a drawing to trace over
  // when a CAD drawing, PDF or picture is not read well, it can lie under the plan as a guide: set its size (two taps
  // on a length you know), move it into place, draw the walls over it with Line, then remove it.
  refUrl(file) {
    const c = (this._refUrls ||= new Map());
    if (!c.has(file)) {
      c.set(file, null);
      this.view.engine.fileSource?.(file).then((b) => { if (b) { c.set(file, URL.createObjectURL(b)); this.draw(); } });
    }
    return c.get(file);
  }
  async setReference(img, width) {
    const v = await this.uploadPicture(img, 4096), f = this.floor, b = f.rooms.length ? planBounds(f) : null;
    const w = width || (b ? Math.max(8, b.x1 - b.x0) : 15);
    this.snapshot();
    f.ref = { file: v.file, aspect: v.aspect, w: round(w, 3), x: b ? b.x0 : 0, y: b ? b.y0 : 0, opacity: 0.6 };
    this._refUrls?.delete(v.file);
    this.changed(false);
    this.roomMode = "line"; this.setTool("room"); this.fitRef();
    this.toast(t("Set its size first: tap two ends of a length you know"));
    this.refMode = "size"; this.refCal = []; this.inspector();
  }
  fitRef() {
    const r = this.floor.ref; if (!r) return;
    const W = this.planEl.clientWidth, H = this.planEl.clientHeight, h = r.w / r.aspect, z = Math.min(400, Math.max(8, Math.min(W / (r.w * 1.1), H / (h * 1.1))));
    this.z = z; this.px = (W - r.w * z) / 2 - r.x * z; this.py = (H - h * z) / 2 - r.y * z; this._userView = true; this.draw();
  }
  refSizeTap(P) {
    (this.refCal ||= []).push(P); if (this.refCal.length > 2) this.refCal = [P];
    this.draw(); this.inspector();
  }
  refPanel(el) {
    const r = this.floor.ref, mode = this.refMode || "", cal = this.refCal || [];
    const L = cal.length === 2 ? Math.hypot(cal[1][0] - cal[0][0], cal[1][1] - cal[0][1]) : 0;
    el.innerHTML = `<h3>${t("Drawing to trace over")}</h3>
      <div class="seg"><button data-rm="size" class="${mode === "size" ? "on" : ""}"><ra-icon icon="mdi:ruler"></ra-icon>${t("Set its size")}</button><button data-rm="move" class="${mode === "move" ? "on" : ""}"><ra-icon icon="mdi:cursor-move"></ra-icon>${t("Move it")}</button><button data-rm="" class="${!mode ? "on" : ""}"><ra-icon icon="mdi:vector-polyline"></ra-icon>${t("Draw")}</button></div>
      ${mode === "size" ? (L ? `<div class="field"><span class="tip">${t("How long is it really? (metres)")}</span><div class="row"><input type="number" inputmode="decimal" step="0.01" min="0.1" data-reallen value="${round(L, 2)}"><button class="primary" data-setlen><ra-icon icon="mdi:check"></ra-icon>${t("Done")}</button></div></div>` : `<p class="tip">${t("Tap the two ends of a wall or a dimension on the drawing whose length you know.")}</p>`) : mode === "move" ? `<p class="tip">${t("Drag the drawing onto the walls already drawn.")}</p>` : ""}
      <label class="sl"><span>${t("See-through")}</span><b data-out="rop">${Math.round((r.opacity ?? 0.6) * 100)}%</b><input type="range" data-rop min="0.1" max="1" step="0.05" value="${r.opacity ?? 0.6}"></label>
      <div class="row"><button data-rfit><ra-icon icon="mdi:fit-to-screen-outline"></ra-icon>${t("Show all of it")}</button><button class="danger" data-rdel><ra-icon icon="mdi:delete-outline"></ra-icon>${t("Remove the drawing")}</button></div>`;
    el.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { this.refMode = b.dataset.rm; this.refCal = []; this.draw(); this.inspector(); }));
    el.querySelector("[data-rop]").oninput = (e) => { r.opacity = +e.target.value; el.querySelector('[data-out="rop"]').textContent = `${Math.round(r.opacity * 100)}%`; this.draw(); };
    el.querySelector("[data-rop]").onchange = () => this.changed(false);
    el.querySelector("[data-rfit]").onclick = () => this.fitRef();
    el.querySelector("[data-rdel]").onclick = () => { this.snapshot(); delete this.floor.ref; this.refMode = ""; this.refCal = []; this.changed(false); this.inspector(); this.toast(t("Deleted")); };
    el.querySelector("[data-setlen]")?.addEventListener("click", () => {
      const real = parseFloat(el.querySelector("[data-reallen]").value); if (!(real > 0) || !L) return;
      // grow or shrink the drawing round the first tap, so that tap stays put
      const k = real / L, a = cal[0];
      this.snapshot(); r.x = round(a[0] - (a[0] - r.x) * k, 3); r.y = round(a[1] - (a[1] - r.y) * k, 3); r.w = round(r.w * k, 3);
      this.refCal = []; this.refMode = this.floor.rooms.length ? "move" : ""; this.changed(false); this.fitRef(); this.inspector();
      this.toast(this.refMode === "move" ? t("Now drag it onto the walls already drawn") : t("Now draw the walls over it with Line"));
    });
  }
  // ------------------------------------------------------------ drawing with lines
  // two ways to draw: a rectangle (drag), or a line of walls (tap corner by corner). Every space a line closes
  // becomes an area that can be named: a line across a room cuts it in two, a line from a wall out and back closes
  // a new area, a line back to its start is an area of its own.
  roomToolPanel(a) {
    const mode = this.roomMode || "rect", n = this.line?.length || 0;
    a.innerHTML = `<h2><ra-icon icon="mdi:vector-square-plus"></ra-icon>${t("Rooms")}</h2>
      <div class="chips">${[["rect", "mdi:vector-square", "Rectangle"], ["line", "mdi:vector-polyline", "Line"]].map(([k, i, l]) => `<button data-rmode="${k}" class="${mode === k ? "on" : ""}"><ra-icon icon="${i}"></ra-icon>${t(l)}</button>`).join("")}</div>
      <p class="tip">${t(mode === "rect" ? "Tap and drag on the plan to draw a room." : "Tap the plan corner by corner to draw walls. Every space the line closes becomes an area: a line across a room cuts it in two. It snaps to walls and straight angles; hold Alt for any angle.")}</p>
      ${mode === "line" && n ? `<div class="row"><button class="primary" data-lfin ${n < 2 ? "disabled" : ""}><ra-icon icon="mdi:check"></ra-icon>${t("Finish")}</button><button data-lback><ra-icon icon="mdi:undo"></ra-icon>${t("Remove last corner")}</button><button data-lcancel><ra-icon icon="mdi:close"></ra-icon>${t("Cancel")}</button></div>` : ""}`;
    if (this.floor.ref) { const box = document.createElement("div"); box.className = "field"; a.appendChild(box); this.refPanel(box); }
    a.querySelectorAll("[data-rmode]").forEach((b) => (b.onclick = () => { this.roomMode = b.dataset.rmode; try { localStorage.setItem("roost-atelier-room-mode", this.roomMode); } catch {} this.line = null; this.lineHover = null; this.draw(); this.inspector(); }));
    a.querySelector("[data-lfin]")?.addEventListener("click", () => this.finishLine(false));
    a.querySelector("[data-lback]")?.addEventListener("click", () => this.undoLinePoint());
    a.querySelector("[data-lcancel]")?.addEventListener("click", () => { this.line = null; this.lineHover = null; this.draw(); this.inspector(); });
  }
  // where a tap lands: on the grid and corners, along straight angles from the last corner, and right onto a wall
  linePoint(P, free) {
    const f = this.floor, reach = 14 / this.z, line = this.line || [], prev = line[line.length - 1];
    let c = this.snapPt(P), straight = false;
    if (prev && !free) {
      const dx = c[0] - prev[0], dy = c[1] - prev[1], L = Math.hypot(dx, dy);
      if (L > 1e-6) {
        const ang = Math.atan2(dy, dx), step = Math.PI / 4, k = Math.round(ang / step) * step;
        if (Math.abs(ang - k) < 0.14) { c = [round(prev[0] + Math.cos(k) * L, 3), round(prev[1] + Math.sin(k) * L, 3)]; straight = true; }
      }
    }
    // back to the first corner: the line closes
    if (line.length >= 3 && Math.hypot(c[0] - line[0][0], c[1] - line[0][1]) < reach) return { p: [...line[0]], close: true };
    const w = onWall(f.rooms, c, reach);
    if (w) {
      const m = straight && prev ? meet(prev, c, w.a, w.b) : null;
      c = m && Math.hypot(m[0] - c[0], m[1] - c[1]) < reach * 2 ? m : w.p;
      return { p: [round(c[0], 4), round(c[1], 4)], wall: true };
    }
    return { p: c };
  }
  addLinePoint(P, free) {
    const pt = this.linePoint(P, free), line = (this.line ||= []);
    if (pt.close) return this.finishLine(true);
    const last = line[line.length - 1];
    // tapping the last corner again finishes the line
    if (last && Math.hypot(pt.p[0] - last[0], pt.p[1] - last[1]) < 0.02) { if (line.length >= 2) this.finishLine(false); return; }
    line.push(pt.p); this.lineHover = null;
    // landing on a wall closes a space: done
    if (pt.wall && line.length >= 2 && drawLine(this.floor.rooms, line, false, () => "x").made.length) return this.finishLine(false);
    this.draw(); this.inspector();
  }
  undoLinePoint() { if (!this.line) return; this.line.pop(); if (!this.line.length) this.line = null; this.lineHover = null; this.draw(); this.inspector(); }
  finishLine(closed) {
    const line = this.line; this.line = null; this.lineHover = null;
    if (!line || line.length < 2) { this.draw(); this.inspector(); return; }
    const res = drawLine(this.floor.rooms, line, closed, () => uid("r"));
    if (!res.made.length) { this.toast(t("The line does not close a space: end it on a wall or back at its start")); this.draw(); this.inspector(); return; }
    this.snapshot(); this.floor.rooms = res.rooms;
    this.tool = "select"; this.drawNav();
    this.sel = { t: "room", id: res.made[0] }; this.changed(); this.inspector();
    this.toast(`${res.made.length + res.split.length} ${t(res.made.length + res.split.length === 1 ? "area" : "areas")}: ${t("tap one to give it a name")}`);
  }
  lineSvg(px) {
    const L = this.line, pts = [...L, ...(this.lineHover ? [this.lineHover] : [])];
    let o = `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--acc2)" stroke-width="${3 * px}" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>`;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.3) continue;
      o += `<text x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2 - 6 * px}" font-size="${12 * px}" font-weight="600" text-anchor="middle" fill="var(--text)" pointer-events="none">${len.toFixed(2)} m</text>`;
    }
    L.forEach((p, i) => (o += `<circle cx="${p[0]}" cy="${p[1]}" r="${(i === 0 ? 6 : 4) * px}" fill="${i === 0 ? "var(--acc2)" : "var(--surface, #fff)"}" stroke="var(--acc2)" stroke-width="${2 * px}" pointer-events="none"/>`));
    return o;
  }
  // ------------------------------------------------------------ measuring
  measureOut() { const o = this.aside.querySelector("[data-mlen]"), m = this.measure; if (o && m) o.textContent = `${Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]).toFixed(2)} m`; }
  measurePanel(a) {
    const m = this.measure, L = m ? Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) : 0;
    a.innerHTML = `<h2><ra-icon icon="mdi:tape-measure"></ra-icon>${t("Measure")}</h2><p class="tip">${t("Drag between any two points. It snaps to walls and corners; hold Shift for a straight line.")}</p>
      <div class="card"><div class="row between"><span class="tip">${t("Length")}</span><b data-mlen style="font-size:20px">${L ? `${L.toFixed(2)} m` : "–"}</b></div></div>
      ${m ? `<div class="row"><button class="primary" data-keepdim><ra-icon icon="mdi:ruler"></ra-icon>${t("Keep it on the plan")}</button><button data-clearm><ra-icon icon="mdi:close"></ra-icon>${t("Clear")}</button></div>` : ""}`;
    a.querySelector("[data-keepdim]")?.addEventListener("click", () => { this.snapshot(); const n = { id: uid("n"), type: "dim", a: [...m.a], b: [...m.b] }; (this.floor.notes ||= []).push(n); this.measure = null; this.changed(false); this.select({ t: "note", id: n.id }); });
    a.querySelector("[data-clearm]")?.addEventListener("click", () => { this.measure = null; this.draw(); this.inspector(); });
  }
  // a piece made to fit: as wide as the wall it stands against (between the corners), flat against it, facing the room
  fitToWall(it) {
    const f = this.floor, d = dims(it), room = f.rooms.find((r) => inside([it.x, it.y], r.pts)); if (!room) return false;
    const a = ((it.rot || 0) * Math.PI) / 180, back = [it.x - Math.sin(a) * (d.d / 2), it.y - Math.cos(a) * (d.d / 2)];
    let best = null;
    room.pts.forEach((p, i) => { const q = room.pts[(i + 1) % room.pts.length], ex = q[0] - p[0], ey = q[1] - p[1], L2 = ex * ex + ey * ey, k = ((back[0] - p[0]) * ex + (back[1] - p[1]) * ey) / L2; if (k < -0.05 || k > 1.05) return; const dist = Math.abs(ex * (back[1] - p[1]) - ey * (back[0] - p[0])) / Math.sqrt(L2); if (!best || dist < best.dist) best = { p, q, dist }; });
    if (!best || best.dist > 0.8) return false;
    const { p, q } = best, L = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    let nx = -uy, ny = ux; if (!inside([mx + nx * 0.3, my + ny * 0.3], room.pts)) { nx = -nx; ny = -ny; }
    const th = nearestWall(f, [mx, my], 0.4)?.w.thick ?? 0.15, ends = th; // half a wall at each corner
    this.snapshot();
    it.w = round(Math.max(0.3, L - ends), 3);
    it.rot = (Math.round((Math.atan2(nx, ny) * 180) / Math.PI) + 360) % 360;
    const off = th / 2 + d.d / 2 + (LIBRARY[it.kind]?.[6] === "wall" ? 0 : 0.005);
    it.x = round(mx + nx * off, 3); it.y = round(my + ny * off, 3);
    return true;
  }
  // ------------------------------------------------------------ outside the windows: trees, or a picture on each side
  outsidePanel(el) {
    const st = (this.plan.settings ||= {}), out = st.outside || {}, mode = out.mode === "pictures" ? "pictures" : "trees", views = out.views || {};
    const SIDES = [["top", "Top of the plan", "mdi:arrow-up"], ["right", "Right of the plan", "mdi:arrow-right"], ["bottom", "Bottom of the plan", "mdi:arrow-down"], ["left", "Left of the plan", "mdi:arrow-left"]];
    el.innerHTML = `<div class="seg"><button data-omode="trees" class="${mode === "trees" ? "on" : ""}">${t("Garden trees")}</button><button data-omode="pictures" class="${mode === "pictures" ? "on" : ""}">${t("Pictures")}</button></div>
      ${mode === "pictures" ? `<p class="tip">${t("A photo of the view for each side of the home: it is seen through the windows on that side, in 3D and in the dashboard pictures. A wide photo taken from a window works best.")}</p>
      ${SIDES.map(([k, l, i]) => { const v = views[k]; return `<div class="row between"><span class="row"><ra-icon icon="${i}"></ra-icon>${v?.thumb ? `<i style="width:44px;height:28px;border-radius:6px;background:url(${v.thumb}) center/cover;display:inline-block"></i>` : ""}${t(l)}</span><span class="row"><label><button data-vpick="${k}"><ra-icon icon="mdi:image-plus-outline"></ra-icon>${t(v ? "Change" : "Choose picture")}</button><input type="file" data-vfile="${k}" accept="image/*" hidden></label>${v ? `<button data-vdel="${k}" title="${t("Delete")}"><ra-icon icon="mdi:delete-outline"></ra-icon></button>` : ""}</span></div>`; }).join("")}` : ""}`;
    const save = (fn) => { this.snapshot(); fn(); this.changed(true); this.outsidePanel(el); };
    el.querySelectorAll("[data-omode]").forEach((b) => (b.onclick = () => save(() => { st.outside = { ...out, mode: b.dataset.omode }; if (b.dataset.omode === "trees" && !Object.keys(views).length) delete st.outside; })));
    el.querySelectorAll("[data-vpick]").forEach((b) => (b.onclick = () => el.querySelector(`[data-vfile="${b.dataset.vpick}"]`).click()));
    el.querySelectorAll("[data-vfile]").forEach((inp) => (inp.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; this.toast(t("Saving"));
      try { const v = await this.uploadPicture(f, 2560); save(() => { st.outside = { mode: "pictures", views: { ...views, [inp.dataset.vfile]: v } }; }); this.toast(t("Added")); }
      catch { this.toast(t("Not saved")); }
    }));
    el.querySelectorAll("[data-vdel]").forEach((b) => (b.onclick = () => save(() => { const v = { ...views }; delete v[b.dataset.vdel]; st.outside = { mode: "pictures", views: v }; })));
  }
  // a photo sent to Home Assistant (made smaller first): its file name, a small preview and its shape
  async uploadPicture(file, max) {
    const img = file instanceof Blob ? await createImageBitmap(file) : file, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88)), th = document.createElement("canvas"); th.width = 66; th.height = 42; th.getContext("2d").drawImage(img, 0, 0, 66, 42);
    const fd = new FormData(); fd.append("file", blob, "view.jpg");
    const r = await this._hass.fetchWithAuth("/api/roost_atelier/upload", { method: "POST", body: fd }); if (!r.ok) throw new Error(await r.text());
    const { file: name } = await r.json();
    return { file: name, thumb: th.toDataURL("image/jpeg", 0.7), aspect: round(img.width / img.height, 3) };
  }
  // ------------------------------------------------------------ your own materials (photos of tiles, wood, fabric)
  async addOwnMaterial(file) {
    const img = await createImageBitmap(file), k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88)), th = document.createElement("canvas"); th.width = th.height = 48; th.getContext("2d").drawImage(img, 0, 0, 48, 48);
    const fd = new FormData(); fd.append("file", blob, "material.jpg");
    const r = await this._hass.fetchWithAuth("/api/roost_atelier/upload", { method: "POST", body: fd }); if (!r.ok) throw new Error(await r.text());
    const { file: name } = await r.json();
    this.snapshot();
    const m = { id: name.split(".")[0], file: name, name: file.name.replace(/\.[^.]+$/, "").slice(0, 30) || t("My material"), size: 0.6, thumb: th.toDataURL("image/jpeg", 0.7) };
    (this.plan.materials ||= []).push(m); setOwnMaterials(this.plan.materials); this.changed(false);
    return m;
  }
  ownPanel(el) {
    const list = this.plan.materials || [];
    el.innerHTML = `${list.map((m) => `<div class="row between"><span class="row"><i style="width:28px;height:28px;border-radius:6px;background:url(${m.thumb}) center/cover;display:inline-block"></i>${esc(m.name)}</span><b class="nv"><input type="number" inputmode="decimal" data-msize="${esc(m.id)}" min="0.1" step="0.05" value="${m.size}"><i>m</i></b><button data-mdel="${esc(m.id)}" title="${t("Delete")}"><ra-icon icon="mdi:delete-outline"></ra-icon></button></div>`).join("")}
      <p class="tip">${t("A photo of a tile, wood, stone or fabric from your supplier. Set how many metres one photo covers. Then pick it for floors, feature walls or furniture.")}</p>
      <div class="row"><label><button data-addmat><ra-icon icon="mdi:image-plus-outline"></ra-icon>${t("Add a material")}</button><input type="file" data-matfile accept="image/*" hidden></label></div>`;
    el.querySelector("[data-addmat]").onclick = () => el.querySelector("[data-matfile]").click();
    el.querySelector("[data-matfile]").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; this.toast(t("Saving")); try { await this.addOwnMaterial(f); this.toast(t("Added")); } catch (err) { this.toast(t("Not saved")); } this.ownPanel(el); };
    el.querySelectorAll("[data-msize]").forEach((i) => (i.onchange = () => { const m = list.find((x) => x.id === i.dataset.msize), v = parseFloat(i.value); if (!m || !(v > 0)) return; this.snapshot(); m.size = round(v, 2); setOwnMaterials(this.plan.materials); this.changed(true); }));
    el.querySelectorAll("[data-mdel]").forEach((b) => (b.onclick = () => this.confirm(t("Delete this material?"), () => { this.snapshot(); this.plan.materials = list.filter((x) => x.id !== b.dataset.mdel); this.changed(true); this.ownPanel(el); })));
  }
  // the picked devices and furniture, kept to paste (rooms, doors and stairs stay where they are)
  copySel() {
    const s = this.sel, f = this.floor; if (!s) return false;
    const list = s.t === "multi" ? s.list : [s], out = [];
    for (const x of list) {
      const o = x.t === "dev" ? f.devices.find((d) => d.id === x.id) : x.t === "item" ? f.items.find((i) => i.id === x.id && i.kind !== "stairs") : null;
      if (o) out.push({ t: x.t, o: clone(o) });
    }
    if (!out.length) return false;
    this.clip = out; this.toast(`${out.length} ${t("copied")}`); return true;
  }
  // pasted under the pointer when it is on the plan, otherwise a little to the side of the originals
  paste() {
    const f = this.floor, cx = this.clip.reduce((a, c) => a + c.o.x, 0) / this.clip.length, cy = this.clip.reduce((a, c) => a + c.o.y, 0) / this.clip.length;
    let dx = 0.5, dy = 0.5;
    if (this._mouse) { const [px, py] = this.toPlan(...this._mouse); dx = snap(px) - cx; dy = snap(py) - cy; }
    this.snapshot(); const next = [];
    for (const { t: k, o } of this.clip) {
      const c = { ...clone(o), id: uid(k === "item" ? "i" : "d"), x: round(o.x + dx, 3), y: round(o.y + dy, 3) };
      if (k === "dev") delete c.group;
      (k === "item" ? f.items : f.devices).push(c); next.push({ t: k, id: c.id });
    }
    this.sel = next.length > 1 ? { t: "multi", list: next } : next[0]; this.tool = "select";
    this.changed(); this.drawNav(); this.inspector(); this.toast(t("Pasted"));
  }
  // every device or piece on this level that passes a test, as one selection
  selectMany(test, base = []) {
    const all = [...this.floor.devices.map((d) => ({ t: "dev", id: d.id, o: d })), ...this.floor.items.filter((i) => i.kind !== "stairs").map((i) => ({ t: "item", id: i.id, o: i }))];
    const list = [...base]; for (const x of all) if (test(x) && !list.some((y) => y.t === x.t && y.id === x.id)) list.push({ t: x.t, id: x.id });
    this.sel = list.length > 1 ? { t: "multi", list } : list[0] || null; this.tool = "select"; this.drawNav(); this.draw(); this.inspector();
    if (list.length) this.toast(`${list.length} ${t("selected")}`);
  }
  // quick ways to pick: everything of the same kind, everything in the same room, everything not picked
  sameKind(o) { const isDev = this.floor.devices.includes(o), k = o.kind || "light"; this.selectMany((x) => (x.t === "dev") === isDev && (x.o.kind || (isDev ? "light" : "")) === k); }
  sameRoom(o) { const r = this.floor.rooms.find((rm) => inside([o.x, o.y], rm.pts)); if (r) this.selectMany((x) => inside([x.o.x, x.o.y], r.pts)); }
  invertSel() { const cur = this.sel?.t === "multi" ? this.sel.list : this.sel ? [this.sel] : []; this.selectMany((x) => !cur.some((y) => y.t === x.t && y.id === x.id)); }
  // devices put in a group switch together (tap one, they all go on or off)
  groupDevices(list) { this.snapshot(); const g = uid("g"); for (const d of list) d.group = g; this.changed(false); this.inspector(); this.toast(t("Grouped: switching one switches them all")); }
  ungroup(g) { this.snapshot(); for (const d of this.floor.devices) if (d.group === g) delete d.group; this.changed(false); this.inspector(); }
}
