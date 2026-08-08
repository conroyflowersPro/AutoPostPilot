"use client";

import { useState } from "react";

/**
 * Phase 1A — one-click max X API collection (posts + mentions + metric snapshots).
 * Does not run DNA learning.
 */
export default function CollectMaxButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function runCollect() {
    if (busy) return;
    setBusy(true);
    setMsg("수집 중… 페이지를 닫지 마세요 (1~2분 걸릴 수 있음)");
    try {
      const res = await fetch("/api/x/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeMentions: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          `실패 (${res.status}): ${data.error || data.message || res.statusText}`
        );
        setBusy(false);
        return;
      }
      const r = data.report || {};
      const posts = r.posts?.totalCollected ?? "?";
      const mentions = r.mentions?.totalCollected ?? "?";
      const enough = r.enoughForBaselineLearning ?? "?";
      setMsg(
        `완료 — posts ${posts}, mentions ${mentions}, readiness ${enough}. 상세는 콘솔/클립보드.`
      );
      console.log("Phase1A collect report", data);
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setMsg(
          (m) =>
            (typeof m === "string" ? m : "") +
            " (JSON 클립보드 복사됨 — 채팅에 붙여넣기)"
        );
      } catch {
        /* clipboard may be blocked */
      }
    } catch (e: unknown) {
      setMsg(`에러: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={runCollect}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "수집 중…" : "Phase1A 최대 수집"}
      </button>
      {msg && (
        <p className="max-w-[14rem] text-right text-[10px] leading-snug text-zinc-400">
          {msg}
        </p>
      )}
    </div>
  );
}
