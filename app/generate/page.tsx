"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 800;
  let { width, height } = bitmap;
  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas failed");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("compress failed"))),
      "image/jpeg",
      0.7
    );
  });
}

async function readJson(res: Response) {
  const rawText = await res.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `서버 응답 오류 (${res.status}): ${rawText.slice(0, 100) || "타임아웃"}`
    );
  }
  if (!res.ok) {
    throw new Error(
      data.detail
        ? `${data.error}: ${String(data.detail).slice(0, 180)}`
        : data.error || `요청 실패 (${res.status})`
    );
  }
  return data;
}

/** Always 1 post per call */
function chunkCounts(n: number): number[] {
  const out: number[] = [];
  let left = Math.max(1, n);
  while (left > 0) {
    out.push(1);
    left -= 1;
  }
  return out.length ? out : [1];
}

export default function GeneratePage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [keywords, setKeywords] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const max = 1;
    const room = max - files.length;
    if (room <= 0) return;
    const nextFiles: File[] = [];
    Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room)
      .forEach((file) => {
        nextFiles.push(file);
        const reader = new FileReader();
        reader.onload = () => {
          setPreviews((prev) => [...prev, reader.result as string].slice(0, max));
        };
        reader.readAsDataURL(file);
      });
    setFiles((prev) => [...prev, ...nextFiles].slice(0, max));
  }

  function removePreview(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadKeywordImages(): Promise<string[]> {
    const urls: string[] = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요합니다");
    for (let i = 0; i < files.length; i++) {
      const blob = await compressImage(files[i]);
      const path = `keywords/${user.id}/${Date.now()}-${i}.jpg`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (upErr) throw new Error(`스샷 업로드 실패: ${upErr.message}`);
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      if (!publicUrl || !publicUrl.startsWith("http")) throw new Error("공개 URL 생성 실패");
      urls.push(publicUrl);
    }
    return urls;
  }

  async function generateBatch(
    dayOffset: number,
    count: number,
    themes: string[],
    mergedKeywords: string,
    attempt = 1
  ): Promise<{ posts: any[]; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("로그인이 필요합니다");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL 없음");

      const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          startDate,
          count: 1,
          dayOffset,
          keywords: keywords.trim() || undefined,
          mergedKeywords: mergedKeywords || undefined,
          themes,
        }),
      });
      const data = await readJson(genRes);
      return { posts: data.posts || [] };
    } catch (err: any) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200));
        return generateBatch(dayOffset, count, themes, mergedKeywords, attempt + 1);
      }
      return { posts: [], error: err.message || "실패" };
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setPhase(null);
    try {
      let mergedKeywords = keywords.trim();
      if (files.length > 0) {
        try {
          setPhase("스샷 업로드 중...");
          const imageUrls = await uploadKeywordImages();
          setPhase("키워드 추출 중...");
          const extractRes = await fetch("/api/grok/extract-keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: imageUrls, keywords: keywords.trim() || undefined }),
          });
          const extractData = await readJson(extractRes);
          mergedKeywords =
            extractData.mergedKeywords ||
            (extractData.keywords || []).join(", ") ||
            keywords.trim();
        } catch {
          setPhase("스샷 생략 — 텍스트 키워드로 진행");
        }
      }

      setPhase("일별 개수 계획 중...");
      let planDays: { dayOffset: number; count: number; themes: string[] }[] = [];
      let rationale: string | null = null;
      try {
        const planRes = await fetch("/api/grok/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate,
            keywords: keywords.trim() || undefined,
            mergedKeywords: mergedKeywords || undefined,
          }),
        });
        const planData = await readJson(planRes);
        planDays = planData.days || [];
        rationale = planData.rationale || null;
      } catch {
        planDays = [
          { dayOffset: 0, count: 3, themes: [] },
          { dayOffset: 1, count: 3, themes: [] },
          { dayOffset: 2, count: 3, themes: [] },
        ];
        rationale = "계획 API 실패 — 기본 3개/일";
      }

      const allPosts: any[] = [];
      const batchErrors: string[] = [];

      for (let di = 0; di < planDays.length; di++) {
        const day = planDays[di];
        const chunks = chunkCounts(day.count);
        for (let bi = 0; bi < chunks.length; bi++) {
          setPhase(
            `Day ${di + 1}/3 · ${bi + 1}/${chunks.length} 작성 중... (누적 ${allPosts.length})`
          );
          const { posts, error: err } = await generateBatch(
            day.dayOffset,
            chunks[bi],
            day.themes || [],
            mergedKeywords
          );
          if (posts.length) allPosts.push(...posts);
          if (err) batchErrors.push(`D${di + 1}B${bi + 1}: ${err}`);
        }
      }

      if (allPosts.length === 0) {
        throw new Error(batchErrors.join(" / ") || "생성된 포스트가 없습니다.");
      }

      setResult({
        success: true,
        count: allPosts.length,
        posts: allPosts,
        mergedKeywords,
        plan: planDays,
        rationale,
        batchErrors,
        model: "grok-4.5",
      });
    } catch (err: any) {
      setError(err.message || "알 수 없는 오류");
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">←</Link>
          <h1 className="text-lg font-semibold">특화 Grok 자동 생성</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">v2.2.1</span>
          <Link href="/" className="ml-auto text-xs text-zinc-400 hover:text-zinc-200">현황</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-zinc-400">
          Grok이 일별 개수를 정한 뒤 1개씩 순차 생성합니다 (Supabase Edge Function).
        </p>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">시작 날짜</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">키워드 / 테마 (선택)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="원하는 주제 입력 (비우면 Grok이 믹스)"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <div className="space-y-2 rounded-lg bg-red-900/30 px-3 py-3">
              <p className="text-xs text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600"
              >
                현황으로 돌아가기 →
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? phase || "처리 중..." : "3일치 한국어 포스트 자동 생성"}
          </button>
        </form>

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm">
              <p className="font-medium text-emerald-300">
                {result.count}개 포스트가 draft로 저장되었습니다.
              </p>
              {result.batchErrors?.length > 0 && (
                <p className="mt-1 text-xs text-amber-300">
                  일부 묶음 실패: {result.batchErrors.join(" · ")}
                </p>
              )}
              <button
                onClick={() => router.push("/")}
                className="mt-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600"
              >
                현황으로 →
              </button>
            </div>
            <div className="space-y-3">
              {result.posts?.map((p: any, i: number) => (
                <div key={p.id || i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                    <span>Day +{p.dayOffset ?? 0}</span>
                    {p.score != null && <span className="text-emerald-400">점수 {p.score}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
