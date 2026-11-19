// Ready-made homes to start from: drag the walls to make them yours.
import { newPlan, rect, uid } from "./model.js";

const room = (type, name, pts, extra = {}) => ({ id: uid("r"), type, name, pts, ...extra });
const door = (x, y, width = 0.9, extra = {}) => ({ id: uid("o"), type: "door", x, y, width, height: 2.1, sill: 0, swing: 1, ...extra });
const win = (x, y, width = 1.6, extra = {}) => ({ id: uid("o"), type: "window", x, y, width, height: 1.5, sill: 0.9, ...extra });
const item = (kind, x, y, rot = 0, extra = {}) => ({ id: uid("i"), kind, x, y, rot, ...extra });
const dev = (kind, x, y, extra = {}) => ({ id: uid("d"), kind, entity: "", x, y, ...extra });

export function apartment() {
  const p = newPlan("Two-bedroom apartment");
  const f = p.floors[0];
  f.rooms = [
    room("balcony", "Balcony", rect(0, -1.6, 6.5, 1.6)),
    room("living", "Living room", rect(0, 0, 6.5, 5)),
    room("kitchen", "Kitchen", rect(6.5, 0, 3.5, 5)),
    room("bedroom", "Master bedroom", rect(10, 0, 4.5, 5)),
    room("entrance", "Entrance", rect(0, 5, 3, 4)),
    room("hall", "Hall", rect(3, 5, 11.5, 1.4)),
    room("bath", "Bathroom", rect(3, 6.4, 2.5, 2.6)),
    room("bedroom", "Bedroom", rect(5.5, 6.4, 4.5, 2.6)),
    room("bath", "Master bath", rect(10, 6.4, 4.5, 2.6)),
  ];
  const kitchen = f.rooms[2];
  kitchen.floor = "porcelain";
  f.openings = [
    door(1.5, 9, 1.0, { main: true, swing: -1 }),
    door(1.5, 5, 0.9), door(3, 5.7, 0.9), door(8.25, 5, 0.9), door(11.2, 5, 0.9), door(4.25, 6.4, 0.8), door(7, 6.4, 0.9), door(12, 6.4, 0.8),
    { id: uid("o"), type: "arch", x: 6.5, y: 2.6, width: 1.4, height: 2.2, sill: 0 },
    { id: uid("o"), type: "slider", x: 3.25, y: 0, width: 2.6, height: 2.2, sill: 0 },
    win(0, 2.5, 2.0), win(8.25, 0, 1.6), win(12.25, 0, 2.2), win(14.5, 2.5, 1.6), win(7.75, 9, 1.8), win(4.25, 9, 0.7, { sill: 1.5, height: 0.6 }), win(12.25, 9, 0.8, { sill: 1.5, height: 0.6 }),
  ];
  f.items = [
    item("rug", 3.45, 2.85, 0), item("sofa_l", 3.2, 3.575, 180), item("coffee_table", 3.65, 2.65, 0), item("armchair", 5.4, 2.0, -100),
    item("tv_unit", 3.1, 0.35, 0), item("tv", 3.1, 0.14, 0, { z: 1.05 }), item("plant", 0.55, 0.55), item("floor_lamp", 1.45, 4.3),
    item("dining_table", 5.55, 4.1, 90, { w: 1.6 }), item("dining_chair", 5.1, 3.55, 90), item("dining_chair", 5.1, 4.65, 90), item("dining_chair", 6.0, 3.55, -90), item("dining_chair", 6.0, 4.65, -90),
    item("kitchen_base", 8.675, 0.4, 0, { w: 2.45 }), item("kitchen_base", 9.6, 2.2, 90, { w: 2.0 }), item("fridge", 6.95, 0.45, 0), item("kitchen_island", 8.2, 3.0, 0, { w: 1.8 }),
    item("bar_stool", 7.7, 3.7, 180), item("bar_stool", 8.7, 3.7, 180), item("pendant_lamp", 8.2, 3.0, 0, { mount: "ceiling" }),
    item("bed_double", 12.25, 1.25, 0), item("nightstand", 11.05, 0.35), item("nightstand", 13.45, 0.35), item("wardrobe", 14.15, 3.8, -90, { w: 1.8 }), item("rug", 12.25, 2.4, 0, { w: 2.2, d: 1.4, color: "#B7A68F" }),
    item("console", 1.5, 8.7, 180, { w: 1.1 }), item("plant_small", 2.6, 8.6), item("mirror", 0.05, 7.0, 90, { z: 1.0 }),
    item("bathtub", 4.25, 8.55, 180), item("toilet", 3.3, 7.4, 90), item("basin", 5.25, 7.4, -90),
    item("bed_single", 9.0, 7.7, -90), item("desk", 6.3, 8.6, 180), item("office_chair", 6.3, 8.1, 0), item("bookshelf", 5.72, 6.9, 90),
    item("shower", 13.95, 8.45, 0), item("toilet", 10.35, 8.5, 90), item("basin", 12.25, 8.7, 180, { w: 1.2 }),
    item("bench", 4.5, -0.8, 0), item("plant", 0.5, -0.8), item("plant", 6.0, -0.8),
  ];
  f.devices = [
    dev("light", 3.65, 2.65, { look: "pendant", name: "Living light" }), dev("light", 8.2, 2.0, { look: "spots", name: "Kitchen light" }),
    dev("light", 12.25, 2.5, { look: "flush", name: "Bedroom light" }), dev("light", 1.5, 7.0, { look: "flush", name: "Entrance light" }),
    dev("light", 8.75, 5.7, { look: "spots", name: "Hall light" }), dev("ac", 6.2, 2.0, { name: "Living AC", rot: -90 }), dev("ac", 14.35, 1.2, { name: "Bedroom AC", rot: -90 }),
    dev("tv", 3.1, 0.14, { name: "TV" }), dev("curtain", 0, 2.5, { name: "Living curtains" }), dev("curtain", 12.25, 0, { name: "Bedroom curtains" }),
    dev("door", 1.5, 9, { name: "Front door" }),
  ];
  return p;
}

export function studio() {
  const p = newPlan("Studio");
  const f = p.floors[0];
  f.rooms = [room("living", "Studio", rect(0, 0, 7, 5.5)), room("bath", "Bathroom", rect(7, 0, 2.4, 2.8)), room("entrance", "Entrance", rect(7, 2.8, 2.4, 2.7))];
  f.openings = [door(8.2, 5.5, 1.0, { main: true, swing: -1 }), door(7, 4.2, 0.9), door(8.2, 2.8, 0.8), win(3.5, 0, 3.0), win(0, 2.75, 1.6), win(8.2, 0, 0.6, { sill: 1.5, height: 0.6 })];
  f.items = [
    item("bed_double", 1.25, 1.2, 90), item("nightstand", 0.3, 2.6), item("sofa", 4.6, 4.8, 180), item("coffee_table", 4.6, 3.8), item("tv_unit", 4.6, 2.45, 0, { w: 1.6 }),
    item("kitchen_base", 6.65, 1.8, 90, { w: 2.8 }), item("fridge", 6.6, 4.9, -90), item("rug", 4.6, 3.8, 0, { w: 2.0, d: 1.4 }), item("plant", 6.5, 0.5),
    item("toilet", 7.4, 0.5, 0), item("shower", 8.95, 0.45, 0), item("basin", 7.3, 2.35, 90),
  ];
  f.devices = [dev("light", 3.5, 2.7, { look: "pendant", name: "Studio light" }), dev("ac", 3.5, 0.15, { name: "AC", rot: 0 }), dev("curtain", 3.5, 0, { name: "Curtains" })];
  return p;
}

export function villa() {
  const p = newPlan("Villa, ground floor");
  const f = p.floors[0];
  f.rooms = [
    room("garden", "Garden", rect(-3, -3, 22, 3)),
    room("majlis", "Majlis", rect(0, 0, 7, 6)), room("living", "Family living", rect(7, 0, 7, 6)), room("kitchen", "Kitchen", rect(14, 0, 5, 6)),
    room("entrance", "Entrance", rect(0, 6, 4, 4)), room("hall", "Hall", rect(4, 6, 10, 2)), room("dining", "Dining", rect(14, 6, 5, 4)),
    room("bath", "Guest bath", rect(4, 8, 3, 2)), room("bedroom", "Guest bedroom", rect(7, 8, 7, 4)), room("laundry", "Laundry", rect(14, 10, 5, 2)),
  ];
  f.openings = [
    door(2, 10, 1.6, { main: true, double: true, swing: -1 }), door(2, 6, 1.2, { double: true }), door(4, 7, 1.0), door(10.5, 6, 1.6, { double: true }), door(14, 7, 1.2),
    door(5.5, 8, 0.8), door(9, 8, 0.9), door(16.5, 10, 0.9), { id: uid("o"), type: "arch", x: 14, y: 3, width: 2.0, height: 2.3, sill: 0 },
    { id: uid("o"), type: "slider", x: 10.5, y: 0, width: 3.2, height: 2.4, sill: 0 },
    win(3.5, 0, 2.4), win(0, 3, 2.0), win(16.5, 0, 1.8), win(19, 3, 1.6), win(19, 8, 1.6), win(10.5, 12, 2.0), win(5.5, 10, 0.7, { sill: 1.6, height: 0.5 }),
  ];
  f.items = [
    item("majlis_seat", 3.5, 0.5, 0, { w: 5.2 }), item("majlis_seat", 0.5, 3.0, 90, { w: 4.8 }), item("majlis_seat", 6.5, 3.0, -90, { w: 4.8 }), item("rug", 3.5, 3.0, 0, { w: 4.4, d: 3.6, color: "#8E2F2F" }),
    item("coffee_table", 3.5, 3.0, 0, { w: 1.6 }),
    item("sofa_l", 10.2, 4.2, 180, { w: 3.4 }), item("tv_unit", 10.5, 0.35, 0, { w: 2.6 }), item("tv", 10.5, 0.14, 0, { z: 1.1, w: 1.9 }), item("rug", 10.5, 2.8, 0, { w: 3.6, d: 2.4 }),
    item("coffee_table", 10.4, 2.8), item("armchair", 7.8, 2.0, 90), item("plant", 13.4, 0.6),
    item("kitchen_base", 16.9, 0.4, 0, { w: 3.8 }), item("kitchen_base", 18.6, 3.0, -90, { w: 4.4 }), item("kitchen_island", 16.2, 3.2, 0, { w: 2.4 }), item("fridge", 14.5, 0.45),
    item("dining_table", 16.5, 8.0, 0, { w: 2.4 }), ...[15.6, 16.5, 17.4].flatMap((x) => [item("dining_chair", x, 7.35, 0), item("dining_chair", x, 8.65, 180)]),
    item("console", 2, 9.7, 180, { w: 1.4 }), item("plant", 0.5, 9.4), item("plant", 3.5, 9.4),
    item("bed_double", 10.5, 10.95, 180), item("nightstand", 9.3, 11.65), item("nightstand", 11.7, 11.65), item("wardrobe", 7.35, 10.0, 90, { w: 2.2 }),
    item("toilet", 4.4, 8.6, 90), item("basin", 6.6, 9.2, -90),
    item("washing_machine", 17.5, 11.65, 180), item("washing_machine", 18.2, 11.65, 180, { color: "#E8E8E8" }),
    item("tree", -1.5, -1.5), item("tree", 20, -1.5), item("bench", 7, -1.2, 0, { w: 2.0 }),
  ];
  f.devices = [
    dev("light", 3.5, 3.0, { look: "chandelier", name: "Majlis chandelier" }), dev("light", 10.5, 2.8, { look: "pendant", name: "Living light" }),
    dev("light", 16.5, 3.0, { look: "spots", name: "Kitchen light" }), dev("light", 16.5, 8.0, { look: "pendant", name: "Dining light" }), dev("light", 10.5, 10.0, { look: "flush", name: "Guest bedroom light" }),
    dev("ac", 6.8, 3.0, { rot: -90, name: "Majlis AC" }), dev("ac", 13.8, 3.0, { rot: -90, name: "Living AC" }), dev("ac", 13.8, 10.0, { rot: -90, name: "Bedroom AC" }),
    dev("tv", 10.5, 0.14, { name: "TV" }), dev("curtain", 3.5, 0, { name: "Majlis curtains" }), dev("curtain", 10.5, 0, { name: "Living curtains" }), dev("door", 2, 10, { name: "Front door" }),
  ];
  return p;
}

export const SAMPLES = [
  { id: "apartment", name: "Two-bedroom apartment", make: apartment, size: "14.5 × 10.6 m" },
  { id: "villa", name: "Villa ground floor with majlis", make: villa, size: "22 × 15 m" },
  { id: "studio", name: "Studio", make: studio, size: "9.4 × 5.5 m" },
];
