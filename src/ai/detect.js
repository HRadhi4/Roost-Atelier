// Reading a room photo on this device. Starts the background reader once and keeps it for later photos.
import { AI_BASE } from "./denoise.js";

let worker = null, n = 0;
export function readPhotoLocally(blob, onProgress, hass) {
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
    // Home Assistant keeps the model for the whole home; the worker uses this screen's sign-in to fetch it
    const origin = hass?.auth?.data?.hassUrl || location.origin;
    const send = (token) => worker.postMessage({ id, blob, base: `${AI_BASE.url}ort/`, origin, token });
    if (hass?.auth?.refreshAccessToken && hass.auth.expired) hass.auth.refreshAccessToken().then(() => send(hass.auth.data.access_token), () => send(""));
    else send(hass?.auth?.data?.access_token || "");
  });
}
