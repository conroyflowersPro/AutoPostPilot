"use client";

import { useCallback, useEffect, useState } from "react";

type BatchPayload = {
  success?: boolean;
  runId?: string | null;
  status?: string;
  phase?: string;
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
};

type StatusRun = {
  id?: string;
  run_status?: string;
  phase?: string;
  pages_fetched?: number;
  posts_discovered?: number;
  mentions_discovered?: number;
  earliest_post_at?: string | null;
  latest_post_at?: string | null;
  end_reason?: string | null;
};

export default function CollectMaxButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [run, setRun] = useState<StatusRun | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/x/collect/status");
      if (!res.ok) {
        setMsg(`상태 조회 실패 (${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.run) {
        setRun(data.run);
        setMsg(null);
      } else {
        setRun(null);
        setMsg("아직 수집 기록 없음");
      }
    } catch (e: unknown) {
      setMsg(`상태 오류: ${e instanceof Error ? e.message : String(e)}`);
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
        messageKo: "타임아웃 — 이어서 재시도",
      };
    }
    return data;
  }

  async function runCollect() {
    if (busy) return;
    setBusy(true);
    setMsg("수집 중…");
    try {
      let guard = 0;
      let last: BatchPayload = {};
      while (guard < 100) {
        guard += 1;
        last = await runOneBatch();
        setRun({
          run_status: last.status,
          phase: last.phase,
          pages_fetched: last.totalPagesFetched,
          posts_discovered: last.totalPostsCollected,
          mentions_discovered: last.totalMentionsCollected,
          earliest_post_at: last.earliestDate,
          latest_post_at: last.latestDate,
          end_reason: last.endReason,
        });
        setMsg(last.messageKo || null);
        if (last.status === "RATE_LIMITED") {
          await new Promise((r) =>
            setTimeout(r, (last.retryAfterSeconds || 60) * 1000)
          );
          continue;
        }
        if (!last.shouldContinue) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      await loadStatus();
    } catch (e: unknown) {
      setMsg(`에러: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const st = run?.run_status || "—";
  const posts = run?.posts_discovered ?? "—";
  const mentions = run?.mentions_discovered ?? "—";
  const pages = run?.pages_fetched ?? "—";
  const label =
    run?.run_status &&
    !["COMPLETE", "CANCELLED"].includes(String(run.run_status))
      ? "이어서 수집"
      : "Phase1A 최대 수집";

  return (
    <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
      <div className="w-full min-w-[11rem] rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-left text-xs">
        <div className="mb-1 font-medium text-emerald-300">Phase1A 수집 상태</div>
        <div className="space-y-0.5 text-zinc-200">
          <div>
            상태: <span className="font-semibold text-white">{st}</span>
          </div>
          <div>
            phase: <span className="text-zinc-100">{run?.phase || "—"}</span>
          </div>
          <div>
            posts: <span className="font-semibold text-white">{posts}</span>
          </div>
          <div>
            mentions: <span className="font-semibold text-white">{mentions}</span>
          </div>
          <div>
            pages: <span className="text-zinc-100">{pages}</span>
          </div>
          {run?.end_reason && (
            <div className="text-[10px] text-zinc-400">end: {run.end_reason}</div>
          )}
        </div>
        <button
          type="button"
          onClick={loadStatus}
          className="mt-2 text-[10px] text-emerald-400 underline"
        >
          새로고침
        </button>
      </div>

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
