const fs=require('fs');const path=require('path');const d=__dirname;
let s=''; for(let i=1;i<=12;i++) s+=fs.readFileSync(path.join(d,'o1s.'+i),'utf8').trim();
const buf=Buffer.from(s,'base64');
fs.writeFileSync(path.join(d,'..','supabase/functions/weekly-plan','seed-interpretation.ts'), buf);
console.log('wrote si', buf.length);
