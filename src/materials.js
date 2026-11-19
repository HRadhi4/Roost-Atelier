// Real-looking finishes, painted in code (no downloads): wood planks, tiles, marble, fabric weave.
// Each finish has a colour map, a roughness map and a bump (normal) map, so light reflects like the real thing.
import * as THREE from "three";

const SIZE = 512;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const cache = new Map();

function canvas(w = SIZE, h = SIZE) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// height (grey canvas) -> normal map canvas
function normalFrom(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext("2d").getImageData(0, 0, w, h).data;
  const out = canvas(w, h), ctx = out.getContext("2d"), img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function tex(c, srgb, repeatM) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.userData.tile = repeatM;
  if (repeatM) t.repeat.set(1 / repeatM, 1 / repeatM);
  return t;
}

// ------------------------------------------------------------- painters: (colour ctx, rough ctx, height ctx, w, h)
function planks(base, vary, { plank = 8, herring = false } = {}) {
  return (c, r, hgt, w, h) => {
    const pw = w / plank;
    c.fillStyle = base; c.fillRect(0, 0, w, h); r.fillStyle = "#8a8a8a"; r.fillRect(0, 0, w, h); hgt.fillStyle = "#808080"; hgt.fillRect(0, 0, w, h);
    const [br, bg, bb] = hex(base);
    const board = (x, y, bw, bh, angle = 0) => {
      c.save(); r.save(); hgt.save();
      for (const k of [c, r, hgt]) { k.translate(x, y); k.rotate(angle); }
      const v = 1 + (rnd() - 0.5) * vary;
      c.fillStyle = rgb(br * v, bg * v, bb * v); c.fillRect(0, 0, bw, bh);
      for (let i = 0; i < 6; i++) { const cx = rnd() * bw; c.strokeStyle = `rgba(${br * 0.6},${bg * 0.52},${bb * 0.45},${0.05 + rnd() * 0.06})`; c.lineWidth = 2 + rnd() * 5; c.beginPath(); c.ellipse(cx, bh * rnd(), bw * (0.15 + rnd() * 0.3), bh * (0.25 + rnd() * 0.4), 0, 0, Math.PI * 2); c.stroke(); }
      for (let i = 0; i < 46; i++) {
        const gx = rnd() * bw, a = 0.04 + rnd() * 0.08;
        c.strokeStyle = `rgba(${br * 0.55},${bg * 0.5},${bb * 0.45},${a})`; c.lineWidth = 0.6 + rnd() * 1.6;
        c.beginPath(); c.moveTo(gx, 0); c.bezierCurveTo(gx + (rnd() - 0.5) * 10, bh * 0.33, gx + (rnd() - 0.5) * 10, bh * 0.66, gx + (rnd() - 0.5) * 6, bh); c.stroke();
      }
      if (rnd() < 0.35) { c.fillStyle = `rgba(${br * 0.5},${bg * 0.45},${bb * 0.4},0.25)`; c.beginPath(); c.ellipse(rnd() * bw, rnd() * bh, 3 + rnd() * 4, 6 + rnd() * 8, 0, 0, Math.PI * 2); c.fill(); }
      r.fillStyle = `rgb(${110 + rnd() * 40},${110 + rnd() * 40},${110 + rnd() * 40})`; r.fillRect(0, 0, bw, bh);
      hgt.fillStyle = "#909090"; hgt.fillRect(1, 1, bw - 2, bh - 2);
      for (const k of [c, hgt]) { k.fillStyle = k === c ? "rgba(30,18,10,.55)" : "#303030"; k.fillRect(0, 0, bw, 1.5); k.fillRect(0, 0, 1.5, bh); }
      c.restore(); r.restore(); hgt.restore();
    };
    if (herring) {
      const bw = w / 16, bh = bw * 4;
      for (let y = -bh; y < h + bh; y += bw * 2) for (let x = -bh; x < w + bh; x += bw * 2) {
        board(x, y, bw, bh, -Math.PI / 4); board(x + bw * 1.414, y, bw, bh, Math.PI / 4);
      }
    } else {
      for (let i = 0; i < plank; i++) {
        let y = -rnd() * h;
        while (y < h) { const len = h * (0.35 + rnd() * 0.5); board(i * pw, y, pw, len); y += len; }
      }
    }
  };
}
function tiles(base, grout, n, vary = 0.05, { veins = 0 } = {}) {
  return (c, r, hgt, w, h) => {
    const s = w / n, [br, bg, bb] = hex(base);
    c.fillStyle = grout; c.fillRect(0, 0, w, h); r.fillStyle = "#c8c8c8"; r.fillRect(0, 0, w, h); hgt.fillStyle = "#505050"; hgt.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 1 + (rnd() - 0.5) * vary;
      c.fillStyle = rgb(br * v, bg * v, bb * v); c.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      r.fillStyle = "#3a3a3a"; r.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      hgt.fillStyle = "#9a9a9a"; hgt.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
    if (veins) marbleVeins(c, w, h, veins);
    speckle(c, w, h, 0.04);
  };
}
function marbleVeins(c, w, h, n) {
  for (let k = 0; k < n; k++) {
    c.strokeStyle = `rgba(120,118,122,${0.08 + rnd() * 0.18})`; c.lineWidth = 0.5 + rnd() * 2.2;
    let x = rnd() * w, y = 0; c.beginPath(); c.moveTo(x, y);
    while (y < h) { x += (rnd() - 0.45) * 40; y += 10 + rnd() * 30; c.lineTo(x, y); }
    c.stroke();
  }
}
function speckle(c, w, h, a) { for (let i = 0; i < w * h * 0.02; i++) { c.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${a * rnd()})`; c.fillRect(rnd() * w, rnd() * h, 1, 1); } }
function flat(base, rough = "#d0d0d0", noise = 0.03) {
  return (c, r, hgt, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h); r.fillStyle = rough; r.fillRect(0, 0, w, h); hgt.fillStyle = "#808080"; hgt.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h * 0.05; i++) { const v = rnd(); hgt.fillStyle = `rgba(${v * 255},${v * 255},${v * 255},.15)`; hgt.fillRect(rnd() * w, rnd() * h, 2, 2); }
    speckle(c, w, h, noise);
  };
}
function weave(base) {
  return (c, r, hgt, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h); r.fillStyle = "#f0f0f0"; r.fillRect(0, 0, w, h); hgt.fillStyle = "#808080"; hgt.fillRect(0, 0, w, h);
    const s = 4;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const on = ((x / s) + (y / s)) % 2 === 0, v = on ? 175 : 95;
      hgt.fillStyle = `rgb(${v},${v},${v})`; hgt.fillRect(x, y, s, s);
      c.fillStyle = `rgba(${on ? 255 : 0},${on ? 255 : 0},${on ? 255 : 0},${0.035 + rnd() * 0.03})`; c.fillRect(x, y, s, s);
      if (rnd() < 0.08) { const t = rnd() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${t},${t},${t},${0.05 + rnd() * 0.06})`; c.fillRect(x, y, s * (1 + rnd() * 6), 1); }
    }
  };
}
function grass() {
  return (c, r, hgt, w, h) => {
    c.fillStyle = "#4E7A3A"; c.fillRect(0, 0, w, h); r.fillStyle = "#f2f2f2"; r.fillRect(0, 0, w, h); hgt.fillStyle = "#606060"; hgt.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const g = 90 + rnd() * 80; c.strokeStyle = `rgba(${40 + rnd() * 40},${g},${30 + rnd() * 30},.6)`; const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5); c.stroke(); hgt.fillStyle = "#c0c0c0"; hgt.fillRect(x, y - 2, 1, 3); }
  };
}

const hex = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))})`;

// name: [label, painter, tile size in metres, roughness scale, metalness, extra]
export const FLOORS = {
  oak: ["Light oak", planks("#B98A5E", 0.18), 1.6, 0.75],
  walnut: ["Walnut", planks("#6A4630", 0.2), 1.6, 0.7],
  herringbone: ["Herringbone oak", planks("#B38459", 0.2, { herring: true }), 1.2, 0.7],
  porcelain: ["Grey porcelain 60×60", tiles("#C9C6C0", "#9A968F", 4, 0.06), 2.4, 0.45],
  sand: ["Sand stone 60×60", tiles("#D8C7A6", "#A8977A", 4, 0.08), 2.4, 0.6],
  marble: ["White marble", tiles("#ECEAE6", "#C9C6C0", 2, 0.03, { veins: 26 }), 2.4, 0.18],
  terrazzo: ["Terrazzo", flat("#DCD6CC", "#909090", 0.25), 1.0, 0.4],
  concrete: ["Polished concrete", flat("#9E9C98", "#9a9a9a", 0.05), 2.0, 0.5],
  carpet: ["Carpet", weave("#A69C8E"), 0.5, 1.0],
  deck: ["Outdoor deck", planks("#8A6B4E", 0.25, { plank: 6 }), 1.8, 0.85],
  grass: ["Grass", grass(), 1.5, 1.0],
};
export const WALLS = {
  "warm-white": ["Warm white", "#F3EFE8"], "pure-white": ["White", "#FAFAF8"], greige: ["Greige", "#D9D1C5"], sand: ["Sand", "#E5D6BD"],
  sage: ["Sage", "#B9C4B0"], sky: ["Soft blue", "#C9D6E2"], blush: ["Blush", "#E9D3CC"], charcoal: ["Charcoal", "#4A4B50"], navy: ["Navy", "#2E3A57"],
};
export const FABRICS = {
  linen: "#D8CFC0", grey: "#8E8C92", charcoal: "#45464C", navy: "#2F3E5C", sage: "#8FA08A", terracotta: "#B8674A", mustard: "#C9A040", blush: "#D9AFA3", cream: "#EEE6D8", plum: "#6A4766",
};

function painted(key, painter, size = SIZE) {
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size), r = canvas(size, size), h = canvas(size, size);
  seed = [...key].reduce((a, ch) => a + ch.charCodeAt(0) * 31, 7);
  const k = size / SIZE; for (const x of [c, r, h]) x.getContext("2d").scale(k, k);
  painter(c.getContext("2d"), r.getContext("2d"), h.getContext("2d"), SIZE, SIZE);
  const out = { map: c, rough: r, normal: normalFrom(h, 2.2) };
  cache.set(key, out);
  return out;
}

const matCache = new Map();
export function floorMaterial(name) {
  const k = `floor:${name}`;
  if (matCache.has(k)) return matCache.get(k);
  const def = FLOORS[name] || FLOORS.oak;
  const p = painted(k, def[1], 1024);
  const m = new THREE.MeshPhysicalMaterial({
    map: tex(p.map, true, def[2]), roughnessMap: tex(p.rough, false, def[2]), normalMap: tex(p.normal, false, def[2]),
    roughness: def[3], metalness: 0, clearcoat: def[3] < 0.5 ? 0.35 : 0.08, clearcoatRoughness: 0.25, envMapIntensity: 0.9,
  });
  m.normalScale.set(0.6, 0.6);
  m.userData.tile = def[2];
  matCache.set(k, m);
  return m;
}
export function wallMaterial(name) {
  const k = `wall:${name}`;
  if (matCache.has(k)) return matCache.get(k);
  const col = (WALLS[name] || [null, name && name.startsWith("#") ? name : "#F3EFE8"])[1];
  const p = painted("wall-plaster", flat("#ffffff", "#e6e6e6", 0.01));
  const m = new THREE.MeshStandardMaterial({ color: col, map: tex(p.map, true, 2), normalMap: tex(p.normal, false, 2), roughness: 0.92, envMapIntensity: 0.4 });
  m.normalScale.set(0.15, 0.15);
  m.userData.tile = 2;
  matCache.set(k, m);
  return m;
}
export function fabric(color = "#8E8C92") {
  const k = `fabric:${color}`;
  if (matCache.has(k)) return matCache.get(k);
  const p = painted("fabric", weave("#ffffff"));
  const m = new THREE.MeshPhysicalMaterial({ color, map: tex(p.map, true, 0.15), normalMap: tex(p.normal, false, 0.15), roughness: 0.95, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4) });
  m.normalScale.set(0.35, 0.35);
  m.userData.tile = 0.15;
  matCache.set(k, m);
  return m;
}
export function wood(kind = "oak", color) {
  const k = `wood:${kind}:${color || ""}`;
  if (matCache.has(k)) return matCache.get(k);
  const base = { oak: "#B98A5E", walnut: "#6A4630", ash: "#D2B48E", ebony: "#3A2A22", white: "#EDEAE4" }[kind] || kind;
  const p = painted(`woodgrain:${base}`, planks(base, 0.08, { plank: 2 }));
  const m = new THREE.MeshPhysicalMaterial({ color: color || "#ffffff", map: tex(p.map, true, 1.2), roughnessMap: tex(p.rough, false, 1.2), roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.3 });
  m.userData.tile = 1.2;
  matCache.set(k, m);
  return m;
}
export function solid(color, { rough = 0.5, metal = 0, clear = 0, emissive, emissiveIntensity = 0, transmission = 0, opacity = 1, side } = {}) {
  const k = `solid:${color}:${rough}:${metal}:${clear}:${emissive}:${transmission}:${opacity}:${side}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, clearcoat: clear, transparent: opacity < 1, opacity });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
  if (transmission) { m.transmission = transmission; m.thickness = 0.01; m.ior = 1.5; }
  if (side) m.side = side;
  matCache.set(k, m);
  return m;
}
export const glass = () => solid("#DDEBF2", { rough: 0.04, transmission: 0.95, opacity: 0.35, side: THREE.DoubleSide });
export const metal = (c = "#1B1B1F", rough = 0.35) => solid(c, { rough, metal: 1 });
export const brass = () => solid("#C9A35A", { rough: 0.3, metal: 1 });
export const chrome = () => solid("#E6E8EB", { rough: 0.12, metal: 1 });
export const porcelain = () => solid("#FBFBFA", { rough: 0.12, clear: 0.6 });

// Fit a material's map to an object size in metres (UVs are in metres on Atelier geometry).
export function tileFor(m) { return m.userData?.tile || 1; }
export function swatchColor(kind, name) {
  if (kind === "floor") { const d = FLOORS[name]; if (!d) return "#B98A5E"; const p = painted(`floor:${name}`, d[1]); const x = p.map.getContext("2d").getImageData(SIZE / 2, SIZE / 2, 1, 1).data; return rgb(x[0], x[1], x[2]); }
  return (WALLS[name] || [0, "#F3EFE8"])[1];
}
export function swatchCanvas(name) { const d = FLOORS[name]; return d ? painted(`floor:${name}`, d[1]).map : null; }
