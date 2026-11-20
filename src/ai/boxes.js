// What the local AI sees (boxes with a label and a score) turned into the same answers the cloud AI gives,
// so both go through the same review and placement.

// what to ask the local AI for, in plain words it understands, for each answer it can give
export const QUERIES = {
  sofa: "a sofa", armchair: "an armchair", lounge_chair: "a rattan lounge chair", coffee_table: "a coffee table", side_table: "a small side table",
  tv_unit: "a low tv cabinet", rug: "a rug on the floor", bookshelf: "a bookshelf", bench: "a wooden bench", dining_table: "a dining table",
  dining_chair: "a dining chair", bar_stool: "a bar stool", double_bed: "a bed", nightstand: "a bedside table", wardrobe: "a wardrobe with doors",
  chest_of_drawers: "a chest of drawers", desk: "a desk", office_chair: "an office chair", round_mirror: "a round mirror",
  leaning_mirror: "a tall mirror leaning on the wall", base_cabinets: "lower kitchen cabinets with a worktop", wall_cabinets: "upper kitchen wall cabinets",
  oven_tower: "a built-in oven in a tall cabinet", hob_and_oven: "a gas stove hob", sink_cabinet: "a kitchen sink", cooker_hood: "a range hood",
  fridge: "a refrigerator", washing_machine: "a washing machine", toilet: "a toilet", wall_basin: "a bathroom sink", led_mirror: "a bathroom mirror",
  shower: "a shower head", bathtub: "a bathtub", towel_rail: "a towel bar", extractor_fan: "a small exhaust fan on the wall", plant: "a potted plant",
  floor_lamp: "a floor lamp", recessed_spot: "a small round recessed ceiling spotlight", square_led_panel: "a square ceiling light panel",
  round_led_panel: "a round flat ceiling light", magnetic_slot_light: "a long thin linear ceiling light", pendant_lamp: "a hanging pendant lamp",
  basket_pendant: "a woven wicker pendant lamp", chandelier: "a chandelier", air_conditioner: "a wall air conditioner", curtain: "curtains",
  tv: "a television", ceiling_fan: "a ceiling fan", window: "a window", door: "a door",
  surface_spot: "a small cylinder spotlight mounted on the ceiling", linear_pendant: "a long linear light hanging from the ceiling", neon_light: "a glowing neon light", filament_bulb_pendant: "a bare light bulb hanging on a cord", glass_globe_pendant: "a glass globe pendant lamp", wall_light: "a wall sconce light", table_lamp: "a table lamp with a shade", desk_lamp: "a desk lamp", garden_bollard: "a garden bollard light", floodlight: "an outdoor floodlight",
};
const CEILING = new Set(["surface_spot", "linear_pendant", "filament_bulb_pendant", "glass_globe_pendant", "recessed_spot", "square_led_panel", "round_led_panel", "magnetic_slot_light", "pendant_lamp", "basket_pendant", "chandelier", "ceiling_fan"]);
const ON_WALL = new Set(["wall_light", "floodlight", "curtain", "window", "air_conditioner", "wall_cabinets", "cooker_hood", "led_mirror", "round_mirror", "towel_rail", "extractor_fan"]);
// some answers need a surer look before they count (small or easily mistaken things)
const MIN = { recessed_spot: 0.12, towel_rail: 0.16, extractor_fan: 0.16, shower: 0.14, door: 0.16, window: 0.13, rug: 0.12, plant: 0.14 };
const BASE_MIN = 0.1;

const iou = (a, b) => {
  const x0 = Math.max(a.xmin, b.xmin), y0 = Math.max(a.ymin, b.ymin), x1 = Math.min(a.xmax, b.xmax), y1 = Math.min(a.ymax, b.ymax);
  const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0), u = (a.xmax - a.xmin) * (a.ymax - a.ymin) + (b.xmax - b.xmin) * (b.ymax - b.ymin) - i;
  return u > 0 ? i / u : 0;
};

// dets: [{ kind, score, box: { xmin, ymin, xmax, ymax } }] in pixels; W, H: photo size; colourAt(box) → "#rrggbb"
export function boxesToFound(dets, W, H, colourAt) {
  // the surest guess wins where two answers point at the same thing (a pendant that might be a basket pendant)
  const kept = [];
  for (const d of dets.filter((d) => QUERIES[d.kind] && d.score >= (MIN[d.kind] ?? BASE_MIN)).sort((a, b) => b.score - a.score)) {
    if (kept.some((k) => iou(k.box, d.box) > (k.kind === d.kind ? 0.3 : 0.6))) continue;
    kept.push(d);
  }
  // two recessed spots side by side, almost touching: one twin fitting
  const spots = kept.filter((d) => d.kind === "recessed_spot"), used = new Set();
  for (const a of spots) for (const b of spots) {
    if (a === b || used.has(a) || used.has(b)) continue;
    const wa = a.box.xmax - a.box.xmin, ca = [(a.box.xmin + a.box.xmax) / 2, (a.box.ymin + a.box.ymax) / 2], cb = [(b.box.xmin + b.box.xmax) / 2, (b.box.ymin + b.box.ymax) / 2];
    if (Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) < wa * 1.8) { a.kind = "twin_recessed_spot"; used.add(a); used.add(b); }
  }
  const items = kept.filter((d) => !used.has(d) || d.kind === "twin_recessed_spot");
  // one answer per kind, with how many and where they are
  const by = new Map();
  for (const d of items) { if (!by.has(d.kind)) by.set(d.kind, []); by.get(d.kind).push(d); }
  const out = [];
  for (const [kind, list] of by) {
    const cx = list.reduce((s, d) => s + (d.box.xmin + d.box.xmax) / 2, 0) / list.length / W;
    const bottom = list.reduce((s, d) => s + d.box.ymax, 0) / list.length / H, cy = list.reduce((s, d) => s + (d.box.ymin + d.box.ymax) / 2, 0) / list.length / H;
    const ceiling = CEILING.has(kind);
    // on the floor, things lower in the photo are nearer; on the ceiling, things higher in the photo are nearer
    const depth = ceiling ? (cy < 0.18 ? "near" : cy < 0.36 ? "middle" : "far") : bottom > 0.88 ? "near" : bottom > 0.66 ? "middle" : "far";
    const wall = ceiling ? "ceiling" : ON_WALL.has(kind) || kind === "door" ? (cx < 0.12 ? "left" : cx > 0.88 ? "right" : "back") : "floor";
    const xs = list.map((d) => (d.box.xmin + d.box.xmax) / 2 / W), spread = list.length > 1 ? Math.max(...xs) - Math.min(...xs) : undefined;
    out.push({ kind, count: list.length, x: Math.round(cx * 100) / 100, spread, depth, wall, colour: colourAt ? colourAt(list[0].box) : undefined, name: "", score: Math.max(...list.map((d) => d.score)) });
  }
  return out.sort((a, b) => b.score - a.score);
}
