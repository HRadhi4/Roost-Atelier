// The live 3D home with tappable devices on top. Used by the dashboard card and by the Atelier itself.
import { setTextureSource, setOwnMaterials } from "./materials.js";
import { AtelierEngine } from "./engine.js";
import { KINDS, tapAction } from "./devices.js";
import { t, isRtl } from "./i18n.js";
import { CONTROLS_CSS, controlsHtml, bindControls } from "./controls.js";
import { inside } from "./model.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const COLORS = { light: "#F5B041", ac: "#2EC4B6", curtain: "#4E8CFF", tv: "#8B6CFF", door: "#FF7A59", lock: "#FF7A59", fan: "#2EC4B6", person: "#E86FB0", speaker: "#8B6CFF", vacuum: "#5FBF77", sensor: "#7C86B8" };

export const VIEW_CSS = `
.pcover{position:absolute;inset:0;z-index:4;pointer-events:none}.pcover img{width:100%;height:100%;object-fit:cover;display:block}.pcover span{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:6px 12px;border-radius:12px;background:rgba(11,13,23,.7);color:#fff;font:500 12px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;white-space:nowrap}
.av{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:radial-gradient(120% 90% at 50% 10%,var(--av-sky1,#1a2050),var(--av-sky2,#0B0D17));transition:background .6s}
.av.day{--av-sky1:#f4efe6;--av-sky2:#dfe6f2}
.av canvas{position:absolute;inset:0}
.av .hot{position:absolute;inset:0;pointer-events:none}
.av .hs{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:3px;transition:opacity .12s;-webkit-tap-highlight-color:transparent}
.av .hs.hide{opacity:0;pointer-events:none}
.av .hs button{all:unset;cursor:pointer;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(20,24,49,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.16);box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .12s,background .12s}
.av .hs button:active{transform:scale(.9)}
.av .hs.on button{background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 70%,#fff));border-color:transparent;box-shadow:0 0 18px color-mix(in srgb,var(--c) 70%,transparent)}
.av .hs ra-icon{--mdc-icon-size:18px}
.av .hs span{pointer-events:none;font:600 10px/1.2 Inter,var(--paper-font-body1_-_font-family,sans-serif);color:#fff;background:rgba(11,13,23,.55);padding:2px 6px;border-radius:8px;white-space:nowrap}
.av .hs span:empty{display:none}
.av .bar{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:8px;justify-content:center;pointer-events:none}
.av .bar .grp{display:flex;gap:4px;padding:4px;border-radius:16px;background:rgba(20,24,49,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);pointer-events:auto}
.av .bar button{all:unset;cursor:pointer;height:36px;min-width:36px;padding:0 10px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;color:#C9CEF0;font:600 12px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;transition:background .12s,color .12s}
.av .bar button.on{color:#fff;background:linear-gradient(135deg,#6D4BFF,#8B6CFF);box-shadow:0 0 14px rgba(109,75,255,.45)}
.av .bar ra-icon{--mdc-icon-size:18px}
.av .bar .lbl{display:none}
@media (min-width:600px){.av .bar .lbl{display:inline}}
.av .prog{position:absolute;top:12px;inset-inline-end:12px;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:12px;background:rgba(20,24,49,.62);color:#fff;font:600 11px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;backdrop-filter:blur(10px);transition:opacity .2s}
.av .prog i{display:block;width:60px;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
.av .prog i b{display:block;height:100%;background:linear-gradient(90deg,#6D4BFF,#8B6CFF);width:0}
.av .prog.hide{opacity:0}
.av .pop{position:absolute;z-index:6;width:min(268px,calc(100% - 24px));padding:12px;border-radius:20px;background:rgba(20,24,49,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.4);box-sizing:border-box}
.av .side{position:absolute;z-index:6;top:10px;bottom:62px;inset-inline-end:10px;width:min(320px,calc(100% - 20px));padding:14px;border-radius:22px;background:rgba(20,24,49,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.4);overflow:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;color:#EEF0FF;font:500 13px Inter,-apple-system,'Segoe UI',Roboto,sans-serif}
.av .side .top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.av .side .top b{font:600 16px "Space Grotesk",Inter,-apple-system,'Segoe UI',Roboto,sans-serif}
.av .side .top button{all:unset;cursor:pointer;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.08)}
.av .side h4{all:unset;font:600 11px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;color:#9AA3D9;text-transform:uppercase;letter-spacing:.06em}
.av .side .card{padding:12px;border-radius:16px;background:rgba(255,255,255,.05)}
.av .side .card.pick{cursor:pointer}
${CONTROLS_CSS}
.av .empty{position:absolute;inset:0;display:grid;place-items:center;color:#9AA3D9;font:500 14px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center;padding:20px}
`;

export class AtelierView {
  constructor(host, { onMoreInfo, toolbar = true, hotspots = true, editing = false, view = "3d", photo = false, quality = "auto", canBake, store, tap = "controls" } = {}) {
    this.host = host; this.onMoreInfo = onMoreInfo; this.tapMode = editing ? "toggle" : tap; this.editing = editing;
    host.innerHTML = `<div class="av" dir="${isRtl() ? "rtl" : "ltr"}"><div class="hot"></div><div class="prog hide"><span>${t("Making photo")}</span><i><b></b></i></div>${toolbar ? `<div class="bar"></div>` : ""}</div>`;
    this.root = host.firstElementChild; this.hotEl = this.root.querySelector(".hot");
    // the light is baked on a computer, not on phones or tablets; the result is shared through Home Assistant
    const strong = (navigator.hardwareConcurrency || 2) >= 4 && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    this.engine = new AtelierEngine(this.root, { editing, view, hotspots, photo, quality, canBake: canBake ?? strong, store: store || { load: (k) => this.loadBake(k), save: (k, b) => this.saveBake(k, b) } });
    this.engine.on("bake", ({ state, progress }) => this.drawBake(state, progress));
    this.root.insertBefore(this.engine.renderer.domElement, this.hotEl);
    this.hsMap = new Map();
    this.engine.on("hotspots", (list) => this.drawHot(list));
    this.engine.on("sky", ({ day }) => this.root.classList.toggle("day", day > 0.3));
    this.engine.on("photo", ({ progress }) => this.drawProgress(progress));
    this.engine.on("tap", (hit) => this.tap(hit));
    this.engine.on("hold", (hit) => hit.device && this.more(hit.device));
    this.engine.on("view", () => { this.drawBar(); if (this.openId) this.open(this.openId); });
    // a tap anywhere else closes the pop-up (the side panel stays until closed)
    this.root.addEventListener("pointerdown", (e) => { const p = e.composedPath(); if (this.popEl && !p.includes(this.popEl) && !p.some((n) => n.classList?.contains?.("hs"))) this.closePanel(); });
    this.toolbar = toolbar; this.photoOn = photo;
    this.drawBar();
    this.io = new IntersectionObserver(([e]) => this.engine.setVisible(e.isIntersecting)); this.io.observe(this.root);
  }
  set hass(h) {
    // real textures come from Home Assistant (downloaded there once)
    if (h && !this._texSet) { this._texSet = true; setOwnMaterials([], (file) => (this._hass || h).fetchWithAuth(`/api/roost_atelier/file/${file}`).then((r) => (r.ok ? r.blob() : null))); setTextureSource((id, kind) => (this._hass || h).fetchWithAuth(`/api/roost_atelier/texture/${id}/${kind}`).then((r) => (r.ok ? r.blob() : null))); this.engine.fileSource = (file) => (this._hass || h).fetchWithAuth(`/api/roost_atelier/file/${file}`).then((r) => (r.ok ? r.blob() : null)); this.engine.skySource = (name) => (this._hass || h).fetchWithAuth(`/api/roost_atelier/sky/${name}`).then((r) => (r.ok ? r.arrayBuffer() : null)); }
    this._hass = h;
    if (!this.plan) return;
    const ids = this.entities, states = {}; let changed = false;
    for (const id of ids) { states[id] = h.states[id]; if (states[id] !== this._last?.[id]) changed = true; }
    if (!this._loc && h.config) { this._loc = true; this.engine.location = { lat: h.config.latitude, lon: h.config.longitude }; }
    const wx = h.states[this.plan.settings?.weather || ""] || Object.values(h.states).find((s) => s.entity_id.startsWith("weather."));
    if (wx !== this._wx) { this._wx = wx; this.engine.setWeather(wx); }
    const sun = h.states["sun.sun"];
    if (sun !== this._sun) { this._sun = sun; this.engine.setSun(this.plan.settings?.sun === false ? null : sun); }
    if (changed) { this._last = states; this.engine.setStates(states); if (this.openId) this.refreshPanel(); }
  }
  setPlan(plan, floor = 0) {
    this.plan = plan;
    // a presence radar also needs the other people it can see (targets 1 to 3, left/right and ahead)
    const more = (d) => (d.kind === "radar" && /_target_1_x$/.test(d.entity || "") ? [1, 2, 3].flatMap((n) => ["x", "y"].map((k) => d.entity.replace(/_target_1_x$/, `_target_${n}_${k}`))) : [d.entity]);
    this.entities = [...new Set(plan.floors.flatMap((f) => f.devices.flatMap(more).filter(Boolean)))];
    setOwnMaterials(plan.materials || []);
    this.engine.setPlan(plan, floor);
    this._last = null; this._sun = undefined;
    if (this._hass) this.hass = this._hass;
  }
  drawBar() {
    if (!this.toolbar) return;
    const bar = this.root.querySelector(".bar"), v = this.engine.view || "3d";
    const views = [["3d", "mdi:cube-outline", "3D"], ["top", "mdi:floor-plan", "Top"], ["walk", "mdi:walk", "Walk"]];
    bar.innerHTML = `<div class="grp">${views.map(([k, i, l]) => `<button data-v="${k}" class="${v === k ? "on" : ""}" title="${t(l)}"><ra-icon icon="${i}"></ra-icon><span class="lbl">${t(l)}</span></button>`).join("")}</div>
      <div class="grp"><button data-p class="${this.photoOn ? "on" : ""}" title="${t("Photo")}"><ra-icon icon="mdi:camera-iris"></ra-icon><span class="lbl">${t("Photo")}</span></button></div>`;
    bar.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { this.engine.userMoved = false; this.engine.frame(b.dataset.v); }));
    bar.querySelector("[data-p]").onclick = () => { this.photoOn = !this.photoOn; this.engine.setPhoto(this.photoOn); this.drawBar(); };
  }
  // stored light lives on the Home Assistant server, shared by every screen
  async loadBake(key) {
    if (!this._hass) return null;
    const r = await this._hass.fetchWithAuth(`/api/roost_atelier/bake/${key}`); if (!r.ok) return null;
    return r.arrayBuffer();
  }
  async saveBake(key, buf) {
    if (!this._hass?.user?.is_admin) return;
    // squeezed before it leaves this computer (a few MB less over a remote link)
    let body = buf;
    try { if (typeof CompressionStream === "function") body = await new Response(new Blob([buf]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer(); } catch { body = buf; }
    await this._hass.fetchWithAuth(`/api/roost_atelier/bake/${key}`, { method: "POST", body, headers: { "Content-Type": "application/octet-stream" } });
  }
  drawBake(state, p) {
    const el = this.root.querySelector(".prog");
    if (state === "baking") { el.classList.remove("hide"); el.querySelector("span").textContent = `${t("Lighting")} ${Math.round(p * 100)}%`; el.querySelector("b").style.width = `${p * 100}%`; this._baking = true; }
    else if (this._baking) { this._baking = false; el.classList.add("hide"); el.querySelector("span").textContent = t("Making photo"); }
  }
  drawProgress(p) {
    const el = this.root.querySelector(".prog");
    if (p === -2) { this.photoOn = false; this.drawBar(); el.classList.remove("hide"); el.querySelector("span").textContent = t("Photo mode isn't available on this device"); el.querySelector("i").style.display = "none"; clearTimeout(this._pe); this._pe = setTimeout(() => { el.classList.add("hide"); el.querySelector("span").textContent = t("Making photo"); el.querySelector("i").style.display = ""; }, 5000); return; }
    el.querySelector("span").textContent = t(p >= 1 ? "Photo ready" : "Making photo");
    el.classList.toggle("hide", p < 0 || (p >= 1 && !this._showReady));
    el.querySelector("b").style.width = `${Math.max(0, p) * 100}%`;
  }
  drawHot(list) {
    const seen = new Set();
    for (const h of list) {
      seen.add(h.id);
      let el = this.hsMap.get(h.id);
      if (!el) {
        el = document.createElement("div"); el.className = "hs";
        el.innerHTML = `<button aria-label=""><ra-icon></ra-icon></button><span></span>`;
        let held = false, timer;
        const btn = el.firstElementChild;
        // the press belongs to the button from the moment the finger lands (even if the button moves with the view),
        // and only a press that started on it switches the device: every press works, and works once
        let down = null;
        btn.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (e.button > 0) return; down = e.pointerId; try { btn.setPointerCapture(e.pointerId); } catch {} held = false; clearTimeout(timer); timer = setTimeout(() => { held = true; this.more(el.dataset.id); }, 500); });
        btn.addEventListener("pointerup", (e) => { e.stopPropagation(); clearTimeout(timer); if (down !== e.pointerId) return; down = null; if (!held) this.toggle(el.dataset.id); });
        btn.addEventListener("pointercancel", () => { clearTimeout(timer); down = null; });
        btn.addEventListener("click", (e) => e.stopPropagation());
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
        this.hotEl.appendChild(el); this.hsMap.set(h.id, el);
      }
      el.dataset.id = h.id;
      const on = h.state.on || h.state.open > 0.05 && h.kind === "curtain" || h.state.open === true;
      el.classList.toggle("on", !!on); el.classList.toggle("hide", !h.visible);
      el.style.setProperty("--c", COLORS[h.kind] || "#8B6CFF");
      el.style.left = `${h.x}px`; el.style.top = `${h.y}px`;
      const icon = h.kind === "curtain" ? (on ? "mdi:curtains" : "mdi:curtains-closed") : h.kind === "door" ? (on ? "mdi:door-open" : "mdi:door-closed") : h.kind === "lock" ? (h.state.locked ? "mdi:lock" : "mdi:lock-open-variant") : h.kind === "light" ? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline") : KINDS[h.kind]?.icon || "mdi:circle";
      const ic = el.querySelector("ra-icon"); if (ic.getAttribute("icon") !== icon) ic.setAttribute("icon", icon);
      el.firstElementChild.setAttribute("aria-label", h.name || "");
      const lbl = h.entity && this._hass && !this._hass.states[h.entity] ? t("Device not found") : t(h.state.label || "");
      const sp = el.querySelector("span"); if (sp.textContent !== lbl) sp.textContent = lbl;
    }
    for (const [id, el] of this.hsMap) if (!seen.has(id)) { el.remove(); this.hsMap.delete(id); }
    if (this.popEl) this.placePop();
  }
  dev(id) { return this.plan?.floors.flatMap((f) => f.devices).find((d) => d.id === id); }
  toggle(id) {
    const d = this.dev(id); if (!d) return;
    // in the Atelier, devices only switch while trying the home out; while editing a tap picks the device
    if (this.editing && !this.testing) { this.onDemo?.(d); return; }
    // a group: every device in it goes the same way as the one tapped
    const group = d.group ? (this.plan?.floors.flatMap((f) => f.devices) || []).filter((x) => x.group === d.group) : null;
    if (group && group.length > 1 && this.tapMode !== "controls") {
      const want = !this.engine.isOn(id);
      for (const x of group) {
        if (!x.entity || (this._hass && !this._hass.states[x.entity])) { this.engine.pretend(x.id, want); continue; }
        const dom = x.entity.split(".")[0];
        if (dom === "cover") this._hass.callService("cover", want ? "open_cover" : "close_cover", { entity_id: x.entity });
        else if (dom === "lock") this._hass.callService("lock", want ? "unlock" : "lock", { entity_id: x.entity });
        else this._hass.callService("homeassistant", want ? "turn_on" : "turn_off", { entity_id: x.entity });
      }
      return;
    }
    // no working entity yet: it still switches on and off here, so the home can be tried out
    if (!d.entity || (this._hass && !this._hass.states[d.entity])) { if (!this.engine.pretend(id)) this.onDemo?.(d); return; }
    if (this.tapMode === "controls") return this.openId === id && this.popEl ? this.closePanel() : this.open(id);
    const dom = d.entity.split(".")[0];
    if (dom === "lock" || dom === "alarm_control_panel" || dom === "sensor" || dom === "binary_sensor" || dom === "person" || dom === "device_tracker") return this.more(id);
    if (tapAction(this._hass, d.entity) === false) this.more(id);
  }
  more(id) { const d = this.dev(id); if (this.editing && !this.testing) { if (d) this.onDemo?.(d); return; } if (this.testing && (!d?.entity || !this._hass?.states[d.entity])) { this.engine.pretend(id); return; } if (d?.entity) this.onMoreInfo?.(d.entity); else this.onDemo?.(d); }
  tap(hit) { if (hit.device) this.toggle(hit.device); else this.onPick?.(hit); }
  // ---------------------------------------------------------------- the controls of a device
  // in the 3D and top views a small pop-up next to it; walking in a room, a side panel with everything in that room
  open(id) {
    const d = this.dev(id); if (!d?.entity) return;
    this.openId = id;
    if (this.engine.view === "walk") { this.popEl?.remove(); this.popEl = null; this.drawSide(); }
    else { this.sideEl?.remove(); this.sideEl = null; this.drawPop(); }
  }
  closePanel() { this.popEl?.remove(); this.sideEl?.remove(); this.popEl = this.sideEl = null; this.openId = null; }
  refreshPanel() {
    const el = this.popEl || this.sideEl; if (!el || el.querySelector(".ctl[data-busy]")) return;
    if (this.popEl) this.drawPop(); else this.drawSide();
  }
  colour(d) { return COLORS[d.kind || "light"] || "#8B6CFF"; }
  drawPop() {
    const d = this.dev(this.openId); if (!d) return this.closePanel();
    if (!this.popEl) { this.popEl = document.createElement("div"); this.popEl.className = "pop"; this.root.appendChild(this.popEl); }
    this.popEl.innerHTML = controlsHtml(this._hass, d.entity, d.name, this.colour(d));
    bindControls(this.popEl, () => this._hass, (e) => { this.closePanel(); this.onMoreInfo?.(e); });
    this.placePop();
  }
  placePop() {
    const el = this.popEl, hs = this.hsMap.get(this.openId); if (!el) return;
    const W = this.root.clientWidth, H = this.root.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    const x = hs ? parseFloat(hs.style.left) : W / 2, y = hs ? parseFloat(hs.style.top) : H / 2;
    const left = Math.max(12, Math.min(W - w - 12, x - w / 2)), top = y - h - 28 > 8 ? y - h - 28 : Math.min(H - h - 8, y + 28);
    el.style.left = `${left}px`; el.style.top = `${Math.max(8, top)}px`;
  }
  drawSide() {
    const d = this.dev(this.openId); if (!d) return this.closePanel();
    const floor = this.plan.floors.find((f) => f.devices.includes(d)), room = floor?.rooms.find((r) => inside([d.x, d.y], r.pts));
    const others = (floor?.devices || []).filter((x) => x !== d && x.entity && this._hass?.states[x.entity] && (!room || inside([x.x, x.y], room.pts)))
      .filter((x, i, a) => a.findIndex((y) => y.entity === x.entity) === i && x.entity !== d.entity);
    if (!this.sideEl) { this.sideEl = document.createElement("div"); this.sideEl.className = "side"; this.root.appendChild(this.sideEl); }
    this.sideEl.innerHTML = `<div class="top"><b>${room?.name ? room.name.replace(/[<>&"]/g, "") : t("This room")}</b><button data-x aria-label="${t("Close")}"><ra-icon icon="mdi:close"></ra-icon></button></div>
      <div class="card">${controlsHtml(this._hass, d.entity, d.name, this.colour(d))}</div>
      ${others.length ? `<h4>${t("Also in this room")}</h4>${others.map((x) => `<div class="card pick" data-id="${esc(x.id)}">${controlsHtml(this._hass, x.entity, x.name, this.colour(x), { compact: true })}</div>`).join("")}` : ""}`;
    bindControls(this.sideEl, () => this._hass, (e) => this.onMoreInfo?.(e));
    this.sideEl.querySelector("[data-x]").onclick = () => this.closePanel();
    this.sideEl.querySelectorAll(".card.pick").forEach((c) => c.addEventListener("click", (e) => { if (e.target.closest("button")) return; this.openId = c.dataset.id; this.drawSide(); }));
  }
  dispose() { this.io.disconnect(); this.engine.dispose(); this.host.innerHTML = ""; }
}
