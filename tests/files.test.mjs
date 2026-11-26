// Every file the panel and the card load must be part of the release.
// Starts at the entry file, follows every import (static, dynamic and workers) and fails if one of them is
// missing on disk or not committed to git. Also lists built files nothing loads any more, so they can be removed.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const dir = "custom_components/roost_atelier/frontend";
const entry = "roost-atelier.js";
let tracked = null;
try { tracked = new Set(execSync(`git ls-files -- ${dir}`, { encoding: "utf8" }).split("\n").filter(Boolean)); } catch (e) { /* not a git checkout */ }

const seen = new Set(), missing = [], untracked = [];
const visit = (rel) => {
  if (seen.has(rel)) return; seen.add(rel);
  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) { missing.push(rel); return; }
  if (tracked && !tracked.has(file)) untracked.push(rel);
  if (!/\.(m?js)$/.test(rel)) return;
  const src = fs.readFileSync(file, "utf8");
  const refs = new Set();
  for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*|import\s*|new URL\(\s*)["'](\.{1,2}\/[^"']+?\.(?:m?js|wasm|json))["']/g)) refs.add(m[1]);
  for (const r of refs) visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), r)));
};
visit(entry);

let fails = 0;
if (missing.length) { fails++; console.error(`FAIL files the panel loads are missing:\n  ${missing.join("\n  ")}\n  Run npm run build.`); }
if (untracked.length) { fails++; console.error(`FAIL files the panel loads are not committed, so they would not be in the release:\n  ${untracked.join("\n  ")}\n  git add ${dir}`); }
const all = fs.readdirSync(path.join(dir, "chunks")).map((f) => `chunks/${f}`);
const unused = all.filter((f) => !seen.has(f) && /\.js$/.test(f) && !/worker/.test(f));
if (unused.length) console.log(`note: built files nothing loads: ${unused.join(", ")}`);
console.log(fails ? `files: ${fails} failed` : `files: all ${seen.size} files the panel loads are present and committed`);
process.exit(fails ? 1 : 0);
