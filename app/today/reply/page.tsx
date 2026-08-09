"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Thread = {
  target_id: string;
  target_text: string;
  target_author_username?: string | null;
  parent_text?: string | null;
  root_text?: string | null;
  parent_id?: string | null;
  conversation_id?: string | null;
  fetched_via: string;
};

type Suggestion = {
  text: string;
  style: string;
  notes?: string | null;
};

type Reaction = {
  id: string;
  text: string;
  author_id?: string | null;
};

export default function ManualReplyPage() {
  const [url, setUrl] = useState("");
  const [pastedComment, setPastedComment] = useState("");
  const [myReply, setMyReply] = useState("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [isReply, setIsReply] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [maxReactions, setMaxReactions] = useState<10 | 20 | 50>(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiState, setApiState] = useState<string>("LOCAL_STORED");
  const [lastScope, setLastScope] = useState<string | null>(null);

  const targetText = useMemo(
    () => thread?.target_text || pastedComment.trim(),
    [thread, pastedComment]
  );

  async function fetchTarget() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setMsg("대상만 조회 중… (다른 댓글 0)");
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/fetch-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          mode: "target",
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: "READ_TARGET",
            service: "X_API",
            purpose: "Fetch single target post or reply only",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setThread(body.thread);
      setIsReply(Boolean(body.is_reply));
      setLastScope(body.audit?.request_scope || "TARGET_ONLY");
      setReactions([]);
      setApiState("API_RESULT");
      setMsg(
        `조회 범위: ${body.audit?.request_scope || "TARGET"} · other_replies=${body.audit?.other_reply_fetch_count ?? 0}`
      );
    } catch (e: unknown) {
      setApiState("API_ERROR");
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function fetchRelated(mode: "parent" | "root") {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(mode === "parent" ? "부모 댓글 읽는 중…" : "원문 읽는 중…");
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/fetch-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          mode,
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: mode === "parent" ? "READ_PARENT_POST" : "READ_ROOT_POST",
            service: "X_API",
            purpose: mode === "parent" ? "Fetch parent only" : "Fetch root only",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setThread((prev) =>
        prev
          ? {
              ...prev,
              parent_text:
                mode === "parent" ? body.related?.text || prev.parent_text : prev.parent_text,
              root_text:
                mode === "root" ? body.related?.text || prev.root_text : prev.root_text,
            }
          : prev
      );
      setLastScope(body.audit?.request_scope || mode);
      setApiState("API_RESULT");
      setMsg(`추가 조회: ${body.audit?.request_scope} · other_replies=0`);
    } catch (e: unknown) {
      setApiState("API_ERROR");
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function fetchOtherReactions() {
    if (!url.trim() && !thread?.conversation_id) {
      setError("대상 URL 또는 conversation이 필요합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(`다른 반응 샘플 최대 ${maxReactions}개…`);
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/fetch-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          mode: "other_reactions",
          conversation_id: thread?.conversation_id || undefined,
          max_reactions: maxReactions,
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: "READ_OTHER_REACTIONS",
            service: "X_API",
            purpose: `Fetch up to ${maxReactions} other replies`,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setReactions(body.reactions || []);
      setLastScope("OTHER_REACTIONS");
      setApiState("API_RESULT");
      setMsg(
        `다른 반응 ${body.reactions?.length || 0}/${body.max_requested} · pagination=0`
      );
    } catch (e: unknown) {
      setApiState("API_ERROR");
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    if (!targetText && !myReply.trim()) {
      setError("상대 글 또는 내 초안이 필요합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg("답글 제안 생성 중… (X 댓글 트리 추가 조회 없음)");
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_text: targetText,
          parent_text: thread?.parent_text || "",
          root_text: thread?.root_text || "",
          my_draft: myReply,
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: "suggest_reply",
            service: "XAI_GROK",
            purpose: "Suggest reply candidates",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSuggestions(body.suggestions || []);
      setApiState("API_RESULT");
      setMsg("제안은 AI 가설 · 자동 게시 없음 · 다른 사용자 댓글 자동 조회 없음");
    } catch (e: unknown) {
      setApiState("API_ERROR");
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function polish() {
    if (!myReply.trim()) {
      setError("다듬을 내 답글이 필요합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg("내 답글 다듬는 중… (추가 X 조회 없음)");
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          my_reply: myReply,
          target_text: targetText,
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: "polish_reply",
            service: "XAI_GROK",
            purpose: "Polish creator-written reply",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setMyReply(body.text || myReply);
      setApiState("API_RESULT");
      setMsg("다듬기 완료 — X에서 직접 게시");
    } catch (e: unknown) {
      setApiState("API_ERROR");
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  function copyText(t: string) {
    navigator.clipboard?.writeText(t).then(
      () => setMsg("복사됨 — X에서 직접 붙여넣기"),
      () => setMsg("클립보드 권한을 확인하세요")
    );
  }

  const primaryLabel = isReply ? "API로 댓글 읽기" : "API로 포스트 읽기";
  const primaryHint = isReply
    ? "조회 범위: 해당 댓글 1개 (스레드/다른 댓글 제외)"
    : "조회 범위: 해당 포스트 1개 (댓글 트리 제외). 댓글 수와 무관하게 동일.";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/today" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">Manual Reply</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {apiState}
          </span>
          {lastScope && (
            <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 text-[10px] text-emerald-400">
              {lastScope}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <p className="text-xs text-zinc-500">
          링크만 붙여도 API는 호출되지 않습니다. 기본 조회는{" "}
          <strong className="text-zinc-300">대상 1개만</strong>입니다. 다른 사용자
          댓글·전체 스레드는 기본에 포함되지 않습니다.
        </p>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            X Post / Reply Link
          </h2>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://x.com/.../status/..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={busy || !url.trim()}
            onClick={fetchTarget}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
          >
            {primaryLabel}
          </button>
          <p className="text-[11px] text-zinc-600">{primaryHint}</p>
          <p className="text-[11px] text-zinc-600">X API 사용 · 예상 금액 미표시</p>

          {thread && (
            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => fetchRelated("root")}
                className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600 disabled:opacity-40"
              >
                원문 읽기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => fetchRelated("parent")}
                className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600 disabled:opacity-40"
              >
                부모 댓글 읽기
              </button>
              <div className="flex items-center gap-1">
                <select
                  value={maxReactions}
                  onChange={(e) =>
                    setMaxReactions(Number(e.target.value) as 10 | 20 | 50)
                  }
                  className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-[11px]"
                >
                  <option value={10}>10개</option>
                  <option value={20}>20개</option>
                  <option value={50}>50개</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={fetchOtherReactions}
                  className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
                >
                  다른 반응도 분석
                </button>
              </div>
            </div>
          )}
          {thread && (
            <p className="text-[11px] text-zinc-600">
              「원문/부모」「다른 반응」은 각각 별도 승인·별도 비용입니다. 기본
              Suggest에는 필요 없습니다.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Direct text mode (API 없음)
          </h2>
          <textarea
            value={pastedComment}
            onChange={(e) => setPastedComment(e.target.value)}
            rows={3}
            placeholder="상대 포스트/댓글 텍스트를 직접 붙여넣기"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </section>

        {thread && (
          <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase text-emerald-400">
              Target · @{thread.target_author_username || "?"} ·{" "}
              {isReply ? "REPLY" : "POST"}
            </div>
            <p className="text-zinc-200 whitespace-pre-wrap">{thread.target_text}</p>
            {thread.parent_text && (
              <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-2">
                Parent: {thread.parent_text}
              </p>
            )}
            {thread.root_text && (
              <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-2">
                Root: {thread.root_text}
              </p>
            )}
          </section>
        )}

        {reactions.length > 0 && (
          <section className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 space-y-2">
            <h2 className="text-xs font-medium uppercase text-amber-400">
              Other reactions sample ({reactions.length})
            </h2>
            <ul className="space-y-2 max-h-48 overflow-y-auto text-xs text-zinc-400">
              {reactions.map((r) => (
                <li key={r.id} className="border-b border-zinc-800 pb-1">
                  {r.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            내 답글
          </h2>
          <textarea
            value={myReply}
            onChange={(e) => setMyReply(e.target.value)}
            rows={5}
            placeholder="직접 답글을 쓰거나, 제안을 받은 뒤 수정하세요."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={suggest}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-40"
            >
              답글 제안
            </button>
            <button
              type="button"
              disabled={busy || !myReply.trim()}
              onClick={polish}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600 disabled:opacity-40"
            >
              내 답글 다듬기
            </button>
            <button
              type="button"
              disabled={!myReply.trim()}
              onClick={() => copyText(myReply)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm hover:bg-emerald-600 disabled:opacity-40"
            >
              복사
            </button>
          </div>
        </section>

        {suggestions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Suggestions (not evidence)
            </h2>
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2"
              >
                <div className="text-[10px] text-zinc-500">{s.style}</div>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{s.text}</p>
                <button
                  type="button"
                  className="text-xs text-emerald-400 hover:underline"
                  onClick={() => {
                    setMyReply(s.text);
                    setMsg("제안을 편집창에 넣었습니다.");
                  }}
                >
                  사용 (편집창에 넣기)
                </button>
              </div>
            ))}
          </section>
        )}

        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        {error && (
          <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-zinc-600">
          기본 Reply Assist 비용은 대상 포스트/댓글 1개 기준입니다. 게시물에 댓글이
          5만 개여도 기본 조회 범위는 동일합니다.
        </p>
      </main>
    </div>
  );
}
