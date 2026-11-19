// A room photo, read by Home Assistant's AI, becomes furniture, lights, devices and windows in the room.
// The AI says what each thing is, how many, and roughly where it is in the photo; this file turns that
// into pieces at a sensible spot, knowing which wall the photo was taken facing.
import { uid, round, bounds, inside, nearestWall } from "./model.js";
import { LIBRARY } from "./furniture.js";

// what the AI may answer, and what each becomes here
// f: furniture kind · l: a light (look and its options) · d: a device · o: an opening
export const CATALOG = {
  // living and dining
  sofa: { f: "sofa" }, corner_sofa: { f: "sofa_l" }, armchair: { f: "armchair" }, lounge_chair: { f: "lounge_chair" },
  coffee_table: { f: "coffee_table" }, round_coffee_table: { f: "coffee_round" }, side_table: { f: "side_table" },
  tv_unit: { f: "tv_unit" }, rug: { f: "rug" }, pouf: { f: "ottoman" }, bookshelf: { f: "bookshelf" }, open_shelves: { f: "bookshelf" },
  console: { f: "console" }, bench: { f: "bench" }, majlis_seating: { f: "majlis_seat" },
  dining_table: { f: "dining_table" }, dining_chair: { f: "dining_chair" }, bar_stool: { f: "bar_stool" },
  // bedroom and dressing
  double_bed: { f: "bed_double" }, single_bed: { f: "bed_single" }, nightstand: { f: "nightstand" }, wardrobe: { f: "wardrobe" },
  chest_of_drawers: { f: "dresser" }, desk: { f: "desk" }, office_chair: { f: "office_chair" },
  wall_panelling: { f: "wall_panels" }, round_mirror: { f: "mirror_round" }, leaning_mirror: { f: "floor_mirror" }, mirror: { f: "mirror" },
  // kitchen and laundry
  base_cabinets: { f: "kitchen_base", noWall: true }, wall_cabinets: { f: "wall_cabinet" }, tall_cabinet: { f: "tall_cabinet" },
  oven_tower: { f: "oven_tower" }, hob_and_oven: { f: "cooker" }, sink_cabinet: { f: "kitchen_sink" }, cooker_hood: { f: "hood" },
  kitchen_island: { f: "kitchen_island" }, fridge: { f: "fridge" }, washing_machine: { f: "washing_machine" },
  // bathroom
  toilet: { f: "toilet" }, wall_basin: { f: "basin_wall" }, basin_vanity: { f: "basin" }, led_mirror: { f: "mirror_led" },
  shower: { f: "shower" }, bathtub: { f: "bathtub" }, towel_rail: { f: "towel_rail" }, extractor_fan: { f: "exhaust_fan" },
  // decor
  plant: { f: "plant" }, small_plant: { f: "plant_small" }, floor_lamp: { l: { look: "floor" } },
  // ceiling lights
  recessed_spot: { l: { look: "downlight" } }, twin_recessed_spot: { l: { look: "downlight", heads: 2 } },
  square_led_panel: { l: { look: "panel", shape: "square" } }, round_led_panel: { l: { look: "panel", shape: "round" } },
  magnetic_slot_light: { l: { look: "linear", style: "slot", len: 2.4 } }, led_strip: { l: { look: "linear", style: "strip" } },
  hidden_cove_light: { l: { look: "linear", style: "cove" } }, track_light: { l: { look: "track" } },
  pendant_lamp: { l: { look: "pendant" } }, basket_pendant: { l: { look: "pendant", style: "basket" } },
  chandelier: { l: { look: "chandelier" } }, candle_chandelier: { l: { look: "chandelier", style: "candle" } },
  ceiling_light: { l: { look: "flush" } },
  // things the cards control
  air_conditioner: { d: "ac" }, curtain: { d: "curtain" }, tv: { d: "tv" }, ceiling_fan: { d: "fan" },
  // openings
  window: { o: "window" }, door: { o: "door" },
};
export const ANSWERS = Object.keys(CATALOG);

// the names people see for each answer
export function label(kind, t = (s) => s) {
  const c = CATALOG[kind]; if (!c) return kind;
  if (c.f) return t(LIBRARY[c.f]?.[0] || kind);
  return t(kind.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase()));
}
export function group(kind) {
  const c = CATALOG[kind]; return !c ? null : c.f ? "furniture" : c.l ? "lights" : c.d ? "devices" : "openings";
}

// facing: which wall of the room the photo looks at ("top", "right", "bottom", "left" as drawn on the plan)
const FACE = { top: { f: [0, -1], r: [1, 0], rot: 0 }, right: { f: [1, 0], r: [0, 1], rot: 270 }, bottom: { f: [0, 1], r: [-1, 0], rot: 180 }, left: { f: [-1, 0], r: [0, -1], rot: 90 } };
const DEPTH = { near: 0.22, middle: 0.5, far: 0.8 };

// where in the room something in the photo is: x across the photo (0 left … 1 right), depth near/middle/far, which surface
export function spot(room, facing, x, depth, wall) {
  const b = bounds(room.pts), F = FACE[facing] || FACE.top, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const W = Math.abs(F.r[0]) ? b.x1 - b.x0 : b.y1 - b.y0, D = Math.abs(F.f[0]) ? b.x1 - b.x0 : b.y1 - b.y0;
  let a = (Math.max(0, Math.min(1, x ?? 0.5)) - 0.5), d = typeof depth === "number" ? depth : DEPTH[depth] ?? 0.5;
  // a phone camera sees less of the side walls close up: near things spread less across the photo
  a *= 0.55 + 0.45 * d;
  if (wall === "back") d = 0.99; else if (wall === "left") a = -0.49; else if (wall === "right") a = 0.49;
  const lat = a * W, fwd = (d - 0.5) * D;
  return [cx + F.r[0] * lat + F.f[0] * fwd, cy + F.r[1] * lat + F.f[1] * fwd];
}
// the rotation that makes a piece face the camera (its back to the wall the photo looks at)
export const faceRot = (facing) => (FACE[facing] || FACE.top).rot;

// turn what the AI found into plan pieces. Returns { items, devices, openings }
export function place(found, { room, facing, floor, H = 2.8, entityFor }) {
  const out = { items: [], devices: [], openings: [] };
  const rot = faceRot(facing);
  for (const x of found) {
    const c = CATALOG[x.kind]; if (!c) continue;
    const n = Math.max(1, Math.min(c.l ? 24 : 8, Math.round(x.count || 1)));
    // lights of one kind usually share a switch: one entity for the whole group
    const shared = c.l ? entityFor?.("light", room, out.devices) || "" : "";
    // four or more of the same ceiling light: an even grid over the room, like the lights really are
    const grid = c.l && n >= 4 && x.layout !== "row" && c.l.look !== "linear" ? gridSpots(room, n, facing) : null;
    for (let i = 0; i < n; i++) {
      // several of the same thing: spread them across the photo around where it says
      const xs = n === 1 ? x.x : Math.max(0.05, Math.min(0.95, (x.x ?? 0.5) + ((i + 0.5) / n - 0.5) * (x.spread ?? Math.min(0.8, 0.25 * n))));
      let [px, py] = grid ? grid[i] : spot(room, facing, xs, x.depth, x.wall);
      if (!inside([px, py], room.pts)) { const b = bounds(room.pts); px = Math.max(b.x0 + 0.2, Math.min(b.x1 - 0.2, px)); py = Math.max(b.y0 + 0.2, Math.min(b.y1 - 0.2, py)); }
      if (c.f) {
        const L = LIBRARY[c.f]; if (!L) continue;
        const it = { id: uid("i"), kind: c.f, x: round(px, 3), y: round(py, 3), rot };
        if (c.noWall) it.noWall = true;
        if (/^#[0-9a-f]{6}$/i.test(x.colour || "")) it.color = x.colour;
        for (const [k, v] of [["w", x.w], ["d", x.d], ["h", x.h]]) if (v && v > 0.05 && v < 8 && Math.abs(v - L[{ w: 3, d: 4, h: 5 }[k]]) > 0.04) it[k] = round(v, 2);
        if (x.kind === "rug" && !x.wall) it.rot = rot;
        hugWall(it, floor);
        out.items.push(it);
      } else if (c.l) {
        const dv = { id: uid("d"), kind: "light", x: round(px, 3), y: round(py, 3), ...c.l, name: x.name || label(x.kind) };
        if (dv.look === "linear" || dv.look === "track" || (dv.look === "panel" && dv.shape !== "round") || dv.heads === 2) dv.rot = (rot + 90) % 360;
        if (x.length && x.length > 0.2 && x.length < 12) dv.len = round(x.length, 2);
        if (dv.look === "linear" && x.bars) dv.bars = Math.max(0, Math.min(12, Math.round(x.bars)));
        if (x.size && dv.look === "panel" && x.size > 0.1 && x.size < 1.5) dv.size = round(x.size, 2);
        // a run of slot lights goes along the room, not across the photo
        if (dv.look === "linear" && dv.style === "slot") { dv.rot = rot === 0 || rot === 180 ? 90 : 0; const b = bounds(room.pts); dv.len = round(Math.min(dv.len || 99, (rot === 0 || rot === 180 ? b.y1 - b.y0 : b.x1 - b.x0) - 0.6), 2); }
        dv.entity = shared;
        out.devices.push(dv);
      } else if (c.d) {
        const dv = { id: uid("d"), kind: c.d, x: round(px, 3), y: round(py, 3), name: x.name || label(x.kind) };
        if (c.d === "ac") { const nw = nearestWall(floor, [px, py], 5); if (nw) { const nx = (px - nw.q[0]) / (nw.d || 1), ny = (py - nw.q[1]) / (nw.d || 1); dv.rot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI); dv.x = round(nw.q[0] + nx * 0.18, 3); dv.y = round(nw.q[1] + ny * 0.18, 3); } }
        if (c.d === "tv") out.items.push(tvPiece(x, px, py, rot, floor));
        dv.entity = entityFor?.(c.d, room, out.devices) || "";
        out.devices.push(dv);
      } else if (c.o) {
        const nw = nearestWall(floor, [px, py], 6); if (!nw) continue;
        const width = round(Math.max(0.5, Math.min(4, x.w || (c.o === "door" ? 0.9 : 1.2))), 2), half = width / 2;
        const tt = Math.max(half, Math.min(nw.len - half, nw.t * nw.len)), ux = Math.cos(nw.angle), uy = Math.sin(nw.angle);
        const op = { id: uid("o"), type: c.o, x: round(nw.w.a[0] + ux * tt, 3), y: round(nw.w.a[1] + uy * tt, 3), width, height: c.o === "door" ? 2.1 : round(Math.max(0.5, Math.min(2.4, x.h || 1.2)), 2), sill: c.o === "door" ? 0 : round(Math.max(0, Math.min(1.8, x.sill ?? 0.9)), 2), swing: 1 };
        // the same window found twice (once by itself, once behind its curtain) is one window
        if ([...(floor.openings || []), ...out.openings].some((o) => o.type === op.type && Math.hypot(o.x - op.x, o.y - op.y) < half + o.width / 2)) continue;
        out.openings.push(op);
      }
    }
  }
  // a curtain needs a window behind it: one is added where the curtain hangs when the room has none there
  for (const dv of out.devices.filter((d) => d.kind === "curtain")) {
    const near = [...(floor.openings || []), ...out.openings].filter((o) => o.type === "window" || o.type === "slider").sort((a, b) => Math.hypot(a.x - dv.x, a.y - dv.y) - Math.hypot(b.x - dv.x, b.y - dv.y))[0];
    if (near && Math.hypot(near.x - dv.x, near.y - dv.y) < 2.5) { dv.x = near.x; dv.y = near.y; continue; }
    const nw = nearestWall(floor, [dv.x, dv.y], 6); if (!nw) continue;
    const width = 2.4, tt = Math.max(width / 2, Math.min(nw.len - width / 2, nw.t * nw.len)), ux = Math.cos(nw.angle), uy = Math.sin(nw.angle);
    const op = { id: uid("o"), type: "window", x: round(nw.w.a[0] + ux * tt, 3), y: round(nw.w.a[1] + uy * tt, 3), width, height: 1.8, sill: 0.4, swing: 1 };
    out.openings.push(op); dv.x = op.x; dv.y = op.y;
  }
  return out;
}

// n lights spread evenly over the room, in rows along its longer side
function gridSpots(room, n, facing) {
  const b = bounds(room.pts), W = b.x1 - b.x0, D = b.y1 - b.y0;
  let cols = Math.max(1, Math.round(Math.sqrt((n * W) / Math.max(0.1, D)))); cols = Math.min(n, cols); const rows = Math.ceil(n / cols);
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols && out.length < n; c++) out.push([b.x0 + ((c + 0.5) * W) / cols, b.y0 + ((r + 0.5) * D) / rows]);
  void facing; return out;
}
// a TV standing on a unit, or hanging on the wall
function tvPiece(x, px, py, rot, floor) {
  const it = { id: uid("i"), kind: x.style === "wall" ? "tv" : "tv_stand", x: round(px, 3), y: round(py, 3), rot };
  if (x.w && x.w > 0.5 && x.w < 3) it.w = round(x.w, 2);
  hugWall(it, floor); return it;
}
// pieces close to a wall turn to face the room and sit against it (the same rule as dragging)
function hugWall(it, floor) {
  const L = LIBRARY[it.kind]; if (!L || L[6] === "ceiling" || it.kind === "rug") return;
  const w = it.w || L[3], d = it.d || L[4];
  const nw = nearestWall(floor, [it.x, it.y], Math.max(w, d) / 2 + (L[6] === "wall" ? 2 : 0.6)); if (!nw || nw.d < 1e-3 || nw.w.parapet) return;
  const nx = (it.x - nw.q[0]) / nw.d, ny = (it.y - nw.q[1]) / nw.d, gap = d / 2 + (nw.w.thick || 0.12) / 2 + (L[6] === "wall" ? 0 : 0.01);
  it.rot = Math.round((Math.atan2(nx, ny) * 180) / Math.PI); it.x = round(nw.q[0] + nx * gap, 3); it.y = round(nw.q[1] + ny * gap, 3);
}

// the room's own devices in Home Assistant: entities in the area with the room's name, of the right kind
const DOMAINS = { light: ["light", "switch"], ac: ["climate"], curtain: ["cover"], tv: ["media_player"], fan: ["fan"] };
export function entityPicker(hass) {
  const areaName = (e) => { const ent = hass.entities?.[e], dev = ent?.device_id && hass.devices?.[ent.device_id]; const a = ent?.area_id || dev?.area_id; return (a && hass.areas?.[a]?.name) || ""; };
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
  return (kind, room, taken) => {
    const doms = DOMAINS[kind]; if (!doms) return "";
    const rn = norm(room.name); if (!rn) return "";
    const used = new Set(taken.map((d) => d.entity).filter(Boolean));
    const list = Object.keys(hass.states).filter((e) => doms.includes(e.split(".")[0]) && (norm(areaName(e)) === rn || norm(areaName(e)).includes(rn) || rn.includes(norm(areaName(e)) || "\u0000")));
    // lights: one entity per light group is enough, the same switch is reused for the rest of that kind
    return list.find((e) => !used.has(e)) || (kind === "light" ? list[0] || "" : "");
  };
}
