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
  radar: { name: "Presence radar", icon: "mdi:radar", domains: ["sensor"], pick: (e) => /_target_1_x$/.test(e) },
};
// a presence radar (Athom, LD2450 and the like): where the people it sees are, in metres from it
export function radarTargets(dv, states) {
  const base = (dv.entity || "").replace(/_target_1_x$/, "");
  if (!base) return [];
  const out = [];
  for (let n = 1; n <= 3; n++) {
    const x = parseFloat(states?.[`${base}_target_${n}_x`]?.state), y = parseFloat(states?.[`${base}_target_${n}_y`]?.state);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) continue;
    out.push([Math.round(x) / 1000, Math.abs(Math.round(y)) / 1000]);
  }
  return out;
}
export const LIGHT_LOOKS = { pendant: "Pendant", chandelier: "Chandelier", spots: "Spotlights", flush: "Ceiling light", floor: "Floor lamp", downlight: "Recessed spot", panel: "LED panel", track: "Track light", linear: "Linear light", focus: "Focus light", wall: "Wall light", table: "Table lamp", bollard: "Garden bollard", uplight: "Ground uplight", step: "Step light", flood: "Floodlight" };
const BASE = { pendant: 30, chandelier: 45, spots: 22, flush: 30, floor: 14, downlight: 14, panel: 26, track: 12, linear: 16, focus: 10, wall: 12, table: 10, bollard: 10, uplight: 10, step: 6, flood: 18 };
// typical real output of each kind of fitting, in lumens, and its warmth in kelvin
export const LUMENS = { pendant: 900, chandelier: 2400, spots: 1200, flush: 1800, floor: 700, downlight: 600, panel: 1600, track: 500, linear: 900, focus: 450, wall: 500, table: 450, bollard: 300, uplight: 400, step: 120, flood: 2000 };
export const KELVIN = { pendant: 2700, chandelier: 2700, spots: 3000, flush: 3000, floor: 2700, downlight: 3000, panel: 4000, track: 3000, linear: 3000, focus: 3000, wall: 2700, table: 2700, bollard: 3000, uplight: 3000, step: 3000, flood: 4000 };
// lamps that aren't smart: when they are on
export const RULES = { demo: "Always on", on: "Always on", off: "Always off", night: "On after sunset", schedule: "On between set times" };
function ruleOn(dv, ctx) {
  const r = dv.rule || "demo";
  if (r === "off") return false;
  if (r === "night") return ctx.night ?? true;
  if (r === "schedule") {
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), p = (t) => { const [h, mm] = String(t || "0:0").split(":").map(Number); return h * 60 + (mm || 0); };
    const a = p(dv.from || "18:00"), b = p(dv.to || "23:00"); return a <= b ? m >= a && m < b : m >= a || m < b;
  }
  return true;
}
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
// pretend: a made-up Home Assistant state, used when the device has no working entity and is switched while testing.
export function stateOf(rec, states, editing, pretend) {
  const dv = rec.dv, st = (dv.entity ? states?.[dv.entity] : null) || pretend || null, a = st?.attributes || {};
  const kind = rec.kind;
  if (kind === "light") {
    const look = rec.look || "flush", lm = (dv.lumens || LUMENS[look] || 1200) * (dv.power || 1), warm = kelvinToHex(dv.kelvin || KELVIN[look] || 2700);
    if (!st) { const on = ruleOn(dv, rec.ctx || {}); return { on, intensity: (BASE[look] || 25) * (dv.power || 1), lm, color: warm, label: dv.entity ? "" : "" }; }
    const on = st.state === "on";
    const b = a.brightness != null ? Math.max(0.08, a.brightness / 255) : 1;
    let color = warm;
    if (a.rgb_color && a.color_mode && !/color_temp|brightness|onoff/.test(a.color_mode)) color = "#" + a.rgb_color.map((v) => v.toString(16).padStart(2, "0")).join("");
    else if (a.color_temp_kelvin) color = kelvinToHex(a.color_temp_kelvin);
    // dimmed bulbs give less light (lumens follow brightness)
    return { on, intensity: (BASE[look] || 25) * b * (dv.power || 1), lm: lm * b, color, label: on ? (a.brightness != null ? `${Math.round(b * 100)}%` : "On") : "Off" };
  }
  if (kind === "curtain") {
    if (!st) return { open: 1, label: "" };
    const open = a.current_position != null ? a.current_position / 100 : st.state === "open" || st.state === "opening" ? 1 : 0;
    const label = open <= 0.01 ? "Closed" : open >= 0.99 ? "Open" : `${Math.round(open * 100)}%`;
    return { open, label };
  }
  if (kind === "door" || kind === "lock") {
    if (!st) return { open: false, label: "" };
    const open = ["on", "open", "opening", "unlocked"].includes(st.state) && !(kind === "lock" && st.state === "unlocked" && !dv.swingOnUnlock);
    const label = { locked: "Locked", unlocked: "Unlocked", open: "Open", opening: "Open", closed: "Closed", on: "Open", off: "Closed", jammed: "Jammed", locking: "Locked", unlocking: "Unlocked" }[st.state] || st.state;
    return { open: kind === "lock" ? st.state === "open" : open, locked: st.state === "locked", label };
  }
  if (kind === "ac") {
    if (!st) return { on: false, label: "" };
    const on = !OFF.includes(st.state);
    return { on, label: on ? (a.temperature != null ? `${a.temperature}°` : "On") : "Off", current: a.current_temperature };
  }
  if (kind === "tv" || kind === "speaker") { if (!st) return { on: false, label: "" }; const on = !OFF.includes(st.state); return { on, label: on ? "On" : "Off", title: a.media_title }; }
  if (kind === "fan") { if (!st) return { on: false, label: "" }; const on = st.state === "on"; return { on, speed: (a.percentage ?? 70) / 100, label: on ? `${a.percentage ?? ""}%` : "Off" }; }
  if (kind === "person") { if (!st) return { on: editing, label: "" }; return { on: st.state === "home", label: st.state === "home" ? "Home" : "Away" }; }
  if (kind === "radar") {
    const people = editing && !dv.entity ? [[0.4, 1.6]] : radarTargets(dv, states);
    return { people, label: dv.entity ? (people.length ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "Nobody") : "" };
  }
  if (kind === "vacuum") { if (!st) return { on: false, label: "" }; return { on: st.state === "cleaning", label: st.state === "cleaning" ? "On" : "Off" }; }
  if (!st) return { label: "" };
  return { label: `${st.state}${a.unit_of_measurement ? " " + a.unit_of_measurement : ""}`, on: st.state === "on" };
}

// Switching a device while testing in the Atelier when it has no working entity: the next made-up state.
export function pretendNext(kind, now) {
  if (kind === "light") return now.on ? { state: "off", attributes: {} } : { state: "on", attributes: { brightness: 255 } };
  if (kind === "curtain") return now.open > 0.5 ? { state: "closed", attributes: { current_position: 0 } } : { state: "open", attributes: { current_position: 100 } };
  if (kind === "lock") return now.locked ? { state: "unlocked", attributes: {} } : { state: "locked", attributes: {} };
  if (kind === "door") return now.open ? { state: "closed", attributes: {} } : { state: "open", attributes: {} };
  if (kind === "ac") return now.on ? { state: "off", attributes: {} } : { state: "cool", attributes: { temperature: 22, current_temperature: 25 } };
  if (kind === "fan") return now.on ? { state: "off", attributes: {} } : { state: "on", attributes: { percentage: 70 } };
  if (kind === "vacuum") return now.on ? { state: "docked", attributes: {} } : { state: "cleaning", attributes: {} };
  if (kind === "tv" || kind === "speaker") return now.on ? { state: "off", attributes: {} } : { state: "playing", attributes: {} };
  return now.on ? { state: "off", attributes: {} } : { state: "on", attributes: {} };
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

// Every fitting in the device library, grouped like a lighting shop: [look, options, name, icon]
export const LIGHT_SUBS = {
  downlight: ["downlight", {}, "Recessed spot", "mdi:circle-small"],
  twin: ["downlight", { heads: 2 }, "Twin spot", "mdi:circle-multiple-outline"],
  deepspot: ["downlight", { style: "deep" }, "Anti-glare spot", "mdi:circle-double"],
  squarespot: ["downlight", { style: "square" }, "Square spot (AR111)", "mdi:square-small"],
  surfacespot: ["downlight", { style: "surface" }, "Surface spot", "mdi:cylinder"],
  panel: ["panel", {}, "Square LED panel", "mdi:square-rounded-outline"],
  roundpanel: ["panel", { shape: "round" }, "Round LED panel", "mdi:circle-outline"],
  flush: ["flush", {}, "Ceiling light", "mdi:ceiling-light"],
  slot: ["linear", { style: "slot", len: 2.4 }, "Magnetic slot light", "mdi:dots-horizontal-circle-outline"],
  track: ["track", {}, "Track light", "mdi:dots-horizontal"],
  linear: ["linear", {}, "Linear light", "mdi:minus-thick"],
  profile: ["linear", { style: "profile", len: 2 }, "Aluminium profile", "mdi:view-sequential-outline"],
  linpendant: ["linear", { style: "pendant", len: 1.2 }, "Linear pendant", "mdi:ceiling-light-multiple-outline"],
  cove: ["linear", { style: "cove" }, "Hidden cove", "mdi:border-top-variant"],
  neon: ["linear", { style: "neon", len: 1.5 }, "Neon flex", "mdi:led-strip-variant"],
  focus: ["focus", {}, "Focus light", "mdi:spotlight-beam"],
  pendant: ["pendant", {}, "Pendant", "mdi:ceiling-light-outline"],
  bulbpendant: ["pendant", { style: "bulb" }, "Filament bulb pendant", "mdi:lightbulb-outline"],
  globe: ["pendant", { style: "glass" }, "Glass globe pendant", "mdi:circle-opacity"],
  chandelier: ["chandelier", {}, "Chandelier", "mdi:chandelier"],
  wall: ["wall", {}, "Wall light", "mdi:wall-sconce-flat-outline"],
  reading: ["wall", { style: "reading" }, "Bedside reading light", "mdi:desk-lamp"],
  table: ["table", {}, "Table lamp", "mdi:lamp-outline"],
  desk: ["table", { style: "desk" }, "Desk lamp", "mdi:desk-lamp-on"],
  floor: ["floor", {}, "Floor lamp", "mdi:floor-lamp-outline"],
  washer: ["linear", { style: "washer", len: 1.2 }, "Wall washer", "mdi:wall-sconce-flat-variant"],
  step: ["step", {}, "Step light", "mdi:stairs"],
  bollard: ["bollard", {}, "Garden bollard", "mdi:coach-lamp"],
  uplight: ["uplight", {}, "Ground uplight", "mdi:spotlight"],
  flood: ["flood", {}, "Floodlight", "mdi:light-flood-down"],
};
export const LIGHT_GROUPS = [
  ["Ceiling lights", ["downlight", "twin", "deepspot", "squarespot", "surfacespot", "panel", "roundpanel", "flush", "focus"]],
  ["Lines and tracks", ["slot", "track", "linear", "profile", "linpendant", "cove", "neon"]],
  ["Hanging lights", ["pendant", "bulbpendant", "globe", "chandelier"]],
  ["Wall, table and floor", ["wall", "reading", "table", "desk", "floor", "washer"]],
  ["Outdoor", ["step", "bollard", "uplight", "flood"]],
];
