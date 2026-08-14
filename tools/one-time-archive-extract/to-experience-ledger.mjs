#!/usr/bin/env node
/**
 * Convert one-time archive extract output → v11 experience ledger JSON.
 * Does NOT train 말투. Dated lived episodes only (what / where / version / as_of).
 *
 * Usage (after extract.mjs):
 *   node to-experience-ledger.mjs --input "./output" --out "./experience-ledger.json"
 *
 * Then drop experience-ledger.json into:
 *   supabase/functions/weekly-plan/experience-ledger.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

const EXPERIENCE_SIGNAL =
  /직접|해봤|타\s*보|충전했|직관|갔었|경험|체감|쓰다\s*보|운전했|사용\s*중|내\s*(차|기록|세션)|오늘\s*(충전|주행|직관)|어제|이번\s*주.*(충전|주행|직관|게임)/i;
const HISTORICAL_SIGNAL =
  /fsd\s*v1[0-2]|v10|v11|v12|예전|과거|당시|옛날|이전\s*버전|그\s*시절/i;

function clusterFromText(text) {
  const t = String(text || "").toLowerCase();
  if (/fsd|자율|합류|공사|보행/.test(t)) return "FSD";
  if (/cyber|사이버|충전|적재|슈퍼차저/.test(t)) return "CYBERTRUCK";
  if (/robotaxi|로보|커브|승하차/.test(t)) return "ROBOTAXI";
  if (/lafc|bmo|직관|경기/.test(t)) return "LAFC";
  if (/게임|컨트롤러/.test(t)) return "GAMING";
  if (/\bai\b|그록|프롬프트/.test(t)) return "AI_TECH";
  return "DAILY";
}

function loadJsonl(dir) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl") || f.includes("publishing"));
  const rows = [];
  for (const f of files) {
    const raw = readFileSync(join(dir, f), "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        /* skip */
      }
    }
  }
  return rows;
}

const input = arg("--input", "./output");
const outPath = arg("--out", "./experience-ledger.json");
const rows = loadJsonl(input);
const seen = new Set();
const ledger = [];

for (const row of rows) {
  const text = String(row.text || row.full_text || row.body || "").trim();
  if (text.length < 20) continue;
  if (!EXPERIENCE_SIGNAL.test(text) && !HISTORICAL_SIGNAL.test(text)) continue;
  const asOf = row.published_at || row.created_at || row.as_of || null;
  const cls = HISTORICAL_SIGNAL.test(text) ? "HISTORICAL" : "TIMELESS";
  const subject = text.replace(/\s+/g, " ").slice(0, 80);
  const key = `${cls}|${subject}`;
  if (seen.has(key)) continue;
  seen.add(key);
  ledger.push({
    cluster: clusterFromText(text),
    dimension: "LIVED",
    concrete_subject: subject,
    experience_class: cls,
    provenance: cls === "HISTORICAL" ? "ARCHIVE_HISTORICAL" : "ARCHIVE_TIMELESS",
    creator_evidence_available: true,
    experience_required: true,
    historical_framing_required: cls === "HISTORICAL",
    source_ref: row.x_post_id || row.id || undefined,
    published_at: asOf || undefined,
    as_of: asOf || undefined,
    seed_eligible: false,
    claim_class: "LIVED",
  });
}

writeFileSync(outPath, JSON.stringify(ledger, null, 2));
console.log(`wrote ${ledger.length} ledger rows → ${outPath}`);
console.log("Copy to supabase/functions/weekly-plan/experience-ledger.json after operator consent.");
