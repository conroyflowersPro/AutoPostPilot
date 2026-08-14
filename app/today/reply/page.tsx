"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

function ManualReplyInner() {
  const searchParams = useSearchParams();
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
  const [postedId, setPostedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [topicHint, setTopicHint] = useState<string | null>(null);

  useEffect(() => {
    const qUrl = searchParams.get("url");
    const qTopic = searchParams.get("topic");
    const qIntent = searchParams.get("intent");
    const qPhase = searchParams.get("phase");
    if (qUrl && qUrl.trim()) setUrl(qUrl.trim());
    if (qTopic) {
      setTopicHint(
        [qTopic, qIntent ? `의도: ${qIntent}` : null, qPhase ? `단계: ${qPhase}` : null]
          .filter(Boolean)
          .join(" · ")
      );
    }
  }, [searchParams]);

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
    setMsg("대상 글만 읽는 중…");
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
            purpose: "Fetch single target only",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setThread(body.thread);
      setIsReply(Boolean(body.is_reply));
      setReactions([]);
      setApiState("API_RESULT");
      setMsg("대상만 읽음");
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
            purpose: "Fetch related context",
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
      setApiState("API_RESULT");
      setMsg("추가 문맥 읽음");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function fetchOtherReactions() {
    setBusy(true);
    setError(null);
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
            purpose: "Sample other reactions",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setReactions(body.reactions || []);
      setApiState("API_RESULT");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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
            purpose: "Suggest reply",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSuggestions(body.suggestions || []);
      setApiState("API_RESULT");
      setMsg("제안은 초안입니다. 수정 후 게시하세요.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function polish() {
    if (!myReply.trim()) {
      setError("다듬을 글이 필요합니다.");
      return;
    }
    setBusy(true);
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
            purpose: "Polish reply",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setMyReply(body.text || myReply);
      setMsg("다듬기 완료");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function postReply() {
    if (!canPost) {
      setError(thread?.target_id ? "답글 텍스트가 필요합니다." : "먼저 대상을 읽어 주세요.");
      return;
    }
    setBusy(true);
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
            purpose: "Publish reply",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setPostedId(body.posted?.id || "ok");
      setMsg(`게시 완료 · ${body.posted?.id || ""}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const primaryLabel = isReply ? "대상 댓글 읽기" : "대상 포스트 읽기";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/today" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">답글 작성</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <p className="text-xs text-zinc-500">
          v11: AI 답글 제안/다듬기는 멈춤. 댓글 상태만 홈·오늘에서 본다.
        </p>
        {topicHint && (
          <div className="rounded-lg border border-sky-900/50 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
            Today에서 넘어온 기회: {topicHint}
            {!url.trim() && (
              <span className="block mt-1 text-zinc-500">
                X 링크를 붙여 대상을 읽거나, 아래 텍스트로 제안만 받을 수 있습니다.
              </span>
            )}
          </div>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
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

          {thread && (
            <div className="border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                {showAdvanced ? "▾ 고급 문맥 접기" : "▸ 고급 문맥 (원문·부모·다른 반응)"}
              </button>
              {showAdvanced && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => fetchRelated("root")} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs disabled:opacity-40">원문 읽기</button>
                  <button type="button" disabled={busy} onClick={() => fetchRelated("parent")} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs disabled:opacity-40">부모 댓글 읽기</button>
                  <select value={maxReactions} onChange={(e) => setMaxReactions(Number(e.target.value) as 10 | 20 | 50)} className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-[11px]">
                    <option value={10}>10개</option>
                    <option value={20}>20개</option>
                    <option value={50}>50개</option>
                  </select>
                  <button type="button" disabled={busy} onClick={fetchOtherReactions} className="rounded-lg border border-amber-800/60 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-40">다른 반응 분석</button>
                </div>
              )}
            </div>
          )}
        </section>

        <textarea
          value={pastedComment}
          onChange={(e) => setPastedComment(e.target.value)}
          rows={2}
          placeholder="텍스트만 붙여넣기 (선택)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />

        {thread && (
          <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm">
            <div className="text-[10px] text-emerald-400">@{thread.target_author_username || "?"}</div>
            <p className="whitespace-pre-wrap text-zinc-200">{thread.target_text}</p>
            {thread.parent_text && <p className="mt-2 text-xs text-zinc-500">부모: {thread.parent_text}</p>}
            {thread.root_text && <p className="mt-1 text-xs text-zinc-500">원문: {thread.root_text}</p>}
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <textarea
            value={myReply}
            onChange={(e) => { setMyReply(e.target.value); setPostedId(null); }}
            rows={5}
            placeholder="내 답글"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={suggest} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm disabled:opacity-40">답글 제안</button>
            <button type="button" disabled={busy || !myReply.trim()} onClick={polish} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm disabled:opacity-40">다듬기</button>
            <button type="button" disabled={busy || !canPost} onClick={postReply} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-40">게시</button>
            <button type="button" disabled={!myReply.trim()} onClick={() => navigator.clipboard?.writeText(myReply)} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm disabled:opacity-40">복사</button>
          </div>
          {postedId && <p className="text-xs text-emerald-400">게시됨 · {postedId}</p>}
        </section>

        {suggestions.map((s, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 p-3 space-y-2">
            <p className="text-sm whitespace-pre-wrap">{s.text}</p>
            <button type="button" className="text-xs text-emerald-400" onClick={() => { setMyReply(s.text); setPostedId(null); }}>사용</button>
          </div>
        ))}

        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </main>
    </div>
  );
}

export default function ManualReplyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 text-sm text-zinc-500">
          답글 화면 준비 중…
        </div>
      }
    >
      <ManualReplyInner />
    </Suspense>
  );
}
