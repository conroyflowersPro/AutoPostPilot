const fs=require('fs');const path=require('path');
const d=__dirname;
let s='';
for (let i=1;i<=4;i++) s+=fs.readFileSync(path.join(d,'order1-si.b64.part'+i),'utf8').trim();
const buf=Buffer.from(s,'base64');
const out=path.join(d,'..','supabase/functions/weekly-plan','seed-interpretation.ts');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out, buf);
console.log('wrote si', out, buf.length);
