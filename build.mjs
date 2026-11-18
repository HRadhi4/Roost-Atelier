// Builds the frontend into the integration: node build.mjs
import { build } from "esbuild";
import { copyFileSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const out = "custom_components/roost_atelier/frontend";
const version = JSON.parse(readFileSync("custom_components/roost_atelier/manifest.json")).version;
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const res = await build({
  entryPoints: { "roost-atelier": "src/main.js" }, bundle: true, splitting: true, format: "esm", outdir: out,
  chunkNames: "chunks/[name]-[hash]", minify: !process.env.DEV, sourcemap: !!process.env.DEV, target: "es2022", legalComments: "none", metafile: true,
  alias: { postprocessing: "./build/pp-stub.js" }, define: { __VERSION__: JSON.stringify(version) }, logLevel: "warning",
});
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", `${out}/chunks/pdf.worker.min.mjs`);
// credit the open-source parts bundled inside
const deps = ["three", "n8ao", "three-gpu-pathtracer", "three-mesh-bvh", "pdfjs-dist", "dxf-parser"];
let notice = "Roost Atelier bundles these open-source libraries. Their licences follow.\n\n";
for (const d of deps) {
  const pkg = JSON.parse(readFileSync(`node_modules/${d}/package.json`));
  const lic = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"].map((f) => `node_modules/${d}/${f}`).find((f) => { try { readFileSync(f); return true; } catch { return false; } });
  notice += `==== ${d} ${pkg.version} (${pkg.license}) ====\n${lic ? readFileSync(lic, "utf8") : pkg.license}\n\n`;
}
writeFileSync(`${out}/THIRD-PARTY-LICENSES.txt`, notice);
const sizes = Object.entries(res.metafile.outputs).filter(([f]) => f.endsWith(".js")).map(([f, o]) => [f.replace(out + "/", ""), Math.round(o.bytes / 1024)]);
for (const [f, k] of sizes.sort((a, b) => b[1] - a[1])) console.log(`${String(k).padStart(6)} KB  ${f}`);
