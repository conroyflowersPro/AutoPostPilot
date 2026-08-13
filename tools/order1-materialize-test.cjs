const fs=require('fs');const path=require('path');const d=__dirname;
let s=''; for(let i=1;i<=4;i++) s+=fs.readFileSync(path.join(d,'o1t.'+i),'utf8').trim();
fs.writeFileSync(path.join(d,'order1-seed-interpretation-test.mjs'), Buffer.from(s,'base64'));
console.log('wrote test');
