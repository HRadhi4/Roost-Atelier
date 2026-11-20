// The icon rule: every piece of furniture, light fitting, device kind and stair style has its own drawing, and
// every icon the app names exists in the set.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
globalThis.customElements ??= undefined;
const { ICON_NAMES } = await import("../src/icons.js");
const have = new Set(ICON_NAMES);
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const keys = (text, start) => { const i = text.indexOf(start), j = text.indexOf("\n};", i); return [...text.slice(i, j).matchAll(/^\s{2}"?([a-z_0-9]+)"?: \[/gm)].map((m) => m[1]); };
const missing = [];
for (const k of keys(src("furniture.js"), "export const LIBRARY = {")) if (k !== "stairs" && !have.has(`item:${k}`)) missing.push(`item:${k}`);
for (const k of keys(src("devices.js"), "export const LIGHT_SUBS = {")) if (!have.has(`light:${k}`)) missing.push(`light:${k}`);
for (const m of src("devices.js").matchAll(/^\s{2}([a-z]+): \{ name:/gm)) if (!have.has(`dev:${m[1]}`)) missing.push(`dev:${m[1]}`);
for (const k of keys(src("stairs.js"), "export const STAIR_STYLES = {")) if (!have.has(`stair:${k}`)) missing.push(`stair:${k}`);
const files = readdirSync(new URL("../src", import.meta.url)).filter((f) => f.endsWith(".js") && f !== "icons.js");
for (const f of files) for (const m of src(f).matchAll(/["`](mdi:[a-z0-9-]+)["`]/g)) if (!have.has(m[1])) missing.push(`${m[1]} (${f})`);
assert.deepEqual([...new Set(missing)], [], "these have no icon of their own yet: " + [...new Set(missing)].join(", "));
console.log(`icons: all passed (${have.size} icons)`);
