// The live 3D home with tappable devices on top. Used by the dashboard card and by the Atelier itself.
import { AtelierEngine } from "./engine.js";
import { KINDS, tapAction } from "./devices.js";
import { t, isRtl } from "./i18n.js";

const COLORS = { light: "#F5B041", ac: "#2EC4B6", curtain: "#4E8CFF", tv: "#8B6CFF", door: "#FF7A59", lock: "#FF7A59", fan: "#2EC4B6", person: "#E86FB0", speaker: "#8B6CFF", vacuum: "#5FBF77", sensor: "#7C86B8" };

export const VIEW_CSS = `
.av{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:radial-gradient(120% 90% at 50% 10%,var(--av-sky1,#1a2050),var(--av-sky2,#0B0D17));transition:background .6s}
.av.day{--av-sky1:#f4efe6;--av-sky2:#dfe6f2}
.av canvas{position:absolute;inset:0}
.av .hot{position:absolute;inset:0;pointer-events:none}
.av .hs{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:3px;transition:opacity .12s;-webkit-tap-highlight-color:transparent}
.av .hs.hide{opacity:0;pointer-events:none}
.av .hs button{all:unset;cursor:pointer;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(20,24,49,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.16);box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .12s,background .12s}
.av .hs button:active{transform:scale(.9)}
.av .hs.on button{background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 70%,#fff));border-color:transparent;box-shadow:0 0 18px color-mix(in srgb,var(--c) 70%,transparent)}
.av .hs ha-icon{--mdc-icon-size:18px}
.av .hs span{font:600 10px/1.2 Inter,var(--paper-font-body1_-_font-family,sans-serif);color:#fff;background:rgba(11,13,23,.55);padding:2px 6px;border-radius:8px;white-space:nowrap}
.av .hs span:empty{display:none}
.av .bar{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:8px;justify-content:center;pointer-events:none}
.av .bar .grp{display:flex;gap:4px;padding:4px;border-radius:16px;background:rgba(20,24,49,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);pointer-events:auto}
.av .bar button{all:unset;cursor:pointer;height:36px;min-width:36px;padding:0 10px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;color:#C9CEF0;font:600 12px Inter,sans-serif;transition:background .12s,color .12s}
.av .bar button.on{color:#fff;background:linear-gradient(135deg,#6D4BFF,#8B6CFF);box-shadow:0 0 14px rgba(109,75,255,.45)}
.av .bar ha-icon{--mdc-icon-size:18px}
.av .bar .lbl{display:none}
@media (min-width:600px){.av .bar .lbl{display:inline}}
.av .prog{position:absolute;top:12px;inset-inline-end:12px;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:12px;background:rgba(20,24,49,.62);color:#fff;font:600 11px Inter,sans-serif;backdrop-filter:blur(10px);transition:opacity .2s}
.av .prog i{display:block;width:60px;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
.av .prog i b{display:block;height:100%;background:linear-gradient(90deg,#6D4BFF,#8B6CFF);width:0}
.av .prog.hide{opacity:0}
.av .empty{position:absolute;inset:0;display:grid;place-items:center;color:#9AA3D9;font:500 14px Inter,sans-serif;text-align:center;padding:20px}
`;

export class AtelierView {
  constructor(host, { onMoreInfo, toolbar = true, hotspots = true, editing = false, view = "3d", photo = false, quality = "auto" } = {}) {
    this.host = host; this.onMoreInfo = onMoreInfo;
    host.innerHTML = `<div class="av" dir="${isRtl() ? "rtl" : "ltr"}"><div class="hot"></div><div class="prog hide"><span>${t("Making photo")}</span><i><b></b></i></div>${toolbar ? `<div class="bar"></div>` : ""}</div>`;
    this.root = host.firstElementChild; this.hotEl = this.root.querySelector(".hot");
    this.engine = new AtelierEngine(this.root, { editing, view, hotspots, photo, quality });
    this.root.insertBefore(this.engine.renderer.domElement, this.hotEl);
    this.hsMap = new Map();
    this.engine.on("hotspots", (list) => this.drawHot(list));
    this.engine.on("sky", ({ day }) => this.root.classList.toggle("day", day > 0.3));
    this.engine.on("photo", ({ progress }) => this.drawProgress(progress));
    this.engine.on("tap", (hit) => this.tap(hit));
    this.engine.on("hold", (hit) => hit.device && this.more(hit.device));
    this.engine.on("view", () => this.drawBar());
    this.toolbar = toolbar; this.photoOn = photo;
    this.drawBar();
    this.io = new IntersectionObserver(([e]) => this.engine.setVisible(e.isIntersecting)); this.io.observe(this.root);
  }
  set hass(h) {
    this._hass = h;
    if (!this.plan) return;
    const ids = this.entities, states = {}; let changed = false;
    for (const id of ids) { states[id] = h.states[id]; if (states[id] !== this._last?.[id]) changed = true; }
    const sun = h.states["sun.sun"];
    if (sun !== this._sun) { this._sun = sun; this.engine.setSun(this.plan.settings?.sun === false ? null : sun); }
    if (changed) { this._last = states; this.engine.setStates(states); }
  }
  setPlan(plan, floor = 0) {
    this.plan = plan;
    this.entities = [...new Set(plan.floors.flatMap((f) => f.devices.map((d) => d.entity).filter(Boolean)))];
    this.engine.setPlan(plan, floor);
    this._last = null; this._sun = undefined;
    if (this._hass) this.hass = this._hass;
  }
  drawBar() {
    if (!this.toolbar) return;
    const bar = this.root.querySelector(".bar"), v = this.engine.view || "3d";
    const views = [["3d", "mdi:cube-outline", "3D"], ["top", "mdi:floor-plan", "Top"], ["walk", "mdi:walk", "Walk"]];
    bar.innerHTML = `<div class="grp">${views.map(([k, i, l]) => `<button data-v="${k}" class="${v === k ? "on" : ""}" title="${t(l)}"><ha-icon icon="${i}"></ha-icon><span class="lbl">${t(l)}</span></button>`).join("")}</div>
      <div class="grp"><button data-p class="${this.photoOn ? "on" : ""}" title="${t("Photo")}"><ha-icon icon="mdi:camera-iris"></ha-icon><span class="lbl">${t("Photo")}</span></button></div>`;
    bar.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { this.engine.userMoved = false; this.engine.frame(b.dataset.v); }));
    bar.querySelector("[data-p]").onclick = () => { this.photoOn = !this.photoOn; this.engine.setPhoto(this.photoOn); this.drawBar(); };
  }
  drawProgress(p) {
    const el = this.root.querySelector(".prog");
    el.classList.toggle("hide", p < 0 || p >= 1);
    el.querySelector("b").style.width = `${Math.max(0, p) * 100}%`;
  }
  drawHot(list) {
    const seen = new Set();
    for (const h of list) {
      seen.add(h.id);
      let el = this.hsMap.get(h.id);
      if (!el) {
        el = document.createElement("div"); el.className = "hs";
        el.innerHTML = `<button aria-label=""><ha-icon></ha-icon></button><span></span>`;
        let held = false, timer;
        const btn = el.firstElementChild;
        btn.addEventListener("pointerdown", (e) => { e.stopPropagation(); held = false; timer = setTimeout(() => { held = true; this.more(el.dataset.id); }, 500); });
        btn.addEventListener("pointerup", (e) => { e.stopPropagation(); clearTimeout(timer); if (!held) this.toggle(el.dataset.id); });
        btn.addEventListener("pointerleave", () => clearTimeout(timer));
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
        this.hotEl.appendChild(el); this.hsMap.set(h.id, el);
      }
      el.dataset.id = h.id;
      const on = h.state.on || h.state.open > 0.05 && h.kind === "curtain" || h.state.open === true;
      el.classList.toggle("on", !!on); el.classList.toggle("hide", !h.visible);
      el.style.setProperty("--c", COLORS[h.kind] || "#8B6CFF");
      el.style.left = `${h.x}px`; el.style.top = `${h.y}px`;
      const icon = h.kind === "curtain" ? (on ? "mdi:curtains" : "mdi:curtains-closed") : h.kind === "door" ? (on ? "mdi:door-open" : "mdi:door-closed") : h.kind === "lock" ? (h.state.locked ? "mdi:lock" : "mdi:lock-open-variant") : h.kind === "light" ? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline") : KINDS[h.kind]?.icon || "mdi:circle";
      const ic = el.querySelector("ha-icon"); if (ic.getAttribute("icon") !== icon) ic.setAttribute("icon", icon);
      el.firstElementChild.setAttribute("aria-label", h.name || "");
      const lbl = h.entity && !this._hass?.states[h.entity] ? t("Device not found") : h.state.label || "";
      const sp = el.querySelector("span"); if (sp.textContent !== lbl) sp.textContent = lbl;
    }
    for (const [id, el] of this.hsMap) if (!seen.has(id)) { el.remove(); this.hsMap.delete(id); }
  }
  dev(id) { return this.plan?.floors.flatMap((f) => f.devices).find((d) => d.id === id); }
  toggle(id) {
    const d = this.dev(id); if (!d) return;
    if (!d.entity) { this.onDemo?.(d); return; }
    const dom = d.entity.split(".")[0];
    if (dom === "lock" || dom === "alarm_control_panel" || dom === "sensor" || dom === "binary_sensor" || dom === "person" || dom === "device_tracker") return this.more(id);
    if (tapAction(this._hass, d.entity) === false) this.more(id);
  }
  more(id) { const d = this.dev(id); if (d?.entity) this.onMoreInfo?.(d.entity); else this.onDemo?.(d); }
  tap(hit) { if (hit.device) this.toggle(hit.device); else this.onPick?.(hit); }
  dispose() { this.io.disconnect(); this.engine.dispose(); this.host.innerHTML = ""; }
}
