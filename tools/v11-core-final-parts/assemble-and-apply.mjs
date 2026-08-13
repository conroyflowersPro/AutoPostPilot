#!/usr/bin/env node
/**
 * ONE-SHOT: reassemble FINAL CORE base64 parts only → verify SHA256 → write canonical paths.
 * New parts only (tools/v11-core-final-parts). Not old zip/core.* path.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.GITHUB_WORKSPACE || path.resolve(__dirname, '../..');
const partsDir = path.join(root, 'tools/v11-core-final-parts');
const manifest = JSON.parse(fs.readFileSync(path.join(partsDir, 'manifest.json'), 'utf8'));

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

let ok = true;
for (const [name, meta] of Object.entries(manifest)) {
  const bufs = [];
  for (const p of meta.parts) {
    const b64path = path.join(partsDir, p + '.b64');
    const rawpath = path.join(partsDir, p);
    let data;
    if (fs.existsSync(b64path)) {
      const b64 = fs.readFileSync(b64path, 'utf8').replace(/\s+/g, '');
      data = Buffer.from(b64, 'base64');
    } else if (fs.existsSync(rawpath)) {
      data = fs.readFileSync(rawpath);
    } else {
      console.error('MISSING', p);
      ok = false;
      continue;
    }
    bufs.push(data);
  }
  if (!bufs.length) continue;
  const data = Buffer.concat(bufs);
  const h = sha256(data);
  console.log(name, 'size', data.length, 'sha', h);
  if (h !== meta.sha256) {
    console.error('SHA MISMATCH', name, 'expected', meta.sha256, 'got', h);
    ok = false;
    continue;
  }
  const dest = path.join(root, meta.dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
  console.log('WROTE', meta.dest, data.length);
}
if (!ok) process.exit(1);
console.log('ALL CORE FILES APPLIED AND VERIFIED');
