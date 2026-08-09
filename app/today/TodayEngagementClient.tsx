"use client";

import { useState } from "react";
import Link from "next/link";
import type { EngagementOpportunity } from "@/lib/reply/types";

type ApiAction = { label: string; action: string; purpose: string };

export default function TodayEngagementClient({
  initialOpportunities,
  apiActions,
  indicators,
  contextTimestamp,
}: {
  initialOpportunities: EngagementOpportunity[];
  apiActions: ApiAction[];
  indicators: string[];
  contextTimestamp: string;
}) {
  const [opportunities, setOpportunities] =
    useState<EngagementOpportunity[]>(initialOpportunities);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runApiAction(action: string, label: string) {
    setBusy(true);
    setError(null);
    setNote(`${label}…`);
    try {
      const res = await fetch("/api/reply/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          find_live: action === "find_engagement_opportunities",
          refresh_x: action === "refresh_x_context",
          api_consent: {
            user_initiated: true,
            feature: "reply_engagement",
            action,
            service: "X_API",
            purpose: label,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (Array.isArray(body.opportunities)) {
        setOpportunities(body.opportunities);
      }
      setNote(
        body.message ||
          `완료 · paid_api_called=${Boolean(body.paid_api_called)} · 자동 댓글 없음`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setNote(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Today&apos;s Engagement
        </h2>
        <Link href="/today/reply" className="text-xs text-sky-400 hover:underline">
          Manual Reply →
        </Link>
      </div>

      <p className="text-sm text-zinc-500">
        자동 댓글 목록이 아닙니다. 참여하면 의미 있을 수 있는 대화 기회입니다.
        페이지 로드 시 외부 API 호출 없음.
      </p>

      {indicators?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {indicators.map((ind) => (
            <span
              key={ind}
              className="rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] text-emerald-300"
            >
              {ind}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-zinc-600">context: {contextTimestamp}</p>

      {!opportunities.length ? (
        <p className="text-sm text-zinc-600">
          저장된 context 기준 추천이 없습니다. 비어 있어도 정상입니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {opportunities.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase text-zinc-500">
                <span className="text-sky-400">{o.opportunity_type}</span>
                <span>{o.suggested_intent}</span>
                {o.api_required ? (
                  <span className="text-amber-400">API REQUIRED</span>
                ) : (
                  <span className="text-emerald-500">LOCAL / STORED</span>
                )}
              </div>
              <div className="mt-1 text-sm font-medium text-zinc-200">{o.topic}</div>
              <p className="mt-1 text-xs text-zinc-400">{o.why_relevant}</p>
              {o.event_context?.phase && (
                <p className="mt-1 text-[10px] text-zinc-500">
                  Event phase: {o.event_context.phase}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/today/reply"
                  className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                >
                  답글 작성
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
        {apiActions.map((a) => (
          <button
            key={a.action}
            type="button"
            disabled={busy}
            onClick={() => runApiAction(a.action, a.label)}
            className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
            title={a.purpose}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600">
        노란 버튼 = 외부 API가 필요할 수 있는 명시적 액션. 누르기 전에는 호출되지
        않습니다.
      </p>

      {note && <p className="text-xs text-zinc-400">{note}</p>}
      {error && (
        <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
