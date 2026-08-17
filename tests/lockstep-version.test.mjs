import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const versionTs = readFileSync("lib/version.ts", "utf8");
const weekly = readFileSync("supabase/functions/weekly-plan/index.ts", "utf8");
const readme = readFileSync("README.md", "utf8");
const changelog = readFileSync("CHANGELOG.md", "utf8");

const v = pkg.version;
assert.match(versionTs, new RegExp(`APP_VERSION = "${v}"`));
assert.match(weekly, new RegExp(`APP_VERSION = "${v}"`));
assert.match(readme, new RegExp(`\\*\\*${v}\\*\\*`));
assert.match(changelog, new RegExp(`## ${v} `));
console.log("lockstep-version ok", v);
