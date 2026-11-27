// Look rules that must not come back: text is never cut off with "…" (boxes grow or the words wrap instead).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../src/", import.meta.url);
const bad = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  const s = readFileSync(new URL(f, dir), "utf8");
  for (const [re, what] of [[/text-overflow\s*:\s*ellipsis/g, "text-overflow:ellipsis"], [/line-clamp/g, "line-clamp"], [/\.slice\(0,\s*\d+\)\s*\+\s*["'`]…/g, "cut-off text with …"]])
    for (const m of s.matchAll(re)) bad.push(`${f}: ${what} at ${s.slice(0, m.index).split("\n").length}`);
}
assert.deepEqual(bad, [], "text must never be cut off:\n" + bad.join("\n"));
console.log("style: all passed");
