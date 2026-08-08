"use client";

import { useState } from "react";

type Manifest = {
  export_version: string;
  generated_at: string;
  handle: string;
  historical_start: string | null;
  historical_end: string | null;
  total_records: number;
  counts_by_type: Record<string, number>;
  creator_publishing: number;
  public_metric_available: number;
  organic_metric_available: number;
  non_public_metric_available: number;
  snapshot_count: number;
  text_integrity: {
    null_text: number;
    empty_text: number;
    duplicate_x_post_id?: number;
  };
  source_tables: string[];
  missing_value_policy: string;
  known_limitations: string[];
  populations: Record<string, string>;
  expected_reconciliation?: Record<string, number>;
};

const README = `# AutoPostPilot X Evidence Export for ChatGPT

## What this is
Raw / normalized Production X evidence for **independent** analysis.
No Grok scores, no success labels, no invented metrics.

## Files
- \`autopostpilot_export_manifest.json\` — dataset inventory & policy
- \`autopostpilot_creator_publishing.jsonl\` — ORIGINAL + QUOTE (one JSON object per line)
- \`autopostpilot_replies.jsonl\` — REPLY
- \`autopostpilot_mentions_reposts.jsonl\` — MENTION + REPOST
- \`README_CHATGPT_ANALYSIS.md\` — this file

## Field notes
- \`text\`: original Creator text (unmodified)
- \`public_metrics\` / \`organic_metrics\` / \`non_public_metrics\`: separate objects; absent family = null
- **missing ≠ 0**: absent keys are omitted; present zeros remain as 0
- \`snapshot_count\` / \`latest_snapshot_at\`: temporal observation metadata
- \`media\`: presence/type/keys only (no binary files)

## Populations
- Creator Publishing = ORIGINAL + QUOTE only
- REPLY is a separate social-interaction population
- Do not mix REPLY metrics into Creator Publishing baselines

## Known limitations
See \`manifest.known_limitations\`
`;

async function fetchAllPopulation(population: string) {
  const records: unknown[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `/api/learning/evidence-export?population=${encodeURIComponent(
        population
      )}&offset=${offset}&limit=500`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ||
          `${population} HTTP ${res.status}`
      );
    }
    const body = await res.json();
    records.push(...(body.records || []));
    if (body.next_offset == null) break;
    offset = body.next_offset as number;
  }
  return records;
}

function toJsonl(records: unknown[]): string {
  if (!records.length) return "";
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

/** CRC32 for ZIP (store method, no compression) */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}
function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Minimal ZIP writer (store only) — one download, multi-file. */
function buildZip(files: { name: string; content: string }[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = encodeUtf8(f.name);
    const data = encodeUtf8(f.content);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDir = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  const zipBytes = concat([...localParts, centralDir, end]);
  return new Blob([zipBytes], { type: "application/zip" });
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function assertReconciliation(manifest: Manifest) {
  const expected = manifest.expected_reconciliation || {
    total: 3839,
    ORIGINAL: 380,
    QUOTE: 328,
    REPLY: 2026,
    REPOST: 276,
    MENTION: 829,
    creator_publishing: 708,
  };
  const issues: string[] = [];
  if (manifest.total_records !== expected.total) {
    issues.push(
      `total ${manifest.total_records} ≠ expected ${expected.total}`
    );
  }
  for (const k of ["ORIGINAL", "QUOTE", "REPLY", "REPOST", "MENTION"] as const) {
    const got = manifest.counts_by_type?.[k] ?? -1;
    const exp = expected[k];
    if (got !== exp) issues.push(`${k} ${got} ≠ expected ${exp}`);
  }
  if (manifest.creator_publishing !== expected.creator_publishing) {
    issues.push(
      `creator_publishing ${manifest.creator_publishing} ≠ expected ${expected.creator_publishing}`
    );
  }
  return issues;
}

export default function EvidenceExportButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg("manifest…");
    try {
      const mRes = await fetch("/api/learning/evidence-export?manifest=1");
      if (!mRes.ok) {
        const err = await mRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || `manifest HTTP ${mRes.status}`
        );
      }
      const manifest: Manifest = await mRes.json();

      setMsg("creator_publishing…");
      const cp = await fetchAllPopulation("creator_publishing");
      setMsg("replies…");
      const replies = await fetchAllPopulation("replies");
      setMsg("mentions_reposts…");
      const mr = await fetchAllPopulation("mentions_reposts");

      const reconIssues = assertReconciliation(manifest);
      const lengthIssues: string[] = [];
      const cpExpected =
        (manifest.counts_by_type?.ORIGINAL || 0) +
        (manifest.counts_by_type?.QUOTE || 0);
      if (cp.length !== cpExpected) {
        lengthIssues.push(`CP files ${cp.length} ≠ ORIGINAL+QUOTE ${cpExpected}`);
      }
      if (replies.length !== (manifest.counts_by_type?.REPLY || 0)) {
        lengthIssues.push(
          `REPLY files ${replies.length} ≠ ${manifest.counts_by_type?.REPLY}`
        );
      }
      const mrExpected =
        (manifest.counts_by_type?.MENTION || 0) +
        (manifest.counts_by_type?.REPOST || 0);
      if (mr.length !== mrExpected) {
        lengthIssues.push(`M+R files ${mr.length} ≠ ${mrExpected}`);
      }

      const allIssues = [...reconIssues, ...lengthIssues];
      if (allIssues.length) {
        throw new Error("Reconciliation failed: " + allIssues.join("; "));
      }

      const sum = cp.length + replies.length + mr.length;
      if (sum !== manifest.total_records) {
        throw new Error(
          `Population sum ${sum} ≠ total_records ${manifest.total_records}`
        );
      }

      setMsg("building zip…");
      const zip = buildZip([
        {
          name: "autopostpilot_export_manifest.json",
          content: JSON.stringify(manifest, null, 2),
        },
        {
          name: "autopostpilot_creator_publishing.jsonl",
          content: toJsonl(cp),
        },
        {
          name: "autopostpilot_replies.jsonl",
          content: toJsonl(replies),
        },
        {
          name: "autopostpilot_mentions_reposts.jsonl",
          content: toJsonl(mr),
        },
        {
          name: "README_CHATGPT_ANALYSIS.md",
          content: README,
        },
      ]);

      downloadBlob("AutoPostPilot_ChatGPT_Evidence_Export_v1.zip", zip);
      setMsg(
        `ZIP 완료 · total ${manifest.total_records} · CP ${cp.length} · REPLY ${replies.length} · M+R ${mr.length}`
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
      >
        {busy ? "Exporting…" : "ChatGPT Evidence Export"}
      </button>
      {msg && (
        <span className="max-w-xs text-right text-xs text-slate-400">{msg}</span>
      )}
    </div>
  );
}
