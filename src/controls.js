// The controls for one device, in plain words: shown in the small pop-up next to it (3D and top views)
// and in the side panel of the room you are walking in. Built from the device's real state in Home Assistant.
import { t } from "./i18n.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MODES = { off: ["Off", "mdi:power"], cool: ["Cool", "mdi:snowflake"], dry: ["Dry", "mdi:water-percent"], fan_only: ["Fan", "mdi:fan"], heat: ["Heat", "mdi:fire"], heat_cool: ["Auto", "mdi:autorenew"], auto: ["Auto", "mdi:autorenew"] };

export const CONTROLS_CSS = `
.ctl{display:flex;flex-direction:column;gap:10px;font:500 13px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;color:#EEF0FF}
.ctl .hd{display:flex;align-items:center;gap:10px}
.ctl .hd .ic{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c);flex:none}
.ctl .hd .ic ra-icon{--mdc-icon-size:20px}
.ctl .hd b{display:block;font:600 14px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;white-space:normal;overflow-wrap:anywhere}
.ctl .hd small{display:block;color:#9AA3D9;font-size:12px;margin-top:1px}
.ctl .hd .tx{min-width:0;flex:1}
.ctl button{all:unset;box-sizing:border-box;cursor:pointer;height:40px;min-width:40px;padding:0 12px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,.08);color:#EEF0FF;font:600 12px Inter,-apple-system,'Segoe UI',Roboto,sans-serif;transition:background .12s,transform .12s;-webkit-tap-highlight-color:transparent}
.ctl button:active{transform:scale(.94)}
.ctl button.on{background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 70%,#fff));color:#fff}
.ctl button ra-icon{--mdc-icon-size:18px}
.ctl .pw{width:40px;padding:0;flex:none}
.ctl .row{display:flex;gap:6px;align-items:center}
.ctl .row>button{flex:1}
.ctl .big{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ctl .big b{font:600 26px "Space Grotesk",Inter,-apple-system,'Segoe UI',Roboto,sans-serif}
.ctl .sl{display:flex;flex-direction:column;gap:4px}
.ctl .sl span{display:flex;justify-content:space-between;color:#9AA3D9;font-size:12px}
.ctl input[type=range]{width:100%;accent-color:var(--c);height:24px;margin:0}
.ctl .chips{display:flex;flex-wrap:wrap;gap:6px}
.ctl .chips button{flex:1 0 auto;height:36px}
.ctl select{all:unset;box-sizing:border-box;height:36px;padding:0 10px;border-radius:12px;background:rgba(255,255,255,.08);width:100%}
.ctl .more{color:#9AA3D9;background:transparent;height:32px}
`;

const icons = { light: "mdi:lightbulb", switch: "mdi:power-socket", climate: "mdi:air-conditioner", cover: "mdi:curtains", media_player: "mdi:television", fan: "mdi:fan", lock: "mdi:lock", vacuum: "mdi:robot-vacuum" };

// a short plain word for the state
function stateWord(st, dom) {
  if (!st) return t("Not found");
  const s = st.state, a = st.attributes;
  if (s === "unavailable" || s === "unknown") return t("Not reachable");
  if (dom === "cover") { const p = a.current_position; if (p == null) return t(s === "open" ? "Open" : s === "closed" ? "Closed" : s[0].toUpperCase() + s.slice(1)); return p <= 10 ? t("Closed") : p >= 90 ? t("Open") : `${p}% ${t("open")}`; }
  if (dom === "climate") return s === "off" ? t("Off") : `${t(MODES[s]?.[0] || s)}${a.current_temperature != null ? ` · ${t("Room")} ${a.current_temperature}°` : ""}`;
  if (dom === "light" && s === "on" && a.brightness != null) return `${t("On")} · ${Math.round(a.brightness / 2.55)}%`;
  if (dom === "media_player") return s === "off" || s === "standby" ? t("Off") : s === "playing" ? t("Playing") : s === "paused" ? t("Paused") : t("On");
  if (dom === "lock") return t(s === "locked" ? "Locked" : s === "unlocked" ? "Unlocked" : s);
  return t(s === "on" ? "On" : s === "off" ? "Off" : s);
}
export function isOn(st) { return !!st && !["off", "closed", "locked", "standby", "unavailable", "unknown", "idle", "docked"].includes(st.state); }

// the HTML for one device. name: what to call it; c: its colour
export function controlsHtml(hass, entity, name, c, { compact = false } = {}) {
  const st = hass?.states[entity], dom = entity?.split(".")[0], a = st?.attributes || {}, on = isOn(st);
  let h = `<div class="ctl" data-e="${esc(entity)}" style="--c:${c}"><div class="hd"><span class="ic"><ra-icon icon="${esc(a.icon || icons[dom] || "mdi:circle")}"></ra-icon></span><span class="tx"><b>${esc(name || a.friendly_name || entity)}</b><small>${esc(stateWord(st, dom))}</small></span>`;
  const pw = ["light", "switch", "fan", "climate", "media_player", "input_boolean"].includes(dom) ? `<button class="pw ${on ? "on" : ""}" data-a="power" aria-label="${t("On or off")}"><ra-icon icon="mdi:power"></ra-icon></button>` : "";
  h += pw + `</div>`;
  if (!st || compact) return h + `</div>`;
  if (dom === "light" && (a.supported_color_modes || []).some((m) => m !== "onoff")) {
    h += `<label class="sl"><span>${t("Brightness")}<b data-o="bri">${on ? Math.round((a.brightness || 0) / 2.55) : 0}%</b></span><input type="range" data-a="bri" min="1" max="100" value="${on ? Math.max(1, Math.round((a.brightness || 0) / 2.55)) : 1}"></label>`;
    if ((a.supported_color_modes || []).includes("color_temp") && a.min_color_temp_kelvin) h += `<label class="sl"><span>${t("Warmth")}<b data-o="ct">${a.color_temp_kelvin || ""} K</b></span><input type="range" data-a="ct" min="${a.min_color_temp_kelvin}" max="${a.max_color_temp_kelvin}" step="50" value="${a.color_temp_kelvin || a.min_color_temp_kelvin}"></label>`;
  }
  if (dom === "climate") {
    const tt = a.temperature;
    if (tt != null) h += `<div class="big"><button data-a="tdown" aria-label="${t("Cooler")}"><ra-icon icon="mdi:minus"></ra-icon></button><b>${tt}°</b><button data-a="tup" aria-label="${t("Warmer")}"><ra-icon icon="mdi:plus"></ra-icon></button></div>`;
    const modes = (a.hvac_modes || []).filter((m) => MODES[m] && m !== "off");
    if (modes.length) h += `<div class="chips">${modes.map((m) => `<button data-a="mode" data-v="${m}" class="${st.state === m ? "on" : ""}"><ra-icon icon="${MODES[m][1]}"></ra-icon>${t(MODES[m][0])}</button>`).join("")}</div>`;
  }
  if (dom === "cover") {
    h += `<div class="row"><button data-a="close"><ra-icon icon="mdi:arrow-collapse-horizontal"></ra-icon>${t("Close")}</button><button data-a="stop"><ra-icon icon="mdi:stop"></ra-icon></button><button data-a="open"><ra-icon icon="mdi:arrow-expand-horizontal"></ra-icon>${t("Open")}</button></div>`;
    if (a.current_position != null) h += `<label class="sl"><span>${t("How open")}<b data-o="pos">${a.current_position}%</b></span><input type="range" data-a="pos" min="0" max="100" value="${a.current_position}"></label>`;
  }
  if (dom === "fan" && a.percentage != null) h += `<label class="sl"><span>${t("Speed")}<b data-o="spd">${a.percentage}%</b></span><input type="range" data-a="spd" min="0" max="100" step="${a.percentage_step || 1}" value="${a.percentage}"></label>`;
  if (dom === "media_player" && on) {
    h += `<div class="row"><button data-a="vdown" aria-label="${t("Quieter")}"><ra-icon icon="mdi:volume-minus"></ra-icon></button><button data-a="mute" class="${a.is_volume_muted ? "on" : ""}" aria-label="${t("Mute")}"><ra-icon icon="mdi:volume-off"></ra-icon></button><button data-a="vup" aria-label="${t("Louder")}"><ra-icon icon="mdi:volume-plus"></ra-icon></button><button data-a="play" aria-label="${t("Play or pause")}"><ra-icon icon="${st.state === "playing" ? "mdi:pause" : "mdi:play"}"></ra-icon></button></div>`;
    if (a.source_list?.length) h += `<select data-a="source">${a.source_list.map((s) => `<option ${s === a.source ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`;
  }
  if (dom === "lock") h += `<div class="row"><button data-a="lock" class="${st.state === "locked" ? "on" : ""}"><ra-icon icon="mdi:lock"></ra-icon>${t("Lock")}</button><button data-a="unlock" class="${st.state === "unlocked" ? "on" : ""}"><ra-icon icon="mdi:lock-open-variant"></ra-icon>${t("Unlock")}</button></div>`;
  if (dom === "vacuum") h += `<div class="row"><button data-a="vstart"><ra-icon icon="mdi:play"></ra-icon>${t("Clean")}</button><button data-a="vdock"><ra-icon icon="mdi:home-import-outline"></ra-icon>${t("Back to dock")}</button></div>`;
  h += `<button class="more" data-a="more"><ra-icon icon="mdi:dots-horizontal"></ra-icon>${t("More")}</button></div>`;
  return h;
}

// what each button does
export function bindControls(root, hass, onMore) {
  root.querySelectorAll(".ctl").forEach((box) => {
    const e = box.dataset.e, dom = e.split(".")[0], st = () => hass().states[e], call = (d, s, data = {}) => hass().callService(d, s, { entity_id: e, ...data });
    const act = (a, v) => {
      const s = st(), at = s?.attributes || {};
      if (a === "power") return dom === "climate" ? call("climate", isOn(s) ? "turn_off" : "turn_on") : dom === "media_player" ? call("media_player", isOn(s) ? "turn_off" : "turn_on") : call("homeassistant", isOn(s) ? "turn_off" : "turn_on");
      if (a === "bri") return call("light", "turn_on", { brightness_pct: +v });
      if (a === "ct") return call("light", "turn_on", { color_temp_kelvin: +v });
      if (a === "tup" || a === "tdown") { const step = at.target_temp_step || (at.temperature_unit === "°F" ? 1 : 0.5), nv = Math.max(at.min_temp ?? 16, Math.min(at.max_temp ?? 30, (at.temperature ?? 24) + (a === "tup" ? step : -step))); return call("climate", "set_temperature", { temperature: nv }); }
      if (a === "mode") return call("climate", "set_hvac_mode", { hvac_mode: v });
      if (a === "open" || a === "close" || a === "stop") return call("cover", `${a}_cover`);
      if (a === "pos") return call("cover", "set_cover_position", { position: +v });
      if (a === "spd") return call("fan", "set_percentage", { percentage: +v });
      if (a === "vup" || a === "vdown") return call("media_player", a === "vup" ? "volume_up" : "volume_down");
      if (a === "mute") return call("media_player", "volume_mute", { is_volume_muted: !at.is_volume_muted });
      if (a === "play") return call("media_player", "media_play_pause");
      if (a === "source") return call("media_player", "select_source", { source: v });
      if (a === "lock" || a === "unlock") return call("lock", a);
      if (a === "vstart") return call("vacuum", "start");
      if (a === "vdock") return call("vacuum", "return_to_base");
      if (a === "more") return onMore?.(e);
    };
    box.querySelectorAll("button[data-a]").forEach((b) => b.addEventListener("click", (ev) => { ev.stopPropagation(); act(b.dataset.a, b.dataset.v); }));
    box.querySelectorAll("input[data-a]").forEach((i) => {
      const out = box.querySelector(`[data-o="${i.dataset.a}"]`);
      i.addEventListener("input", () => { box.dataset.busy = "1"; if (out) out.textContent = `${i.value}${i.dataset.a === "ct" ? " K" : "%"}`; });
      i.addEventListener("change", () => { act(i.dataset.a, i.value); setTimeout(() => delete box.dataset.busy, 1500); });
      for (const ev of ["pointerdown", "touchstart"]) i.addEventListener(ev, (x) => x.stopPropagation(), { passive: true });
    });
    box.querySelector("select[data-a]")?.addEventListener("change", (ev) => act("source", ev.target.value));
  });
}
