const fs=require('fs');const path=require('path');const d=__dirname;
let s=''; for(let i=1;i<=12;i++) s+=fs.readFileSync(path.join(d,'o1i.'+i),'utf8').trim();
fs.writeFileSync(path.join(d,'order1-index.gz.b64'), s+'\n');
console.log('assembled', s.length);
