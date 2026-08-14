#!/usr/bin/env node
/**
 * v11 CORE-REPAIR assemble: reconstruct files from tools/v11-core-repair-parts
 * and write to repo paths. Verify SHA256 against manifest.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PARTS = path.join(ROOT, 'tools', 'v11-core-repair-parts');
const manifest = JSON.parse(fs.readFileSync(path.join(PARTS, 'manifest.json'), 'utf8'));

let ok = 0;
for (const entry of manifest) {
  let b64 = '';
  for (let i = 0; i < entry.parts; i++) {
    const pn = path.join(PARTS, `${entry.part_prefix}${String(i).padStart(2, '0')}`);
    if (!fs.existsSync(pn)) throw new Error('missing part ' + pn);
    b64 += fs.readFileSync(pn, 'utf8').trim();
  }
  const buf = Buffer.from(b64, 'base64');
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== entry.sha256) {
    throw new Error(`SHA mismatch ${entry.name}: got ${sha} expected ${entry.sha256}`);
  }
  if (buf.length !== entry.size) {
    throw new Error(`size mismatch ${entry.name}: got ${buf.length} expected ${entry.size}`);
  }
  const dest = path.join(ROOT, entry.repo_path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log('OK', entry.repo_path, buf.length, sha.slice(0, 16));
  ok++;
}
console.log(`ASSEMBLED ${ok}/${manifest.length}`);
