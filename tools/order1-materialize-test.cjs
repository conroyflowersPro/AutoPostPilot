const fs=require('fs');const path=require('path');
const d=__dirname;
const s=fs.readFileSync(path.join(d,'order1-test.b64.part1'),'utf8').trim()+fs.readFileSync(path.join(d,'order1-test.b64.part2'),'utf8').trim();
fs.writeFileSync(path.join(d,'order1-seed-interpretation-test.mjs'), Buffer.from(s,'base64'));
console.log('wrote test');
