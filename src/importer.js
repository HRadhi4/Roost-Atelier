// Import: a CAD drawing, a PDF or a picture of a plan becomes rooms, doors and windows;
// a photo of a room becomes furniture, recognised by Home Assistant's own AI.
import { t } from "./i18n.js";
import { uid, round, centroid, inside, ROOM_TYPES } from "./model.js";
import { LIBRARY } from "./furniture.js";
import { fromDxf, fromImage, pdfToImage } from "./recon.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const KIND_MAP = { stove: "kitchen_base", sink_cabinet: "kitchen_base", cabinet: "dresser", ac_split: null, curtain: null };
const WORKER = new URL("./pdf.worker.min.mjs", import.meta.url).href; // copied next to the chunks at build time

export function importPanel(ed, a) {
  const aiTasks = Object.keys(ed._hass.states).filter((e) => e.startsWith("ai_task."));
  a.innerHTML = `<h2><ha-icon icon="mdi:file-image-plus-outline"></ha-icon>${t("Import")}</h2>
    <div class="card"><b>${t("From CAD or PDF")}</b><span class="tip">DXF · PDF · JPG · PNG. Walls become rooms; gaps become doors and windows.</span>
      <label><button class="primary" data-pick-plan><ha-icon icon="mdi:upload"></ha-icon>Choose file</button><input type="file" data-plan accept=".dxf,.pdf,.png,.jpg,.jpeg,.webp" hidden></label>
      <div data-plan-out></div></div>
    <div class="card"><b>${t("From a photo")}</b><span class="tip">A photo of a room. Each piece of furniture is named with its colour and size.</span>
      ${aiTasks.length ? `<select data-ai>${aiTasks.map((e) => `<option value="${e}">${esc(ed._hass.states[e].attributes.friendly_name || e)}</option>`).join("")}</select>` : `<span class="tip">Needs an AI Task in Home Assistant (Settings → Devices &amp; services → add an AI provider such as Google Gemini, OpenAI or Ollama).</span>`}
      <label><button class="primary" data-pick-photo ${aiTasks.length ? "" : "disabled"}><ha-icon icon="mdi:camera-plus-outline"></ha-icon>Choose photo</button><input type="file" data-photo accept="image/*" capture="environment" hidden></label>
      <div data-photo-out></div></div>`;
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
  out.innerHTML = `<span class="tip">Looking at the photo…</span>`;
  try {
    const small = await shrink(file);
    const body = new FormData(); body.append("file", small, "room.jpg");
    const resp = await ed._hass.fetchWithAuth("/api/roost_atelier/upload", { method: "POST", body });
    if (!resp.ok) throw new Error(await resp.text());
    const { file: name } = await resp.json();
    const res = await ed._hass.connection.sendMessagePromise({ type: "roost_atelier/recognize", file: name, entity_id: entity });
    const items = res.items.map((x) => ({ ...x, kind: KIND_MAP[x.kind] === undefined ? x.kind : KIND_MAP[x.kind] })).filter((x) => x.kind && LIBRARY[x.kind]);
    if (!items.length) { out.innerHTML = `<span class="tip">No furniture was recognised. Try a wider, brighter photo.</span>`; return; }
    const room = ed.floor.rooms.find((r) => r.id === ed.sel?.id) || ed.floor.rooms.find((r) => !ROOM_TYPES[r.type]?.outdoor);
    out.innerHTML = `<div class="list">${items.map((x, i) => `<button data-i="${i}" class="on"><span style="width:18px;height:18px;border-radius:6px;background:${esc(x.colour)};flex:none"></span><span>${esc(LIBRARY[x.kind][0])}<small>${[x.w, x.d, x.h].filter(Boolean).map((v) => round(v, 2)).join(" × ")}${x.w ? " m" : ""} · ${esc(x.material)}</small></span></button>`).join("")}</div>
      <div class="row"><button class="primary" data-add><ha-icon icon="mdi:plus"></ha-icon>${t("Add")}${room ? ` → ${esc(room.name || ROOM_TYPES[room.type]?.name)}` : ""}</button></div>`;
    out.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => b.classList.toggle("on")));
    out.querySelector("[data-add]").onclick = () => {
      const pick = [...out.querySelectorAll("[data-i].on")].map((b) => items[+b.dataset.i]); if (!pick.length) return;
      ed.snapshot();
      const [cx, cy] = room ? centroid(room.pts) : [0, 0], where = { left: -1, centre: 0, center: 0, right: 1 };
      pick.forEach((x, n) => {
        let px = cx + (where[x.where] ?? 0) * 1.2 + ((n % 3) - 1) * 0.3, py = cy + (Math.floor(n / 3) - 0.5) * 0.9;
        if (room && !inside([px, py], room.pts)) [px, py] = [cx, cy];
        const it = { id: uid("i"), kind: x.kind, x: round(px, 3), y: round(py, 3), rot: 0, color: /^#[0-9a-f]{6}$/i.test(x.colour) ? x.colour : undefined };
        if (x.w) it.w = round(x.w, 2); if (x.d) it.d = round(x.d, 2); if (x.h) it.h = round(x.h, 2);
        ed.floor.items.push(it);
      });
      ed.changed(); out.innerHTML = `<span class="tip">${t("Done")} · ${pick.length}</span>`; ed.setTool("select");
    };
  } catch (err) { out.innerHTML = `<span class="tip">${esc(err.message || err)}</span>`; console.warn(err); }
}
function shrink(file) {
  return loadImage(file).then((img) => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return new Promise((r) => c.toBlob(r, "image/jpeg", 0.88)); });
}
