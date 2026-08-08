"use client";

import { useCallback, useEffect, useState } from "react";

type BatchPayload = {
  success?: boolean;
  runId?: string | null;
  status?: string;
  phase?: string;
  batchPagesFetched?: number;
  totalPagesFetched?: number;
  totalPostsCollected?: number;
  totalMentionsCollected?: number;
  shouldContinue?: boolean;
  retryAfterSeconds?: number | null;
  endReason?: string | null;
  error?: string | null;
  messageKo?: string;
  earliestDate?: string | null;
  latestDate?: string | null;
  version?: string;
};

export default function CollectMaxButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchPayload | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/x/collect/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.active && data.run) {
        setProgress({
          runId: data.run.id,
          status: data.run.run_status,
          phase: data.run.phase,
          totalPagesFetched: data.run.pages_fetched,
          totalPostsCollected: data.run.posts_discovered,
          totalMentionsCollected: data.run.mentions_discovered,
          shouldContinue: !["COMPLETE", "CANCELLED", "FAILED_FATAL", "PAUSED"].includes(
            String(data.run.run_status)
          ),
          earliestDate: data.run.earliest_post_at,
          latestDate: data.run.latest_post_at,
          endReason: data.run.end_reason,
        });
        setMsg(
          `이전 진행: ${data.run.run_status} / ${data.run.phase} / posts ${data.run.posts_discovered ?? 0}`
        );
      }
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runOneBatch(): Promise<BatchPayload> {
    const res = await fetch("/api/x/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPagesPerBatch: 2, includeMentions: true }),
    });
    const data = (await res.json().catch(() => ({}))) as BatchPayload;
    if (!res.ok && res.status === 504) {
      return {
        shouldContinue: true,
        status: "FAILED_RETRYABLE",
        error: "504",
        messageKo: "타임아웃 — 체크포인트에서 재시도",
      };
    }
    return data;
  }

  async function runCollect() {
    if (busy) return;
    setBusy(true);
    setMsg("배치 수집 시작… (v5.5.8)");
    try {
      let guard = 0;
      let last: BatchPayload = {};
      while (guard < 100) {
        guard += 1;
        last = await runOneBatch();
        setProgress(last);
        setMsg(
          last.messageKo ||
            `${last.phase} · p${last.totalPagesFetched ?? 0} · posts ${last.totalPostsCollected ?? 0}`
        );
        console.log("Phase1A batch", last);

        if (last.status === "RATE_LIMITED") {
          const wait = (last.retryAfterSeconds || 60) * 1000;
          setMsg(`Rate limit — ${last.retryAfterSeconds || 60}초 대기…`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (!last.shouldContinue) break;
        await new Promise((r) => setTimeout(r, 400));
      }

      try {
        await navigator.clipboard.writeText(JSON.stringify(last, null, 2));
      } catch {
        /* */
      }

      if (last.status === "COMPLETE") {
        setMsg(
          `완료 · posts ${last.totalPostsCollected} · mentions ${last.totalMentionsCollected}`
        );
      } else if (last.status === "PAUSED") {
        setMsg(`일시정지 · ${last.error || ""} — X 재연결 후 다시`);
      } else {
        setMsg(
          `중단 · ${last.status} · ${last.error || last.endReason || ""} (DB 저장됨)`
        );
      }
    } catch (e: unknown) {
      setMsg(`에러: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const label =
    progress?.status && !["COMPLETE", "CANCELLED"].includes(progress.status)
      ? "이어서 수집"
      : "Phase1A 최대 수집";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={runCollect}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "수집 중…" : label}
      </button>
      {msg && (
        <p className="max-w-[16rem] text-right text-[10px] leading-snug text-zinc-400">
          {msg}
        </p>
      )}
    </div>
  );
}
