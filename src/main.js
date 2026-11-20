// Roost Atelier: the dashboard card and the Atelier sidebar page. Heavy parts load only when needed.
import { langFor, t, isRtl } from "./i18n.js";

const VERSION = __VERSION__;
const loadView = () => import("./view.js");
const fire = (el, type, detail) => el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

export async function listPlans(hass) { return hass.connection.sendMessagePromise({ type: "roost_atelier/plans" }); }
export async function getPlan(hass, id) { return hass.connection.sendMessagePromise({ type: "roost_atelier/plan", plan_id: id }); }

class RoostAtelierCard extends HTMLElement {
  static getStubConfig() { return { plan: "", height: 420, view: "still" }; }
  static getConfigElement() { return document.createElement("roost-atelier-card-editor"); }
  setConfig(c) {
    const old = this._config; this._config = { height: 420, view: "still", toolbar: true, hotspots: true, photo: false, quality: "auto", language: "auto", ...c };
    if (this._view && old && (old.plan !== c.plan || old.toolbar !== c.toolbar || old.quality !== c.quality || old.view !== c.view || old.room !== c.room || old.floor !== c.floor || old.tap !== c.tap || old.hotspots !== c.hotspots)) { this._view.dispose(); this._view = null; this._booted = false; this.boot(); }
    if (this.card) this.card.style.height = this.height();
  }
  height() { const h = this._config.height; return typeof h === "number" ? `${h}px` : h || "420px"; }
  getCardSize() { return Math.ceil((parseInt(this._config?.height) || 420) / 50); }
  getGridOptions() { return { columns: "full", rows: Math.ceil((parseInt(this._config?.height) || 420) / 56), min_rows: 4 }; }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    if (first) langFor(h, this._config?.language);
    if (this._view) this._view.hass = h;
    if (first) this.boot();
  }
  connectedCallback() { clearTimeout(this._drop); this.boot(); this._view?.engine.setVisible(true); }
  disconnectedCallback() {
    this._view?.engine.setVisible(false);
    // left the page: give the graphics memory back after a minute (coming back sooner keeps it instant)
    clearTimeout(this._drop); this._drop = setTimeout(() => this.shutdown(), 60000);
  }
  // the light card: finished pictures of the home with device buttons on them (no 3D engine)
  async bootStill(plan) {
    const { StillViewer, STILL_CSS, photoFetcher } = await import("./still.js");
    const fi = this._config.floor || 0;
    const style = document.createElement("style"); style.textContent = STILL_CSS; this.shadowRoot.appendChild(style);
    const v = new StillViewer(this.card, { plan, floorIndex: fi, room: this._config.room, photo: photoFetcher(() => this._hass, plan.id, fi), tap: this._config.tap || "controls", nav: this._config.toolbar !== false, devices: this._config.hotspots !== false, onMoreInfo: (e) => fire(this, "hass-more-info", { entityId: e }) });
    v.hass = this._hass;
    this._view = { engine: { setVisible() {}, on() {} }, dispose: () => v.dispose(), setPlan: (p, f) => v.setPlan(p, f), set hass(h) { v.hass = h; } };
  }
  shutdown() {
    this._unsub?.(); this._unsub = null;
    this._view?.dispose(); this._view = null; this._booted = false;
  }
  async boot() {
    if (this._booted || !this._hass || !this._config || !this.isConnected) return;
    this._booted = true;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    // the picture card never loads the 3D engine
    const light = this._config.view === "still" || this._config.view === "360";
    const { VIEW_CSS, AtelierView } = light ? { VIEW_CSS: `.av{position:absolute;inset:0;display:grid;place-items:center;background:#0B0D17}.av .empty{color:#9AA3D9;font:500 14px Inter,sans-serif;text-align:center;line-height:1.6}` } : await loadView();
    this.shadowRoot.innerHTML = `<style>${VIEW_CSS} ha-card{overflow:hidden;border-radius:var(--ha-card-border-radius,24px);position:relative}</style><ha-card></ha-card>`;
    this.card = this.shadowRoot.querySelector("ha-card"); this.card.style.height = this.height();
    let id = this._config.plan;
    try {
      if (!id) id = (await listPlans(this._hass))[0]?.id;
      if (!id) { this.card.innerHTML = `<div class="av"><div class="empty">${t("No homes yet")}<br>Atelier → ${t("New home")}</div></div>`; this._booted = false; return; }
      const plan = await getPlan(this._hass, id);
      if (light) await this.bootStill(plan);
      else this._view = new AtelierView(this.card, { toolbar: this._config.toolbar, hotspots: this._config.hotspots, view: this._config.view, photo: this._config.photo, quality: this._config.quality, tap: this._config.tap || "controls", onMoreInfo: (e) => fire(this, "hass-more-info", { entityId: e }) });
      if (!light) this._view.setPlan(plan, this._config.floor || 0);
      this._view.hass = this._hass;
      this._planId = id; this._updated = plan.updated;
      // the browser took the 3D away (too many open views or a driver hiccup): build it again
      this._view.engine.on("lost", () => setTimeout(() => { this.shutdown(); this.boot(); }, 1500));
      this._unsub?.();
      this._unsub = await this._hass.connection.subscribeMessage((m) => {
        if (m.plan_id !== this._planId || (m.updated && m.updated === this._updated)) return;
        // many saves in a row while someone edits: redraw once they pause
        clearTimeout(this._refresh);
        this._refresh = setTimeout(() => getPlan(this._hass, id).then((p) => { this._updated = p.updated; this._view?.setPlan(p, this._config.floor || 0); }), 1500);
      }, { type: "roost_atelier/subscribe" });
    } catch (err) {
      this.card.innerHTML = `<div class="av"><div class="empty">${t("Offline")}</div></div>`; this._booted = false;
      console.warn("Roost Atelier:", err);
    }
  }
}

class RoostAtelierCardEditor extends HTMLElement {
  setConfig(c) { const before = this._config; this._config = c; if (c.view !== "3d" && c.view !== "top" && c.view !== "walk" && (!this._rooms || before?.plan !== c.plan || before?.floor !== c.floor)) this.loadRooms(); this.draw(); }
  set hass(h) { const first = !this._hass; this._hass = h; if (first) { listPlans(h).then((p) => { this._plans = p; this.draw(); }).catch(() => {}); if (!["3d", "top", "walk"].includes(this._config?.view)) this.loadRooms(); } if (this.form) this.form.hass = h; }
  async loadRooms() {
    if (!this._hass) return;
    try { const id = this._config.plan || (await listPlans(this._hass))[0]?.id; if (!id) return; const p = await getPlan(this._hass, id); this._rooms = (p.floors[this._config.floor || 0] || p.floors[0]).rooms; this.draw(); } catch { /* offline */ }
  }
  draw() {
    if (!this._config || !this._hass) return;
    if (!this.form) { this.form = document.createElement("ha-form"); this.appendChild(this.form); this.form.addEventListener("value-changed", (e) => fire(this, "config-changed", { config: e.detail.value })); this.form.computeLabel = (s) => s.label; }
    const plans = this._plans || [];
    this.form.hass = this._hass; this.form.data = this._config;
    this.form.schema = [
      { name: "plan", label: t("Home"), selector: { select: { mode: "dropdown", options: [{ value: "", label: "First home" }, ...plans.map((p) => ({ value: p.id, label: p.name }))] } } },
      { name: "floor", label: "Level (0 = ground)", selector: { number: { min: 0, max: 9, step: 1, mode: "box" } } },
      { name: "view", label: "View", selector: { select: { mode: "box", options: [{ value: "still", label: t("Pictures (light, recommended)") }, { value: "3d", label: t("Live 3D") }, { value: "top", label: t("Live top view") }, { value: "walk", label: t("Live walk") }] } } },
      ...(this._config.view === "still" || this._config.view === "360" || !this._config.view ? [{ name: "room", label: t("Start in this room"), selector: { select: { mode: "dropdown", options: [{ value: "", label: t("Whole home") }, ...(this._rooms || []).map((r) => ({ value: r.id, label: r.name || r.id }))] } } }] : []),
      { name: "height", label: t("Height"), selector: { number: { min: 240, max: 1200, step: 20, mode: "slider", unit_of_measurement: "px" } } },
      { name: "toolbar", label: "Buttons along the bottom", selector: { boolean: {} } },
      { name: "hotspots", label: "Device buttons", selector: { boolean: {} } },
      { name: "tap", label: "Tapping a device", selector: { select: { mode: "box", options: [{ value: "controls", label: "Shows its controls" }, { value: "toggle", label: "Turns it on or off" }] } } },
      ...(["3d", "top", "walk"].includes(this._config.view) ? [
        { name: "photo", label: t("Photo") + " (idle)", selector: { boolean: {} } },
        { name: "quality", label: t("Quality"), selector: { select: { mode: "dropdown", options: ["auto", "low", "medium", "high"].map((v) => ({ value: v, label: t(v[0].toUpperCase() + v.slice(1)) })) } } }] : []),
      { name: "language", label: "Language", selector: { select: { mode: "dropdown", options: [{ value: "auto", label: "Auto" }, { value: "en", label: "English" }, { value: "ar", label: "العربية" }] } } },
    ];
  }
}

class RoostAtelierPanel extends HTMLElement {
  set hass(h) { this._hass = h; if (this.editor) this.editor.hass = h; else this.boot(); }
  set narrow(n) { this._narrow = n; if (this.editor) this.editor.narrow = n; }
  set panel(p) { this._panel = p; }
  async boot() {
    if (this._booting || !this._hass) return; this._booting = true;
    langFor(this._hass);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<div style="display:grid;place-items:center;height:100vh;color:#9AA3D9;font:500 14px Inter,sans-serif;background:#0B0D17">Atelier…</div>`;
    const { AtelierEditor } = await import("./editor.js");
    this.editor = new AtelierEditor(this.shadowRoot, this, { rtl: isRtl() });
    this.editor.narrow = this._narrow; this.editor.hass = this._hass;
  }
  disconnectedCallback() { this.editor?.pause(true); }
  connectedCallback() { this.editor?.pause(false); }
}

if (!customElements.get("roost-atelier-card")) customElements.define("roost-atelier-card", RoostAtelierCard);
if (!customElements.get("roost-atelier-card-editor")) customElements.define("roost-atelier-card-editor", RoostAtelierCardEditor);
if (!customElements.get("roost-atelier-panel")) customElements.define("roost-atelier-panel", RoostAtelierPanel);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "roost-atelier-card"))
  window.customCards.push({ type: "roost-atelier-card", name: "Roost Atelier", description: "Your home as realistic pictures you can tap: lights, curtains, ACs, doors, room by room in 360°.", preview: false, documentationURL: "https://github.com/HRadhi4/Roost-Atelier" });
console.info(`%c ROOST ATELIER %c ${VERSION} `, "background:#6D4BFF;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px", "background:#141831;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px");
