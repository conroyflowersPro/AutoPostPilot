const fs=require("fs"),path=require("path"),zlib=require("zlib"),crypto=require("crypto");
const ROOT=path.join(__dirname,"..");
const PARTS=path.join(ROOT,"tools","order2-parts");
const MANIFEST=JSON.parse(fs.readFileSync(path.join(ROOT,"tools","order2-manifest.json"),"utf8"));
for(const item of MANIFEST){
  const files=fs.readdirSync(PARTS).filter(f=>f.startsWith(item.prefix+".p")&&f.endsWith(".b64")).sort();
  if(files.length!==item.parts){console.error("parts",item.path,files.length,item.parts);process.exit(1);}
  const b64=files.map(f=>fs.readFileSync(path.join(PARTS,f),"utf8").trim()).join("");
  const buf=zlib.gunzipSync(Buffer.from(b64,"base64"));
  const sha=crypto.createHash("sha256").update(buf).digest("hex");
  if(sha!==item.sha256||buf.length!==item.size){console.error("integrity",item.path,sha,buf.length);process.exit(1);}
  const target=path.join(ROOT,item.path);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,buf);
  console.log("OK",item.path,buf.length,sha);
}
