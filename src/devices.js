// How each Home Assistant thing looks and behaves in the 3D home.
export function deviceKind(entity = "") {
  const d = entity.split(".")[0];
  return { light: "light", switch: "light", climate: "ac", cover: "curtain", lock: "lock", media_player: "tv", fan: "fan", person: "person", device_tracker: "person", vacuum: "vacuum", binary_sensor: "door" }[d] || "sensor";
}
export const KINDS = {
  light: { name: "Light", icon: "mdi:lightbulb", domains: ["light", "switch"] },
  ac: { name: "Air conditioner", icon: "mdi:air-conditioner", domains: ["climate", "fan", "switch"] },
  curtain: { name: "Curtain or blind", icon: "mdi:curtains", domains: ["cover"] },
  tv: { name: "TV", icon: "mdi:television", domains: ["media_player", "switch"] },
  door: { name: "Door", icon: "mdi:door", domains: ["binary_sensor", "lock", "cover"] },
  lock: { name: "Lock", icon: "mdi:lock", domains: ["lock"] },
  fan: { name: "Ceiling fan", icon: "mdi:ceiling-fan", domains: ["fan", "switch"] },
  person: { name: "Person", icon: "mdi:account", domains: ["person", "device_tracker"] },
  speaker: { name: "Speaker", icon: "mdi:speaker", domains: ["media_player"] },
  vacuum: { name: "Robot vacuum", icon: "mdi:robot-vacuum", domains: ["vacuum"] },
  sensor: { name: "Sensor", icon: "mdi:thermometer", domains: ["sensor", "binary_sensor"] },
};
export const LIGHT_LOOKS = { pendant: "Pendant", chandelier: "Chandelier", spots: "Spotlights", flush: "Ceiling light", floor: "Floor lamp" };
const BASE = { pendant: 30, chandelier: 45, spots: 22, flush: 30, floor: 14 };
export const lightLook = (dv) => dv.look || "flush";

export function kelvinToHex(k) {
  const t = k / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * (t - 60) ** -0.1332; g = 288.12 * (t - 60) ** -0.0755; b = 255; }
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
const OFF = ["off", "standby", "unavailable", "unknown", "idle", "paused"];

// The state a device should show. Without a linked entity it shows a calm demo state so the home looks alive.
export function stateOf(rec, states, editing) {
  const dv = rec.dv, st = dv.entity ? states?.[dv.entity] : null, a = st?.attributes || {};
  const kind = rec.kind;
  if (kind === "light") {
    if (!st) return { on: !!(dv.demo ?? true), intensity: (BASE[rec.look] || 25) * (dv.power || 1), color: "#ffcf96", label: "" };
    const on = st.state === "on";
    const b = a.brightness != null ? Math.max(0.08, a.brightness / 255) : 1;
    let color = "#ffcf96";
    if (a.rgb_color && a.color_mode && !/color_temp|brightness|onoff/.test(a.color_mode)) color = "#" + a.rgb_color.map((v) => v.toString(16).padStart(2, "0")).join("");
    else if (a.color_temp_kelvin) color = kelvinToHex(a.color_temp_kelvin);
    return { on, intensity: (BASE[rec.look] || 25) * b * (dv.power || 1), color, label: on ? (a.brightness != null ? `${Math.round(b * 100)}%` : "On") : "Off" };
  }
  if (kind === "curtain") {
    if (!st) return { open: 1, label: "" };
    const open = a.current_position != null ? a.current_position / 100 : st.state === "open" || st.state === "opening" ? 1 : 0;
    return { open, label: a.current_position != null ? `${a.current_position}%` : st.state };
  }
  if (kind === "door" || kind === "lock") {
    if (!st) return { open: false, label: "" };
    const open = ["on", "open", "opening", "unlocked"].includes(st.state) && !(kind === "lock" && st.state === "unlocked" && !dv.swingOnUnlock);
    return { open: kind === "lock" ? st.state === "open" : open, locked: st.state === "locked", label: st.state };
  }
  if (kind === "ac") {
    if (!st) return { on: false, label: "" };
    const on = !OFF.includes(st.state);
    return { on, label: on ? (a.temperature != null ? `${a.temperature}°` : "On") : "Off", current: a.current_temperature };
  }
  if (kind === "tv" || kind === "speaker") { if (!st) return { on: false, label: "" }; const on = !OFF.includes(st.state); return { on, label: on ? a.media_title || "On" : "Off" }; }
  if (kind === "fan") { if (!st) return { on: false, label: "" }; const on = st.state === "on"; return { on, speed: (a.percentage ?? 70) / 100, label: on ? `${a.percentage ?? ""}%` : "Off" }; }
  if (kind === "person") { if (!st) return { on: editing, label: "" }; return { on: st.state === "home", label: st.state === "home" ? "Home" : "Away" }; }
  if (kind === "vacuum") { if (!st) return { on: false, label: "" }; return { on: st.state === "cleaning", label: st.state }; }
  if (!st) return { label: "" };
  return { label: `${st.state}${a.unit_of_measurement ? " " + a.unit_of_measurement : ""}`, on: st.state === "on" };
}

// What a tap does.
export function tapAction(hass, entity) {
  if (!entity || !hass) return false;
  const d = entity.split(".")[0];
  const call = (dom, svc) => hass.callService(dom, svc, { entity_id: entity });
  if (["light", "switch", "fan", "input_boolean", "media_player", "climate"].includes(d)) return call(d === "climate" ? "climate" : d === "media_player" ? "media_player" : "homeassistant", "toggle");
  if (d === "cover") return call("cover", "toggle");
  if (d === "lock") return call("lock", hass.states[entity]?.state === "locked" ? "unlock" : "lock");
  if (d === "vacuum") return call("vacuum", hass.states[entity]?.state === "cleaning" ? "return_to_base" : "start");
  if (d === "scene" || d === "script") return call(d, "turn_on");
  return false;
}
