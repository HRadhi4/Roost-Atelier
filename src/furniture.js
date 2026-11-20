// The furniture library. Every piece is built from soft rounded shapes and real finishes, at its real size in metres.
// Origin: centre of the footprint on the floor. Front faces +z (towards the room); the back sits at -z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { fabric, wood, solid, metal, brass, chrome, glass, porcelain, ownMaterial } from "./materials.js";
import { buildStairs } from "./stairs.js";

const geoCache = new Map();
function rbox(w, h, d, r) {
  r = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 3, r));
  return geoCache.get(k);
}
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
// a rounded box resting with its bottom at y
const B = (g, w, h, d, r, mat, x = 0, y = 0, z = 0) => { const m = mesh(rbox(w, h, d, r), mat, x, y + h / 2, z); g.add(m); return m; };
const C = (g, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) => { const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z); g.add(m); return m; };
const legs = (g, w, d, h, inset, mat, r = 0.018) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(g, r, r * 0.8, h, mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 10); };

// ---------------------------------------------------------------- builders: (o) => Group, o = { w, d, h, color, wood, metal }
function sofa(o, arms = true) {
  const g = new THREE.Group(), f = fabric(o.color), w = o.w, d = o.d;
  legs(g, w - 0.1, d - 0.1, 0.1, 0.06, wood("walnut"));
  B(g, w, 0.22, d, 0.05, f, 0, 0.1, 0);
  const arm = arms ? 0.18 : 0, seatW = w - arm * 2, n = Math.max(1, Math.round(seatW / 0.75));
  for (let i = 0; i < n; i++) B(g, seatW / n - 0.01, 0.15, d - 0.28, 0.06, f, -seatW / 2 + (i + 0.5) * (seatW / n), 0.31, 0.1);
  B(g, w, 0.48, 0.22, 0.07, f, 0, 0.3, -d / 2 + 0.11);
  for (let i = 0; i < n; i++) { const c = B(g, seatW / n - 0.06, 0.38, 0.14, 0.07, f, -seatW / 2 + (i + 0.5) * (seatW / n), 0.42, -d / 2 + 0.28); c.rotation.x = -0.18; }
  if (arms) for (const s of [-1, 1]) B(g, arm, 0.34, d, 0.07, f, s * (w / 2 - arm / 2), 0.3, 0);
  return g;
}
function sofaL(o) {
  // the whole corner sofa stays inside its footprint: o.d is the chaise length, the back sofa is 0.95 deep
  const D = 0.95, ch = Math.max(D + 0.3, o.d), g = new THREE.Group(), f = fabric(o.color);
  const back = sofa({ ...o, d: D }, true); back.position.z = -ch / 2 + D / 2; g.add(back);
  // chaise on the right, running from the back to the front of the footprint
  const c = new THREE.Group();
  B(c, 0.9, 0.22, ch, 0.05, f, 0, 0.1, 0); B(c, 0.86, 0.15, ch - 0.06, 0.06, f, 0, 0.31, 0.02); B(c, 0.18, 0.34, ch, 0.07, f, 0.36, 0.3, 0);
  legs(c, 0.8, ch - 0.1, 0.1, 0.06, wood("walnut"));
  c.position.set(o.w / 2 - 0.45, 0, 0);
  g.add(c);
  return g;
}
function armchair(o) {
  const g = new THREE.Group(), f = fabric(o.color);
  for (const s of [-1, 1]) for (const z of [-1, 1]) { const l = C(g, 0.02, 0.014, 0.18, wood("walnut"), s * 0.3, 0, z * 0.3, 10); l.rotation.z = s * 0.12; }
  B(g, 0.8, 0.2, 0.8, 0.06, f, 0, 0.16, 0); B(g, 0.6, 0.14, 0.6, 0.06, f, 0, 0.36, 0.06);
  const back = B(g, 0.8, 0.5, 0.18, 0.08, f, 0, 0.36, -0.3); back.rotation.x = -0.15;
  for (const s of [-1, 1]) B(g, 0.12, 0.26, 0.74, 0.06, f, s * 0.34, 0.36, 0.02);
  return g;
}
function coffeeTable(o) {
  const g = new THREE.Group(), round = o.round;
  if (round) { C(g, o.w / 2, o.w / 2, 0.04, solid("#EDEAE4", { rough: 0.25, clear: 0.4 }), 0, 0.36, 0, 48); C(g, 0.12, 0.16, 0.36, metal("#1B1B1F"), 0, 0, 0); return g; }
  B(g, o.w, 0.05, o.d, 0.015, wood(o.wood || "walnut"), 0, 0.35, 0);
  B(g, o.w - 0.1, 0.03, o.d - 0.1, 0.01, wood(o.wood || "walnut"), 0, 0.08, 0);
  legs(g, o.w, o.d, 0.35, 0.05, metal("#1B1B1F"), 0.012);
  B(g, 0.22, 0.05, 0.16, 0.01, solid("#3E5A7A", { rough: 0.6 }), -0.2, 0.4, 0.05); C(g, 0.05, 0.04, 0.12, solid("#E8E2D6", { rough: 0.3, clear: 0.5 }), 0.25, 0.4, -0.05);
  return g;
}
function sideTable(o) { const g = new THREE.Group(); C(g, o.w / 2, o.w / 2, 0.03, wood(o.wood || "oak"), 0, o.h - 0.03, 0, 32); C(g, 0.015, 0.015, o.h - 0.03, metal("#1B1B1F"), 0, 0, 0); C(g, 0.16, 0.18, 0.02, metal("#1B1B1F"), 0, 0, 0); return g; }
function tvUnit(o) {
  const g = new THREE.Group(), wd = wood(o.wood || "walnut");
  B(g, o.w, o.h - 0.1, o.d, 0.01, wd, 0, 0.1, 0);
  for (let i = 0; i < 3; i++) B(g, o.w / 3 - 0.02, o.h - 0.16, 0.01, 0.003, wood(o.wood || "walnut", "#d9d2c8"), -o.w / 3 + i * (o.w / 3), 0.13, o.d / 2);
  legs(g, o.w, o.d, 0.1, 0.06, metal("#1B1B1F"), 0.012);
  return g;
}
function tv(o) {
  const g = new THREE.Group();
  B(g, o.w, o.h, 0.04, 0.008, solid("#0B0B0E", { rough: 0.25, metal: 0.3 }), 0, 0, 0);
  const scr = mesh(new THREE.PlaneGeometry(o.w - 0.03, o.h - 0.03), solid("#05060A", { rough: 0.08, clear: 1 }), 0, o.h / 2, 0.021);
  scr.name = "screen"; g.add(scr);
  return g;
}
function rug(o) { const g = new THREE.Group(); const m = B(g, o.w, 0.012, o.d, 0.004, fabric(o.color || "#B9AE9C"), 0, 0, 0); m.castShadow = false; return g; }
function floorLamp(o) {
  const g = new THREE.Group();
  C(g, 0.15, 0.16, 0.02, metal("#1B1B1F"), 0, 0, 0); C(g, 0.012, 0.012, 1.35, brass(), 0, 0.02, 0, 8);
  const shade = C(g, 0.16, 0.22, 0.3, solid("#F3EBDD", { rough: 0.9, emissive: "#FFD9A0", emissiveIntensity: 0, side: THREE.DoubleSide }), 0, 1.3, 0, 32);
  shade.material = shade.material.clone(); shade.name = "glow";
  return g;
}
function pendant(o) {
  const g = new THREE.Group(), h = o.drop || 0.75;
  C(g, 0.004, 0.004, h, metal("#1B1B1F"), 0, -h, 0, 6);
  if (o.style === "basket") {
    // a woven rattan or seagrass shade: an egg of light woven bands with the bulb glowing through the gaps
    const weave = solid("#A9784A", { rough: 0.9, side: THREE.DoubleSide }), H2 = 0.42, R = 0.2;
    for (let i = 0; i < 9; i++) { const y = -h - 0.02 - (i + 0.5) * (H2 / 9), r = R * Math.sin(Math.PI * (0.12 + 0.76 * (i + 0.5) / 9)); const band = mesh(new THREE.TorusGeometry(r, 0.012, 6, 32), weave, 0, y, 0); band.rotation.x = Math.PI / 2; g.add(band); }
    const bulb = mesh(new THREE.SphereGeometry(0.05, 16, 12), solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 0 }), 0, -h - 0.2, 0);
    bulb.material = bulb.material.clone(); bulb.name = "glow"; g.add(bulb);
    return g;
  }
  if (o.style === "bulb") {
    // a bare filament bulb on its cord: the glass itself glows warm
    const cap = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), metal("#B08D57"), 0, -h - 0.02, 0); g.add(cap);
    const bulb = mesh(new THREE.SphereGeometry(0.065, 20, 16), solid("#FFE7B8", { emissive: "#FFC07A", emissiveIntensity: 0, rough: 0.1 }), 0, -h - 0.1, 0);
    bulb.scale.y = 1.25; bulb.material = bulb.material.clone(); bulb.name = "glow"; g.add(bulb);
    return g;
  }
  if (o.style === "glass") {
    // a clear or opal glass globe with the bulb glowing inside
    const globe = mesh(new THREE.SphereGeometry(0.15, 32, 20), solid("#F4F1EA", { rough: 0.15, emissive: "#FFD9A0", emissiveIntensity: 0, opacity: 0.85 }), 0, -h - 0.15, 0);
    globe.material = globe.material.clone(); globe.name = "glow"; g.add(globe);
    return g;
  }
  const shade = mesh(new THREE.SphereGeometry(0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), solid("#1D1E22", { rough: 0.35, metal: 0.6, side: THREE.DoubleSide }), 0, -h, 0);
  g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.06, 16, 12), solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 0 }), 0, -h - 0.02, 0);
  bulb.material = bulb.material.clone(); bulb.name = "glow"; g.add(bulb);
  return g;
}
function chandelier(o = {}) {
  const g = new THREE.Group();
  if (o.style === "candle") {
    // black iron arms curving up to candle bulbs, hung on a chain
    const iron = metal("#1B1B1F", 0.5), glow = solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 0 }).clone();
    C(g, 0.06, 0.06, 0.02, iron, 0, -0.02, 0, 24); C(g, 0.006, 0.006, 0.5, iron, 0, -0.52, 0, 6); C(g, 0.05, 0.035, 0.06, iron, 0, -0.58, 0, 16);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, arm = new THREE.Group(); arm.rotation.y = a; g.add(arm);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.56, 0), new THREE.Vector3(0.3, -0.72, 0), new THREE.Vector3(0.36, -0.5, 0));
      const tube = mesh(new THREE.TubeGeometry(curve, 16, 0.008, 6), iron); arm.add(tube);
      const cup = mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.012, 16), iron, 0.36, -0.5, 0); arm.add(cup);
      const can = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 10), iron, 0.36, -0.45, 0); arm.add(can);
      const b = mesh(new THREE.SphereGeometry(0.02, 12, 8), glow, 0.36, -0.39, 0); b.scale.y = 1.6; b.name = "glow"; arm.add(b);
    }
    return g;
  }
  C(g, 0.006, 0.006, 0.6, brass(), 0, -0.6, 0, 6);
  const ring = mesh(new THREE.TorusGeometry(0.42, 0.015, 8, 48), brass(), 0, -0.65, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  const glow = solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 0 }).clone();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const b = mesh(new THREE.SphereGeometry(0.05, 12, 8), glow, Math.cos(a) * 0.42, -0.6, Math.sin(a) * 0.42); b.name = "glow"; g.add(b); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const c = mesh(new THREE.OctahedronGeometry(0.025), glass(), Math.cos(a) * 0.36, -0.75 - (i % 3) * 0.05, Math.sin(a) * 0.36); g.add(c); }
  return g;
}
function diningTable(o) {
  const g = new THREE.Group();
  B(g, o.w, 0.05, o.d, 0.012, wood(o.wood || "oak"), 0, 0.7, 0);
  for (const s of [-1, 1]) { B(g, 0.06, 0.66, o.d - 0.2, 0.01, wood(o.wood || "oak"), s * (o.w / 2 - 0.15), 0.04, 0); B(g, 0.12, 0.04, o.d - 0.12, 0.01, wood(o.wood || "oak"), s * (o.w / 2 - 0.15), 0, 0); }
  return g;
}
function diningChair(o) {
  const g = new THREE.Group(), wd = wood(o.wood || "oak"), f = fabric(o.color || "#D8CFC0");
  legs(g, 0.42, 0.44, 0.44, 0.03, wd, 0.016);
  B(g, 0.46, 0.06, 0.46, 0.03, f, 0, 0.44, 0);
  const back = B(g, 0.42, 0.34, 0.04, 0.02, wd, 0, 0.52, -0.21); back.rotation.x = -0.1;
  return g;
}
function barStool(o) { const g = new THREE.Group(); C(g, 0.18, 0.17, 0.06, fabric(o.color || "#45464C"), 0, 0.68, 0, 24); C(g, 0.02, 0.02, 0.68, metal("#1B1B1F"), 0, 0, 0, 8); C(g, 0.2, 0.2, 0.02, metal("#1B1B1F"), 0, 0, 0); const r = mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 24), metal("#1B1B1F"), 0, 0.28, 0); r.rotation.x = Math.PI / 2; g.add(r); return g; }
function bed(o) {
  const g = new THREE.Group(), wd = wood(o.wood || "oak"), f = fabric(o.color || "#E9E6F0");
  B(g, o.w + 0.06, 0.3, o.d, 0.03, fabric("#8E8C92"), 0, 0.08, 0);
  legs(g, o.w, o.d, 0.08, 0.08, wd, 0.02);
  B(g, o.w + 0.1, 0.95, 0.1, 0.04, fabric(o.head || "#8E8C92"), 0, 0.1, -o.d / 2 + 0.05);
  B(g, o.w - 0.04, 0.22, o.d - 0.14, 0.08, f, 0, 0.36, 0.04);
  B(g, o.w - 0.02, 0.06, o.d * 0.42, 0.03, fabric(o.throw || "#6D5BB0"), 0, 0.56, o.d * 0.24);
  const n = o.w > 1.3 ? 2 : 1;
  for (let i = 0; i < n; i++) { const p = B(g, o.w / n - 0.12, 0.14, 0.38, 0.07, fabric("#F7F5F2"), -o.w / 2 + (i + 0.5) * (o.w / n), 0.56, -o.d / 2 + 0.32); p.rotation.x = -0.25; }
  return g;
}
function nightstand(o) { const g = new THREE.Group(), wd = wood(o.wood || "walnut"); B(g, o.w, 0.42, o.d, 0.015, wd, 0, 0.12, 0); legs(g, o.w, o.d, 0.12, 0.04, metal("#1B1B1F"), 0.01); B(g, o.w - 0.04, 0.16, 0.01, 0.003, wood(o.wood || "walnut", "#cfc7bb"), 0, 0.33, o.d / 2); const lamp = C(g, 0.09, 0.11, 0.16, solid("#F3EBDD", { rough: 0.9, emissive: "#FFD9A0", emissiveIntensity: 0 }), 0.04, 0.72, -0.04, 24); lamp.material = lamp.material.clone(); lamp.name = "glow"; C(g, 0.05, 0.06, 0.18, solid("#C9B79C", { rough: 0.4, clear: 0.6 }), 0.04, 0.54, -0.04); return g; }
function wardrobe(o) { const g = new THREE.Group(), wd = wood(o.wood || "white"); B(g, o.w, o.h, o.d, 0.01, wd, 0, 0, 0); const n = Math.max(2, Math.round(o.w / 0.5)); for (let i = 0; i < n; i++) { B(g, o.w / n - 0.008, o.h - 0.02, 0.012, 0.003, wd, -o.w / 2 + (i + 0.5) * (o.w / n), 0.01, o.d / 2); B(g, 0.012, 0.3, 0.02, 0.004, brass(), -o.w / 2 + (i + 0.5) * (o.w / n) + (i % 2 ? -1 : 1) * (o.w / n / 2 - 0.05), o.h / 2 - 0.15, o.d / 2 + 0.015); } return g; }
function dresser(o) { const g = new THREE.Group(), wd = wood(o.wood || "walnut"); B(g, o.w, o.h - 0.12, o.d, 0.015, wd, 0, 0.12, 0); legs(g, o.w, o.d, 0.12, 0.05, metal("#1B1B1F"), 0.012); for (let i = 0; i < 3; i++) B(g, o.w - 0.04, (o.h - 0.18) / 3 - 0.01, 0.01, 0.003, wood(o.wood || "walnut", "#d3cabe"), 0, 0.14 + i * ((o.h - 0.18) / 3), o.d / 2); return g; }
function desk(o) { const g = new THREE.Group(); B(g, o.w, 0.04, o.d, 0.01, wood(o.wood || "oak"), 0, 0.72, 0); for (const s of [-1, 1]) { B(g, 0.04, 0.72, 0.04, 0.005, metal("#1B1B1F"), s * (o.w / 2 - 0.04), 0, o.d / 2 - 0.05); B(g, 0.04, 0.72, 0.04, 0.005, metal("#1B1B1F"), s * (o.w / 2 - 0.04), 0, -o.d / 2 + 0.05); } B(g, 0.55, 0.32, 0.02, 0.008, solid("#0B0B0E", { rough: 0.3 }), 0, 0.84, -o.d / 2 + 0.12); C(g, 0.02, 0.04, 0.12, metal("#1B1B1F"), 0, 0.76, -o.d / 2 + 0.12, 8); return g; }
function officeChair(o) { const g = new THREE.Group(), f = fabric(o.color || "#45464C"); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const l = B(g, 0.03, 0.03, 0.3, 0.01, metal("#1B1B1F"), Math.sin(a) * 0.15, 0.04, Math.cos(a) * 0.15); l.rotation.y = a; } C(g, 0.02, 0.025, 0.4, chrome(), 0, 0.06, 0, 10); B(g, 0.5, 0.08, 0.48, 0.03, f, 0, 0.46, 0); const b = B(g, 0.46, 0.5, 0.05, 0.03, f, 0, 0.58, -0.24); b.rotation.x = -0.12; return g; }
function bookshelf(o) {
  const g = new THREE.Group(), wd = wood(o.wood || "oak");
  for (const s of [-1, 1]) B(g, 0.025, o.h, o.d, 0.005, wd, s * (o.w / 2 - 0.0125), 0, 0);
  const n = 5; for (let i = 0; i <= n; i++) B(g, o.w, 0.025, o.d, 0.005, wd, 0, i * (o.h - 0.025) / n, 0);
  // the same books every time for the same shelf (seeded by its id), as simple blocks
  let seed = [...String(o.id || "shelf")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 7;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const cols = ["#7A3B3B", "#3E5A7A", "#D8CFC0", "#4D6B4F", "#C9A040", "#2F2F35"].map((c) => solid(c, { rough: 0.7 }));
  for (let i = 0; i < n; i++) {
    let x = -o.w / 2 + 0.04;
    while (x < o.w / 2 - 0.08) {
      const bw = 0.025 + rnd() * 0.03, bh = 0.18 + rnd() * 0.1;
      g.add(mesh(new THREE.BoxGeometry(bw, bh, o.d - 0.06), cols[(rnd() * cols.length) | 0], x + bw / 2, i * (o.h - 0.025) / n + 0.025 + bh / 2, 0));
      x += bw + 0.003; if (rnd() < 0.08) x += 0.12;
    }
  }
  return g;
}
function plant(o) {
  const g = new THREE.Group(), s = o.h / 1.2;
  C(g, 0.2 * s, 0.15 * s, 0.38 * s, solid(o.pot || "#D8CFC2", { rough: 0.75 }), 0, 0, 0, 24);
  C(g, 0.19 * s, 0.19 * s, 0.01, solid("#3B2A1E", { rough: 1 }), 0, 0.37 * s, 0, 24);
  const leaf = solid("#3E7A44", { rough: 0.55, side: THREE.DoubleSide }), dark = solid("#2C5E35", { rough: 0.55, side: THREE.DoubleSide });
  const lg = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI, 0, Math.PI); lg.scale(0.07, 0.003, 0.17);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, up = 0.4 + (i / 26) * 0.75, r = 0.05 + Math.sin(i * 1.7) * 0.03;
    const stem = C(g, 0.004, 0.004, up * s - 0.35 * s, solid("#4F6B3A"), Math.cos(a) * r * s, 0.37 * s, Math.sin(a) * r * s, 5);
    stem.rotation.z = Math.cos(a) * 0.25; stem.rotation.x = -Math.sin(a) * 0.25;
    const l = mesh(lg, i % 3 ? leaf : dark, Math.cos(a) * (r + 0.12) * s, up * s, Math.sin(a) * (r + 0.12) * s);
    l.rotation.y = -a + Math.PI / 2; l.rotation.x = 0.6 + (i % 4) * 0.12; l.scale.setScalar(s * (0.8 + (i % 5) * 0.08));
    g.add(l);
  }
  return g;
}
function tree(o) { const g = new THREE.Group(); C(g, 0.08, 0.12, 1.4, wood("#5A4030"), 0, 0, 0, 10); const leaf = solid("#3F6E37", { rough: 0.8 }); for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 0.55 : 0; const m = mesh(new THREE.IcosahedronGeometry(0.7 - (i ? 0.2 : 0), 1), leaf, Math.cos(a) * r, 1.9 + (i % 3) * 0.25, Math.sin(a) * r); g.add(m); } return g; }
function kitchenBase(o) {
  const g = new THREE.Group(), cab = solid(o.color || "#3D4A5C", { rough: 0.45, clear: 0.3 });
  B(g, o.w, 0.1, o.d - 0.06, 0.005, solid("#1B1B1F"), 0, 0, -0.03);
  const n = Math.max(1, Math.round(o.w / 0.6));
  for (let i = 0; i < n; i++) { B(g, o.w / n - 0.006, 0.76, o.d - 0.04, 0.008, cab, -o.w / 2 + (i + 0.5) * (o.w / n), 0.1, -0.02); B(g, o.w / n - 0.16, 0.012, 0.02, 0.004, brass(), -o.w / 2 + (i + 0.5) * (o.w / n), 0.8, o.d / 2 - 0.01); }
  B(g, o.w + 0.02, 0.03, o.d + 0.02, 0.006, marbleTop(), 0, 0.88, 0);
  if (o.w > 1.6 && !o.noSink) { B(g, 0.55, 0.01, 0.42, 0.01, chrome(), o.w / 4, 0.905, 0); const tap = C(g, 0.012, 0.012, 0.28, chrome(), o.w / 4, 0.91, -0.22, 8); tap.name = "tap"; B(g, 0.6, 0.01, 0.52, 0.01, solid("#0B0B0E", { rough: 0.15, clear: 1 }), -o.w / 4, 0.91, 0); }
  // wall cabinets
  if (!o.noWall) { B(g, o.w, 0.7, 0.35, 0.006, solid(o.color2 || "#EDEAE4", { rough: 0.4, clear: 0.3 }), 0, 1.5, -o.d / 2 + 0.175); const strip = B(g, o.w - 0.04, 0.01, 0.02, 0.003, solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 0 }), 0, 1.49, -o.d / 2 + 0.3); strip.material = strip.material.clone(); strip.name = "glow"; }
  return g;
}
const marbleTop = () => solid("#F0EEEA", { rough: 0.15, clear: 0.6 });
function island(o) { const g = new THREE.Group(); B(g, o.w - 0.1, 0.86, o.d - 0.2, 0.01, solid(o.color || "#3D4A5C", { rough: 0.45, clear: 0.3 }), 0, 0, -0.05); B(g, o.w + 0.04, 0.04, o.d + 0.04, 0.008, marbleTop(), 0, 0.88, 0); return g; }
function fridge(o) { const g = new THREE.Group(), st = solid("#C9CCD1", { rough: 0.25, metal: 0.7 }); B(g, o.w, o.h, o.d, 0.02, st, 0, 0, 0); B(g, 0.004, o.h - 0.1, 0.01, 0.002, solid("#1B1B1F"), 0, 0.05, o.d / 2); for (const s of [-1, 1]) B(g, 0.02, 0.5, 0.03, 0.008, chrome(), s * 0.06, o.h * 0.55, o.d / 2 + 0.02); return g; }
function washer(o) { const g = new THREE.Group(); B(g, 0.6, 0.85, 0.6, 0.03, solid(o.color || "#F4F4F2", { rough: 0.3, clear: 0.6 }), 0, 0, 0); const door = mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 32), chrome(), 0, 0.42, 0.31); g.add(door); const win = mesh(new THREE.CircleGeometry(0.15, 32), solid("#2B3445", { rough: 0.05, clear: 1 }), 0, 0.42, 0.302); g.add(win); return g; }
function bathtub(o) {
  const g = new THREE.Group(), w = o.w, d = o.d;
  const shape = new THREE.Shape(); const r = 0.25;
  shape.moveTo(-w / 2 + r, -d / 2); shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); shape.lineTo(-w / 2 + r, d / 2); shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const hole = new THREE.Path(); const iw = w - 0.16, id = d - 0.16, ir = 0.2;
  hole.moveTo(-iw / 2 + ir, -id / 2); hole.lineTo(iw / 2 - ir, -id / 2); hole.quadraticCurveTo(iw / 2, -id / 2, iw / 2, -id / 2 + ir); hole.lineTo(iw / 2, id / 2 - ir); hole.quadraticCurveTo(iw / 2, id / 2, iw / 2 - ir, id / 2); hole.lineTo(-iw / 2 + ir, id / 2); hole.quadraticCurveTo(-iw / 2, id / 2, -iw / 2, id / 2 - ir); hole.lineTo(-iw / 2, -id / 2 + ir); hole.quadraticCurveTo(-iw / 2, -id / 2, -iw / 2 + ir, -id / 2);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: o.h, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }); geo.rotateX(-Math.PI / 2);
  g.add(mesh(geo, porcelain(), 0, 0, 0));
  B(g, iw, 0.02, id, 0.08, porcelain(), 0, 0.08, 0);
  const water = mesh(new THREE.PlaneGeometry(iw - 0.02, id - 0.02), solid("#BFD9E6", { rough: 0.02, transmission: 0.6, opacity: 0.6 }), 0, o.h * 0.65, 0); water.rotation.x = -Math.PI / 2; water.name = "water"; water.visible = false; g.add(water);
  C(g, 0.015, 0.015, 0.22, chrome(), 0, o.h, -d / 2 + 0.05, 8);
  return g;
}
function shower(o) { const g = new THREE.Group(); B(g, o.w, 0.04, o.d, 0.01, porcelain(), 0, 0, 0); const gl = glass(); const p1 = mesh(new THREE.BoxGeometry(o.w, 1.95, 0.01), gl, 0, 1.0, o.d / 2); g.add(p1); C(g, 0.012, 0.012, 1.2, chrome(), o.w / 2 - 0.12, 0.9, -o.d / 2 + 0.04, 8); C(g, 0.1, 0.1, 0.015, chrome(), o.w / 2 - 0.25, 2.05, -o.d / 2 + 0.2, 24); return g; }
function toilet(o) { const g = new THREE.Group(), p = porcelain(); B(g, 0.38, 0.4, 0.5, 0.15, p, 0, 0, 0.04); B(g, 0.4, 0.04, 0.5, 0.18, p, 0, 0.4, 0.05); B(g, 0.38, 0.38, 0.16, 0.04, p, 0, 0.42, -0.24); B(g, 0.06, 0.012, 0.03, 0.006, chrome(), 0, 0.81, -0.24); return g; }
function basin(o) { const g = new THREE.Group(); B(g, o.w, 0.5, o.d, 0.01, wood(o.wood || "walnut"), 0, 0.3, 0); B(g, o.w, 0.03, o.d, 0.008, marbleTop(), 0, 0.8, 0); C(g, 0.2, 0.17, 0.12, porcelain(), 0, 0.83, 0.02, 32); C(g, 0.012, 0.012, 0.22, chrome(), 0, 0.83, -o.d / 2 + 0.07, 8); B(g, o.w * 0.8, 0.7, 0.02, 0.01, solid("#D8E4EA", { rough: 0.02, metal: 1 }), 0, 1.15, -o.d / 2 + 0.01); return g; }
function mirror(o) { const g = new THREE.Group(); B(g, o.w, o.h, 0.03, 0.01, brass(), 0, 0, 0); B(g, o.w - 0.05, o.h - 0.05, 0.01, 0.005, solid("#D8E4EA", { rough: 0.02, metal: 1 }), 0, 0.025, 0.015); return g; }
function bench(o) { const g = new THREE.Group(); B(g, o.w, 0.05, o.d, 0.01, wood(o.wood || "oak"), 0, 0.4, 0); for (const s of [-1, 1]) B(g, 0.05, 0.4, o.d - 0.04, 0.01, wood(o.wood || "oak"), s * (o.w / 2 - 0.08), 0, 0); return g; }
function ottoman(o) { const g = new THREE.Group(); C(g, o.w / 2, o.w / 2, 0.42, fabric(o.color || "#C9A040"), 0, 0, 0, 32); return g; }
function consoleT(o) { const g = new THREE.Group(); B(g, o.w, 0.03, o.d, 0.008, wood(o.wood || "walnut"), 0, 0.78, 0); legs(g, o.w, o.d, 0.78, 0.03, brass(), 0.01); const vase = C(g, 0.07, 0.05, 0.3, solid("#C6B79F", { rough: 0.3, clear: 0.6 }), o.w / 3, 0.81, 0, 24); vase.name = "vase"; return g; }
function cabinet(o) { return dresser({ ...o, h: o.h || 0.8 }); }
function majlis(o) {
  const g = new THREE.Group(), f = fabric(o.color || "#8E2F2F"), back = fabric(o.color2 || "#C9A040");
  B(g, o.w, 0.18, o.d, 0.04, f, 0, 0, 0);
  B(g, o.w, 0.42, 0.2, 0.06, back, 0, 0.18, -o.d / 2 + 0.1);
  const n = Math.max(1, Math.round(o.w / 0.9));
  for (let i = 0; i < n; i++) { const c = B(g, 0.5, 0.36, 0.12, 0.05, fabric("#E8D9B8"), -o.w / 2 + (i + 0.5) * (o.w / n), 0.2, -o.d / 2 + 0.26); c.rotation.x = -0.15; }
  for (const s of [-1, 1]) { const r = mesh(new THREE.CylinderGeometry(0.12, 0.12, o.d - 0.1, 20), back, s * (o.w / 2 - 0.12), 0.3, 0.02); r.rotation.x = Math.PI / 2; r.castShadow = true; g.add(r); }
  return g;
}
function acSplit(o) {
  const g = new THREE.Group(), body = solid("#F6F7FA", { rough: 0.3, clear: 0.5 });
  B(g, o.w, o.h, o.d, 0.05, body, 0, 0, 0);
  const louver = B(g, o.w - 0.1, 0.012, 0.08, 0.005, solid("#E3E6EC", { rough: 0.35 }), 0, 0.03, o.d / 2 - 0.03); louver.name = "louver";
  const led = B(g, 0.03, 0.01, 0.005, 0.002, solid("#38BDF8", { emissive: "#38BDF8", emissiveIntensity: 0 }), o.w / 2 - 0.12, o.h * 0.55, o.d / 2 + 0.001); led.material = led.material.clone(); led.name = "glow";
  return g;
}
function ceilingFan() { const g = new THREE.Group(); C(g, 0.01, 0.01, 0.3, metal("#1B1B1F"), 0, -0.3, 0, 8); C(g, 0.09, 0.09, 0.12, metal("#1B1B1F"), 0, -0.42, 0, 24); const blades = new THREE.Group(); blades.name = "spin"; blades.position.y = -0.38; for (let i = 0; i < 5; i++) { const b = mesh(rbox(0.6, 0.012, 0.13, 0.005), wood("walnut"), 0.36, 0, 0); const p = new THREE.Group(); p.rotation.y = (i / 5) * Math.PI * 2; p.add(b); blades.add(p); } g.add(blades); return g; }
function spots(o) { const g = new THREE.Group(); const glow = solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 0 }).clone(); const n = 4; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.7; C(g, 0.045, 0.045, 0.012, solid("#EDEDED", { rough: 0.3 }), x, -0.012, 0, 20); const l = mesh(new THREE.CircleGeometry(0.03, 20), glow, x, -0.0125, 0); l.rotation.x = Math.PI / 2; l.name = "glow"; g.add(l); } return g; }
function flush(o) { const g = new THREE.Group(); const m = mesh(new THREE.SphereGeometry(0.22, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), solid("#FFF8EC", { rough: 0.6, emissive: "#FFD9A0", emissiveIntensity: 0 }).clone(), 0, 0, 0); m.scale.y = 0.35; m.name = "glow"; g.add(m); return g; }
function speaker() { const g = new THREE.Group(); C(g, 0.06, 0.06, 0.2, fabric("#45464C"), 0, 0, 0, 24); return g; }
function vacuum() { const g = new THREE.Group(); C(g, 0.17, 0.17, 0.09, solid("#1E2026", { rough: 0.3, clear: 0.5 }), 0, 0, 0, 32); C(g, 0.04, 0.04, 0.02, solid("#3A3D46"), 0, 0.09, -0.05, 20); return g; }
function person(o) {
  const g = new THREE.Group(), c = o.color || "#6D4BFF";
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.75, 6, 16), solid(c, { rough: 0.6 }), 0, 0.6, 0); g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.13, 24, 16), solid("#E6C9A8", { rough: 0.6 }), 0, 1.38, 0); g.add(head);
  return g;
}

// ---------------------------------------------------------------- pieces seen in real homes (kitchens, bathrooms, dressing rooms)
const mirrorGlass = () => solid("#D8E4EA", { rough: 0.02, metal: 1 });
// a bathroom mirror with a frosted LED band glowing around the edge
function mirrorLed(o) {
  const g = new THREE.Group();
  B(g, o.w, o.h, 0.025, 0.06, mirrorGlass(), 0, 0, 0);
  const band = solid("#F4F8FF", { rough: 0.6, emissive: "#EAF2FF", emissiveIntensity: 0 }).clone();
  for (const [w, h, x, y] of [[o.w - 0.12, 0.02, 0, 0.05], [o.w - 0.12, 0.02, 0, o.h - 0.07], [0.02, o.h - 0.12, -o.w / 2 + 0.06, 0.06], [0.02, o.h - 0.12, o.w / 2 - 0.06, 0.06]]) { const m = B(g, w, h, 0.004, 0.002, band, x, y, 0.0125); m.name = "glow"; }
  return g;
}
function mirrorRound(o) { const g = new THREE.Group(), r = Math.min(o.w, o.h) / 2; const ring = mesh(new THREE.TorusGeometry(r - 0.02, 0.02, 10, 64), metal("#1B1B1F", 0.5), 0, r, 0.02); g.add(ring); const gl = mesh(new THREE.CircleGeometry(r - 0.025, 64), mirrorGlass(), 0, r, 0.018); g.add(gl); return g; }
// a tall mirror in a chunky wooden frame, leaning back against the wall
function floorMirror(o) {
  const g = new THREE.Group(), lean = new THREE.Group(), wd = wood(o.wood || "oak"), f = 0.08;
  B(lean, o.w, f, 0.04, 0.005, wd, 0, 0, 0); B(lean, o.w, f, 0.04, 0.005, wd, 0, o.h - f, 0);
  for (const s of [-1, 1]) B(lean, f, o.h, 0.04, 0.005, wd, s * (o.w / 2 - f / 2), 0, 0);
  B(lean, o.w - 2 * f, o.h - 2 * f, 0.01, 0.002, mirrorGlass(), 0, f, -0.005);
  lean.rotation.x = -0.1; lean.position.z = o.d / 2 - 0.04; g.add(lean); return g;
}
// a ceramic basin hung on the wall, no cabinet under it
function basinWall(o) { const g = new THREE.Group(), p = porcelain(); B(g, o.w, 0.2, o.d, 0.05, p, 0, 0.66, 0); B(g, o.w * 0.55, 0.42, o.d * 0.4, 0.06, p, 0, 0.3, -o.d / 2 + o.d * 0.2); C(g, o.w / 2 - 0.08, o.w / 2 - 0.12, 0.02, solid("#E9ECEF", { rough: 0.2, clear: 0.8 }), 0, 0.845, 0.03, 32); C(g, 0.012, 0.012, 0.18, chrome(), 0, 0.86, -o.d / 2 + 0.06, 8); return g; }
function towelRail(o) { const g = new THREE.Group(); const bar = mesh(new THREE.CylinderGeometry(0.011, 0.011, o.w, 10), chrome(), 0, 0.03, 0.04); bar.rotation.z = Math.PI / 2; g.add(bar); for (const s of [-1, 1]) B(g, 0.025, 0.05, 0.06, 0.008, chrome(), s * (o.w / 2), 0, 0); return g; }
// the small square fan high on a bathroom or kitchen wall
function exhaustFan(o) { const g = new THREE.Group(), w = solid("#F3F2EE", { rough: 0.4 }); B(g, o.w, o.h, 0.04, 0.008, w, 0, 0, 0); for (let i = 0; i < 6; i++) B(g, o.w - 0.06, 0.006, 0.01, 0.002, solid("#D8D6D0", { rough: 0.5 }), 0, 0.03 + i * ((o.h - 0.06) / 6), 0.022); return g; }
// kitchen: cabinets on the wall, tall cabinets, a tower with two built-in ovens, a hob with an oven under it, a sink and a hood
const cabMat = (o) => solid(o.color || "#B9AEA2", { rough: 0.55, clear: 0.15 });
function doors(g, o, y0, h, n, mat, z) { for (let i = 0; i < n; i++) B(g, o.w / n - 0.006, h - 0.006, 0.018, 0.003, mat, -o.w / 2 + (i + 0.5) * (o.w / n), y0 + 0.003, z); }
function wallCabinet(o) { const g = new THREE.Group(), m = cabMat({ color: o.color || "#6E6C6A" }); B(g, o.w, o.h, o.d - 0.018, 0.005, m, 0, 0, -0.009); doors(g, o, 0, o.h, Math.max(1, Math.round(o.w / 0.5)), m, o.d / 2 - 0.009); return g; }
function tallCabinet(o) { const g = new THREE.Group(), m = cabMat(o); B(g, o.w, 0.1, o.d - 0.06, 0.005, metal("#B9BCC2", 0.4), 0, 0, -0.03); B(g, o.w, o.h - 0.1, o.d - 0.018, 0.005, m, 0, 0.1, -0.009); const n = Math.max(1, Math.round(o.w / 0.6)); doors(g, o, 0.1, (o.h - 0.1) * 0.55, n, m, o.d / 2 - 0.009); doors(g, o, 0.1 + (o.h - 0.1) * 0.55, (o.h - 0.1) * 0.45, n, m, o.d / 2 - 0.009); return g; }
function ovenFront(g, w, y, h, z) { const st = solid("#C3C6CB", { rough: 0.25, metal: 0.8 }); B(g, w, h, 0.02, 0.004, st, 0, y, z); B(g, w - 0.1, h * 0.55, 0.004, 0.002, solid("#0B0B0E", { rough: 0.08, clear: 1 }), 0, y + h * 0.15, z + 0.011); B(g, w - 0.12, 0.016, 0.03, 0.006, chrome(), 0, y + h * 0.78, z + 0.025); }
function ovenTower(o) { const g = tallCabinet(o); ovenFront(g, Math.min(0.58, o.w - 0.02), 0.82, 0.58, o.d / 2 + 0.002); ovenFront(g, Math.min(0.58, o.w - 0.02), 1.42, 0.45, o.d / 2 + 0.002); return g; }
function cooker(o) { const g = kitchenBase({ ...o, noWall: true, noSink: true }); ovenFront(g, Math.min(0.58, o.w - 0.02), 0.16, 0.6, o.d / 2 + 0.005); const grate = metal("#1B1B1F", 0.5); B(g, Math.min(0.75, o.w - 0.05), 0.012, 0.5, 0.004, solid("#2A2B30", { rough: 0.3, metal: 0.6 }), 0, 0.91, 0); for (const [x, z] of [[-0.18, -0.1], [0.18, -0.1], [-0.18, 0.12], [0.18, 0.12], [0, 0.01]]) C(g, 0.05, 0.05, 0.02, grate, x, 0.92, z, 16); return g; }
function kitchenSink(o) { const g = kitchenBase({ ...o, noWall: true, noSink: true }); for (const s of [-1, 1]) B(g, Math.min(0.42, o.w / 2 - 0.12), 0.012, 0.42, 0.02, chrome(), s * Math.min(0.23, o.w / 4), 0.9, 0); const tap = C(g, 0.012, 0.012, 0.32, chrome(), 0, 0.91, -o.d / 2 + 0.08, 8); tap.name = "tap"; return g; }
function hood(o) { const g = new THREE.Group(); B(g, o.w, o.h, o.d, 0.006, solid("#E9E9E6", { rough: 0.3, clear: 0.5 }), 0, 0, 0); B(g, o.w - 0.02, 0.02, 0.03, 0.004, metal("#C3C6CB", 0.25), 0, 0, o.d / 2 - 0.01); return g; }
// a low lounge chair: a rattan or bamboo frame with a round back and a thick white cushion
function loungeChair(o) {
  const g = new THREE.Group(), cane = solid(o.wood ? "#9A6B3F" : "#B07E4A", { rough: 0.75 }), f = fabric(o.color || "#F2EFE8");
  B(g, o.w, 0.3, o.d, 0.04, cane, 0, 0, 0);
  B(g, o.w - 0.06, 0.12, o.d - 0.1, 0.05, f, 0, 0.3, 0.03);
  const back = mesh(new THREE.CylinderGeometry(o.w / 2, o.w / 2, 0.06, 32, 1, false, -Math.PI / 2, Math.PI), cane, 0, 0.32, -o.d / 2 + 0.05); back.rotation.x = Math.PI / 2 - 0.2; back.castShadow = true; g.add(back);
  B(g, o.w - 0.14, 0.42, 0.14, 0.06, f, 0, 0.38, -o.d / 2 + 0.16).rotation.x = -0.2;
  return g;
}
// a TV standing on its own feet (on a unit or a table)
function tvFeet(o) { const g = tv(o); for (const s of [-1, 1]) { const f = B(g, 0.02, 0.012, 0.22, 0.004, metal("#1B1B1F", 0.4), s * (o.w / 2 - 0.12), -0.07, 0.04); f.rotation.z = s * 0.4; } g.children.forEach((c) => (c.position.y += 0.07)); return g; }
// the grid of thin mouldings on a feature wall (behind a bed, in a dining room)
function wallPanels(o) {
  const g = new THREE.Group(), m = solid(o.color || "#ECEAE4", { rough: 0.7 }), cols = Math.max(1, Math.round(o.w / 0.75)), rows = Math.max(1, Math.round(o.h / 0.85)), t = 0.06;
  for (let i = 0; i <= cols; i++) B(g, t, o.h, o.d, 0.004, m, -o.w / 2 + (i * o.w) / cols, 0, 0);
  for (let j = 0; j <= rows; j++) B(g, o.w, t, o.d, 0.004, m, 0, Math.min(o.h - t, (j * o.h) / rows), 0);
  return g;
}

// ---------------------------------------------------------------- more pieces, after the range of a big furniture store
const white = () => solid("#F2F0EC", { rough: 0.55 });
function boxUnit(g, o, mat, { doors = 2, legsH = 0, gap = 0.004 } = {}) {
  if (legsH) legs(g, o.w, o.d, legsH, 0.05, metal("#1B1B1F"), 0.012);
  B(g, o.w, o.h - legsH, o.d, 0.01, mat, 0, legsH, 0);
  for (let i = 0; i < doors; i++) B(g, o.w / doors - gap * 2, o.h - legsH - 0.03, 0.008, 0.003, mat, -o.w / 2 + (i + 0.5) * (o.w / doors), legsH + 0.015, o.d / 2);
  return g;
}
function sideboard(o) { return boxUnit(new THREE.Group(), o, wood(o.wood || "oak"), { doors: 3, legsH: 0.12 }); }
function shoeCabinet(o) { const g = boxUnit(new THREE.Group(), o, white(), { doors: 2 }); for (let i = 0; i < 2; i++) B(g, 0.08, 0.015, 0.02, 0.005, metal("#8E9096", 0.3), -o.w / 4 + i * (o.w / 2), o.h - 0.08, o.d / 2 + 0.012); return g; }
function displayCabinet(o) {
  const g = new THREE.Group(), fr = wood(o.wood || "walnut"), gl = glass();
  B(g, o.w, 0.04, o.d, 0.005, fr, 0, 0, 0); B(g, o.w, 0.03, o.d, 0.005, fr, 0, o.h - 0.03, 0);
  for (const s of [-1, 1]) B(g, 0.03, o.h, o.d, 0.004, fr, s * (o.w / 2 - 0.015), 0, 0);
  B(g, o.w, o.h, 0.01, 0.002, fr, 0, 0, -o.d / 2 + 0.005);
  for (let k = 1; k < 4; k++) B(g, o.w - 0.06, 0.012, o.d - 0.04, 0.003, gl, 0, (k * o.h) / 4, 0);
  const p = mesh(new THREE.BoxGeometry(o.w - 0.06, o.h - 0.08, 0.006), gl, 0, o.h / 2, o.d / 2); p.userData.glass = true; g.add(p);
  for (let k = 1; k < 4; k++) C(g, 0.04, 0.05, 0.12, solid("#B8674A", { rough: 0.4 }), -0.1 + 0.1 * k, (k * o.h) / 4 + 0.012, 0, 16);
  return g;
}
function cubeShelf(o) {
  const g = new THREE.Group(), m = white(), cols = Math.max(1, Math.round(o.w / 0.39)), rows = Math.max(1, Math.round(o.h / 0.39)), t = 0.025;
  for (let i = 0; i <= cols; i++) B(g, t, o.h, o.d, 0.004, m, -o.w / 2 + (i * o.w) / cols, 0, 0);
  for (let j = 0; j <= rows; j++) B(g, o.w, t, o.d, 0.004, m, 0, Math.min(o.h - t, (j * o.h) / rows), 0);
  // a few boxes and books in the cubes
  const fill = [fabric("#C9B79C"), solid("#3E5A7A", { rough: 0.6 }), fabric("#8FA08A")];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i + j) % 2 === 0) B(g, o.w / cols - 0.06, o.h / rows - 0.08, o.d - 0.06, 0.02, fill[(i + j * 2) % 3], -o.w / 2 + (i + 0.5) * (o.w / cols), (j * o.h) / rows + t, 0);
  return g;
}
function wallShelf(o) { const g = new THREE.Group(); B(g, o.w, 0.025, o.d, 0.004, wood(o.wood || "oak"), 0, 0, 0); for (let k = 0; k < 4; k++) B(g, 0.03, 0.2, 0.15, 0.004, solid(["#3E5A7A", "#B8674A", "#E8E2D6", "#45464C"][k], { rough: 0.6 }), -o.w / 3 + k * 0.04, 0.025, 0); C(g, 0.05, 0.04, 0.14, solid("#E8E2D6", { rough: 0.3, clear: 0.5 }), o.w / 4, 0.025, 0, 16); return g; }
function coatRack(o) { const g = new THREE.Group(), m = metal("#1B1B1F"); C(g, 0.02, 0.02, o.h, m, 0, 0, 0, 10); C(g, 0.2, 0.22, 0.02, m, 0, 0, 0, 24); for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, h = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), m, Math.cos(a) * 0.07, o.h - 0.15, Math.sin(a) * 0.07); h.rotation.z = Math.cos(a) * 0.9; h.rotation.x = -Math.sin(a) * 0.9; g.add(h); } B(g, 0.32, 0.6, 0.12, 0.05, fabric("#B8674A"), 0.12, o.h - 0.9, 0); return g; }
function clothesRail(o) { const g = new THREE.Group(), m = metal("#1B1B1F"); for (const s of [-1, 1]) C(g, 0.014, 0.014, o.h, m, s * (o.w / 2 - 0.02), 0, 0, 8); const bar = mesh(new THREE.CylinderGeometry(0.012, 0.012, o.w, 8), m, 0, o.h - 0.02, 0); bar.rotation.z = Math.PI / 2; g.add(bar); B(g, o.w - 0.04, 0.02, o.d, 0.004, wood("oak"), 0, 0.2, 0); const cl = [fabric("#D8CFC0"), fabric("#2F3E5C"), fabric("#8E8C92"), fabric("#B8674A")]; for (let k = 0; k < 5; k++) B(g, 0.05, 0.85, 0.42, 0.02, cl[k % 4], -o.w / 3 + (k * o.w) / 7, o.h - 0.95, 0); return g; }
function roomDivider(o) { const g = new THREE.Group(), n = Math.max(2, Math.round(o.w / 0.45)), m = solid("#C9B79C", { rough: 0.9 }); for (let i = 0; i < n; i++) { const p = B(g, o.w / n - 0.02, o.h, 0.025, 0.006, m, -o.w / 2 + (i + 0.5) * (o.w / n), 0, 0); p.rotation.y = (i % 2 ? 1 : -1) * 0.25; } return g; }
function trolley(o) { const g = new THREE.Group(), m = metal("#3E5A7A", 0.45); for (const y of [0.1, 0.38, 0.66]) B(g, o.w, 0.06, o.d, 0.015, m, 0, y, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { C(g, 0.008, 0.008, 0.7, m, sx * (o.w / 2 - 0.02), 0.04, sz * (o.d / 2 - 0.02), 6); C(g, 0.025, 0.025, 0.02, solid("#1B1B1F"), sx * (o.w / 2 - 0.03), 0, sz * (o.d / 2 - 0.03), 10); } return g; }
function bunkBed(o) {
  const g = new THREE.Group(), fr = wood(o.wood || "white"), mat = fabric("#F2EFE8"), sheet = fabric("#8FA08A");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.05, o.h, 0.05, 0.008, fr, sx * (o.w / 2 - 0.025), 0, sz * (o.d / 2 - 0.025));
  for (const y of [0.25, 1.25]) { B(g, o.w, 0.06, o.d, 0.01, fr, 0, y, 0); B(g, o.w - 0.08, 0.14, o.d - 0.08, 0.04, mat, 0, y + 0.06, 0); B(g, o.w - 0.1, 0.03, o.d * 0.6, 0.02, sheet, 0, y + 0.2, 0.15); B(g, 0.45, 0.1, 0.3, 0.05, mat, 0, y + 0.2, -o.d / 2 + 0.25); }
  for (const sz of [-1, 1]) B(g, o.w, 0.05, 0.03, 0.006, fr, 0, o.h - 0.1, sz * (o.d / 2 - 0.02));
  for (let k = 0; k < 5; k++) B(g, 0.03, 0.03, 0.4, 0.005, fr, o.w / 2 - 0.02, 0.35 + k * 0.25, o.d / 2 - 0.3);
  return g;
}
function cot(o) { const g = new THREE.Group(), fr = wood("white"); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.04, o.h, 0.04, 0.006, fr, sx * (o.w / 2 - 0.02), 0, sz * (o.d / 2 - 0.02)); B(g, o.w - 0.06, 0.12, o.d - 0.06, 0.03, fabric("#F2EFE8"), 0, 0.3, 0); for (const sz of [-1, 1]) for (let k = 0; k < 10; k++) C(g, 0.008, 0.008, o.h - 0.3, fr, -o.w / 2 + 0.06 + (k * (o.w - 0.12)) / 9, 0.3, sz * (o.d / 2 - 0.02), 6); return g; }
function dayBed(o) { const g = new THREE.Group(), fr = wood(o.wood || "oak"), f = fabric(o.color || "#D8CFC0"); B(g, o.w, 0.35, o.d, 0.02, fr, 0, 0, 0); B(g, o.w - 0.06, 0.14, o.d - 0.06, 0.05, f, 0, 0.35, 0); B(g, o.w, 0.5, 0.06, 0.02, fr, 0, 0.35, -o.d / 2 + 0.03); for (const s of [-1, 1]) B(g, 0.06, 0.4, o.d, 0.02, fr, s * (o.w / 2 - 0.03), 0.35, 0); for (let k = 0; k < 3; k++) B(g, 0.55, 0.38, 0.14, 0.07, f, -o.w / 3 + (k * o.w) / 3, 0.48, -o.d / 2 + 0.16); return g; }
function chaiseLongue(o) { const g = new THREE.Group(), f = fabric(o.color); legs(g, o.w - 0.1, o.d - 0.1, 0.12, 0.05, wood("walnut")); B(g, o.w, 0.2, o.d, 0.05, f, 0, 0.12, 0); const back = B(g, o.w, 0.5, 0.2, 0.08, f, 0, 0.3, -o.d / 2 + 0.1); back.rotation.x = -0.35; B(g, 0.18, 0.28, o.d * 0.45, 0.06, f, -o.w / 2 + 0.09, 0.3, -o.d * 0.25); return g; }
function diningRound(o) { const g = new THREE.Group(); C(g, o.w / 2, o.w / 2, 0.035, wood(o.wood || "oak"), 0, o.h - 0.035, 0, 48); C(g, 0.06, 0.06, o.h - 0.1, wood(o.wood || "oak"), 0, 0.06, 0, 16); C(g, 0.3, 0.32, 0.06, wood(o.wood || "oak"), 0, 0, 0, 32); return g; }
function barTable(o) { const g = new THREE.Group(); C(g, o.w / 2, o.w / 2, 0.03, solid("#2B2D33", { rough: 0.4 }), 0, o.h - 0.03, 0, 40); C(g, 0.03, 0.03, o.h - 0.03, metal("#1B1B1F"), 0, 0, 0, 10); C(g, 0.24, 0.26, 0.02, metal("#1B1B1F"), 0, 0, 0, 32); return g; }
function dressingTable(o) { const g = new THREE.Group(), wd = white(); legs(g, o.w, o.d, 0.72, 0.04, wood("oak"), 0.016); B(g, o.w, 0.12, o.d, 0.01, wd, 0, 0.62, 0); const mir = mesh(new THREE.CircleGeometry(0.32, 40), solid("#DDE6EE", { rough: 0.02, metal: 1 }), 0, 1.08, -o.d / 2 + 0.06); g.add(mir); const ring = mesh(new THREE.TorusGeometry(0.33, 0.012, 8, 48), brass(), 0, 1.08, -o.d / 2 + 0.06); g.add(ring); B(g, 0.2, 0.02, 0.1, 0.005, brass(), 0, 0.74, -o.d / 2 + 0.07); return g; }
function drawerUnit(o) { const g = new THREE.Group(), m = white(), n = Math.max(2, Math.round(o.h / 0.18)); B(g, o.w, o.h - 0.05, o.d, 0.01, m, 0, 0.05, 0); for (let i = 0; i < n; i++) { const y = 0.06 + (i * (o.h - 0.07)) / n; B(g, o.w - 0.02, (o.h - 0.07) / n - 0.008, 0.01, 0.003, m, 0, y, o.d / 2); B(g, 0.1, 0.012, 0.02, 0.004, metal("#8E9096", 0.3), 0, y + (o.h - 0.07) / n / 2, o.d / 2 + 0.012); } for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(g, 0.02, 0.02, 0.04, solid("#1B1B1F"), sx * (o.w / 2 - 0.05), 0, sz * (o.d / 2 - 0.05), 10); return g; }
function dishwasher(o) { const g = new THREE.Group(); B(g, o.w, o.h, o.d, 0.01, solid("#E7E8EA", { rough: 0.25, metal: 0.6 }), 0, 0, 0); B(g, o.w - 0.04, 0.03, 0.02, 0.006, metal("#2B2D33"), 0, o.h - 0.1, o.d / 2 + 0.01); return g; }
function microwave(o) { const g = new THREE.Group(); B(g, o.w, o.h, o.d, 0.02, solid("#1B1B1F", { rough: 0.3 }), 0, 0, 0); const d = mesh(new THREE.PlaneGeometry(o.w * 0.62, o.h * 0.7), solid("#0B0B0E", { rough: 0.05, clear: 1 }), -o.w * 0.12, o.h / 2, o.d / 2 + 0.001); g.add(d); return g; }
function dryer(o) { const g = new THREE.Group(); B(g, o.w, o.h, o.d, 0.02, white(), 0, 0, 0); const d = mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 40), chrome(), 0, o.h * 0.5, o.d / 2); g.add(d); const gl = mesh(new THREE.CircleGeometry(0.15, 32), solid("#2B2D33", { rough: 0.1 }), 0, o.h * 0.5, o.d / 2 + 0.001); g.add(gl); B(g, o.w - 0.08, 0.08, 0.01, 0.004, solid("#D8D6D2", { rough: 0.4 }), 0, o.h - 0.1, o.d / 2); return g; }
function dryingRack(o) { const g = new THREE.Group(), m = metal("#E6E8EB", 0.3); for (const s of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.02, o.h * 1.1, 0.02), m, s * (o.w / 2 - 0.05), o.h / 2, 0); l.rotation.z = s * 0.25; g.add(l); } for (let k = 0; k < 8; k++) { const b = mesh(new THREE.CylinderGeometry(0.004, 0.004, o.d, 6), m, -o.w / 2 + 0.1 + (k * (o.w - 0.2)) / 7, o.h, 0); b.rotation.x = Math.PI / 2; g.add(b); } B(g, 0.4, 0.01, 0.5, 0.004, fabric("#C9D6E2"), -0.1, o.h - 0.25, 0).rotation.z = 0.05; return g; }
function laundryBasket(o) { const g = new THREE.Group(); C(g, o.w / 2, o.w / 2 * 0.9, o.h, solid("#B89A70", { rough: 0.9 }), 0, 0, 0, 20); C(g, o.w / 2 - 0.02, o.w / 2 - 0.02, 0.02, fabric("#E9E4DA"), 0, o.h - 0.05, 0, 20); return g; }
function bathShelf(o) { const g = new THREE.Group(), m = wood(o.wood || "oak"); for (const sx of [-1, 1]) B(g, 0.03, o.h, o.d, 0.004, m, sx * (o.w / 2 - 0.015), 0, 0); for (let k = 0; k < 4; k++) B(g, o.w, 0.02, o.d, 0.004, m, 0, 0.05 + (k * (o.h - 0.1)) / 3, 0); for (let k = 0; k < 3; k++) B(g, o.w - 0.1, 0.06, o.d - 0.06, 0.02, fabric(["#F2EFE8", "#C9D6E2", "#D8CFC0"][k]), 0, 0.07 + (k * (o.h - 0.1)) / 3, 0); return g; }
function sunLounger(o) { const g = new THREE.Group(), fr = wood("oak"), f = fabric(o.color || "#F2EFE8"); legs(g, o.w, o.d - 0.1, 0.25, 0.05, fr, 0.025); B(g, o.w, 0.04, o.d, 0.01, fr, 0, 0.25, 0); B(g, o.w - 0.04, 0.07, o.d * 0.65, 0.03, f, 0, 0.29, o.d * 0.17); const back = B(g, o.w - 0.04, 0.07, o.d * 0.35, 0.03, f, 0, 0.3, -o.d * 0.32); back.rotation.x = 0.7; back.position.y = 0.42; return g; }
function parasol(o) { const g = new THREE.Group(); C(g, 0.025, 0.025, o.h, wood("oak"), 0, 0, 0, 10); C(g, 0.25, 0.28, 0.06, solid("#45464C", { rough: 0.8 }), 0, 0, 0, 24); const top = mesh(new THREE.ConeGeometry(o.w / 2, 0.45, 8, 1, true), fabric("#EEE6D8"), 0, o.h - 0.15, 0); top.material = top.material.clone(); top.material.side = THREE.DoubleSide; g.add(top); return g; }
function outdoorSofa(o) { const g = new THREE.Group(), fr = solid("#5A5550", { rough: 0.85 }), f = fabric("#E9E4DA"); B(g, o.w, 0.4, o.d, 0.03, fr, 0, 0, 0); B(g, o.w, 0.45, 0.12, 0.03, fr, 0, 0.4, -o.d / 2 + 0.06); for (const s of [-1, 1]) B(g, 0.12, 0.25, o.d, 0.03, fr, s * (o.w / 2 - 0.06), 0.4, 0); B(g, o.w - 0.26, 0.12, o.d - 0.16, 0.05, f, 0, 0.4, 0.04); B(g, o.w - 0.3, 0.35, 0.12, 0.06, f, 0, 0.52, -o.d / 2 + 0.2); return g; }
function planter(o) { const g = new THREE.Group(); B(g, o.w, o.h, o.d, 0.02, solid("#45464C", { rough: 0.85 }), 0, 0, 0); for (let k = 0; k < Math.max(2, Math.round(o.w / 0.35)); k++) { const p = mesh(new THREE.IcosahedronGeometry(0.2, 1), solid("#5F7A45", { rough: 0.85 }), -o.w / 2 + 0.2 + k * 0.35, o.h + 0.12, 0); p.scale.y = 0.8; g.add(p); } return g; }
function bbq(o) { const g = new THREE.Group(), m = metal("#2B2D33", 0.5); legs(g, o.w, o.d, 0.75, 0.04, m, 0.015); B(g, o.w, 0.25, o.d, 0.04, m, 0, 0.75, 0); const lid = mesh(new THREE.CylinderGeometry(o.d / 2, o.d / 2, o.w * 0.9, 20, 1, false, 0, Math.PI), m, 0, 1.0, 0); lid.rotation.z = Math.PI / 2; g.add(lid); return g; }
function wallArt(o) { const g = new THREE.Group(); B(g, o.w, o.h, 0.03, 0.004, wood("walnut"), 0, 0, 0); const p = mesh(new THREE.PlaneGeometry(o.w - 0.08, o.h - 0.08), solid(o.color || "#D9AFA3", { rough: 0.9 }), 0, o.h / 2, 0.016); g.add(p); const sun = mesh(new THREE.CircleGeometry(Math.min(o.w, o.h) * 0.16, 32), solid("#B8674A", { rough: 0.9 }), 0, o.h * 0.58, 0.017); g.add(sun); return g; }
function vase(o) { const g = new THREE.Group(), pts = [[0, 0], [o.w * 0.35, 0], [o.w * 0.5, o.h * 0.35], [o.w * 0.25, o.h * 0.8], [o.w * 0.28, o.h], [o.w * 0.24, o.h]].map(([x, y]) => new THREE.Vector2(x, y)); g.add(mesh(new THREE.LatheGeometry(pts, 24), solid(o.color || "#B8674A", { rough: 0.5, clear: 0.3 }))); for (let k = 0; k < 3; k++) { const st = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), solid("#5F7A45"), (k - 1) * 0.04, o.h + 0.22, 0); st.rotation.z = (k - 1) * 0.25; g.add(st); } return g; }
function wallClock(o) { const g = new THREE.Group(); const f = mesh(new THREE.CylinderGeometry(o.w / 2, o.w / 2, 0.04, 40), white(), 0, 0, 0.02); f.rotation.x = Math.PI / 2; f.position.y = o.h / 2; g.add(f); const r = mesh(new THREE.TorusGeometry(o.w / 2, 0.012, 8, 40), metal("#1B1B1F"), 0, o.h / 2, 0.04); g.add(r); for (const [l, a] of [[o.w * 0.3, 0.4], [o.w * 0.4, 2.2]]) { const hnd = mesh(new THREE.BoxGeometry(0.008, l, 0.004), metal("#1B1B1F"), 0, o.h / 2, 0.045); hnd.geometry.translate(0, l / 2, 0); hnd.rotation.z = a; g.add(hnd); } return g; }
function toyStorage(o) { const g = new THREE.Group(), m = wood("white"); B(g, o.w, o.h, o.d, 0.01, m, 0, 0, 0); const cols = ["#E86FB0", "#4E8CFF", "#F5B041", "#5FBF77", "#FF7A59", "#8B6CFF"], n = 3; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) B(g, o.w / n - 0.04, o.h / 2 - 0.06, 0.02, 0.01, solid(cols[(i + j * 3) % 6], { rough: 0.6 }), -o.w / 2 + (i + 0.5) * (o.w / n), 0.03 + (j * o.h) / 2, o.d / 2); return g; }
function kidsTable(o) { const g = new THREE.Group(); B(g, o.w, 0.03, o.d, 0.01, white(), 0, o.h - 0.03, 0); legs(g, o.w, o.d, o.h - 0.03, 0.04, wood("oak"), 0.02); return g; }
function stool(o) { const g = new THREE.Group(); C(g, o.w / 2, o.w / 2, 0.03, wood(o.wood || "oak"), 0, o.h - 0.03, 0, 28); for (let k = 0; k < 3; k++) { const a = (k * Math.PI * 2) / 3, l = mesh(new THREE.CylinderGeometry(0.014, 0.012, o.h, 8), wood(o.wood || "oak"), Math.cos(a) * o.w * 0.3, (o.h - 0.03) / 2, Math.sin(a) * o.w * 0.3); l.rotation.z = Math.cos(a) * 0.08; l.rotation.x = -Math.sin(a) * 0.08; g.add(l); } return g; }

// kind: [name, category, builder, default w, d, h, mount ("floor" | "wall" | "ceiling"), default elevation]
// ---------------------------------------------------------------- the building itself, and joinery made to fit a wall
// a structural column, floor to ceiling (o.h is set to the room's height when placed), square or round
function column(o) {
  const g = new THREE.Group(), m = solid(o.color || "#ECE8E0", { rough: 0.9 });
  if (o.round) C(g, o.w / 2, o.w / 2, o.h, m, 0, 0, 0, 40); else B(g, o.w, o.h, o.d, 0.004, m, 0, 0, 0);
  return g;
}
// a beam under the ceiling: o.w long, o.d wide, o.h deep; hangs down from the ceiling
function beam(o) { const g = new THREE.Group(); B(g, o.w, o.h, o.d, 0.004, solid(o.color || "#F2EFE9", { rough: 0.9 }), 0, -o.h, 0); return g; }
// a built-in wardrobe, wall to wall and floor to ceiling, with a top filler and a plinth
function fittedWardrobe(o) {
  const g = new THREE.Group(), wd = o.wood ? wood(o.wood) : solid(o.color || "#ECE8E0", { rough: 0.45, clear: 0.2 }), n = Math.max(2, Math.round(o.w / 0.5)), plinth = 0.08, top = 0.06;
  B(g, o.w, plinth, o.d - 0.05, 0.003, solid("#2A2A2E", { rough: 0.6 }), 0, 0, -0.025);
  B(g, o.w, o.h - plinth, o.d - 0.02, 0.003, wd, 0, plinth, -0.01);
  const dh = o.h - plinth - top - 0.01;
  for (let i = 0; i < n; i++) {
    const x = -o.w / 2 + (i + 0.5) * (o.w / n);
    B(g, o.w / n - 0.006, dh, 0.018, 0.002, wd, x, plinth + 0.005, o.d / 2 - 0.009);
    B(g, 0.012, Math.min(0.9, dh * 0.4), 0.02, 0.004, o.metal ? metal(o.metal) : metal("#1B1B1F"), x + (i % 2 ? -1 : 1) * (o.w / n / 2 - 0.05), plinth + dh * 0.35, o.d / 2 + 0.006);
  }
  return g;
}
// a TV wall: a panelled back as wide as the wall, a floating cabinet and a lit shelf
function tvWall(o) {
  const g = new THREE.Group(), back = o.wood ? wood(o.wood) : wood("walnut"), cab = solid(o.color || "#ECE8E0", { rough: 0.4, clear: 0.3 });
  const ph = Math.min(o.h, 2.6), slats = Math.max(4, Math.round(o.w / 0.09));
  for (let i = 0; i < slats; i++) B(g, o.w / slats - 0.012, ph, 0.025, 0.003, back, -o.w / 2 + (i + 0.5) * (o.w / slats), 0, -o.d / 2 + 0.0125);
  B(g, Math.min(o.w - 0.2, 2.4), 0.36, o.d - 0.05, 0.006, cab, 0, 0.22, 0.02);
  B(g, Math.min(o.w - 0.4, 1.8), 0.025, 0.25, 0.004, back, 0, 1.75, -o.d / 2 + 0.15);
  B(g, Math.min(o.w - 0.4, 1.8) - 0.04, 0.008, 0.01, 0.002, solid("#FFF3DC", { emissive: "#FFD9A0", emissiveIntensity: 1.6 }), 0, 1.742, -o.d / 2 + 0.25);
  return g;
}

export const LIBRARY = {
  column: ["Column", "Building", column, 0.4, 0.4, 2.8, "floor"],
  round_column: ["Round column", "Building", (o) => column({ ...o, round: true }), 0.4, 0.4, 2.8, "floor"],
  beam: ["Beam", "Building", beam, 3.0, 0.25, 0.4, "ceiling"],
  fitted_wardrobe: ["Built-in wardrobe", "Bedroom", fittedWardrobe, 2.4, 0.62, 2.8, "floor"],
  tv_wall: ["TV wall", "Living", tvWall, 3.0, 0.45, 2.6, "floor"],
  sideboard: ["Sideboard", "Living", sideboard, 1.6, 0.45, 0.8, "floor"],
  display_cabinet: ["Glass cabinet", "Living", displayCabinet, 0.8, 0.4, 1.9, "floor"],
  cube_shelf: ["Cube shelf", "Living", cubeShelf, 1.47, 0.39, 1.47, "floor"],
  wall_shelf: ["Wall shelf", "Living", wallShelf, 0.8, 0.22, 0.3, "wall", 1.5],
  chaise: ["Chaise longue", "Living", chaiseLongue, 0.75, 1.6, 0.8, "floor"],
  stool: ["Stool", "Living", stool, 0.38, 0.38, 0.45, "floor"],
  room_divider: ["Room divider", "Living", roomDivider, 1.6, 0.3, 1.75, "floor"],
  dining_round: ["Round dining table", "Dining", diningRound, 1.1, 1.1, 0.75, "floor"],
  bar_table: ["Bar table", "Dining", barTable, 0.7, 0.7, 1.05, "floor"],
  trolley: ["Trolley", "Dining", trolley, 0.45, 0.35, 0.78, "floor"],
  bunk_bed: ["Bunk bed", "Bedroom", bunkBed, 1.0, 2.0, 1.6, "floor"],
  cot: ["Baby cot", "Bedroom", cot, 0.66, 1.26, 0.9, "floor"],
  day_bed: ["Day bed", "Bedroom", dayBed, 0.9, 2.0, 0.85, "floor"],
  dressing_table: ["Dressing table", "Bedroom", dressingTable, 1.0, 0.45, 0.75, "floor"],
  clothes_rail: ["Clothes rail", "Bedroom", clothesRail, 1.2, 0.5, 1.75, "floor"],
  toy_storage: ["Toy storage", "Bedroom", toyStorage, 0.9, 0.35, 0.65, "floor"],
  kids_table: ["Children's table", "Bedroom", kidsTable, 0.8, 0.55, 0.48, "floor"],
  drawer_unit: ["Drawer unit", "Office", drawerUnit, 0.42, 0.5, 0.6, "floor"],
  shoe_cabinet: ["Shoe cabinet", "Hall", shoeCabinet, 0.8, 0.3, 1.0, "floor"],
  coat_rack: ["Coat stand", "Hall", coatRack, 0.45, 0.45, 1.8, "floor"],
  dishwasher: ["Dishwasher", "Kitchen", dishwasher, 0.6, 0.6, 0.86, "floor"],
  microwave: ["Microwave", "Kitchen", microwave, 0.5, 0.38, 0.3, "wall", 0.92],
  dryer: ["Tumble dryer", "Laundry", dryer, 0.6, 0.6, 0.85, "floor"],
  drying_rack: ["Drying rack", "Laundry", dryingRack, 1.1, 0.55, 0.95, "floor"],
  laundry_basket: ["Laundry basket", "Laundry", laundryBasket, 0.45, 0.45, 0.6, "floor"],
  bath_shelf: ["Bathroom shelf", "Bathroom", bathShelf, 0.6, 0.3, 1.4, "floor"],
  sun_lounger: ["Sun lounger", "Outdoor", sunLounger, 0.7, 1.95, 0.5, "floor"],
  parasol: ["Parasol", "Outdoor", parasol, 2.5, 2.5, 2.4, "floor"],
  outdoor_sofa: ["Outdoor sofa", "Outdoor", outdoorSofa, 1.9, 0.85, 0.75, "floor"],
  planter: ["Planter", "Outdoor", planter, 1.0, 0.4, 0.45, "floor"],
  bbq: ["Barbecue", "Outdoor", bbq, 1.1, 0.55, 1.1, "floor"],
  wall_art: ["Picture", "Decor", wallArt, 0.7, 0.03, 0.9, "wall", 1.2],
  vase: ["Vase", "Decor", vase, 0.25, 0.25, 0.4, "floor"],
  wall_clock: ["Wall clock", "Decor", wallClock, 0.4, 0.05, 0.4, "wall", 1.8],
  stairs: ["Stairs", "Building", buildStairs, 1.0, 3.6, 2.8, "floor"],
  sofa: ["Sofa", "Living", (o) => sofa(o), 2.2, 0.95, 0.8, "floor"],
  sofa_l: ["Corner sofa", "Living", sofaL, 2.8, 1.6, 0.8, "floor"],
  armchair: ["Armchair", "Living", armchair, 0.8, 0.8, 0.8, "floor"],
  coffee_table: ["Coffee table", "Living", coffeeTable, 1.2, 0.65, 0.4, "floor"],
  coffee_round: ["Round coffee table", "Living", (o) => coffeeTable({ ...o, round: true }), 0.9, 0.9, 0.4, "floor"],
  side_table: ["Side table", "Living", sideTable, 0.45, 0.45, 0.55, "floor"],
  tv_unit: ["TV unit", "Living", tvUnit, 2.0, 0.42, 0.5, "floor"],
  tv: ["TV on the wall", "Living", tv, 1.45, 0.06, 0.84, "wall", 1.05],
  rug: ["Rug", "Living", rug, 2.4, 1.7, 0.01, "floor"],
  ottoman: ["Pouf", "Living", ottoman, 0.5, 0.5, 0.42, "floor"],
  bookshelf: ["Bookshelf", "Living", bookshelf, 0.9, 0.35, 1.9, "floor"],
  console: ["Console", "Living", consoleT, 1.2, 0.35, 0.8, "floor"],
  majlis_seat: ["Majlis seating", "Living", majlis, 4.0, 0.8, 0.6, "floor"],
  bench: ["Bench", "Living", bench, 1.4, 0.4, 0.45, "floor"],
  dining_table: ["Dining table", "Dining", diningTable, 1.8, 0.9, 0.75, "floor"],
  dining_chair: ["Dining chair", "Dining", diningChair, 0.46, 0.5, 0.86, "floor"],
  bar_stool: ["Bar stool", "Dining", barStool, 0.4, 0.4, 0.75, "floor"],
  bed_double: ["Double bed", "Bedroom", (o) => bed(o), 1.8, 2.1, 1.05, "floor"],
  bed_single: ["Single bed", "Bedroom", (o) => bed(o), 1.1, 2.05, 1.05, "floor"],
  nightstand: ["Bedside table", "Bedroom", nightstand, 0.5, 0.4, 0.54, "floor"],
  wardrobe: ["Wardrobe", "Bedroom", wardrobe, 1.8, 0.6, 2.2, "floor"],
  dresser: ["Chest of drawers", "Bedroom", dresser, 1.2, 0.5, 0.85, "floor"],
  desk: ["Desk", "Office", desk, 1.4, 0.7, 0.76, "floor"],
  office_chair: ["Office chair", "Office", officeChair, 0.6, 0.6, 1.05, "floor"],
  kitchen_base: ["Kitchen counter", "Kitchen", kitchenBase, 2.4, 0.62, 0.91, "floor"],
  kitchen_island: ["Kitchen island", "Kitchen", island, 2.0, 1.0, 0.92, "floor"],
  fridge: ["Fridge", "Kitchen", fridge, 0.9, 0.72, 1.85, "floor"],
  washing_machine: ["Washing machine", "Laundry", washer, 0.6, 0.6, 0.85, "floor"],
  bathtub: ["Bathtub", "Bathroom", bathtub, 1.7, 0.8, 0.55, "floor"],
  shower: ["Shower", "Bathroom", shower, 1.0, 1.0, 2.0, "floor"],
  toilet: ["Toilet", "Bathroom", toilet, 0.4, 0.65, 0.82, "floor"],
  basin: ["Basin and vanity", "Bathroom", basin, 0.8, 0.5, 0.85, "floor"],
  mirror: ["Mirror", "Bathroom", mirror, 0.8, 0.03, 1.0, "wall", 1.0],
  wall_cabinet: ["Wall cabinets", "Kitchen", wallCabinet, 1.2, 0.35, 0.7, "wall", 1.45],
  tall_cabinet: ["Tall cabinet", "Kitchen", tallCabinet, 0.6, 0.6, 2.3, "floor"],
  oven_tower: ["Oven tower", "Kitchen", ovenTower, 0.6, 0.6, 2.3, "floor"],
  cooker: ["Hob and oven", "Kitchen", cooker, 0.9, 0.62, 0.91, "floor"],
  kitchen_sink: ["Sink cabinet", "Kitchen", kitchenSink, 1.0, 0.62, 0.91, "floor"],
  hood: ["Cooker hood", "Kitchen", hood, 0.9, 0.3, 0.06, "wall", 1.55],
  basin_wall: ["Wall basin", "Bathroom", basinWall, 0.55, 0.45, 0.86, "floor"],
  mirror_led: ["LED mirror", "Bathroom", mirrorLed, 0.6, 0.03, 0.8, "wall", 1.1],
  towel_rail: ["Towel rail", "Bathroom", towelRail, 0.6, 0.08, 0.06, "wall", 1.2],
  exhaust_fan: ["Extractor fan", "Bathroom", exhaustFan, 0.22, 0.04, 0.22, "wall", 2.1],
  lounge_chair: ["Lounge chair", "Living", loungeChair, 0.75, 0.85, 0.75, "floor"],
  tv_stand: ["TV on its feet", "Living", tvFeet, 1.45, 0.25, 0.84, "wall", 0.5],
  wall_panels: ["Wall panelling", "Decor", wallPanels, 3.0, 0.02, 2.6, "wall", 0],
  mirror_round: ["Round mirror", "Decor", mirrorRound, 0.9, 0.03, 0.9, "wall", 0.9],
  floor_mirror: ["Leaning mirror", "Decor", floorMirror, 0.8, 0.3, 1.9, "floor"],
  plant: ["Plant", "Decor", plant, 0.6, 0.6, 1.3, "floor"],
  plant_small: ["Small plant", "Decor", (o) => plant({ ...o, h: 0.6 }), 0.35, 0.35, 0.6, "floor"],
  tree: ["Tree", "Outdoor", tree, 1.8, 1.8, 3.0, "floor"],
  floor_lamp: ["Floor lamp", "Lights", floorLamp, 0.4, 0.4, 1.6, "floor"],
  pendant_lamp: ["Pendant lamp", "Lights", pendant, 0.45, 0.45, 0.8, "ceiling"],
  chandelier: ["Chandelier", "Lights", chandelier, 1.0, 1.0, 0.9, "ceiling"],
};
// what devices look like
export const DEVICE_LOOKS = {
  pendant: pendant, chandelier: chandelier, spots: spots, flush: flush, floor: floorLamp,
  ac: (o) => acSplit({ w: 0.95, d: 0.24, h: 0.3, ...o }), fan: ceilingFan, speaker, vacuum, person,
};
export const CATEGORIES = ["Building", "Living", "Dining", "Bedroom", "Office", "Hall", "Kitchen", "Laundry", "Bathroom", "Decor", "Lights", "Outdoor"];

export function dims(it) {
  const L = LIBRARY[it.kind]; if (!L) return { w: 0.5, d: 0.5, h: 0.5 };
  return { w: it.w || L[3], d: it.d || L[4], h: it.h || L[5], mount: it.mount || L[6], z: it.z ?? L[7] ?? 0 };
}
export function build(it) {
  const L = LIBRARY[it.kind]; if (!L) return new THREE.Group();
  const d = dims(it);
  const g = L[2]({ ...it, ...d });
  g.userData.item = it.id;
  finish(g, it);
  return g;
}
// a piece's own finishes: its wood, its metal (legs, handles, frames) and your own material on its fabric
function finish(g, it) {
  if (!it.wood && !it.metal && !it.mat) return;
  const own = it.mat ? ownMaterial(it.mat) : null;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!m) return m;
      if (it.wood && m.userData?.wood) return wood(it.wood);
      if (it.metal && m.metalness === 1 && !m.emissive?.getHex?.()) return metal(it.metal, m.roughness);
      if (own && m.sheen > 0) return own;
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}
