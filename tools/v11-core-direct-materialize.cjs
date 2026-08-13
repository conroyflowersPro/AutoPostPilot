#!/usr/bin/env node
/**
 * Assemble CORE index.ts from base64 parts in tools/v11-core-direct/iXX.b64
 * Optionally copy sibling modules if present as *.ts in the same dir.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const partsDir = path.join(root, 'tools', 'v11-core-direct');
const destIndex = path.join(root, 'supabase', 'functions', 'weekly-plan', 'index.ts');

const b64Files = fs.readdirSync(partsDir).filter(f => /^i\d+\.b64$/.test(f)).sort();
if (b64Files.length < 1) {
  console.error('No iXX.b64 index parts found');
  process.exit(1);
}
const joined = b64Files.map(f => fs.readFileSync(path.join(partsDir, f), 'utf8').replace(/\s+/g, '')).join('');
const assembled = Buffer.from(joined, 'base64').toString('utf8');
if (!assembled.includes('phased_v11_order8d_apply')) {
  console.error('Assembled index missing phased_v11_order8d_apply');
  process.exit(1);
}
if (!assembled.includes('APP_VERSION = "11.0.0"')) {
  console.error('Assembled index missing APP_VERSION 11.0.0');
  process.exit(1);
}
fs.mkdirSync(path.dirname(destIndex), { recursive: true });
fs.writeFileSync(destIndex, assembled, 'utf8');
console.log('Wrote', destIndex, 'bytes', Buffer.byteLength(assembled, 'utf8'), 'parts', b64Files.length);

for (const name of ['independent-post-generation.ts', 'semantic-judge.ts', 'seed-supply-expansion.ts']) {
  const src = path.join(partsDir, name);
  if (fs.existsSync(src)) {
    const dest = path.join(root, 'supabase', 'functions', 'weekly-plan', name);
    fs.copyFileSync(src, dest);
    console.log('Copied', name, 'bytes', fs.statSync(dest).size);
  }
}
console.log('OK');
