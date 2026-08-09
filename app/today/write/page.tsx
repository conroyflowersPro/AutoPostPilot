"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LengthControl =
  | "KEEP"
  | "SHORT"
  | "MEDIUM"
  | "LONG"
  | "VERY_LONG"
  | "AUTO";

export default function CreatorWritePage() {
  const router = useRouter();
  const supabase = createClient();

  const [text, setText] = useState("");
  const [rawSnapshot, setRawSnapshot] = useState("");
  const [pipelineId, setPipelineId] = useState("42303");
  const [lengthControl, setLengthControl] = useState<LengthControl>("AUTO");
  const [initiative] = useState<"CREATOR_INITIATED">("CREATOR_INITIATED");
  const [aiTransformation, setAiTransformation] = useState<
    "NONE" | "POLISH" | "GENERATIVE_REWRITE"
  >("NONE");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextIndicators, setContextIndicators] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/context/current");
        if (!res.ok) return;
        const body = await res.json();
        const ind = body?.context?.indicators;
        if (!cancelled && Array.isArray(ind)) setContextIndicators(ind.map(String));
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canAct = useMemo(() => text.trim().length > 0 && !busy, [text, busy]);

  async function runTransform(mode: "POLISH" | "AI_WRITE") {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(mode === "POLISH" ? "다듬는 중…" : "AI 작성 중…");
    try {
      if (!rawSnapshot) setRawSnapshot(text);

      const res = await fetch("/api/grok/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text,
          length_control: lengthControl,
          initiative_origin: initiative,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setText(body.text || text);
      setAiTransformation(
        mode === "POLISH" ? "POLISH" : "GENERATIVE_REWRITE"
      );
      setMsg(
        mode === "POLISH"
          ? "다듬기 완료 — 직접 수정 가능"
          : "AI 작성 완료 — 직접 수정 가능"
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const payload: Record<string, unknown> = {
        content: text.trim(),
        status: "draft",
        pipeline_id: pipelineId,
        user_id: user.id,
      };

      const meta = {
        initiative_origin: initiative,
        ai_transformation: aiTransformation,
        creator_raw_input: rawSnapshot || text,
        length_control: lengthControl,
        writing_path: "daily_creator_write_v1",
      };

      let data: { id: string } | null = null;
      let insertError: { message?: string } | null = null;

      const first = await supabase
        .from("SeungContent")
        .insert({ ...payload, meta })
        .select("id")
        .single();
      if (first.error) {
        const second = await supabase
          .from("SeungContent")
          .insert(payload)
          .select("id")
          .single();
        data = second.data;
        insertError = second.error;
      } else {
        data = first.data;
      }

      if (insertError) throw insertError;
      if (!data?.id) throw new Error("저장 실패");

      router.push(`/posts/${data.id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/today" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">직접 쓰기</h1>
          <span className="ml-auto text-[10px] text-zinc-500">
            CREATOR_INITIATED · {aiTransformation}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="text-xs text-zinc-500">
          X에 쓰듯 그냥 적으세요. 주제/프롬프트 입력창은 없습니다. 필요할 때만
          다듬기 또는 AI 작성.
        </p>
        {contextIndicators.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {contextIndicators.map((ind) => (
              <span
                key={ind}
                className="rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] text-emerald-300"
              >
                {ind}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPipelineId("42303")}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              pipelineId === "42303"
                ? "bg-emerald-600"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            한국어 42303
          </button>
          <button
            type="button"
            onClick={() => setPipelineId("20121")}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              pipelineId === "20121"
                ? "bg-emerald-600"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            영어 20121
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="예: FSD 요즘 사람처럼 운전하는데... 참 거시기다."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-relaxed outline-none focus:border-emerald-500"
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-zinc-500">길이</span>
          {(
            [
              "AUTO",
              "KEEP",
              "SHORT",
              "MEDIUM",
              "LONG",
              "VERY_LONG",
            ] as LengthControl[]
          ).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLengthControl(l)}
              className={`rounded px-2 py-1 text-[10px] ${
                lengthControl === l
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-900 text-zinc-400"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canAct}
            onClick={() => runTransform("POLISH")}
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600 disabled:opacity-40"
          >
            다듬기
          </button>
          <button
            type="button"
            disabled={!canAct}
            onClick={() => runTransform("AI_WRITE")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-40"
          >
            AI 작성
          </button>
          <button
            type="button"
            disabled={!canAct}
            onClick={saveDraft}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500 disabled:opacity-40"
          >
            초안 저장
          </button>
        </div>

        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        {error && (
          <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-zinc-600">
          POLISH = 의미 보존 편집 · AI 작성 = 의도/문맥 기반 완성 포스트. 둘 다
          주제 선택은 Creator. 존재하지 않는 경험은 만들지 않습니다.
        </p>
      </main>
    </div>
  );
}
