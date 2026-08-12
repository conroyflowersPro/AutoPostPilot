const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const dir = path.join(__dirname, "order0a-final-blobs");
const map = {
  "index.ts.gz.b64": path.join(__dirname, "..", "supabase/functions/weekly-plan/index.ts"),
  "page.tsx.gz.b64": path.join(__dirname, "..", "app/generate/page.tsx"),
};
for (const [blob, dest] of Object.entries(map)) {
  const b64 = fs.readFileSync(path.join(dir, blob), "utf8");
  const buf = zlib.gunzipSync(Buffer.from(b64, "base64"));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log("materialized", dest, buf.length);
}
