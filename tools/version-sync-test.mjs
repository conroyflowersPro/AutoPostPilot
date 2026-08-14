#!/usr/bin/env node
/**
 * User-facing version must stay in lockstep so the operator can trust the badge.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const ver = readFileSync(path.join(ROOT, "lib/version.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const shell = readFileSync(path.join(ROOT, "app/components/AppShell.tsx"), "utf8");
const log = readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log("  PASS ", name);
  } else {
    fail++;
    console.log("  FAIL ", name);
  }
}

const pkgV = String(pkg.version || "");
const libM = ver.match(/export const APP_VERSION = "([^"]+)"/);
const libV = libM ? libM[1] : "";
const edgeM = ix.match(/const APP_VERSION = "([^"]+)"/);
const edgeV = edgeM ? edgeM[1] : "";

console.log("User-facing version lockstep");
ok("V1. package.json version", /^\d+\.\d+\.\d+$/.test(pkgV));
ok("V2. lib/version.ts matches package.json", libV === pkgV);
ok("V3. weekly-plan APP_VERSION matches package.json", edgeV === pkgV);
ok("V4. CHANGELOG has this version heading", log.includes(`## ${pkgV}`));
ok("V5. VERSION_SUMMARY_KO present", /export const VERSION_SUMMARY_KO/.test(ver));
ok("V6. AppShell shows VersionBadge", /VersionBadge/.test(shell));
ok("V7. BUILD_STAMP is APP_VERSION", /export const BUILD_STAMP = APP_VERSION/.test(ver));

console.log("========================================");
console.log(`VERSION: ${pass} PASS / ${fail} FAIL (shipping ${pkgV})`);
process.exit(fail ? 1 : 0);
