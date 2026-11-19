// Match a photo of a real room: reads the colour of the light in the photo and sets the warmth of the
// room's lamps to it. (A phone sets its own exposure, so a photo can't tell true brightness: that stays
// on the "Room brightness" slider.)
import { kelvinToHex } from "./devices.js";
import { inside } from "./model.js";

function load(file) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
const ratio = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n & 255) + 1) / (((n >> 16) & 255) + 1); };

export async function matchPhoto(file, room, floor) {
  let img; try { img = await load(file); } catch { return null; }
  const c = document.createElement("canvas"), k = Math.min(1, 256 / Math.max(img.width, img.height));
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  // light-coloured, unsaturated surfaces (walls, ceilings) show the colour of the light best
  let r = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx < 70 || mx > 250 || (mx - mn) / mx > 0.45) continue;
    r += R; b += B; n++;
  }
  if (n < 200) return null;
  const measured = b / r;
  let best = 2700, err = 1e9;
  for (let K = 2200; K <= 6500; K += 100) { const e = Math.abs(ratio(kelvinToHex(K)) - measured); if (e < err) { err = e; best = K; } }
  const lamps = floor.devices.filter((dv) => (dv.kind || "light") === "light" && !/^(cover|climate|media_player|lock|person|fan|vacuum|binary_sensor)\./.test(dv.entity || "") && inside([dv.x, dv.y], room.pts));
  return {
    kelvin: best,
    apply: () => { for (const dv of lamps) dv.kelvin = best; },
    text: lamps.length ? `${lamps.length} lamp${lamps.length > 1 ? "s" : ""} set to ${best} K from the photo's light colour.` : `The light in the photo is about ${best} K. Add lamps to this room to use it.`,
  };
}
