// The integration's own photographer: once the light is baked and nobody is using the computer, it walks
// into each room, makes a realistic photo (light tracing + local AI clean-up) and keeps it in Home Assistant.
// Any touch stops it straight away; it carries on later.
import { ROOM_TYPES } from "./model.js";

export class RoomPhotographer {
  constructor(editor) {
    this.ed = editor; this.busy = false; this.done = new Set();
    const stop = () => this.cancel();
    for (const ev of ["pointerdown", "keydown", "wheel"]) editor.root.addEventListener(ev, stop, true);
  }
  // the home changed or was baked again: photos need remaking
  reset() { this.done.clear(); this.cancel(); }
  schedule(delay = 25000) {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.run(), delay);
  }
  cancel() {
    clearTimeout(this._t);
    if (!this.busy) return;
    this.aborted = true; this.busy = false;
    const e = this.ed.view.engine; e.setPhoto(false); e.opts.hotspots = true; e.userMoved = false; e.frame(this._view || "3d");
    this.ed.view.root.querySelector(".hot").style.display = "";
    this.schedule(60000);
  }
  async run() {
    const ed = this.ed, e = ed.view.engine;
    if (this.busy || !e.baked || !ed.plan?.id || document.hidden) return;
    if (!(await e.photoReady())) return; // needs a WebGPU graphics chip for the AI clean-up
    // rooms that already have a photo made after the latest light bake are left alone
    try {
      const at = Date.parse(e.bakeMgr.data?.meta.at || 0) / 1000, list = await ed._hass.connection.sendMessagePromise({ type: "roost_atelier/photos", plan_id: ed.plan.id });
      for (const p of list) { const [, fi, ...rid] = p.key.slice(ed.plan.id.length).split("_"); if (+fi === ed.fi && p.updated > at) this.done.add(`${fi}:${rid.join("_")}`); }
    } catch { /* offline */ }
    const rooms = ed.floor.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor && !this.done.has(`${ed.fi}:${r.id}`));
    if (!rooms.length) return;
    this.busy = true; this.aborted = false; this._view = e.view;
    ed.view.root.querySelector(".hot").style.display = "none";
    for (const r of rooms) {
      if (this.aborted) return;
      e.walkRoom = r; e.frame("walk", true); e.opts.hotspots = false;
      await wait(400);
      const shot = await e.takePhoto(() => this.aborted);
      if (!shot || this.aborted) return;
      try {
        await ed._hass.fetchWithAuth(`/api/roost_atelier/photo/${ed.plan.id}_${ed.fi}_${r.id}`, { method: "POST", body: shot, headers: { "Content-Type": "image/jpeg" } });
        this.done.add(`${ed.fi}:${r.id}`);
        ed.emitPhotos?.();
      } catch { /* offline: try again later */ }
    }
    this.busy = false;
    e.setPhoto(false); e.opts.hotspots = true; ed.view.root.querySelector(".hot").style.display = ""; e.frame(this._view || "3d");
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
