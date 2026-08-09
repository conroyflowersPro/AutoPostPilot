"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION_LABEL } from "@/lib/version";

type MemoryRow = {
  id: string;
  version: number;
  summary_ko: string | null;
  patterns: string[] | null;
  created_at: string;
};

export default function LearningPage() {
  const [csvText, setCsvText] = useState("");
  const [origin, setOrigin] = useState<"unknown" | "ai" | "manual">("unknown");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [latestMemory, setLatestMemory] = useState<MemoryRow | null>(null);
  const supabase = createClient();

  async function refreshMemory() {
    try {
      const { data } = await supabase
        .from("planner_memory")
        .select("id, version, summary_ko, patterns, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestMemory((data as MemoryRow) || null);
    } catch {
      setLatestMemory(null);
    }
  }

  useEffect(() => {
    refreshMemory();
  }, []);

  async function handleFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function runCycle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setPhase("CSV 가져오는 중…");
      const impRes = await fetch("/api/learning/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          origin,
          notes: notes || undefined,
        }),
      });
      const imp = await impRes.json();
      if (!impRes.ok) {
        throw new Error(imp.detail || imp.error || "import failed");
      }

      setPhase("성과 분석 & Memory 갱신 중…");
      const anRes = await fetch("/api/learning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningRunId: imp.learningRunId }),
      });
      const an = await anRes.json();
      if (!anRes.ok) {
        throw new Error(an.detail || an.error || "analyze failed");
      }

      setResult({ import: imp, analyze: an });
      await refreshMemory();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">주간 학습 (Learning)</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {APP_VERSION_LABEL}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">Growth Intelligence Engine v4</p>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
            X Analytics Content CSV 우선. 생성·발행 직후 Memory 갱신 안 함.
            검증된 고성과만 Planner Memory / Creator·Audience·Performance·Revenue DNA에 반영.
            권장 학습 주기: 약 14일. 노출만으로 학습하지 않습니다.
          </p>
        </div>

        {latestMemory && (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm">
            <p className="text-xs text-emerald-400">
              최신 Planner Memory · v{latestMemory.version}
            </p>
            <p className="mt-1 text-zinc-200">{latestMemory.summary_ko}</p>
            {Array.isArray(latestMemory.patterns) &&
              latestMemory.patterns.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                  {latestMemory.patterns.slice(0, 5).map((p, i) => (
                    <li key={i} className="truncate">
                      · {p}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}

        <form onSubmit={runCycle} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">
              X Analytics Content CSV (우선) / Fedica CSV
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="mb-2 block w-full text-xs text-zinc-400"
            />
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder="Post text,Impressions,Likes,New follows,Profile visits,Bookmarks,..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">출처</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as any)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="unknown">unknown</option>
                <option value="ai">AI 생성</option>
                <option value="manual">수동 작성 (premium)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-400">메모</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 2026-07-25~08-07 X Analytics export"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !csvText.trim()}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? phase || "처리 중…" : "가져오기 → 분석 → Memory 갱신"}
          </button>
        </form>

        {result && (
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm">
            <p className="font-medium text-emerald-300">학습 주기 완료</p>
            <p className="mt-1 text-xs text-zinc-300">
              import {result.import.imported}건 · Memory v
              {result.analyze.version} · 고성과{" "}
              {result.analyze.memory?.successCount ?? "—"} /{" "}
              {result.analyze.memory?.analyzedCount ?? "—"}
            </p>
            {result.analyze.memory?.summaryKo && (
              <p className="mt-2 text-xs text-zinc-400">
                {result.analyze.memory.summaryKo}
              </p>
            )}
            {result.analyze.performanceDna?.summaryKo && (
              <p className="mt-1 text-xs text-emerald-400/80">
                {result.analyze.performanceDna.summaryKo}
                {result.analyze.performanceDna.topicWins?.length
                  ? ` · ${result.analyze.performanceDna.topicWins.join(", ")}`
                  : ""}
              </p>
            )}
            <p className="mt-3 text-xs text-zinc-500">
              다음 주 생성 시 plan이 이 Memory·DNA를 읽습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
