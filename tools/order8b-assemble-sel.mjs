import fs from "fs";
const parts = [
  "tools/order8b-hotfix-selts.aa",
  "tools/order8b-hotfix-selts.bb",
  "tools/order8b-hotfix-selts.cc",
];
const out = "supabase/functions/weekly-plan/selective-regeneration.ts";
fs.writeFileSync(out, parts.map((p) => fs.readFileSync(p, "utf8")).join(""));
console.log("assembled", fs.statSync(out).size);
if (!fs.readFileSync(out, "utf8").includes("executeSelectiveRegeneration")) {
  console.error("missing executeSelectiveRegeneration");
  process.exit(1);
}
