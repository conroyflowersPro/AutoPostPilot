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

  async function handleImport() {
    if (!csvText.trim()) {
      setError("CSV 내용이 필요합니다.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setPhase("CSV 가져오는 중…");
    try {
      const res = await fetch("/api/learning/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          origin,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);

      setPhase("성과 분석 & 학습 반영 중…");
      const res2 = await fetch("/api/learning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningRunId: data.learningRunId }),
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) {
        throw new Error(data2.error || data2.detail || "분석 실패");
      }
      setResult({ import: data, analyze: data2 });
      await refreshMemory();
      setPhase(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">성장 인사이트 · 학습</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {APP_VERSION_LABEL}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-zinc-400">
          성과 데이터를 반영해 다음에 무엇을 할지 정리합니다. 발행 직후 바로 학습하지 않습니다.
          충분히 확인된 성과만 전략·크리에이터 이해에 반영합니다.
        </p>

        {latestMemory && (
          <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
            <div className="text-xs text-emerald-400">
              최신 학습 요약 · v{latestMemory.version}
            </div>
            <p className="mt-1 text-zinc-200">{latestMemory.summary_ko}</p>
            {Array.isArray(latestMemory.patterns) &&
              latestMemory.patterns.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">
                  {latestMemory.patterns.slice(0, 5).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
          </section>
        )}

        <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-zinc-500">
            데이터 가져오기 (Advanced)
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-zinc-400">
              성과 CSV 가져오기 (X Analytics 우선)
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-zinc-400"
            />
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder="CSV 붙여넣기 가능"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1 text-zinc-400">
                origin
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value as any)}
                  className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1"
                >
                  <option value="unknown">unknown</option>
                  <option value="ai">ai</option>
                  <option value="manual">manual</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={loading || !csvText.trim()}
              onClick={handleImport}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-40"
            >
              {loading ? phase || "처리 중…" : "가져오기 → 분석 → 학습 반영"}
            </button>
            {error && <p className="text-xs text-red-300">{error}</p>}
            {result && (
              <p className="text-xs text-zinc-400">
                가져오기 {result.import?.imported ?? "?"}건 · 다음 주 계획 만들 때 이 학습 결과를
                참고합니다.
              </p>
            )}
          </div>
        </details>
      </main>
    </div>
  );
}
