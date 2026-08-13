#!/usr/bin/env node
/**
 * One-shot: assemble CORE index.ts parts into supabase/functions/weekly-plan/index.ts
 * and copy other CORE modules if present under tools/v11-core-direct/
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const partsDir = path.join(root, 'tools', 'v11-core-direct');
const destIndex = path.join(root, 'supabase', 'functions', 'weekly-plan', 'index.ts');
const partFiles = fs.readdirSync(partsDir).filter(f => /^p\d+\.txt$/.test(f)).sort();
if (partFiles.length < 1) {
  console.error('No index parts found in tools/v11-core-direct/');
  process.exit(1);
}
const assembled = partFiles.map(f => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('');
if (!assembled.includes('phased_v11_order8d_apply')) {
  console.error('Assembled index missing WEEKLY_ENGINE_VERSION phased_v11_order8d_apply');
  process.exit(1);
}
if (!assembled.includes('APP_VERSION = "11.0.0"')) {
  console.error('Assembled index missing APP_VERSION 11.0.0');
  process.exit(1);
}
fs.mkdirSync(path.dirname(destIndex), { recursive: true });
fs.writeFileSync(destIndex, assembled, 'utf8');
console.log('Wrote', destIndex, 'bytes', Buffer.byteLength(assembled, 'utf8'), 'parts', partFiles.length);

// optional sibling modules
for (const name of ['independent-post-generation.ts', 'semantic-judge.ts', 'seed-supply-expansion.ts']) {
  const src = path.join(partsDir, name);
  if (fs.existsSync(src)) {
    const dest = path.join(root, 'supabase', 'functions', 'weekly-plan', name);
    fs.copyFileSync(src, dest);
    console.log('Copied', name, 'bytes', fs.statSync(dest).size);
  }
}
console.log('OK');
