// The local AI that reads room photos, run in the background so the page never freezes.
// It is an open-vocabulary object finder (OWL-ViT): it is asked for each thing by name and answers with boxes.
// The program that runs it ships with Roost Atelier. The trained model is fetched once by Home Assistant itself
// and kept there, so every screen in the home gets it from Home Assistant (and the browser keeps its own copy).
// Only if Home Assistant can't get it does this screen ask the model's own site. The photo never leaves this device.
import { pipeline, env, RawImage } from "@huggingface/transformers";
import { QUERIES, boxesToFound } from "./boxes.js";

const MODEL = "Xenova/owlvit-base-patch32";
let det = null, how = "";

// requests to Home Assistant carry this screen's sign-in (given fresh with every photo)
let token = "", origin = "";
const plainFetch = self.fetch.bind(self);
self.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (token && origin && url.startsWith(`${origin}/api/roost_atelier/model/`)) {
    const headers = new Headers(init.headers || (typeof input === "string" ? undefined : input.headers)); headers.set("Authorization", `Bearer ${token}`);
    return plainFetch(url, { ...init, headers });
  }
  return plainFetch(input, init);
};

async function gpuWithHalf() {
  try { const a = await navigator.gpu?.requestAdapter(); return !!a?.features?.has("shader-f16"); } catch { return false; }
}

async function load(base) {
  if (det) return det;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.wasmPaths = base; // the runtime files shipped with Atelier, not from a CDN
  const progress = (p) => { if (p.status === "progress" && p.total > 1e6) postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total }); };
  // the ways to run it, fastest first: on the graphics chip when it has one, else the small 8-bit model on the processor
  const ways = [];
  if (await gpuWithHalf()) ways.push({ device: "webgpu", dtype: "fp16" });
  ways.push({ device: "wasm", dtype: "q8" });
  const hosts = origin ? [[`${origin}/api/roost_atelier/model/`, "{model}/"], ["https://huggingface.co/", "{model}/resolve/{revision}/"]] : [["https://huggingface.co/", "{model}/resolve/{revision}/"]];
  let last;
  for (const [host, tpl] of hosts) {
    env.remoteHost = host; env.remotePathTemplate = tpl;
    for (const w of ways) {
      try { det = await pipeline("zero-shot-object-detection", MODEL, { ...w, progress_callback: progress }); how = `${w.device}/${w.dtype}`; return det; }
      catch (err) { last = err; det = null; }
    }
  }
  throw last;
}

function colourOf(img) {
  // the average colour in the middle of a box, a little brighter than the raw pixels (photos are often dim)
  return (b) => {
    const { width: W, height: H, data, channels: c } = img, x0 = Math.max(0, Math.round(b.xmin + (b.xmax - b.xmin) * 0.3)), x1 = Math.min(W - 1, Math.round(b.xmax - (b.xmax - b.xmin) * 0.3));
    const y0 = Math.max(0, Math.round(b.ymin + (b.ymax - b.ymin) * 0.3)), y1 = Math.min(H - 1, Math.round(b.ymax - (b.ymax - b.ymin) * 0.3));
    let r = 0, g = 0, bl = 0, n = 0;
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { const i = (y * W + x) * c; r += data[i]; g += data[i + 1]; bl += data[i + 2]; n++; }
    if (!n) return undefined;
    const k = (v) => Math.min(255, Math.round((v / n) * 1.08)).toString(16).padStart(2, "0");
    return `#${k(r)}${k(g)}${k(bl)}`;
  };
}

onmessage = async (e) => {
  const { id, blob, base } = e.data;
  token = e.data.token || token; origin = e.data.origin || origin;
  try {
    const d = await load(base);
    postMessage({ type: "progress", reading: true });
    const img = await RawImage.fromBlob(blob);
    const kinds = Object.keys(QUERIES), labels = kinds.map((k) => QUERIES[k]);
    const raw = await d(img, labels, { threshold: 0.08, percentage: false });
    const dets = raw.map((r) => ({ kind: kinds[labels.indexOf(r.label)], score: r.score, box: r.box }));
    postMessage({ type: "done", id, how, found: boxesToFound(dets, img.width, img.height, colourOf(img.rgb())) });
  } catch (err) {
    postMessage({ type: "error", id, message: String(err?.message || err) });
  }
};
