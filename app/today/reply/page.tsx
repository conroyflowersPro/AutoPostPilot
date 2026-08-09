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
  const [postedId, setPostedId] = useState<string | null>(null);

  const targetText = useMemo(
    () => thread?.target_text || pastedComment.trim(),
    [thread, pastedComment]
  );

  const canPost = Boolean(thread?.target_id && myReply.trim() && !postedId);

  async function fetchTarget() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setPostedId(null);
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
    setMsg("답글 제안 생성 중… (의도 입력 없음 · 댓글 트리 조회 없음)");
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
            purpose: "Suggest reply candidates from DNA + target",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSuggestions(body.suggestions || []);
      setApiState("API_RESULT");
      setMsg("제안은 AI 가설 · 자동 게시 없음 · 「게시」를 눌러야 X에 올라갑니다");
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
      setMsg("다듬기 완료 — 「게시」로 X에 올리거나 복사 가능");
    } catch (e: unknown) {
      setApiState("API_ERROR");
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function postReply() {
    if (!canPost) {
      setError(
        thread?.target_id
          ? "게시할 답글 텍스트가 필요합니다."
          : "먼저 「API로 포스트/댓글 읽기」로 대상을 불러오세요. (붙여넣기만으로는 게시 대상 ID가 없습니다)"
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMsg("X에 답글 게시 중… (Fedica 아님 · 원클릭 게시)");
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: myReply.trim(),
          in_reply_to_tweet_id: thread!.target_id,
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: "POST_REPLY",
            service: "X_API",
            purpose: "Publish reply to X after Creator edit",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setPostedId(body.posted?.id || "ok");
      setLastScope("POST_REPLY");
      setApiState("API_RESULT");
      setMsg(
        `게시 완료 · id=${body.posted?.id || "?"} · AI 초안은 evidence 아님 · 실제 게시만 행동 evidence 후보`
      );
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
      () => setMsg("복사됨 — 필요 시 X에서 직접 붙여넣기"),
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
          일반 포스트 예약은 Fedica · 답글 게시는{" "}
          <strong className="text-zinc-300">X 직접</strong>
          입니다. 링크만 붙여도 API는 호출되지 않습니다. 기본 조회는 대상 1개만입니다.
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
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Direct text mode (조회·게시 ID 없음 → 복사용)
          </h2>
          <textarea
            value={pastedComment}
            onChange={(e) => setPastedComment(e.target.value)}
            rows={3}
            placeholder="상대 텍스트 붙여넣기 (제안·다듬기 가능, 원클릭 게시는 대상 ID 필요)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </section>

        {thread && (
          <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase text-emerald-400">
              Target · @{thread.target_author_username || "?"} ·{" "}
              {isReply ? "REPLY" : "POST"} · id={thread.target_id}
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
            수정 & 게시
          </h2>
          <textarea
            value={myReply}
            onChange={(e) => {
              setMyReply(e.target.value);
              setPostedId(null);
            }}
            rows={5}
            placeholder="직접 쓰거나 제안을 넣은 뒤 수정하세요. 의도 입력창 없음."
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
              다듬기
            </button>
            <button
              type="button"
              disabled={busy || !canPost}
              onClick={postReply}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
            >
              게시
            </button>
            <button
              type="button"
              disabled={!myReply.trim()}
              onClick={() => copyText(myReply)}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-40"
            >
              복사
            </button>
          </div>
          <p className="text-[11px] text-zinc-600">
            「게시」= Creator가 누를 때만 X API로 답글 전송 (자동 전송 없음 · Fedica 아님).
            쓰기 권한 오류 시 앱에서 X 재연결이 필요합니다.
          </p>
          {postedId && (
            <p className="text-xs text-emerald-400">게시됨 · {postedId}</p>
          )}
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
                    setPostedId(null);
                    setMsg("제안을 편집창에 넣었습니다. 수정 후 「게시」");
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
      </main>
    </div>
  );
}
