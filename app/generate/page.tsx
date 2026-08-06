"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function GeneratePage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/grok/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          days: 3,
          countPerDay: 4,
          keywords: keywords.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
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
          <h1 className="text-lg font-semibold">특화 Grok 자동 생성</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            v1.1.1
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-zinc-400">
          날짜를 정하면 특화 Grok이 X 알고리즘 기준으로 약 3일치 한국어
          포스트를 자동으로 작성합니다. 허위 경험/에피소드는 쓰지 않습니다.
          생성된 글은 draft로 저장되며, 각 포스트에 추천 미디어가 표시됩니다.
        </p>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">
              시작 날짜
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">
              키워드 / 테마 (선택)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="예: FSD 주차, LAFC, Cybertruck 짐"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading
              ? "특화 Grok이 작성 중..."
              : "3일치 한국어 포스트 자동 생성"}
          </button>
        </form>

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm">
              <p className="font-medium text-emerald-300">
                {result.count}개 포스트가 draft로 저장되었습니다.
              </p>
              {result.keywordRequest && (
                <p className="mt-2 text-amber-300 text-xs">
                  Grok 요청: {result.keywordRequest}
                </p>
              )}
              <button
                onClick={() => router.push("/")}
                className="mt-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600"
              >
                목록으로 가서 미디어 올리고 스케줄하기 →
              </button>
            </div>

            <div className="space-y-3">
              {result.posts?.map((p: any, i: number) => (
                <div
                  key={p.id || i}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                    <span>Day +{p.dayOffset ?? 0}</span>
                    {p.score != null && (
                      <span className="text-emerald-400">점수 {p.score}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {p.content}
                  </p>
                  {p.suggestedMedia && (
                    <p className="mt-2 text-xs text-amber-300">
                      📷 추천: {p.suggestedMedia}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
