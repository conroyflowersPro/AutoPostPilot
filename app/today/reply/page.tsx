"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Thread = {
  target_id: string;
  target_text: string;
  target_author_username?: string | null;
  parent_text?: string | null;
  root_text?: string | null;
  fetched_via: string;
};

type Suggestion = {
  text: string;
  style: string;
  notes?: string | null;
};

export default function ManualReplyPage() {
  const [url, setUrl] = useState("");
  const [pastedComment, setPastedComment] = useState("");
  const [myReply, setMyReply] = useState("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiState, setApiState] = useState<string>("LOCAL_STORED");

  const targetText = useMemo(
    () => thread?.target_text || pastedComment.trim(),
    [thread, pastedComment]
  );

  async function fetchContext() {
    setBusy(true);
    setError(null);
    setMsg("X API로 댓글 문맥 읽는 중…");
    setApiState("API_LOADING");
    try {
      const res = await fetch("/api/reply/fetch-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          api_consent: {
            user_initiated: true,
            feature: "reply_manual",
            action: "fetch_comment_context",
            service: "X_API",
            purpose: "Read comment and related thread context",
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setThread(body.thread);
      setApiState("API_RESULT");
      setMsg("문맥 확보 — 자동 게시 없음");
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
      setError("상대 댓글 또는 내 초안이 필요합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg("답글 제안 생성 중…");
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
      setMsg("제안은 AI 가설입니다. 자동 게시 없음 · Creator evidence 아님");
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
    setMsg("내 답글 다듬는 중…");
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
      setMsg("다듬기 완료 — 직접 수정 후 X에서 직접 게시");
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
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <p className="text-xs text-zinc-500">
          링크만 붙여도 API는 호출되지 않습니다. 「API로 댓글 읽기」를 눌렀을 때만 X
          API가 실행됩니다. 자동 게시는 없습니다.
        </p>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            X Reply / Comment Link
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
            onClick={fetchContext}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
          >
            API로 댓글 읽기
          </button>
          <p className="text-[11px] text-zinc-600">
            X에서 댓글 및 관련 문맥을 불러옵니다. API 사용이 발생할 수 있습니다.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Direct text mode (API 없음)
          </h2>
          <textarea
            value={pastedComment}
            onChange={(e) => setPastedComment(e.target.value)}
            rows={3}
            placeholder="상대 댓글을 직접 붙여넣기"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </section>

        {thread && (
          <section className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase text-emerald-400">
              Loaded · @{thread.target_author_username || "?"} · {thread.fetched_via}
            </div>
            <p className="text-zinc-200 whitespace-pre-wrap">{thread.target_text}</p>
            {thread.parent_text && (
              <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-2">
                Parent: {thread.parent_text}
              </p>
            )}
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
                    setMsg("제안을 편집창에 넣었습니다. 수정 후 사용하세요.");
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
          AutoPostPilot은 자동 댓글 봇이 아닙니다. 최종 문장·게시 여부는 항상
          Creator가 결정합니다.
        </p>
      </main>
    </div>
  );
}
