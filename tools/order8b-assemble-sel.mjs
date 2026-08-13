import fs from "fs";
const parts = [
  "tools/order8b-hotfix-selts.aa",
  "tools/order8b-hotfix-selts.bb",
  "tools/order8b-hotfix-selts.cc",
];
const out = "supabase/functions/weekly-plan/selective-regeneration.ts";
const body = parts.map((p) => fs.readFileSync(p, "utf8")).join("");
fs.mkdirSync("supabase/functions/weekly-plan", { recursive: true });
fs.writeFileSync(out, body);
console.log("assembled", out, body.length);
if (!body.includes("executeSelectiveRegeneration")) process.exit(1);
if (body.includes("PLACEHOLDER")) process.exit(2);
