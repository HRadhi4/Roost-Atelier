// The integration's own photographer: once the light is worked out it makes realistic photos of the whole
// floor and of every room in the background (light tracing + local AI clean-up) and keeps them in Home Assistant.
// A bar shows how far it is. Photos already made after the latest light are kept.
import { t } from "./i18n.js";
import { Studio, shotsFor, panosFor } from "./studio.js";

export class RoomPhotographer {
  constructor(editor) {
    this.ed = editor;
    this.bar = document.createElement("button"); this.bar.className = "studio hide";
    this.bar.innerHTML = `<ha-icon icon="mdi:camera-iris"></ha-icon><span></span><i><b></b></i>`;
    this.bar.onclick = () => { this.ed.select(null); this.ed.homePanel(); };
    editor.ed.appendChild(this.bar);
  }
  get studio() {
    return (this._studio ||= new Studio(this.ed.view.engine, {
      save: (key, blob) => this.ed._hass.fetchWithAuth(`/api/roost_atelier/photo/${this.ed.plan.id}_${this.ed.fi}_${key}`, { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } }),
      onProgress: (p) => this.show(p),
    }));
  }
  show(p) {
    const b = this.bar; clearTimeout(this._hide);
    if (p.state === "working") {
      b.classList.remove("hide", "ok");
      b.querySelector("span").textContent = `${p.name?.startsWith("360°") ? "" : t("Photos") + " "}${Math.min(p.done + 1, p.total)}/${p.total} · ${p.name || ""}${p.ai ? " · AI" : ""} · ${Math.round(p.f * 100)}%`;
      b.querySelector("b").style.width = `${Math.round(p.f * 100)}%`;
      if (p.saved) this.ed.emitPhotos?.();
    } else if (p.state === "done") {
      b.classList.remove("hide"); b.classList.add("ok"); b.querySelector("span").textContent = t("All photos ready"); b.querySelector("b").style.width = "100%";
      this.ed.emitPhotos?.(); this._hide = setTimeout(() => b.classList.add("hide"), 6000);
    } else if (p.state === "black" || p.state === "failed") {
      b.classList.remove("hide", "ok"); b.querySelector("span").textContent = t("Some photos came out black on this computer. Try again, or make them on another computer."); b.querySelector("b").style.width = "0%";
      this.ed.emitPhotos?.(); this._hide = setTimeout(() => b.classList.add("hide"), 12000);
    } else b.classList.add("hide");
  }
  // the 360° views of every room, on request (they take longer than the photos)
  async panos() {
    const ed = this.ed, e = ed.view.engine;
    if (!e.baked || !ed.plan?.id) { ed.toast?.(t("Waiting for the light to be ready")); return; }
    this.studio.cancel(); clearTimeout(this._t);
    await new Promise((r) => setTimeout(r, 50));
    this.studio.run(panosFor(ed.floor, t));
  }
  // everything the dashboard card shows: the photo of the whole floor and of each room, then every room in 360°
  async publish() {
    const ed = this.ed, e = ed.view.engine;
    if (!e.baked || !ed.plan?.id) { ed.toast?.(t("Waiting for the light to be ready")); return; }
    this.studio.cancel(); clearTimeout(this._t);
    await new Promise((r) => setTimeout(r, 50));
    const token = this.studio.token + 1;
    const flat = await this.studio.run(shotsFor(ed.floor, t));
    if (this.studio.token !== token) return;
    const round = await this.studio.run(panosFor(ed.floor, t));
    // all made: show the Roost Home Tour card as it will look on the dashboard
    if (flat && round) ed.showPano(null, null);
  }
  // the home changed or is being lit again: photos need remaking
  reset() { this.studio.cancel(); }
  cancel() { this.studio.cancel(); }
  schedule(delay = 4000) { clearTimeout(this._t); this._t = setTimeout(() => this.run(), delay); }
  async run() {
    const ed = this.ed, e = ed.view.engine;
    if (this.studio.running || !e.baked || !ed.plan?.id) return;
    // photos made after the latest light bake are kept
    const done = new Set();
    try {
      const at = Date.parse(e.bakeMgr.data?.meta.at || 0) / 1000, list = await ed._hass.connection.sendMessagePromise({ type: "roost_atelier/photos", plan_id: ed.plan.id });
      for (const p of list) { const rest = p.key.slice(ed.plan.id.length + 1), cut = rest.indexOf("_"); if (+rest.slice(0, cut) === ed.fi && p.updated > at) done.add(rest.slice(cut + 1)); }
    } catch { /* offline */ }
    const shots = shotsFor(ed.floor, t).filter((s) => !done.has(s.key));
    if (shots.length) this.studio.run(shots);
  }
}
