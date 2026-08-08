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
  text_integrity: { null_text: number; empty_text: number };
  source_tables: string[];
  missing_value_policy: string;
  known_limitations: string[];
  populations: Record<string, string>;
};

async function fetchAllPopulation(population: string) {
  const records: unknown[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `/api/learning/evidence-export?population=${population}&offset=${offset}&limit=500`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const body = await res.json();
    records.push(...(body.records || []));
    if (body.next_offset == null) break;
    offset = body.next_offset;
  }
  return records;
}

function toJsonl(records: unknown[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const README = `# AutoPostPilot X Evidence Export for ChatGPT

## What this is
Raw / normalized Production X evidence for independent analysis.
No Grok scores, no success labels, no invented metrics.

## Files
- autopostpilot_export_manifest.json — dataset inventory & policy
- autopostpilot_creator_publishing.jsonl — ORIGINAL + QUOTE (one JSON object per line)
- autopostpilot_replies.jsonl — REPLY
- autopostpilot_mentions_reposts.jsonl — MENTION + REPOST

## Field notes
- text: original Creator text (unmodified)
- public_metrics / organic_metrics / non_public_metrics: separate objects; absent family = null
- missing ≠ 0: absent keys are omitted; present zeros remain as 0
- snapshot_count / latest_snapshot_at: temporal observation metadata
- media: presence/type/keys only (no binary files)

## Populations
- Creator Publishing = ORIGINAL + QUOTE only
- REPLY is a separate social-interaction population
- Do not mix REPLY metrics into Creator Publishing baselines

## Known limitations
See manifest.known_limitations
`;

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
        throw new Error(err.error || `manifest HTTP ${mRes.status}`);
      }
      const manifest: Manifest = await mRes.json();

      setMsg("creator_publishing…");
      const cp = await fetchAllPopulation("creator_publishing");
      setMsg("replies…");
      const replies = await fetchAllPopulation("replies");
      setMsg("mentions_reposts…");
      const mr = await fetchAllPopulation("mentions_reposts");

      downloadText(
        "autopostpilot_export_manifest.json",
        JSON.stringify(manifest, null, 2),
        "application/json"
      );
      downloadText(
        "autopostpilot_creator_publishing.jsonl",
        toJsonl(cp),
        "application/x-ndjson"
      );
      downloadText(
        "autopostpilot_replies.jsonl",
        toJsonl(replies),
        "application/x-ndjson"
      );
      downloadText(
        "autopostpilot_mentions_reposts.jsonl",
        toJsonl(mr),
        "application/x-ndjson"
      );
      downloadText(
        "README_CHATGPT_ANALYSIS.md",
        README,
        "text/markdown"
      );

      setMsg(
        `완료: CP ${cp.length} / REPLY ${replies.length} / M+R ${mr.length} / total≈${manifest.total_records}`
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
