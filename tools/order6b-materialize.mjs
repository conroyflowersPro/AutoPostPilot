#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const patch = path.join(root, "tools/order6b-index.patch");
const target = path.join(root, "supabase/functions/weekly-plan/index.ts");
if (!existsSync(patch)) {
  console.error("missing patch", patch);
  process.exit(1);
}
try {
  execSync(`patch -p1 --forward < ${patch}`, { cwd: root, stdio: "inherit" });
} catch (e) {
  const t = readFileSync(target, "utf8");
  if (t.includes("decideNaturalHumor") && t.includes("10.0.0-order6b")) {
    console.log("patch already applied");
  } else {
    throw e;
  }
}
const t = readFileSync(target, "utf8");
console.log("index size", t.length);
console.log("has humor", t.includes("decideNaturalHumor"));
console.log("app", (t.match(/APP_VERSION = "[^"]+"/) || [])[0]);
