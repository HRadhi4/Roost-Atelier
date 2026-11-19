// The local AI that reads room photos, run in the background so the page never freezes.
// It is an open-vocabulary object finder (OWL-ViT): it is asked for each thing by name and answers with boxes.
// The program that runs it ships with Roost Atelier; the trained model itself is downloaded once from
// Hugging Face the first time and then kept by the browser. The photo never leaves this device.
import { pipeline, env, RawImage } from "@huggingface/transformers";
import { QUERIES, boxesToFound } from "./boxes.js";

const MODEL = "Xenova/owlvit-base-patch32";
let det = null;

async function load(base) {
  if (det) return det;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.backends.onnx.wasm.wasmPaths = base; // the runtime files shipped with Atelier, not from a CDN
  const progress = (p) => { if (p.status === "progress" && p.total > 1e6) postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total }); };
  // the small 8-bit model (about 150 MB) on the processor: the same answers on every phone and computer
  det = await pipeline("zero-shot-object-detection", MODEL, { dtype: "q8", device: "wasm", progress_callback: progress });
  return det;
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
  try {
    const d = await load(base);
    postMessage({ type: "progress", reading: true });
    const img = await RawImage.fromBlob(blob);
    const kinds = Object.keys(QUERIES), labels = kinds.map((k) => QUERIES[k]);
    const raw = await d(img, labels, { threshold: 0.08, percentage: false });
    const dets = raw.map((r) => ({ kind: kinds[labels.indexOf(r.label)], score: r.score, box: r.box }));
    postMessage({ type: "done", id, found: boxesToFound(dets, img.width, img.height, colourOf(img.rgb())) });
  } catch (err) {
    postMessage({ type: "error", id, message: String(err?.message || err) });
  }
};
