// Devices go to the room with the same name as their Home Assistant area, at sensible spots.
import assert from "node:assert/strict";
import { autoPlace, nameFit, kindOf } from "../src/autoplace.js";
import { rect } from "../src/model.js";

const floor = { height: 2.8, rooms: [{ id: "lr", name: "Living room", pts: rect(0, 0, 6, 4) }, { id: "mb", name: "Master Bedroom", pts: rect(6, 0, 4, 4) }],
  openings: [{ id: "w1", type: "window", x: 3, y: 0, width: 2 }, { id: "d1", type: "door", x: 6, y: 2, width: 0.9 }], items: [{ id: "s", kind: "sofa", x: 3, y: 3.4 }],
  devices: [{ id: "old", kind: "light", look: "pendant", entity: "", x: 3, y: 2 }], walls: [] };
const st = (id, a = {}) => [id, { entity_id: id, state: "off", attributes: { friendly_name: id.split(".")[1].replace(/_/g, " "), ...a } }];
const hass = {
  states: Object.fromEntries([st("light.lr_main"), st("light.lr_spots"), st("light.lr_group", { entity_id: ["light.lr_main"] }), st("climate.lr_ac"), st("cover.lr_curtain"),
    st("media_player.lr_tv", { device_class: "tv" }), st("switch.lr_lamp_plug"), st("switch.lr_kettle"), st("light.bed"), st("fan.bed_fan"), st("lock.bed_door"), st("light.garage"), st("climate.config_thing")]),
  entities: { "light.lr_main": { area_id: "living" }, "light.lr_spots": { area_id: "living" }, "light.lr_group": { area_id: "living" }, "climate.lr_ac": { area_id: "living" }, "cover.lr_curtain": { area_id: "living" },
    "media_player.lr_tv": { area_id: "living" }, "switch.lr_lamp_plug": { area_id: "living" }, "switch.lr_kettle": { area_id: "living" }, "light.bed": { device_id: "dv1" }, "fan.bed_fan": { area_id: "bed" },
    "lock.bed_door": { area_id: "bed" }, "light.garage": { area_id: "garage" }, "climate.config_thing": { area_id: "living", entity_category: "config" } },
  devices: { dv1: { area_id: "bed" } },
  areas: { living: { name: "Living Room" }, bed: { name: "Master bedroom" }, garage: { name: "Garage" } },
};
assert.equal(nameFit("Living Room", "Living room"), 1);
assert.ok(nameFit("Lounge", "Living room") > 0.4);
assert.equal(kindOf("switch.lr_kettle", hass.states["switch.lr_kettle"]), null);
assert.equal(kindOf("switch.lr_lamp_plug", hass.states["switch.lr_lamp_plug"]), "light");
const r = autoPlace(hass, floor);
const ents = r.add.map((d) => d.entity).sort();
assert.deepEqual(r.link, [{ id: "old", entity: "light.lr_main" }], "a drawn light is linked first");
assert.ok(!ents.includes("light.lr_group"), "light groups are left out");
assert.ok(!ents.includes("switch.lr_kettle") && !ents.includes("climate.config_thing"));
for (const e of ["light.lr_spots", "climate.lr_ac", "cover.lr_curtain", "media_player.lr_tv", "switch.lr_lamp_plug", "light.bed", "fan.bed_fan", "lock.bed_door"]) assert.ok(ents.includes(e), e);
const by = Object.fromEntries(r.add.map((d) => [d.entity, d]));
assert.deepEqual([by["cover.lr_curtain"].x, by["cover.lr_curtain"].y], [3, 0], "the curtain goes on the window");
assert.equal(by["lock.bed_door"].x, 6, "the lock goes on the door");
assert.ok(by["media_player.lr_tv"].y < 1, "the TV faces the sofa");
assert.ok(by["climate.lr_ac"].y > 0.05 || by["climate.lr_ac"].x !== 3, "the AC is not on the window wall");
for (const d of r.add) assert.ok(d.x >= 0 && d.x <= 10 && d.y >= 0 && d.y <= 4, `${d.entity} inside`);
assert.deepEqual(r.unmatched.map((u) => u.name), ["Garage"]);
// nothing is placed twice, and a device taken out stays out
const again = autoPlace(hass, { ...floor, devices: [...floor.devices.map((d) => (d.id === "old" ? { ...d, entity: "light.lr_main" } : d)), ...r.add] });
assert.equal(again.add.length + again.link.length, 0);
assert.ok(!autoPlace(hass, floor, { skip: new Set(["fan.bed_fan"]) }).add.some((d) => d.entity === "fan.bed_fan"));
// the person can choose a room for an area without a match
assert.ok(autoPlace(hass, floor, { chosen: { garage: "mb" } }).add.some((d) => d.entity === "light.garage"));
console.log("autoplace: all passed");
