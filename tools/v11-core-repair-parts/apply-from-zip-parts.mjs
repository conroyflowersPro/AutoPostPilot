#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const PARTS = path.join(__dirname);
const ROOT = path.resolve(__dirname, '../..');
const meta = JSON.parse(fs.readFileSync(path.join(PARTS, 'zip-manifest.json'), 'utf8'));
let b64 = '';
for (let i = 0; i < meta.parts; i++) {
  const f = path.join(PARTS, `zip.b64.${String(i).padStart(2,'0')}`);
  if (!fs.existsSync(f)) throw new Error('missing ' + f);
  b64 += fs.readFileSync(f, 'utf8').trim();
}
const buf = Buffer.from(b64, 'base64');
const sha = crypto.createHash('sha256').update(buf).digest('hex');
if (sha !== meta.sha256) throw new Error('zip sha mismatch ' + sha);
fs.writeFileSync('/tmp/core-repair.zip', buf);
execSync('unzip -o /tmp/core-repair.zip -d /tmp/cr', {stdio:'inherit'});
const src = '/tmp/cr/AutoPostPilot-v11.0.0-CORE-REPAIR';
const copies = [
  ['app/generate/page.tsx', 'app/generate/page.tsx'],
  ['supabase/functions/weekly-plan/index.ts', 'supabase/functions/weekly-plan/index.ts'],
  ['supabase/functions/weekly-plan/independent-post-generation.ts', 'supabase/functions/weekly-plan/independent-post-generation.ts'],
  ['supabase/functions/weekly-plan/semantic-judge.ts', 'supabase/functions/weekly-plan/semantic-judge.ts'],
  ['supabase/functions/weekly-plan/selective-regeneration.ts', 'supabase/functions/weekly-plan/selective-regeneration.ts'],
  ['supabase/functions/weekly-plan/regeneration-router.ts', 'supabase/functions/weekly-plan/regeneration-router.ts'],
];
for (const [a,b] of copies) {
  fs.copyFileSync(path.join(src,a), path.join(ROOT,b));
  console.log('copied', b, fs.statSync(path.join(ROOT,b)).size);
}
const idx = fs.readFileSync(path.join(ROOT,'supabase/functions/weekly-plan/index.ts'),'utf8');
if (!idx.includes('phased_v11_order8d_apply')) throw new Error('engine marker missing');
console.log('APPLY_OK');
