const fs=require("fs");const path=require("path");const zlib=require("zlib");const crypto=require("crypto");
const ROOT=path.join(__dirname,"..");
const PARTS=path.join(ROOT,"tools/order4-parts");
const TARGET=path.join(ROOT,"supabase/functions/weekly-plan/audience-reaction-intelligence.ts");
const EXPECT_SHA="ad89180c245ee6156dce4c354009a9457edf1b2132b3878086eedc8e9172d88b";
const EXPECT_SIZE=25456;
const files=fs.readdirSync(PARTS).filter(f=>f.startsWith("audience-reaction-intelligence.ts.p")&&f.endsWith(".b64")).sort();
let b64=""; for(const f of files) b64+=fs.readFileSync(path.join(PARTS,f),"utf8").trim();
const buf=zlib.gunzipSync(Buffer.from(b64,"base64"));
const sha=crypto.createHash("sha256").update(buf).digest("hex");
if(buf.length!==EXPECT_SIZE||sha!==EXPECT_SHA){console.error("MISMATCH",buf.length,sha);process.exit(1);}
const text=buf.toString("utf8");
for(const r of ["ORDER4_VERSION","analyzePublishedPostAudience","ORDER4_NO_TOPIC_MECHANISM_MAP","audienceEvidenceMayBecomeSeed"]) {
  if(!text.includes(r)){console.error("MISSING",r);process.exit(1);}
}
fs.mkdirSync(path.dirname(TARGET),{recursive:true});
fs.writeFileSync(TARGET,buf);
console.log("MATERIALIZED",TARGET,buf.length,sha);
