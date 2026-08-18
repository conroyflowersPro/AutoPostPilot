"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  content?: string | null;
  final_text?: string | null;
  topic?: string | null;
  status: string;
  pipeline_id: string | null;
  media_urls: string[] | null;
  scheduled_at: string | null;
  created_at?: string;
  strategy_json?: {
    planned_at?: string | null;
    planned_pt?: string | null;
  } | null;
};

function postBody(p: Post) {
  return String(p.content || p.final_text || p.topic || "").trim();
}

function formatPT(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function queueWhen(post: Post): { kind: "예약" | "계획" | "없음"; text: string } {
  if (post.scheduled_at) {
    return { kind: "예약", text: `${formatPT(post.scheduled_at)} PT` };
  }
  const planned = String(post.strategy_json?.planned_at || "").trim();
  if (planned) {
    return { kind: "계획", text: `${formatPT(planned)} PT` };
  }
  return { kind: "없음", text: "시각 없음" };
}

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "draft", label: "draft" },
  { key: "reviewed", label: "reviewed" },
  { key: "scheduling", label: "scheduling" },
  { key: "schedule_failed", label: "failed" },
  { key: "scheduled", label: "scheduled" },
] as const;

/** Must match lib/config/scheduling.ts batchSize */
const SCHEDULE_BATCH_SIZE = 3;

function formatLA(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayLA() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

export default function PostList({ posts }: { posts: Post[] }) {
  const [filter, setFilter] = useState<string>("draft");
  const [livePosts, setLivePosts] = useState<Post[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(todayLA);
  const [maxPerDay, setMaxPerDay] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scheduleResult, setScheduleResult] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();
  const queue = livePosts !== null ? livePosts : posts;

  const loadQueue = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Only columns that exist on production SeungContent. Asking for
    // topic/final_text/strategy_json 400s the query and used to wipe the list.
    const cols =
      "id, content, status, pipeline_id, media_urls, scheduled_at, created_at, user_id";
    const [active, rest] = await Promise.all([
      supabase
        .from("SeungContent")
        .select(cols)
        .eq("user_id", user.id)
        .in("status", ["draft", "reviewed", "scheduling", "schedule_failed"])
        .order("created_at", { ascending: false })
        .limit(800),
      supabase
        .from("SeungContent")
        .select(cols)
        .eq("user_id", user.id)
        .in("status", ["scheduled", "published"])
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (active.error && rest.error) return;
    const byId = new Map<string, Post>();
    for (const row of [...(active.data || []), ...(rest.data || [])] as Post[]) {
      if (row?.id) byId.set(row.id, row);
    }
    setLivePosts(
      Array.from(byId.values()).sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || ""))
      )
    );
  }, [supabase]);

  useEffect(() => {
    loadQueue();
    const onFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      loadQueue();
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadQueue, router]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: queue.length };
    for (const p of queue) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [queue]);

  const visible = useMemo(() => {
    if (filter === "all") return queue;
    return queue.filter((p) => p.status === filter);
  }, [queue, filter]);

  const selectable = visible.filter(
    (p) =>
      (p.status === "reviewed" || p.status === "schedule_failed") &&
      p.pipeline_id === "42303"
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAllReady() {
    setSelected(new Set(selectable.map((p) => p.id)));
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((p) => p.id)));
  }

  function clearSel() {
    setSelected(new Set());
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggleSelectAllVisible() {
    if (allVisibleSelected) clearSel();
    else selectAllVisible();
  }

  async function handleBatchMarkReviewed() {
    const ids = Array.from(selected).filter((id) => {
      const p = queue.find((x) => x.id === id);
      return p && p.status === "draft";
    });
    if (ids.length === 0) {
      setMsg("reviewed로 바꿀 draft를 선택하세요.");
      return;
    }
    if (
      !confirm(
        `선택한 draft ${ids.length}개를 reviewed로 표시할까요?\n(미디어 없는 항목도 포함됩니다)`
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("SeungContent")
        .update({ status: "reviewed" })
        .in("id", ids);
      if (error) throw error;
      setSelected(new Set());
      setMsg(`${ids.length}개 draft → reviewed 완료`);
      await loadQueue();
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, status: string) {
    if (status === "scheduled") {
      if (
        !confirm(
          "이미 스케줄된 포스트입니다. 앱에서만 삭제할까요? (Fedica 쪽은 수동 확인)"
        )
      )
        return;
    } else if (!confirm("이 포스트를 삭제할까요?")) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("SeungContent").delete().eq("id", id);
      if (error) throw error;
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setMsg("삭제할 포스트를 선택하세요.");
      return;
    }
    if (!confirm(`선택한 ${ids.length}개 포스트를 삭제할까요?`)) return;
    setBusy(true);
    setMsg("삭제 중…");
    try {
      const { error } = await supabase.from("SeungContent").delete().in("id", ids);
      if (error) throw error;
      setSelected(new Set());
      setMsg(`${ids.length}개 삭제 완료`);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || "일괄 삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchSchedule() {
    const ids = Array.from(selected).filter((id) =>
      selectable.some((p) => p.id === id)
    );
    if (ids.length === 0) {
      setMsg("reviewed(또는 재시도 failed) 포스트를 선택하세요.");
      return;
    }
    if (
      !confirm(
        `선택한 ${ids.length}개를 Fedica 지정 파이프라인에 일괄 스케줄할까요?\nAgent승이 정한 계획 시각을 사용합니다. 시각이 없는 예전 초안만 기존 occupied-safe 경로입니다.\n최소 2시간은 간격 제약입니다. 스케줄러가 2시간 격자나 jitter로 새 주간 시각을 만들지 않습니다.\n배치 ${SCHEDULE_BATCH_SIZE}개씩`
      )
    )
      return;

    setBusy(true);
    setScheduleResult(null);

    const allScheduled: any[] = [];
    const allFailed: any[] = [];
    const allSkipped: any[] = [];
    const total = ids.length;

    try {
      for (let offset = 0; offset < ids.length; offset += SCHEDULE_BATCH_SIZE) {
        const chunk = ids.slice(offset, offset + SCHEDULE_BATCH_SIZE);
        const done = Math.min(offset + chunk.length, total);
        setMsg(
          `Scheduling ${total} posts… ${done} / ${total} (성공 ${allScheduled.length} · 실패 ${allFailed.length})`
        );

        const res = await fetch("/api/fedica/batch-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipelineId: "42303",
            requireMedia: false,
            postIds: chunk,
            startDate,
            maxPerDay,
            slotOffset: offset,
            totalPlanned: total,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          for (const id of chunk) {
            allFailed.push({
              id,
              error: data.error || "배치 요청 실패",
              stage: "publish_post",
            });
          }
          continue;
        }
        if (Array.isArray(data.scheduled)) allScheduled.push(...data.scheduled);
        if (Array.isArray(data.failed)) allFailed.push(...data.failed);
        if (Array.isArray(data.skipped)) allSkipped.push(...data.skipped);
      }

      const summary = {
        scheduled: allScheduled,
        failed: allFailed,
        skipped: allSkipped,
        total,
        message: `완료: ${allScheduled.length} Scheduled · ${allFailed.length} Failed · ${allSkipped.length} Skipped`,
      };
      setScheduleResult(summary);
      setMsg(summary.message);
      setSelected(new Set());
      await loadQueue();
      router.refresh();
    } catch (e: any) {
      setMsg(e.message || "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {f.label} {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      <details
        className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4"
        open={selected.size > 0}
      >
        <summary className="cursor-pointer text-xs text-zinc-400">
          일괄 스케줄 · 선택 {selected.size}개
        </summary>
        <div className="mt-3 space-y-3">
        <p className="text-xs text-zinc-400">
          글에 지정된 Fedica 파이프라인으로 Agent승이 정한 계획 시각을 넣습니다. 시각이 없는
          예전 초안만 이미 예약된 시각 다음 occupied-safe 경로를 씁니다. 최소 2시간은 간격
          제약이지 2시간 격자나 jitter가 아닙니다. {SCHEDULE_BATCH_SIZE}개씩 자동 배치.
        </p>

        <div
          className="grid grid-cols-2 gap-3"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              스케줄 시작일 (LA)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-zinc-500">선택일 {startDate}</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              하루 최대 개수
            </label>
            <input
              type="number"
              min={3}
              max={5}
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(Number(e.target.value) || 5)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-800/50 bg-indigo-950/50 px-3 py-1.5 hover:bg-indigo-900/40">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              className="h-4 w-4 accent-emerald-500"
            />
            <span className="font-medium text-indigo-200">
              화면 전체 선택 ({visible.length})
            </span>
          </label>
          <button
            type="button"
            onClick={selectAllReady}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700"
          >
            스케줄 가능만 ({selectable.length})
          </button>
          <button
            type="button"
            onClick={clearSel}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700"
          >
            선택 해제
          </button>
          <span className="self-center text-zinc-500">선택 {selected.size}개</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBatchSchedule}
            disabled={busy || selected.size === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 sm:w-auto sm:px-5"
          >
            {busy
              ? "처리 중…"
              : `선택 ${selected.size}개 · ${startDate}부터 일괄 스케줄`}
          </button>
          <button
            type="button"
            onClick={handleBatchMarkReviewed}
            disabled={busy || selected.size === 0}
            className="w-full rounded-xl border border-blue-800/60 bg-blue-950/40 py-3 text-sm font-medium text-blue-200 hover:bg-blue-900/50 disabled:opacity-50 sm:w-auto sm:px-5"
          >
            선택 draft → reviewed
          </button>
          <button
            type="button"
            onClick={handleBatchDelete}
            disabled={busy || selected.size === 0}
            className="w-full rounded-xl border border-red-800/60 bg-red-950/40 py-3 text-sm font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-50 sm:w-auto sm:px-5"
          >
            선택 {selected.size}개 일괄 삭제
          </button>
        </div>

        {msg && <p className="text-xs text-zinc-300">{msg}</p>}
        {scheduleResult && (
          <div className="space-y-2 text-xs">
            {scheduleResult.scheduled?.length > 0 && (
              <ul className="max-h-28 space-y-1 overflow-y-auto text-emerald-300/90">
                {scheduleResult.scheduled.map((s: any) => (
                  <li key={s.id}>
                    ✓ 예정 {s.scheduledAt ? formatLA(s.scheduledAt) : "—"} LA
                    {s.mediaCount ? ` · 미디어 ${s.mediaCount}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {scheduleResult.failed?.length > 0 && (
              <ul className="max-h-28 space-y-1 overflow-y-auto text-red-300/90">
                {scheduleResult.failed.map((f: any) => (
                  <li key={f.id}>
                    ✗ {f.stage ? `[${f.stage}] ` : ""}
                    {f.error || "실패"}
                  </li>
                ))}
              </ul>
            )}
            {scheduleResult.skipped?.length > 0 && (
              <p className="text-zinc-500">
                건너뜀 {scheduleResult.skipped.length}개 (이미 예약됨 등)
              </p>
            )}
          </div>
        )}
        </div>
      </details>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
          해당 상태 포스트 없음
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((post) => {
            const canSchedule =
              (post.status === "reviewed" || post.status === "schedule_failed") &&
              post.pipeline_id === "42303";
            const checked = selected.has(post.id);

            return (
              <div
                key={post.id}
                className={`rounded-xl border bg-zinc-900/60 p-4 ${
                  checked
                    ? canSchedule
                      ? "border-emerald-600 bg-emerald-950/20"
                      : "border-indigo-600/60 bg-indigo-950/15"
                    : "border-zinc-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(post.id)}
                    className="mt-1 h-5 w-5 accent-emerald-500"
                    aria-label="선택"
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/posts/${post.id}`} className="block">
                      <p className="line-clamp-3 text-sm leading-relaxed text-zinc-200">
                        {postBody(post) || "(본문 없음)"}
                      </p>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <StatusBadge status={post.status} />
                      {post.pipeline_id === "42303" ? "KR" : "EN"}
                      {post.media_urls?.length ? (
                        <span>📷 {post.media_urls.length}</span>
                      ) : null}
                      {(() => {
                        const when = queueWhen(post);
                        return (
                          <span className={when.kind === "없음" ? "text-zinc-600" : "text-amber-300"}>
                            {when.kind === "없음" ? when.text : `${when.kind} ${when.text}`}
                          </span>
                        );
                      })()}
                      <Link
                        href={`/posts/${post.id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        상세 →
                      </Link>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(post.id, post.status);
                    }}
                    className="shrink-0 rounded-lg border border-red-900/50 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/50 disabled:opacity-40"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-zinc-700 text-zinc-300",
    reviewed: "bg-blue-900/60 text-blue-300",
    scheduling: "bg-purple-900/60 text-purple-300",
    schedule_failed: "bg-red-900/60 text-red-300",
    scheduled: "bg-amber-900/60 text-amber-300",
    published: "bg-emerald-900/60 text-emerald-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
        colors[status] || colors.draft
      }`}
    >
      {status}
    </span>
  );
}
