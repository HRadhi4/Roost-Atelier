// Home Assistant already knows which room each device is in (its area). Once the rooms are drawn, every light,
// AC, curtain, TV, fan, lock, vacuum and sensor of an area is put in the room with the same name, at a sensible
// spot: lights in an even grid on the ceiling (or linked to lights already drawn there), the AC high on the longest
// wall without a window, curtains on the windows, the TV opposite the sofa, the fan in the middle, locks and door
// sensors on the doors. Things already placed are never moved, and a device taken out is not put back.
import { uid, round, bounds, inside, centroid, nearestWall, area } from "./model.js";

const LIGHTY = /(light|lamp|lights|spot|led|chandelier|pendant|ضوء|إضاءة|اضاءة|انارة|إنارة|لمبة|نجفة|سبوت)/i;
const TVY = /(tv|television|تلفاز|تلفزيون|شاشة)/i;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").replace(/\b(the|room|area)\b/g, " ").replace(/\s+/g, " ").trim();
// common names for the same room
const SAME = [["living", "lounge", "salon", "family", "صالة", "معيشة"], ["master", "main bedroom", "parents"], ["bedroom", "bed", "غرفة نوم", "نوم"],
  ["kitchen", "مطبخ"], ["bathroom", "bath", "toilet", "wc", "حمام"], ["majlis", "مجلس", "guest"], ["office", "study", "مكتب"], ["dining", "طعام"],
  ["entrance", "hall", "hallway", "corridor", "مدخل", "ممر"], ["balcony", "terrace", "شرفة", "بلكونة"], ["garden", "yard", "حديقة"], ["laundry", "غسيل"]];

// how well an area name fits a room name: 1 exact, lower for partial or synonym matches, 0 none
export function nameFit(area, room) {
  const a = norm(area), r = norm(room);
  if (!a || !r) return 0;
  if (a === r) return 1;
  if (a.includes(r) || r.includes(a)) return 0.8;
  const words = (s) => new Set(s.split(" ").filter((w) => w.length > 1));
  const wa = words(a), wr = words(r), shared = [...wa].filter((w) => wr.has(w)).length;
  if (shared) return 0.5 + 0.2 * (shared / Math.max(wa.size, wr.size));
  for (const g of SAME) if (g.some((x) => a.includes(x)) && g.some((x) => r.includes(x))) return 0.45;
  return 0;
}

// what a Home Assistant entity becomes on the plan (null: not something the plan shows)
export function kindOf(entityId, st, reg) {
  const d = entityId.split(".")[0], a = st?.attributes || {}, name = `${a.friendly_name || ""} ${entityId}`, dc = a.device_class || reg?.device_class;
  if (reg?.hidden || reg?.entity_category) return null;
  if (d === "light") return a.entity_id ? null : "light"; // light groups are not lights
  if (d === "switch") return LIGHTY.test(name) || /lightbulb|ceiling-light|lamp|led/.test(a.icon || "") ? "light" : null;
  if (d === "climate") return "ac";
  if (d === "cover") return ["garage", "gate", "door"].includes(dc) ? null : "curtain";
  if (d === "media_player") return dc === "tv" || TVY.test(name) ? "tv" : dc === "speaker" ? "speaker" : null;
  if (d === "fan") return "fan";
  if (d === "lock") return "lock";
  if (d === "vacuum") return "vacuum";
  if (d === "binary_sensor") return ["door", "window", "garage_door", "opening"].includes(dc) ? (dc === "window" ? null : "door") : null;
  if (d === "sensor" && /_target_1_x$/.test(entityId)) return "radar";
  return null;
}

// one entity per Home Assistant device (a device with a light and its power switch is one light)
function devicesOf(hass) {
  const S = hass.states || {}, E = hass.entities || {}, D = hass.devices || {}, A = hass.areas || {};
  const out = [], seen = new Set();
  const order = { light: 0, climate: 0, cover: 0, media_player: 0, fan: 0, lock: 0, vacuum: 0, switch: 1, binary_sensor: 2, sensor: 3 };
  const ids = Object.keys(S).sort((x, y) => (order[x.split(".")[0]] ?? 9) - (order[y.split(".")[0]] ?? 9) || x.localeCompare(y));
  for (const id of ids) {
    const reg = E[id], kind = kindOf(id, S[id], reg); if (!kind) continue;
    const dev = reg?.device_id && D[reg.device_id], areaId = reg?.area_id || dev?.area_id; if (!areaId || !A[areaId]) continue;
    const key = `${reg?.device_id || id}:${kind === "door" || kind === "lock" ? "door" : kind}`;
    if (reg?.device_id && seen.has(key)) continue; seen.add(key);
    out.push({ entity: id, kind, area: areaId, areaName: A[areaId].name, name: S[id].attributes?.friendly_name || id, dc: S[id].attributes?.device_class || reg?.device_class || null });
  }
  return out;
}

// which room each area goes to: the best name match on this floor (or the person's own choice)
export function areaRooms(hass, floor, chosen = {}) {
  const map = {};
  for (const [id, a] of Object.entries(hass.areas || {})) {
    if (chosen[id] !== undefined) { if (chosen[id] && floor.rooms.some((r) => r.id === chosen[id])) map[id] = chosen[id]; continue; }
    let best = null, bf = 0.44;
    for (const r of floor.rooms) { const f = nameFit(a.name, r.name); if (f > bf) { bf = f; best = r.id; } }
    if (best) map[id] = best;
  }
  return map;
}

// the room's edges: [a, b, length, inward normal]
function edges(room) {
  const c = centroid(room.pts), out = [];
  for (let i = 0; i < room.pts.length; i++) {
    const a = room.pts[i], b = room.pts[(i + 1) % room.pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.4) continue;
    let n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ((c[0] - m[0]) * n[0] + (c[1] - m[1]) * n[1] < 0) n = [-n[0], -n[1]];
    out.push({ a, b, len, n, m });
  }
  return out;
}
// how far a point is from a room edge
const segDist = (p, e) => { const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], t = Math.max(0, Math.min(1, ((p[0] - e.a[0]) * dx + (p[1] - e.a[1]) * dy) / (e.len * e.len))); return Math.hypot(e.a[0] + dx * t - p[0], e.a[1] + dy * t - p[1]); };
const onEdge = (p, e) => { const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], t = ((p[0] - e.a[0]) * dx + (p[1] - e.a[1]) * dy) / (e.len * e.len); if (t < 0 || t > 1) return false; return Math.hypot(e.a[0] + dx * t - p[0], e.a[1] + dy * t - p[1]) < 0.25; };
// a spot against a wall, facing into the room, the way the editor places an AC
function onWall(floor, e, gap, along = 0.5) {
  const p = [e.a[0] + (e.b[0] - e.a[0]) * along + e.n[0] * 0.3, e.a[1] + (e.b[1] - e.a[1]) * along + e.n[1] * 0.3], nw = nearestWall(floor, p, 1.5);
  if (!nw) return { x: round(p[0], 3), y: round(p[1], 3), rot: Math.round((Math.atan2(e.n[0], e.n[1]) * 180) / Math.PI) };
  const nx = (p[0] - nw.q[0]) / (nw.d || 1), ny = (p[1] - nw.q[1]) / (nw.d || 1), g = (nw.w.thick || 0.12) / 2 + gap;
  return { x: round(nw.q[0] + nx * g, 3), y: round(nw.q[1] + ny * g, 3), rot: Math.round((Math.atan2(nx, ny) * 180) / Math.PI) };
}
// n spots spread evenly over a room (inside it, away from the walls)
function grid(room, n) {
  const b = bounds(room.pts), W = b.x1 - b.x0, D = b.y1 - b.y0, out = [];
  let cols = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * W) / Math.max(0.1, D))))); const rows = Math.ceil(n / cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols && out.length < n; c++) {
    const p = [b.x0 + ((c + 0.5) * W) / cols, b.y0 + ((r + 0.5) * D) / rows];
    out.push(inside(p, room.pts) ? p : centroid(room.pts));
  }
  return out;
}

// what to add (new devices) and which drawn lights to link, for the devices of the matched areas
// skip: entities never to place again (taken out by the person, or already handled)
export function autoPlace(hass, floor, { chosen = {}, skip = new Set() } = {}) {
  const map = areaRooms(hass, floor, chosen), placed = new Set(floor.devices.map((d) => d.entity).filter(Boolean));
  const todo = devicesOf(hass).filter((d) => map[d.area] && !placed.has(d.entity) && !skip.has(d.entity));
  const add = [], link = [], byRoom = {};
  for (const d of todo) (byRoom[map[d.area]] ||= []).push(d);
  for (const [rid, list] of Object.entries(byRoom)) {
    const room = floor.rooms.find((r) => r.id === rid), es = edges(room), inRoom = (p) => inside(p, room.pts);
    const ops = (types) => (floor.openings || []).filter((o) => types.includes(o.type) && es.some((e) => onEdge([o.x, o.y], e)));
    const devHere = (k) => floor.devices.filter((x) => x.kind === k && inRoom([x.x, x.y]));
    const sofa = (floor.items || []).find((i) => /sofa|majlis/.test(i.kind) && inRoom([i.x, i.y]));
    const used = new Set();
    // lights: first link the lights already drawn in the room, then an even grid for the rest
    const lights = list.filter((d) => d.kind === "light"), free = devHere("light").filter((x) => !x.entity);
    const extra = [];
    lights.forEach((d, i) => { if (free[i]) link.push({ id: free[i].id, entity: d.entity }); else extra.push(d); });
    if (extra.length) grid(room, extra.length).forEach((p, i) => add.push({ id: uid("d"), kind: "light", look: "downlight", entity: extra[i].entity, name: extra[i].name, x: round(p[0], 3), y: round(p[1], 3), room: rid }));
    // walls: those with a window are for curtains, the longest plain one for the AC, the one facing the sofa for the TV
    const windows = ops(["window", "slider"]), doors = ops(["door", "arch"]);
    // a wall already holding an AC or a TV (drawn, or placed before) is not used again
    const holds = (e) => [...floor.devices.filter((x) => ["ac", "tv"].includes(x.kind)), ...(floor.items || []).filter((i) => i.kind === "tv")].some((x) => inRoom([x.x, x.y]) && segDist([x.x, x.y], e) < 0.45);
    const plain = es.filter((e) => !windows.some((o) => onEdge([o.x, o.y], e))).sort((x, y) => (holds(x) - holds(y)) || y.len - x.len);
    // one TV per room, and one AC for every 25 m² or so: the same TV or AC often shows up several times in
    // Home Assistant (through two integrations, or an IR remote); the extra ones are left for the person to add
    const tvAt = (floor.items || []).find((i) => i.kind === "tv" && inRoom([i.x, i.y]));
    let tvs = devHere("tv").filter((x) => x.entity).length, acs = devHere("ac").filter((x) => x.entity).length;
    const maxAc = Math.max(1, Math.round(Math.abs(area(room.pts)) / 25));
    const rank = (d) => (d.dc === "tv" ? 0 : 1) + (/\d+[._]\d+[._]\d+/.test(d.entity + d.name) ? 2 : 0) + (/_\d+$/.test(d.entity) ? 1 : 0);
    list.sort((x, y) => (x.kind === y.kind && (x.kind === "tv" || x.kind === "ac") ? rank(x) - rank(y) : 0));
    for (const d of list) {
      if (d.kind === "light") continue;
      if (d.kind === "ac") {
        if (acs >= maxAc && !devHere("ac").some((x) => !x.entity && !used.has(x.id))) continue; acs++;
        const linkTo = devHere("ac").find((x) => !x.entity && !used.has(x.id)); if (linkTo) { used.add(linkTo.id); link.push({ id: linkTo.id, entity: d.entity }); continue; }
        const e = plain.find((x) => !used.has(x) && !holds(x)) || plain.find((x) => !used.has(x)) || es.slice().sort((x, y) => y.len - x.len)[0]; used.add(e); add.push({ id: uid("d"), kind: "ac", entity: d.entity, name: d.name, ...onWall(floor, e, 0.13), room: rid });
      } else if (d.kind === "curtain") {
        const linkTo = devHere("curtain").find((x) => !x.entity && !used.has(x.id)); if (linkTo) { used.add(linkTo.id); link.push({ id: linkTo.id, entity: d.entity }); continue; }
        const w = windows.find((o) => !used.has(o.id) && !floor.devices.some((x) => x.kind === "curtain" && Math.hypot(x.x - o.x, x.y - o.y) < 0.5));
        if (w) { used.add(w.id); add.push({ id: uid("d"), kind: "curtain", entity: d.entity, name: d.name, x: w.x, y: w.y, room: rid }); }
        else { const e = es.slice().sort((x, y) => y.len - x.len)[0]; add.push({ id: uid("d"), kind: "curtain", entity: d.entity, name: d.name, x: round(e.m[0], 3), y: round(e.m[1], 3), room: rid, needsWindow: true }); }
      } else if (d.kind === "tv") {
        const linkTo = devHere("tv").find((x) => !x.entity && !used.has(x.id)); if (linkTo) { used.add(linkTo.id); tvs++; link.push({ id: linkTo.id, entity: d.entity }); continue; }
        if (tvs >= 1) continue; tvs++;
        // a TV already drawn on the plan: the device goes on it
        if (tvAt) { add.push({ id: uid("d"), kind: "tv", entity: d.entity, name: d.name, x: tvAt.x, y: tvAt.y, rot: tvAt.rot || 0, room: rid }); const te = es.slice().sort((x, y) => segDist([tvAt.x, tvAt.y], x) - segDist([tvAt.x, tvAt.y], y))[0]; if (te) used.add(te); continue; }
        // the wall farthest from the sofa (that is where people look); without a sofa, a long plain wall
        const e = sofa ? es.slice().sort((x, y) => Math.hypot(y.m[0] - sofa.x, y.m[1] - sofa.y) - Math.hypot(x.m[0] - sofa.x, x.m[1] - sofa.y))[0] : plain.find((x) => !used.has(x)) || es[0];
        used.add(e); add.push({ id: uid("d"), kind: "tv", entity: d.entity, name: d.name, ...onWall(floor, e, 0.05), room: rid, wantsScreen: true });
      } else if (d.kind === "fan") {
        const linkTo = devHere("fan").find((x) => !x.entity); if (linkTo) { link.push({ id: linkTo.id, entity: d.entity }); continue; }
        const c = centroid(room.pts); add.push({ id: uid("d"), kind: "fan", entity: d.entity, name: d.name, x: round(c[0], 3), y: round(c[1], 3), room: rid });
      } else if (d.kind === "door" || d.kind === "lock") {
        const o = doors.find((x) => !used.has(`${d.kind}${x.id}`)) || doors[0]; if (!o) continue; used.add(`${d.kind}${o.id}`);
        add.push({ id: uid("d"), kind: d.kind, entity: d.entity, name: d.name, x: o.x, y: o.y, room: rid });
      } else if (d.kind === "vacuum") {
        const b = bounds(room.pts); let p = [b.x0 + 0.35, b.y1 - 0.35]; if (!inRoom(p)) p = centroid(room.pts);
        add.push({ id: uid("d"), kind: "vacuum", entity: d.entity, name: d.name, x: round(p[0], 3), y: round(p[1], 3), room: rid });
      } else if (d.kind === "radar") {
        const e = plain[plain.length - 1] || es[0]; add.push({ id: uid("d"), kind: "radar", entity: d.entity, name: d.name, ...onWall(floor, e, 0.02), z: 1.9, room: rid });
      } else if (d.kind === "speaker") {
        const c = centroid(room.pts); add.push({ id: uid("d"), kind: "speaker", entity: d.entity, name: d.name, x: round(c[0] + 0.4, 3), y: round(c[1], 3), z: 0.8, room: rid });
      }
    }
  }
  // areas with devices but no room of that name: the person can pick a room for them
  const all = devicesOf(hass), loose = all.filter((d) => !map[d.area] && chosen[d.area] !== "");
  const unmatched = [...new Set(loose.map((d) => d.area))].map((id) => ({ id, name: hass.areas[id].name, count: loose.filter((d) => d.area === id).length }));
  return { add, link, unmatched, map };
}
