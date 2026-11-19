// Every kind of lamp: how it looks, and exactly where its light comes from and where it points.
// The same description feeds the light bake (soft, true light on every surface), the live view and the photos.
import * as THREE from "three";

const D2R = Math.PI / 180;
// plan rotation (degrees) to a direction on the floor; matches how furniture turns
const along = (deg) => [Math.cos(deg * D2R), 0, -Math.sin(deg * D2R)];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// [name, live intensity before baking]
export const NEW_LOOKS = { downlight: "Recessed spot", track: "Track light", linear: "Linear light", focus: "Focus light", panel: "LED panel" };
// default light output: recessed and focus per lamp, track per head, linear per metre, a panel as a whole
export const NEW_LUMENS = { downlight: 600, track: 500, linear: 900, focus: 450, panel: 1600 };

// beam half-angles (radians)
const BEAM = { downlight: 0.62, track: 0.38, focus: 0.26, spots: 0.55 };

// where the light comes from. H: ceiling height; room: the room the lamp is in (for cove direction)
export function emittersFor(dv, look, H, room) {
  const x = dv.x, z = dv.y;
  if (look === "downlight") {
    // one spot, or a twin fitting (two spots side by side in one frame)
    const n = dv.heads === 2 ? 2 : 1, u = along(dv.rot || 0);
    return Array.from({ length: n }, (_, i) => { const s = n === 1 ? 0 : (i - 0.5) * 0.13; return { p: [x + u[0] * s, H - 0.03, z + u[2] * s], dir: [0, -1, 0], cone: BEAM.downlight, r: 0.04, w: 1 }; });
  }
  if (look === "panel") {
    // a flat LED panel, square or round, glowing softly straight down from its whole face
    const sz = dv.size || 0.3, q = sz / 4, u = along(dv.rot || 0), v = [-u[2], 0, u[0]], y = H - (dv.shape === "round" ? 0.04 : 0.01);
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ p: [x + (u[0] * a + v[0] * b) * q, y, z + (u[2] * a + v[2] * b) * q], dir: [0, -1, 0], down: 1, r: q, w: 0.25 }));
  }
  if (look === "focus") {
    const t = [dv.tx ?? x + 0.8, dv.tz ?? 1.4, dv.ty ?? z];
    return [{ p: [x, H - 0.05, z], dir: norm([t[0] - x, t[1] - (H - 0.05), t[2] - z]), cone: BEAM.focus, r: 0.03, w: 1 }];
  }
  if (look === "track") {
    const n = Math.max(1, Math.min(8, dv.heads || 3)), len = dv.len || 1.5, u = along(dv.rot || 0);
    const tilt = (dv.tilt ?? 25) * D2R, h = along(dv.aim ?? (dv.rot || 0) - 90);
    const dir = norm([h[0] * Math.sin(tilt), -Math.cos(tilt), h[2] * Math.sin(tilt)]);
    return Array.from({ length: n }, (_, i) => { const s = (i - (n - 1) / 2) * (len / n); return { p: [x + u[0] * s, H - 0.14, z + u[2] * s], dir, cone: BEAM.track, r: 0.03, w: 1 }; });
  }
  if (look === "linear") {
    const len = dv.len || 1.2, u = along(dv.rot || 0), cove = dv.style === "cove";
    // a magnetic slot: a black channel with a few lit bars along it
    if (dv.style === "slot") return slotBars(dv, len).map(([s, l]) => ({ p: [x + u[0] * s, H - 0.01, z + u[2] * s], dir: [0, -1, 0], down: 1, r: 0.02, u, hl: l / 2, w: l }));
    const k = Math.max(2, Math.round(len / 0.3));
    let dir = [0, -1, 0];
    if (cove) {
      // hidden in a dropped ceiling edge, washing the ceiling: up, and a little toward the middle of the room
      const c = room ? centre(room.pts) : [x, z], side = [-u[2], 0, u[0]], toC = (c[0] - x) * side[0] + (c[1] - z) * side[2] >= 0 ? 1 : -1;
      dir = norm([side[0] * toC * 0.55, 0.85, side[2] * toC * 0.55]);
    }
    return Array.from({ length: k }, (_, i) => { const s = ((i + 0.5) / k - 0.5) * len; return { p: [x + u[0] * s, H - (cove ? 0.22 : 0.02), z + u[2] * s], dir, down: 1, r: 0.03, u, hl: len / k / 2, w: len / k }; });
  }
  return null;
}
// the lit bars of a magnetic slot: [centre along the channel, length]. bars: how many (0 = lit all along)
export function slotBars(dv, len) {
  const n = Math.max(0, Math.min(12, Math.round(dv.bars ?? 3)));
  if (!n) return [[0, len]];
  const l = Math.min(0.6, (len / n) * 0.6);
  return Array.from({ length: n }, (_, i) => [((i + 0.5) / n - 0.5) * len, l]);
}
function centre(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }

// the lamp itself (at the ceiling, y = 0 is the ceiling plane)
export function lampModel(dv, look) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: "#EDEDED", roughness: 0.35, metalness: 0.1 });
  const black = new THREE.MeshStandardMaterial({ color: "#1E1F24", roughness: 0.45, metalness: 0.3 });
  const glow = () => new THREE.MeshStandardMaterial({ color: "#FFF3DC", emissive: "#FFD9A0", emissiveIntensity: 0, roughness: 0.5 });
  const disc = (r, y, m, name) => { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 24), m); d.rotation.x = Math.PI / 2; d.position.y = y; if (name) d.name = name; return d; };
  if (look === "downlight") {
    const n = dv.heads === 2 ? 2 : 1;
    if (n === 2) { const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.006, 0.12), white); frame.position.y = -0.003; g.add(frame); }
    for (let i = 0; i < n; i++) {
      const s = n === 1 ? 0 : (i - 0.5) * 0.13;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), white); ring.rotation.x = Math.PI / 2; ring.position.set(s, -0.006, 0); g.add(ring);
      const d = disc(0.04, -0.004, glow(), "glow"); d.position.x = s; g.add(d);
    }
  } else if (look === "panel") {
    const sz = dv.size || 0.3;
    if (dv.shape === "round") {
      // surface-mounted round panel: a slim drum with a glowing face
      const body = new THREE.Mesh(new THREE.CylinderGeometry(sz / 2, sz / 2, 0.04, 40), white); body.position.y = -0.02; g.add(body);
      g.add(disc(sz / 2 - 0.01, -0.0405, glow(), "glow"));
    } else {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(sz, 0.008, sz), white); frame.position.y = -0.004; g.add(frame);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(sz - 0.02, sz - 0.02), glow()); face.rotation.x = Math.PI / 2; face.position.y = -0.0085; face.name = "glow"; g.add(face);
    }
  } else if (look === "focus") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 24), white); ring.rotation.x = Math.PI / 2; ring.position.y = -0.006; g.add(ring);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.06, 18), black); can.position.y = -0.03; can.name = "aim"; g.add(can);
    const lens = disc(0.026, -0.061, glow(), "glow"); can.add(lens); lens.position.y = -0.031;
  } else if (look === "track") {
    const n = Math.max(1, Math.min(8, dv.heads || 3)), len = dv.len || 1.5;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.035), black); rail.position.y = -0.015; g.add(rail);
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) * (len / n), stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), black); stem.position.set(s, -0.06, 0); g.add(stem);
      const head = new THREE.Group(); head.position.set(s, -0.1, 0); head.name = "head";
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.13, 18), black); head.add(can);
      const lens = disc(0.033, -0.066, glow(), "glow"); lens.rotation.x = Math.PI / 2; head.add(lens);
      g.add(head);
    }
  } else if (look === "linear") {
    const len = dv.len || 1.2;
    if (dv.style === "slot") {
      // a thin black channel set into the ceiling, with lit bars along it
      const ch = new THREE.Mesh(new THREE.BoxGeometry(len, 0.004, 0.03), black); ch.position.y = -0.002; g.add(ch);
      for (const [s, l] of slotBars(dv, len)) { const bar = new THREE.Mesh(new THREE.BoxGeometry(l, 0.004, 0.022), glow()); bar.position.set(s, -0.0045, 0); bar.name = "glow"; g.add(bar); }
    } else if (dv.style === "cove") {
      // the dropped edge that hides the strip, and the strip glowing above it
      const lip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 0.04), white); lip.position.set(0, -0.125, 0); lip.name = "lip"; g.add(lip);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.02), glow()); strip.position.y = -0.22; strip.name = "glow"; g.add(strip);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.05), white); body.position.y = -0.015; g.add(body);
      const diff = new THREE.Mesh(new THREE.BoxGeometry(len - 0.02, 0.004, 0.04), glow()); diff.position.y = -0.032; diff.name = "glow"; g.add(diff);
    }
  }
  return g;
}

// turn the lamp's heads to where the light really goes (track heads and focus lights)
export function aimModel(g, dv, look, em) {
  if (!em?.length) return;
  const q = new THREE.Quaternion(), down = new THREE.Vector3(0, -1, 0);
  if (look === "focus") { const can = g.getObjectByName("aim"); if (can) can.quaternion.setFromUnitVectors(down, new THREE.Vector3(...em[0].dir)); }
  if (look === "track") {
    // heads are children of the rotated group: give them the direction in the group's own frame
    const inv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(dv.rot || 0) * D2R);
    const d = new THREE.Vector3(...em[0].dir).applyQuaternion(inv);
    g.traverse((o) => { if (o.name === "head") o.quaternion.copy(q.setFromUnitVectors(down, d)); });
  }
}
