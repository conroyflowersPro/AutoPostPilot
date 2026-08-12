/**
 * Materialize full weekly-plan/index.ts from gzip+b64 parts.
 * Run in GitHub Actions on order1-seed-interpretation branch.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const PARTS_DIR = path.join(ROOT, "tools", "order1-index-parts");
const TARGET = path.join(ROOT, "supabase", "functions", "weekly-plan", "index.ts");
const EXPECTED_SHA256 = "c52b891d3fc9cd49c7d0bcc1cd6211b990334980c14f07521ee0ba25f2bec0a8";
const EXPECTED_SIZE = 28952;

function main() {
  if (!fs.existsSync(PARTS_DIR)) {
    console.error("parts dir missing", PARTS_DIR);
    process.exit(1);
  }
  const parts = fs
    .readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith(".b64"))
    .sort();
  if (parts.length === 0) {
    console.error("no parts");
    process.exit(1);
  }
  const b64 = parts.map((f) => fs.readFileSync(path.join(PARTS_DIR, f), "utf8").trim()).join("");
  const buf = zlib.gunzipSync(Buffer.from(b64, "base64"));
  if (buf.length !== EXPECTED_SIZE) {
    console.error("size mismatch", buf.length, "expected", EXPECTED_SIZE);
    process.exit(1);
  }
  const crypto = require("crypto");
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha !== EXPECTED_SHA256) {
    console.error("sha256 mismatch", sha, "expected", EXPECTED_SHA256);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, buf);
  console.log("OK wrote", TARGET, "size", buf.length, "sha256", sha);
}

main();
