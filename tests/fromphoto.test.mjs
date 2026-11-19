// Photos of real rooms, as the AI describes them, become pieces in the right room, the right way round.
// The answers below are written from real photos (a living and dining room, a kitchen, a bathroom, a bedroom).
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { CATALOG, ANSWERS, place, spot, group } from "../src/fromphoto.js";
import { LIBRARY } from "../src/furniture.js";
import { inside, bounds } from "../src/model.js";

// the AI is told exactly the answers this file understands
const py = readFileSync(new URL("../custom_components/roost_atelier/recognize.py", import.meta.url), "utf8");
const pyKinds = [...py.slice(py.indexOf("KINDS = ["), py.indexOf("]", py.indexOf("KINDS = ["))).matchAll(/"(\w+)"/g)].map((m) => m[1]);
assert.deepEqual(pyKinds, ANSWERS, "the AI's list matches what Atelier understands");
for (const [k, c] of Object.entries(CATALOG)) if (c.f) assert(LIBRARY[c.f], `${k} → ${c.f} is in the furniture library`);

const room = (id, name, type, x0, y0, x1, y1) => ({ id, name, type, pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
const floor = { height: 2.8, rooms: [room("liv", "Living Room", "living", 0, 0, 7, 4.5), room("kit", "Kitchen", "kitchen", 7, 0, 11, 3.6), room("bath", "Hall Bathroom", "bath", 7, 3.6, 9.8, 5.4), room("bed", "Master Bedroom", "bedroom", 0, 4.5, 4.5, 8.5)], openings: [], items: [], devices: [] };
const R = (id) => floor.rooms.find((r) => r.id === id);

// the middle of the far wall is at the far wall, whichever way the photo faces
for (const [facing, test] of [["top", (p) => p[1] < 0.2], ["right", (p) => p[0] > 6.8], ["bottom", (p) => p[1] > 4.3], ["left", (p) => p[0] < 0.2]]) assert(test(spot(R("liv"), facing, 0.5, "far", "back")), `far wall when facing ${facing}`);
// left in the photo is left of the camera
assert(spot(R("liv"), "top", 0.1, "middle")[0] < 3.5 && spot(R("liv"), "bottom", 0.1, "middle")[0] > 3.5, "left and right follow the camera");

const living = [
  { kind: "dining_table", count: 1, x: 0.25, depth: "near", wall: "floor", w: 2.0, d: 0.95, h: 0.76, colour: "#8B5E3C" },
  { kind: "dining_chair", count: 3, x: 0.12, depth: "near", wall: "floor" },
  { kind: "bench", count: 1, x: 0.5, depth: "near", wall: "floor", w: 1.5 },
  { kind: "lounge_chair", count: 2, x: 0.55, depth: "middle", wall: "floor" },
  { kind: "sofa", count: 2, x: 0.75, depth: "far", wall: "floor", colour: "#D9D2C8" },
  { kind: "coffee_table", count: 1, x: 0.75, depth: "middle", wall: "floor" },
  { kind: "rug", count: 2, x: 0.72, depth: "middle", wall: "floor" },
  { kind: "basket_pendant", count: 1, x: 0.8, depth: "far", wall: "ceiling" },
  { kind: "magnetic_slot_light", count: 2, x: 0.6, depth: "middle", wall: "ceiling", length: 5, bars: 4, layout: "row" },
  { kind: "curtain", count: 1, x: 0.85, depth: "far", wall: "back" },
  { kind: "air_conditioner", count: 1, x: 0.9, depth: "far", wall: "right" },
  { kind: "tv", count: 1, x: 0.85, depth: "middle", wall: "right", style: "stand" },
  { kind: "tv_unit", count: 1, x: 0.85, depth: "middle", wall: "right", w: 2.4 },
];
const lr = place(living, { room: R("liv"), facing: "top", floor });
assert.equal(lr.items.filter((i) => i.kind === "dining_chair").length, 3, "three dining chairs");
assert.equal(lr.items.filter((i) => i.kind === "sofa").length, 2, "two sofas");
for (const it of lr.items) assert(inside([it.x, it.y], R("liv").pts), `${it.kind} inside the living room`);
assert(lr.devices.some((d) => d.kind === "light" && d.look === "pendant" && d.style === "basket"), "a woven pendant");
const slots = lr.devices.filter((d) => d.style === "slot"); assert.equal(slots.length, 2, "two slot lights"); assert(slots.every((d) => d.bars === 4 && d.len <= 4.5), "slot lights fit the room");
const cur = lr.devices.find((d) => d.kind === "curtain"); assert(cur && lr.openings.some((o) => o.type === "window" && o.x === cur.x && o.y === cur.y), "the curtain gets a window behind it");
assert(lr.items.some((i) => i.kind === "tv_stand") && lr.devices.some((d) => d.kind === "tv"), "the TV stands on its unit and can be linked");
const ac = lr.devices.find((d) => d.kind === "ac"); assert(ac.x > 6.5, "the AC is on the right wall");

const kitchen = [
  { kind: "oven_tower", count: 1, x: 0.1, depth: "middle", wall: "left" },
  { kind: "tall_cabinet", count: 1, x: 0.05, depth: "near", wall: "left" },
  { kind: "wall_cabinets", count: 1, x: 0.45, depth: "far", wall: "back", w: 2.2 },
  { kind: "hob_and_oven", count: 1, x: 0.5, depth: "far", wall: "back" },
  { kind: "cooker_hood", count: 1, x: 0.5, depth: "far", wall: "back" },
  { kind: "sink_cabinet", count: 1, x: 0.9, depth: "middle", wall: "right" },
  { kind: "base_cabinets", count: 2, x: 0.6, depth: "far", wall: "back" },
  { kind: "square_led_panel", count: 6, x: 0.5, depth: "middle", wall: "ceiling", layout: "grid", size: 0.3 },
  { kind: "ceiling_fan", count: 1, x: 0.7, depth: "middle", wall: "ceiling" },
  { kind: "window", count: 1, x: 0.85, depth: "far", wall: "right", w: 1.3, h: 1.0, sill: 1.05 },
  { kind: "fridge", count: 1, x: 0.85, depth: "near", wall: "right" },
  { kind: "washing_machine", count: 1, x: 0.4, depth: "far", wall: "back" },
  { kind: "extractor_fan", count: 1, x: 0.9, depth: "far", wall: "right" },
];
const kr = place(kitchen, { room: R("kit"), facing: "top", floor });
const panels = kr.devices.filter((d) => d.look === "panel"); assert.equal(panels.length, 6, "six panels"); assert(panels.every((d) => inside([d.x, d.y], R("kit").pts)), "panels in the kitchen");
assert(new Set(panels.map((d) => `${d.x},${d.y}`)).size === 6, "panels spread over the ceiling");
const base = kr.items.find((i) => i.kind === "kitchen_base"); assert(base?.noWall, "the plain worktop run does not add a second row of wall cabinets");
const tower = kr.items.find((i) => i.kind === "oven_tower"); assert(tower.rot === 90, `the oven tower faces the room from the left wall (${tower.rot})`);
assert.equal(kr.openings.length, 1, "one window"); assert(kr.openings[0].x > 10.8, "the window is on the right wall");

const bath = [
  { kind: "wall_basin", count: 1, x: 0.2, depth: "near", wall: "left" },
  { kind: "led_mirror", count: 1, x: 0.15, depth: "near", wall: "left" },
  { kind: "shower", count: 1, x: 0.4, depth: "middle", wall: "left" },
  { kind: "toilet", count: 1, x: 0.55, depth: "far", wall: "back" },
  { kind: "round_led_panel", count: 1, x: 0.5, depth: "near", wall: "ceiling", size: 0.3 },
  { kind: "recessed_spot", count: 1, x: 0.5, depth: "far", wall: "ceiling" },
  { kind: "extractor_fan", count: 1, x: 0.5, depth: "far", wall: "back" },
  { kind: "window", count: 1, x: 0.55, depth: "far", wall: "back", w: 0.7, h: 0.6, sill: 1.5 },
  { kind: "towel_rail", count: 1, x: 0.8, depth: "far", wall: "right" },
];
const br = place(bath, { room: R("bath"), facing: "left", floor });
for (const it of br.items) assert(inside([it.x, it.y], R("bath").pts), `${it.kind} inside the bathroom`);
assert(br.devices.some((d) => d.look === "panel" && d.shape === "round"), "a round panel");
assert(br.openings[0].x < 7.2, "the bathroom window is on the wall the photo faces");

const bedroom = [
  { kind: "double_bed", count: 1, x: 0.45, depth: "far", wall: "back", w: 1.9, d: 2.2 },
  { kind: "nightstand", count: 2, x: 0.45, depth: "far", wall: "back", spread: 0.6 },
  { kind: "wall_panelling", count: 1, x: 0.5, depth: "far", wall: "back", w: 4.2 },
  { kind: "candle_chandelier", count: 1, x: 0.4, depth: "middle", wall: "ceiling" },
  { kind: "twin_recessed_spot", count: 2, x: 0.3, depth: "far", wall: "ceiling" },
  { kind: "rug", count: 1, x: 0.4, depth: "near", wall: "floor" },
  { kind: "curtain", count: 1, x: 0.05, depth: "middle", wall: "left" },
  { kind: "leaning_mirror", count: 1, x: 0.25, depth: "far", wall: "back" },
];
const bd = place(bedroom, { room: R("bed"), facing: "bottom", floor });
const bed = bd.items.find((i) => i.kind === "bed_double"); assert(bed.rot === 180 && bed.y > 7, `the bed's head is against the far wall (${bed.rot}, ${bed.y})`);
assert(bd.devices.some((d) => d.look === "chandelier" && d.style === "candle"), "candle chandelier");
assert(bd.devices.filter((d) => d.look === "downlight" && d.heads === 2).length === 2, "two twin spots");
assert.equal(group("curtain"), "devices"); assert.equal(group("window"), "openings"); assert.equal(group("recessed_spot"), "lights");
// a light group shares one switch; devices are matched to entities in the room's area
const hass = { states: { "light.living_spots": {}, "light.living_pendant": {}, "climate.living_room_ac": {}, "cover.living_room": {}, "light.kitchen": {} },
  entities: { "light.living_spots": { area_id: "lr" }, "light.living_pendant": { area_id: "lr" }, "climate.living_room_ac": { area_id: "lr" }, "cover.living_room": { area_id: "lr" }, "light.kitchen": { area_id: "k" } },
  areas: { lr: { name: "Living Room" }, k: { name: "Kitchen" } } };
const { entityPicker } = await import("../src/fromphoto.js");
const linked = place(living, { room: R("liv"), facing: "top", floor, entityFor: entityPicker(hass) });
assert.equal(linked.devices.find((d) => d.kind === "ac").entity, "climate.living_room_ac", "the AC is linked");
assert.equal(linked.devices.find((d) => d.kind === "curtain").entity, "cover.living_room", "the curtain is linked");
const sl = linked.devices.filter((d) => d.style === "slot"); assert(sl[0].entity && sl[0].entity === sl[1].entity, "both slot lights share one switch");
assert(!linked.devices.some((d) => d.entity === "light.kitchen"), "nothing from another room");
void bounds;
console.log("fromphoto: all passed");

// the local AI's boxes become the same answers: one per kind, counted, with where they are
const { boxesToFound, QUERIES } = await import("../src/ai/boxes.js");
for (const k of Object.keys(QUERIES)) assert(CATALOG[k], `local AI answer ${k} is understood`);
const bx = (kind, score, xmin, ymin, xmax, ymax) => ({ kind, score, box: { xmin, ymin, xmax, ymax } });
const local = boxesToFound([
  bx("sofa", 0.31, 1000, 700, 1560, 900), bx("sofa", 0.28, 1620, 700, 2200, 960), bx("armchair", 0.12, 1010, 705, 1550, 895),
  bx("pendant_lamp", 0.2, 1780, 120, 1880, 330), bx("basket_pendant", 0.33, 1775, 118, 1885, 335),
  bx("recessed_spot", 0.2, 160, 400, 230, 450), bx("recessed_spot", 0.19, 200, 470, 270, 520), bx("recessed_spot", 0.15, 900, 600, 940, 630),
  bx("dining_table", 0.4, 300, 800, 1300, 1600), bx("curtain", 0.3, 1550, 80, 2212, 800), bx("door", 0.09, 0, 0, 100, 900),
], 2212, 1659, () => "#aabbcc");
const L = (k) => local.find((x) => x.kind === k);
assert.equal(L("sofa").count, 2, "two sofas");
assert(!L("armchair"), "the weaker guess on the same spot is dropped");
assert(L("basket_pendant") && !L("pendant_lamp"), "the surer of two pendant guesses wins");
assert.equal(L("twin_recessed_spot")?.count, 1, "two spots almost touching are one twin fitting"); assert.equal(L("recessed_spot")?.count, 1, "the lone spot stays single");
assert.equal(L("basket_pendant").wall, "ceiling"); assert.equal(L("dining_table").depth, "near"); assert.equal(L("curtain").wall, "back");
assert(!L("door"), "unsure guesses are left out");
const lp = place(local, { room: R("liv"), facing: "top", floor });
assert(lp.items.length >= 3 && lp.devices.length >= 3, "local answers place like cloud answers");
console.log("local AI boxes: all passed");
