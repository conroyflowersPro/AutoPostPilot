const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "order0a-final-parts");
function join(name, dest, n) {
  let s = "";
  for (let i = 1; i <= n; i++) {
    s += fs.readFileSync(path.join(dir, name + ".part" + i + ".txt"), "utf8");
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, s);
  console.log("assembled", dest, s.length);
}
join("index", path.join(__dirname, "..", "supabase/functions/weekly-plan/index.ts"), 3);
join("page", path.join(__dirname, "..", "app/generate/page.tsx"), 3);
