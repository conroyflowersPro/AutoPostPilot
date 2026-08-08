"use client";

import { useState } from "react";

type DiagnosticReport = {
  generatedAt?: string;
  inventory?: {
    totalNormalizedRecords?: number;
    earliestPublishedAt?: string | null;
    latestPublishedAt?: string | null;
  };
  activityCounts?: {
    total?: number;
    creatorPublishing?: number;
    socialInteraction?: number;
    redistribution?: number;
    byPostType?: Record<string, number>;
  };
  verdicts?: string[];
  verdictRationale?: string[];
  snapshotStats?: {
    totalSnapshots?: number;
    postsWithAtLeastOne?: number;
    avgSnapshotsPerPost?: number | null;
  };
  familyCoverage?: Array<{
    family: string;
    population: string;
    eligible: number;
    usable: number;
    coveragePct: number | null;
    status: string;
  }>;
  creatorPublishingCoverage?: Array<{
    metricKey: string;
    present: number;
    missing: number;
    zero: number;
    nonZero: number;
    coveragePct: number | null;
  }>;
  dataQuality?: Array<{ code: string; message: string }>;
};

export default function PerformanceCoverageButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setRawJson(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/learning/performance-coverage");
      const data = await res.json().catch(() => ({}));
      const t1 = performance.now();
      setDurationMs(Math.round(t1 - t0));
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : `요청 실패 (${res.status})`
        );
        return;
      }
      setHandle(data.handle || null);
      setReport(data.report || null);
      setRawJson(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copyJson() {
    if (!rawJson) return;
    void navigator.clipboard.writeText(rawJson);
  }

  const ac = report?.activityCounts;
  const inv = report?.inventory;

  return (
    <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium hover:bg-amber-500 disabled:opacity-50"
      >
        {busy ? "진단 중… (최대 ~60s)" : "Performance Coverage 진단"}
      </button>

      {error && (
        <p className="max-w-[18rem] text-right text-[10px] text-red-400">{error}</p>
      )}

      {report && (
        <div className="w-full min-w-[14rem] max-w-md rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-left text-xs">
          <div className="mb-1 font-medium text-amber-300">
            Performance Evidence {handle ? `· @${handle}` : ""}
          </div>
          <div className="space-y-0.5 text-zinc-200">
            <div>
              records:{" "}
              <span className="font-semibold text-white">
                {inv?.totalNormalizedRecords ?? "—"}
              </span>
            </div>
            <div>
              creator publishing:{" "}
              <span className="font-semibold text-white">
                {ac?.creatorPublishing ?? "—"}
              </span>
            </div>
            <div>
              reply / repost: {ac?.socialInteraction ?? "—"} /{" "}
              {ac?.redistribution ?? "—"}
            </div>
            <div>
              snapshots: {report.snapshotStats?.totalSnapshots ?? "—"} (posts w/
              snap {report.snapshotStats?.postsWithAtLeastOne ?? "—"})
            </div>
            <div className="text-[10px] text-zinc-400">
              range: {inv?.earliestPublishedAt?.slice(0, 10) || "—"} →{" "}
              {inv?.latestPublishedAt?.slice(0, 10) || "—"}
            </div>
            <div className="pt-1 text-amber-200">
              verdict:{" "}
              <span className="font-semibold">
                {(report.verdicts || []).join(", ") || "—"}
              </span>
            </div>
            {durationMs != null && (
              <div className="text-[10px] text-zinc-500">{durationMs} ms</div>
            )}
          </div>
          {(report.verdictRationale || []).length > 0 && (
            <ul className="mt-1 list-disc pl-3 text-[10px] text-zinc-400">
              {report.verdictRationale!.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyJson}
              className="text-[10px] text-amber-400 underline"
            >
              JSON 전체 복사
            </button>
          </div>
          {rawJson && (
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-950/80 p-2 text-[9px] leading-tight text-zinc-400">
              {rawJson}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
