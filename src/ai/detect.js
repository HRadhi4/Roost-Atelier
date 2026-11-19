// Reading a room photo on this device. Starts the background reader once and keeps it for later photos.
import { AI_BASE } from "./denoise.js";

let worker = null, n = 0;
export function readPhotoLocally(blob, onProgress) {
  worker ||= new Worker(new URL(`./detect-worker.js?v=${__VERSION__}`, import.meta.url), { type: "module" });
  const id = ++n;
  return new Promise((resolve, reject) => {
    const on = (e) => {
      const m = e.data;
      if (m.type === "progress") { onProgress?.(m); return; }
      if (m.id !== id) return;
      worker.removeEventListener("message", on);
      if (m.type === "done") resolve(m.found); else reject(new Error(m.message));
    };
    worker.addEventListener("message", on);
    worker.postMessage({ id, blob, base: `${AI_BASE.url}ort/` });
  });
}
