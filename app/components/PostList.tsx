"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  content: string;
  status: string;
  pipeline_id: string | null;
  media_urls: string[] | null;
  scheduled_at: string | null;
  created_at?: string;
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "draft", label: "draft" },
  { key: "reviewed", label: "reviewed" },
  { key: "scheduled", label: "scheduled" },
] as const;

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
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(todayLA);
  const [maxPerDay, setMaxPerDay] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scheduleResult, setScheduleResult] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    for (const p of posts) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [posts]);

  const visible = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => p.status === filter);
  }, [posts, filter]);

  const selectable = visible.filter(
    (p) =>
      p.status === "reviewed" &&
      p.pipeline_id === "42303" &&
      p.media_urls &&
      p.media_urls.length > 0
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
      const p = posts.find((x) => x.id === id);
      return p && p.status === "draft";
    });
    if (ids.length === 0) {
      setMsg("reviewed로 바꿀 draft를 선택하세요.");
      return;
    }
    if (
      !confirm(
        `선택한 draft ${ids.length}개를 reviewed로 표시할까요?\n(미디어 없는 항목도 포함됩니다. 스케줄은 미디어 있는 reviewed만 가능)`
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
    const scheduledCount = posts.filter(
      (p) => ids.includes(p.id) && p.status === "scheduled"
    ).length;
    const warn =
      scheduledCount > 0
        ? `\n(그중 스케줄됨 ${scheduledCount}개 — 앱 DB에서만 삭제, Fedica는 수동 확인)`
        : "";
    if (
      !confirm(
        `선택한 ${ids.length}개 포스트를 삭제할까요?${warn}\n이 작업은 되돌릴 수 없습니다.`
      )
    )
      return;

    setBusy(true);
    setMsg("삭제 중…");
    try {
      const { error } = await supabase
        .from("SeungContent")
        .delete()
        .in("id", ids);
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
      setMsg("reviewed + 미디어 있는 포스트를 선택하세요.");
      return;
    }
    if (
      !confirm(
        `선택한 ${ids.length}개를 Fedica 일괄 스케줄할까요?\n시작일: ${startDate} (LA)\n하루 최대 ${maxPerDay}개 · 최소 3시간 간격`
      )
    )
      return;

    setBusy(true);
    setMsg("업로드 중…");
    setScheduleResult(null);
    try {
      const res = await fetch("/api/fedica/batch-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: "42303",
          requireMedia: true,
          postIds: ids,
          startDate,
          maxPerDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "일괄 스케줄 실패");
      setScheduleResult(data);
      setMsg(data.message || "완료");
      setSelected(new Set());
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

      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-3">
        <p className="text-xs text-zinc-400">
          Fedica는 <strong className="text-emerald-300">선택한 포스트만</strong>{" "}
          · 시작일 기준으로 일자 분산
        </p>

        <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              하루 최대 개수
            </label>
            <input
              type="number"
              min={3}
              max={8}
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

        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        {scheduleResult?.scheduled?.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-300">
            {scheduleResult.scheduled.map((s: any) => (
              <li key={s.id}>
                예정 {formatLA(s.scheduledAt)} LA
                {s.mediaCount ? ` · 미디어 ${s.mediaCount}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
          해당 상태 포스트 없음
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((post) => {
            const canSchedule =
              post.status === "reviewed" &&
              post.pipeline_id === "42303" &&
              !!post.media_urls?.length;
            const checked = selected.has(post.id);

            return (
              <div
                key={post.id}
                role="button"
                tabIndex={0}
                onClick={() => toggle(post.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(post.id);
                  }
                }}
                className={`cursor-pointer rounded-xl border bg-zinc-900/60 p-4 transition-colors ${
                  checked
                    ? canSchedule
                      ? "border-emerald-600 bg-emerald-950/20"
                      : "border-indigo-600/60 bg-indigo-950/15"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(post.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-5 w-5 accent-emerald-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-3 text-sm leading-relaxed text-zinc-200">
                      {post.content}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <StatusBadge status={post.status} />
                      {post.pipeline_id === "42303" ? "KR" : "EN"}
                      {post.media_urls?.length ? (
                        <span>📷 {post.media_urls.length}</span>
                      ) : null}
                      {post.scheduled_at && (
                        <span className="text-amber-300">
                          예정 {formatLA(post.scheduled_at)} LA
                        </span>
                      )}
                      <Link
                        href={`/posts/${post.id}`}
                        onClick={(e) => e.stopPropagation()}
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
