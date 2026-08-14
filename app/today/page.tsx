import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStoredEngagementRecommendations } from "@/lib/reply/recommendations";
import { buildSharedCurrentContext } from "@/lib/context";
import TodayEngagementClient from "./TodayEngagementClient";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: scheduled } = await supabase
    .from("SeungContent")
    .select("id, content, status, pipeline_id, created_at")
    .eq("user_id", user.id)
    .in("status", ["scheduled", "draft", "reviewed"])
    .order("created_at", { ascending: false })
    .limit(8);

  const engagement = buildStoredEngagementRecommendations({});
  const shared = buildSharedCurrentContext({});
  const events = [
    ...shared.active_events,
    ...shared.upcoming_events,
    ...shared.recent_events,
  ].filter((e) => e.creator_relevance !== "none" && e.phase !== "UNKNOWN");

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="text-xl font-medium">오늘</h1>
      <p className="text-sm text-zinc-500">
        할당량이 아닙니다. 오늘 할 수 있는 기회만 보여 줍니다. 아무것도 안 해도
        됩니다.
      </p>

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-emerald-400/80">
          지금 하기
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/today/write"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            지금 쓰기
          </Link>
          <Link
            href="/generate"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            이번 주 계획
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
          >
            캘린더
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          이벤트 · 맥락
        </h2>
        {!events.length ? (
          <p className="text-sm text-zinc-600">
            지금 표시할 Creator 관련 이벤트가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 5).map((ev) => (
              <li
                key={`${ev.event_name}-${ev.phase}`}
                className="rounded-lg bg-zinc-950/50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase text-amber-400">
                    {ev.phase}
                  </span>
                  <span className="font-medium text-zinc-200">{ev.event_name}</span>
                </div>
                {ev.notes && (
                  <p className="mt-0.5 text-xs text-zinc-500">{ev.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {shared.indicators?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {shared.indicators.map((ind) => (
              <span
                key={ind}
                className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400"
              >
                {ind}
              </span>
            ))}
          </div>
        )}
      </section>

      <TodayEngagementClient
        initialOpportunities={engagement.opportunities}
        apiActions={engagement.api_required_actions}
        indicators={engagement.indicators}
        contextTimestamp={engagement.context_timestamp}
      />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          오늘 콘텐츠 · 초안 / 예약
        </h2>
        {!scheduled?.length ? (
          <p className="text-sm text-zinc-600">표시할 초안이 없습니다.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {scheduled.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/posts/${p.id}`}
                  className="block rounded-lg bg-zinc-950/50 px-3 py-2 hover:bg-zinc-900"
                >
                  <span className="text-[10px] uppercase text-sky-400">
                    {p.status}
                  </span>{" "}
                  <span className="text-zinc-300">
                    {(p.content || "").slice(0, 80)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
