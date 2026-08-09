"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION_LABEL, BUILD_STAMP } from "@/lib/version";

const GENERATION_DAYS = 7;
const LS_PREFIX = "autopostpilot_generation_job_";

type TargetLength = "short" | "medium" | "long";
type ContentSlot = {
  slotId: string;
  primaryTopic: string;
  angle: string;
  contentType: string;
  allowedContext: string[];
  forbiddenTopics: string[];
  targetLength: TargetLength;
};
type ContentPlanDay = { dayOffset: number; posts: ContentSlot[] };
type ContentPlan = { generationDays: number; days: ContentPlanDay[]; rationale?: string };
type UsedRecord = {
  usedTopics: string[];
  usedAngles: string[];
  usedExamples: string[];
  usedPlaces: string[];
  usedOpenings: string[];
  usedConclusions: string[];
};
type GenerationJobState = {
  jobId: string;
  startDate: string;
  generationDays: number;
  nextDayOffset: number;
  usedRecord: UsedRecord;
  status: "processing" | "completed" | "failed";
  updatedAt: string;
  plan?: ContentPlan;
  mergedKeywords?: string;
};

function emptyUsedRecord(): UsedRecord {
  return {
    usedTopics: [],
    usedAngles: [],
    usedExamples: [],
    usedPlaces: [],
    usedOpenings: [],
    usedConclusions: [],
  };
}

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
    throw new Error(`서버 응답 오류 (${res.status}): ${rawText.slice(0, 100) || "타임아웃"}`);
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

function saveJob(state: GenerationJobState) {
  try {
    localStorage.setItem(LS_PREFIX + state.jobId, JSON.stringify(state));
    localStorage.setItem(LS_PREFIX + "latest", state.jobId);
  } catch {
    /* ignore */
  }
}

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const s = searchParams.get("start");
    if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) setStartDate(s);
  }, [searchParams]);
  const [keywords, setKeywords] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요합니다");
    for (let i = 0; i < files.length; i++) {
      const blob = await compressImage(files[i]);
      const path = `keywords/${user.id}/${Date.now()}-${i}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw new Error(`스샷 업로드 실패: ${upErr.message}`);
      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);
      if (!publicUrl || !publicUrl.startsWith("http")) {
        throw new Error("공개 URL 생성 실패");
      }
      urls.push(publicUrl);
    }
    return urls;
  }

  async function callGenerateDay(
    jobId: string,
    dayOffset: number,
    slots: ContentSlot[],
    usedRecord: UsedRecord
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
      body: JSON.stringify({ jobId, startDate, dayOffset, slots, usedRecord }),
    });
    const data = await readJson(genRes);
    return { posts: data.posts || [] };
  }

  async function runGeneration() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const jobId = crypto.randomUUID();
      let mergedKeywords = keywords.trim();
      let audienceInterests: string[] = [];
      let audienceTopicCategories: string[] = [];
      let audienceSentiment: string | null = null;

      if (files.length > 0 || keywords.trim()) {
        try {
          let imageUrls: string[] = [];
          if (files.length > 0) {
            setPhase("스샷 업로드 중...");
            imageUrls = await uploadKeywordImages();
          }
          setPhase("Audience Intelligence 변환 중...");
          const extractRes = await fetch("/api/grok/extract-keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              images: imageUrls.length ? imageUrls : undefined,
              keywords: keywords.trim() || undefined,
            }),
          });
          const extractData = await readJson(extractRes);
          mergedKeywords =
            extractData.mergedKeywords ||
            (extractData.keywords || []).join(", ") ||
            keywords.trim();
          if (Array.isArray(extractData.interests)) {
            audienceInterests = extractData.interests
              .map((x: unknown) => String(x).trim())
              .filter(Boolean);
          }
          if (Array.isArray(extractData.topicCategories)) {
            audienceTopicCategories = extractData.topicCategories
              .map((x: unknown) => String(x).trim())
              .filter(Boolean);
          }
          if (extractData.sentiment) audienceSentiment = String(extractData.sentiment);
        } catch {
          setPhase("키워드 변환 생략");
        }
      }

      const TIME_NOISE =
        /best\s*time|posting\s*time|time\s*zone|timezone|reach by time|followers by time|최적.*시간|게시\s*시간|타임존/i;
      audienceInterests = audienceInterests.filter((x) => !TIME_NOISE.test(x));
      audienceTopicCategories = audienceTopicCategories.filter((x) => !TIME_NOISE.test(x));

      setPhase("이번 주 슬롯 계획 중...");
      let publishedTopics: string[] = [];
      let scheduledTopics: string[] = [];
      try {
        const { data: topicRows } = await supabase
          .from("SeungContent")
          .select("content, status")
          .in("status", ["published", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(40);
        for (const r of topicRows || []) {
          const snippet = String((r as any).content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
          if (!snippet) continue;
          if ((r as any).status === "published") publishedTopics.push(snippet);
          else if ((r as any).status === "scheduled") scheduledTopics.push(snippet);
        }
        publishedTopics = publishedTopics.slice(0, 12);
        scheduledTopics = scheduledTopics.slice(0, 12);
      } catch {
        /* non-fatal */
      }

      let planData: any;
      try {
        const planRes = await fetch("/api/grok/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate,
            keywords: keywords.trim() || undefined,
            mergedKeywords: mergedKeywords || undefined,
            generationDays: GENERATION_DAYS,
            recentTopics: publishedTopics.length ? publishedTopics : undefined,
            publishedTopics: publishedTopics.length ? publishedTopics : undefined,
            scheduledTopics: scheduledTopics.length ? scheduledTopics : undefined,
            interests: audienceInterests.length ? audienceInterests : undefined,
            topicCategories: audienceTopicCategories.length
              ? audienceTopicCategories
              : undefined,
            sentiment: audienceSentiment || undefined,
          }),
        });
        planData = await readJson(planRes);
      } catch (planErr: any) {
        throw new Error(
          `주간 계획 생성에 실패했습니다. 다시 시도해주세요. (${String(planErr?.message || planErr).slice(0, 120)})`
        );
      }

      if (planData?.fallback === true) {
        throw new Error(
          `주간 계획 생성에 실패했습니다 (서버 fallback). 자동 대체 계획으로 초안을 만들지 않습니다.`
        );
      }
      if (!planData?.days?.length) {
        throw new Error("주간 계획 결과가 비어 있습니다. 초안 생성을 중단했습니다.");
      }

      const plan: ContentPlan = {
        generationDays: planData.generationDays || GENERATION_DAYS,
        days: planData.days,
        rationale: planData.rationale || undefined,
      };

      let usedRecord = emptyUsedRecord();
      saveJob({
        jobId,
        startDate,
        generationDays: GENERATION_DAYS,
        nextDayOffset: 0,
        usedRecord,
        status: "processing",
        updatedAt: new Date().toISOString(),
        plan,
        mergedKeywords,
      });

      const allPosts: any[] = [];
      const dayErrors: string[] = [];
      const generationDays = plan.generationDays || GENERATION_DAYS;

      for (let di = 0; di < generationDays; di++) {
        const day = plan.days.find((d) => d.dayOffset === di) || plan.days[di];
        if (!day?.posts?.length) {
          dayErrors.push(`D${di + 1}: 슬롯 없음`);
          continue;
        }
        setPhase(`Day ${di + 1}/${generationDays} 초안 생성 중...`);
        try {
          const { posts } = await callGenerateDay(jobId, day.dayOffset, day.posts, usedRecord);
          if (posts.length) {
            allPosts.push(...posts);
            for (const s of day.posts) {
              if (s.primaryTopic) usedRecord.usedTopics.push(s.primaryTopic);
              if (s.angle) usedRecord.usedAngles.push(s.angle);
            }
          }
        } catch (e: any) {
          dayErrors.push(`D${di + 1}: ${e?.message || e}`);
        }
      }

      if (allPosts.length === 0) {
        throw new Error(dayErrors.join(" / ") || "생성된 포스트가 없습니다.");
      }

      saveJob({
        jobId,
        startDate,
        generationDays,
        nextDayOffset: generationDays,
        usedRecord,
        status: "completed",
        updatedAt: new Date().toISOString(),
        plan,
        mergedKeywords,
      });

      setResult({
        success: true,
        count: allPosts.length,
        posts: allPosts,
        mergedKeywords,
        plan: plan.days.map((d) => ({
          dayOffset: d.dayOffset,
          count: d.posts.length,
          themes: d.posts.map((p) => p.primaryTopic).slice(0, 3),
        })),
        rationale: plan.rationale,
        batchErrors: dayErrors,
        dna_sources: planData?.dna_sources,
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-medium">이번 주 계획</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {APP_VERSION_LABEL}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          키워드·스샷은 글에 넣지 않고 관심사 신호로만 씁니다. Planner 실패 시 자동 대체 초안을
          만들지 않습니다.
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-600">{BUILD_STAMP}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runGeneration();
        }}
        className="space-y-4"
      >
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
          <label className="mb-1.5 block text-xs text-zinc-400">
            관심사 키워드 / 테마 (선택 · 글에 넣지 않음, 신호만)
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: Terafab, Optimus, Grimes County"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-zinc-400">키워드 스크린샷 (선택, 1장)</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center rounded-xl border border-dashed border-zinc-600 bg-zinc-900/80 px-4 py-5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            🖼 스샷 / 사진 추가
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-lg border border-zinc-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`keyword-${i}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePreview(i)}
                    className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-[10px] text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {error && (
          <div className="space-y-2 rounded-lg bg-red-900/30 px-3 py-3">
            <p className="text-xs text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600"
            >
              홈으로 →
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? phase || "처리 중..." : "이번 주 전략 만들기"}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-500">이번 주 전략 요약</p>
            {result.rationale && <p className="text-sm text-zinc-200">{result.rationale}</p>}
            {result.dna_sources && (
              <p className="text-[10px] text-zinc-500">
                DNA: creator={result.dna_sources.creator} · performance=
                {result.dna_sources.performance}
              </p>
            )}
            {result.plan && (
              <div className="rounded-lg bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
                {result.plan.map((d: any) => (
                  <div
                    key={d.dayOffset}
                    className="flex gap-2 border-b border-zinc-800/80 py-1 last:border-0"
                  >
                    <span className="w-10 text-zinc-500">D{d.dayOffset + 1}</span>
                    <span>
                      {d.count}개
                      {d.themes?.length ? ` · ${d.themes.slice(0, 3).join(", ")}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="font-medium text-emerald-300">
              {result.count}개 초안이 draft로 저장되었습니다.
            </p>
            {result.batchErrors?.length > 0 && (
              <p className="text-xs text-amber-300">
                일부 날짜 실패: {result.batchErrors.join(" · ")}
              </p>
            )}
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600"
            >
              목록으로 →
            </button>
          </div>
          <div className="space-y-3">
            {result.posts?.map((p: any, i: number) => (
              <div key={p.id || i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                  <span>Day +{p.dayOffset ?? 0}</span>
                  {p.slotId && <span>{p.slotId}</span>}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-500">계획 화면 준비 중…</div>
      }
    >
      <GeneratePageInner />
    </Suspense>
  );
}
