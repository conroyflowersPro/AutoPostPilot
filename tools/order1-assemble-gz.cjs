const fs=require('fs');const path=require('path');
const d=path.join(__dirname);
const a=fs.readFileSync(path.join(d,'order1-index.gz.b64.part1'),'utf8').trim();
const b=fs.readFileSync(path.join(d,'order1-index.gz.b64.part2'),'utf8').trim();
fs.writeFileSync(path.join(d,'order1-index.gz.b64'), a+b+'\n');
console.log('assembled', a.length+b.length);
