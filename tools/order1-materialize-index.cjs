const fs=require('fs');const path=require('path');const zlib=require('zlib');
const d=__dirname; const root=path.join(d,'..');
const b64=fs.readFileSync(path.join(d,'order1-index.gz.b64'),'utf8').trim();
const buf=zlib.gunzipSync(Buffer.from(b64,'base64'));
fs.writeFileSync(path.join(root,'supabase/functions/weekly-plan/index.ts'), buf);
console.log('wrote index', buf.length);
