// Every word shown on screen has Arabic, Spanish, Russian and Chinese.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allWords, setLang, t, isRtl } from "../src/i18n.js";
const dir = fileURLToPath(new URL("../src/", import.meta.url));
const files = [...readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => dir + f), ...readdirSync(dir + "ai").filter((f) => f.endsWith(".js")).map((f) => dir + "ai/" + f)];
const keys = new Set();
for (const f of files) { if (f.endsWith("i18n.js")) continue; const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) keys.add(JSON.parse('"' + m[1] + '"'));
  for (const m of s.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) keys.add(m[1]);
  for (const m of s.matchAll(/\bt\(\s*`([^`$]*)`\s*\)/g)) keys.add(m[1]);
}
// names inside the data tables (shown through t(name))
const extra = new Set();
const grab = (file, re) => { const s = readFileSync(dir + file, "utf8"); for (const m of s.matchAll(re)) extra.add(m[1]); };
grab("furniture.js", /^\s{2}[a-z_0-9]+: \["([^"]+)", "/gm);
grab("furniture.js", /CATEGORIES = \[([^\]]+)\]/g);
grab("devices.js", /\[\s*"[a-z]+",\s*\{[^}]*\},\s*"([^"]+)",\s*"mdi/g);
grab("devices.js", /name: "([^"]+)"/g);
grab("devices.js", /: "((?:Always|On |Recessed|Pendant)[^"]*)"/g);
grab("model.js", /name: "([^"]+)"/g);
grab("materials.js", /: \["([^"]+)", (?:planks|tiles|flat|weave|grass|"#)/g);
grab("stairs.js", /: \["([^"]+)", \d/g);
grab("editor.js", /\["[^"\]]*", "([A-Z][^"]+)"\]/g);
grab("materials.js", /: \["([^"]+)", (?:stripes|trellis|damask|grasscloth|stone|tiles|null)/g);
grab("materials.js", /"#[0-9A-F]{6}": "([^"]+)"/g);
grab("lights.js", /\["[a-z]+", "([A-Z][^"]+)"\]/g);
grab("editor.js", /(?:select|room|door|window|slider|arch|furniture|devices|stairs): "([A-Z][^"]+)"/g);
const cats = [...extra].filter((x) => x.includes('"')); for (const c of cats) { extra.delete(c); for (const m of c.matchAll(/"([^"]+)"/g)) extra.add(m[1]); }
const LL = (() => { const s = readFileSync(dir + "devices.js", "utf8"); const i = s.indexOf("LIGHT_LOOKS"); const j = s.indexOf("};", i); return [...s.slice(i, j).matchAll(/: "([^"]+)"/g)].map((m) => m[1]); })();
for (const x of LL) extra.add(x);
const all = new Set([...keys, ...extra, "Language"]);
const W = allWords(); let bad = 0;
for (const [l, d] of Object.entries(W)) { const miss = [...all].filter((k) => !d[k]); if (miss.length) { bad++; console.error(`${l} is missing ${miss.length}:`, miss.slice(0, 20)); } }
for (const [l, d] of Object.entries(W)) for (const [k, v] of Object.entries(d)) { const n = (x) => (x.replace(/3D/g, "").match(/\d+/g) || []).join(","); if (n(k) !== n(v) && l !== "zh") { bad++; console.error(`${l}: numbers differ in "${k}" -> "${v}"`); } }
setLang("es-ES"); if (t("Save") !== "Guardar" || isRtl()) bad++;
setLang("zh-Hans"); if (t("Save") !== "保存") bad++;
setLang("ar"); if (!isRtl()) bad++;
setLang("fr"); if (t("Save") !== "Save") bad++;
if (bad) { console.error("language check failed"); process.exit(1); }
console.log(`languages ok: ${all.size} words in ${Object.keys(W).length} languages`);
