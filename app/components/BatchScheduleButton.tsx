"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BatchScheduleButton({
  reviewedCount,
}: {
  reviewedCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  async function handleBatch() {
    if (reviewedCount === 0) {
      setProgress("검수 완료(reviewed) + 미디어가 있는 포스트가 없습니다.");
      return;
    }
    if (
      !confirm(
        `검수 완료된 한국어 포스트를 Fedica에 일괄 스케줄할까요?\n(태평양시 오후 2시부터, For You 간격은 플래너가 배정)`
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress("업로드 중… 플래너가 For You 간격을 배정하고 Fedica로 전송합니다.");

    try {
      const res = await fetch("/api/fedica/batch-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: "42303",
          requireMedia: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "일괄 스케줄 실패");

      setResult(data);
      setProgress(data.message || "완료");
      router.refresh();
    } catch (err: any) {
      setProgress(err.message || "실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleBatch}
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 sm:w-auto sm:px-5"
      >
        {loading
          ? "업로드 중…"
          : `Fedica 일괄 스케줄 (reviewed ${reviewedCount})`}
      </button>

      {progress && (
        <p className="text-xs text-zinc-400">{progress}</p>
      )}

      {result?.scheduled?.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
          <p className="mb-1 font-medium text-emerald-300">
            스케줄됨 {result.scheduled.length}개
          </p>
          <ul className="space-y-1">
            {result.scheduled.map((s: any) => (
              <li key={s.id}>
                {new Date(s.scheduledAt).toLocaleString("ko-KR", {
                  timeZone: "America/Los_Angeles",
                })}
                {s.mediaCount ? ` · 미디어 ${s.mediaCount}` : ""}
              </li>
            ))}
          </ul>
          {result.failed?.length > 0 && (
            <p className="mt-2 text-amber-300">
              실패 {result.failed.length}개 — 상세는 서버 로그 확인
            </p>
          )}
        </div>
      )}
    </div>
  );
}
