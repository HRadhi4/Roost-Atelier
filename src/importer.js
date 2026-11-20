// Import: a CAD drawing, a PDF or a picture of a plan becomes rooms, doors and windows;
// a photo of a room becomes furniture, recognised by Home Assistant's own AI.
import { t } from "./i18n.js";
import { round, ROOM_TYPES } from "./model.js";
import { LIBRARY } from "./furniture.js";
import { settle } from "./collide.js";
import { fromDxf, fromImage, pdfToImage } from "./recon.js";
import { CATALOG, place, label, group, entityPicker } from "./fromphoto.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const WORKER = new URL(`./pdf.worker.min.mjs?v=${__VERSION__}`, import.meta.url).href; // copied next to the chunks at build time

export function importPanel(ed, a) {
  const aiTasks = Object.keys(ed._hass.states).filter((e) => e.startsWith("ai_task."));
  a.innerHTML = `<h2><ha-icon icon="mdi:file-image-plus-outline"></ha-icon>${t("Import")}</h2>
    <div class="card"><b>${t("From CAD or PDF")}</b><span class="tip">DXF · PDF · JPG · PNG. Walls become rooms; gaps become doors and windows.</span>
      <label><button class="primary" data-pick-plan><ha-icon icon="mdi:upload"></ha-icon>Choose file</button><input type="file" data-plan accept=".dxf,.pdf,.png,.jpg,.jpeg,.webp" hidden></label>
      <div data-plan-out></div></div>
    <div class="card"><b>${t("From a photo")}</b><span class="tip">${t("A photo of a room. Furniture, ceiling lights, curtains, windows, the AC and the TV are found and put in place.")}</span>
      <select data-ai><option value="">${t("This device (free, private)")}</option>${aiTasks.map((e) => `<option value="${e}">${esc(ed._hass.states[e].attributes.friendly_name || e)}${t(" (more detail)")}</option>`).join("")}</select>
      <span class="tip" data-ai-tip></span>
      <label><button class="primary" data-pick-photo><ha-icon icon="mdi:camera-plus-outline"></ha-icon>${t("Choose photo")}</button><input type="file" data-photo accept="image/*" capture="environment" hidden></label>
      <div data-photo-out></div></div>`;
  const tip = () => { const v = a.querySelector("[data-ai]").value; a.querySelector("[data-ai-tip]").textContent = v ? t("Uses your AI provider. Best at telling light types apart and at sizes.") : t("Runs on this device: the photo never leaves it. The first time it downloads its reading model (about 150 MB) once."); };
  a.querySelector("[data-ai]").onchange = tip; tip();
  a.querySelector("[data-pick-plan]").onclick = () => a.querySelector("[data-plan]").click();
  a.querySelector("[data-pick-photo]").onclick = () => a.querySelector("[data-photo]").click();
  a.querySelector("[data-plan]").onchange = (e) => e.target.files[0] && planFile(ed, a.querySelector("[data-plan-out]"), e.target.files[0]);
  a.querySelector("[data-photo]").onchange = (e) => e.target.files[0] && photoFile(ed, a.querySelector("[data-photo-out]"), e.target.files[0], a.querySelector("[data-ai]")?.value);
}

async function planFile(ed, out, file) {
  out.innerHTML = `<span class="tip">Reading ${esc(file.name)}…</span>`;
  try {
    const ext = file.name.split(".").pop().toLowerCase();
    let src, result;
    const opts = { gap: 1.0 };
    if (ext === "dxf") { const text = await file.text(); result = await fromDxf(text, opts); return show(ed, out, result, null, (o) => fromDxf(text, o), opts); }
    else {
      src = ext === "pdf" ? await pdfToImage(await file.arrayBuffer(), WORKER) : await loadImage(file);
      await new Promise((r) => setTimeout(r, 20));
      result = fromImage(src, opts);
    }
    show(ed, out, result, src, async (o) => fromImage(src, o), opts);
  } catch (err) { out.innerHTML = `<span class="tip">Could not read this file: ${esc(err.message || err)}</span>`; console.warn(err); }
}
function show(ed, out, r, src, redo, opts) {
  const width = r.size?.[0];
  const again = async (o) => { Object.assign(opts, o); out.querySelector("[data-use]").setAttribute("disabled", ""); show(ed, out, await redo(opts), src, redo, opts); };
  out.innerHTML = `<div class="row between"><span>${t("Rooms")}</span><b>${r.rooms.length}</b></div><div class="row between"><span>${t("Doors")} / ${t("Window")}</span><b>${r.openings.length}</b></div>${r.items?.length ? `<div class="row between"><span>${t("Furniture")}</span><b>${r.items.length}</b></div>` : ""}
    ${src ? `<label class="sl"><span>Drawing width</span><b data-o>${width} m</b><input type="range" data-scale min="${round(width * 0.4, 1)}" max="${round(width * 2.5, 1)}" step="0.1" value="${width}"></label><span class="tip">Move until the rooms have their real size (a door is about 0.9 m).</span>` : ""}
    <div class="field"><span class="tip">Widest doorway between rooms</span><div class="seg"><button data-gap="1" class="${opts.gap < 1.4 ? "on" : ""}">Normal doors</button><button data-gap="1.9" class="${opts.gap >= 1.4 ? "on" : ""}">Wide double doors</button></div></div>
    <div class="row"><button class="primary" data-use><ha-icon icon="mdi:check"></ha-icon>Use this plan</button></div>`;
  out.querySelector("[data-scale]")?.addEventListener("input", (e) => (out.querySelector("[data-o]").textContent = `${e.target.value} m`));
  out.querySelector("[data-scale]")?.addEventListener("change", (e) => again({ metresPerPx: +e.target.value / src.width }));
  out.querySelectorAll("[data-gap]").forEach((b) => (b.onclick = () => again({ gap: +b.dataset.gap })));
  out.querySelector("[data-use]").onclick = () => {
    ed.snapshot();
    // move the drawing so it starts at 0,0
    const xs = r.rooms.flatMap((x) => x.pts.map((p) => p[0])), ys = r.rooms.flatMap((x) => x.pts.map((p) => p[1])), ox = Math.min(...xs), oy = Math.min(...ys);
    const sh = (o) => { o.x = round(o.x - ox, 3); o.y = round(o.y - oy, 3); };
    for (const x of r.rooms) x.pts = x.pts.map(([px, py]) => [round(px - ox, 3), round(py - oy, 3)]);
    r.openings.forEach(sh); (r.items || []).forEach(sh);
    // the outside door nearest the bottom is the main door
    ed.floor.rooms = r.rooms; ed.floor.openings = r.openings; ed.floor.items = r.items || []; ed.floor.devices = [];
    ed.sel = null; ed.changed(); ed.fit(); ed.view.engine._framed = false; ed.view.setPlan(ed.plan, ed.fi); ed.view.engine.frame("3d", true); ed.setTool("check");
  };
}
function loadImage(file) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Not an image")); i.src = URL.createObjectURL(file); }); }

async function photoFile(ed, out, file, entity) {
  out.innerHTML = `<span class="tip">${t("Looking at the photo… this takes about half a minute")}</span>`;
  try {
    const small = await shrink(file);
    if (!entity) {
      // on this device: no upload, no cloud
      const { readPhotoLocally } = await import("./ai/detect.js");
      const found = await readPhotoLocally(small, (p) => {
        const tipEl = out.querySelector(".tip"); if (!tipEl) return;
        tipEl.textContent = p.reading ? t("Looking at the photo…") : `${t("Getting the reading model ready (once)")} · ${Math.round((100 * p.loaded) / p.total)}%`;
      });
      reviewFound(ed, out, found, URL.createObjectURL(small));
      return;
    }
    const body = new FormData(); body.append("file", small, "room.jpg");
    const resp = await ed._hass.fetchWithAuth("/api/roost_atelier/upload", { method: "POST", body });
    if (!resp.ok) throw new Error(await resp.text());
    const { file: name } = await resp.json();
    const res = await ed._hass.connection.sendMessagePromise({ type: "roost_atelier/recognize", file: name, entity_id: entity });
    reviewFound(ed, out, res.items || [], URL.createObjectURL(small));
  } catch (err) { out.innerHTML = `<span class="tip">${/fetch|network|Failed to load/i.test(String(err?.message)) ? t("Could not download the reading model. Check the internet connection and try again.") : esc(err.message || err)}</span>`; console.warn(err); }
}

// what was found, grouped, each one on or off; which room and which wall the photo faces; then add
export function reviewFound(ed, out, found, pic) {
  found = found.filter((x) => CATALOG[x.kind]);
  if (!found.length) { out.innerHTML = `<span class="tip">${t("Nothing was recognised. Try a wider, brighter photo.")}</span>`; return; }
  const rooms = ed.floor.rooms.filter((r) => !ROOM_TYPES[r.type]?.outdoor);
  if (!rooms.length) { out.innerHTML = `<span class="tip">${t("Draw the room first, then add what is in it from a photo.")}</span>`; return; }
  const st = { room: (rooms.find((r) => r.id === ed.sel?.id) || rooms[0]).id, facing: "top", on: found.map(() => true) };
  const pick = entityPicker(ed._hass);
  const GROUPS = [["furniture", "Furniture", "mdi:sofa-outline"], ["lights", "Ceiling lights", "mdi:lightbulb-group-outline"], ["devices", "Smart devices", "mdi:home-automation"], ["openings", "Windows and doors", "mdi:window-closed-variant"]];
  const draw = () => {
    const room = rooms.find((r) => r.id === st.room);
    out.innerHTML = `${pic ? `<img src="${pic}" style="width:100%;border-radius:14px;max-height:200px;object-fit:cover">` : ""}
      <div class="field"><h3>${t("Room")}</h3><select data-room>${rooms.map((r) => `<option value="${esc(r.id)}" ${r.id === st.room ? "selected" : ""}>${esc(r.name || t(ROOM_TYPES[r.type]?.name || "Room"))}</option>`).join("")}</select></div>
      <div class="field"><h3>${t("Which wall were you facing? (as drawn on the plan)")}</h3><div class="seg">${[["top", "mdi:arrow-up"], ["right", "mdi:arrow-right"], ["bottom", "mdi:arrow-down"], ["left", "mdi:arrow-left"]].map(([k, ic]) => `<button data-face="${k}" class="${st.facing === k ? "on" : ""}" title="${t(k)}"><ha-icon icon="${ic}"></ha-icon></button>`).join("")}</div></div>
      ${GROUPS.map(([g, title, ic]) => { const rows = found.map((x, i) => [x, i]).filter(([x]) => group(x.kind) === g); return rows.length ? `<div class="field"><h3><ha-icon icon="${ic}" style="--mdc-icon-size:14px"></ha-icon> ${t(title)}</h3><div class="list">${rows.map(([x, i]) => `<button data-i="${i}" class="${st.on[i] ? "on" : ""}"><span style="width:18px;height:18px;border-radius:6px;background:${/^#[0-9a-f]{6}$/i.test(x.colour || "") ? x.colour : "#9a9a9a"};flex:none"></span><span>${x.count > 1 ? `${x.count} × ` : ""}${esc(label(x.kind, t))}<small>${esc(x.name || "")}${x.w ? ` · ${[x.w, x.d, x.h].filter(Boolean).map((v) => round(v, 2)).join(" × ")} m` : ""}</small></span></button>`).join("")}</div></div>` : ""; }).join("")}
      <p class="tip">${t("Tap a line to leave it out. Everything can be moved afterwards.")}</p>
      <div class="row"><button class="primary" data-add><ha-icon icon="mdi:plus"></ha-icon>${t("Add to")} ${esc(room.name || t(ROOM_TYPES[room.type]?.name || "Room"))}</button></div>`;
    out.querySelector("[data-room]").onchange = (e) => { st.room = e.target.value; draw(); };
    out.querySelectorAll("[data-face]").forEach((b) => (b.onclick = () => { st.facing = b.dataset.face; draw(); }));
    out.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { st.on[+b.dataset.i] = !st.on[+b.dataset.i]; b.classList.toggle("on", st.on[+b.dataset.i]); }));
    out.querySelector("[data-add]").onclick = () => {
      const chosen = found.filter((_, i) => st.on[i]); if (!chosen.length) return;
      ed.snapshot();
      const r = place(chosen, { room, facing: st.facing, floor: ed.floor, H: ed.floor.height || 2.8, entityFor: pick });
      for (const it of r.items) { ed.floor.items.push(it); if (LIBRARY[it.kind]?.[6] === "floor") settle(it, ed.floor.items); }
      ed.floor.devices.push(...r.devices); ed.floor.openings.push(...r.openings);
      ed.changed();
      const linked = r.devices.filter((d) => d.entity).length;
      out.innerHTML = `<span class="tip">${t("Added")}: ${r.items.length} ${t("Furniture").toLowerCase()} · ${r.devices.length} ${t("Devices").toLowerCase()} · ${r.openings.length} ${t("Windows and doors").toLowerCase()}${linked ? ` · ${linked} ${t("linked to your devices")}` : ""}</span>`;
      ed.setTool("select");
    };
  };
  draw();
}
function shrink(file) {
  return loadImage(file).then((img) => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return new Promise((r) => c.toBlob(r, "image/jpeg", 0.88)); });
}
