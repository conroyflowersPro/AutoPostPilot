"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

type ContentPlanDay = {
  dayOffset: number;
  posts: ContentSlot[];
};

type ContentPlan = {
  generationDays: number;
  days: ContentPlanDay[];
  rationale?: string;
};

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

function extractOpeningConclusion(content: string): {
  opening: string;
  conclusion: string;
} {
  const lines = (content || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return { opening: "", conclusion: "" };
  if (lines.length === 1)
    return {
      opening: lines[0].slice(0, 120),
      conclusion: lines[0].slice(0, 120),
    };
  return {
    opening: lines[0].slice(0, 120),
    conclusion: lines[lines.length - 1].slice(0, 120),
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

function saveJob(state: GenerationJobState) {
  try {
    localStorage.setItem(LS_PREFIX + state.jobId, JSON.stringify(state));
    localStorage.setItem(LS_PREFIX + "latest", state.jobId);
  } catch {
    /* ignore */
  }
}

function loadLatestJob(): GenerationJobState | null {
  try {
    const id = localStorage.getItem(LS_PREFIX + "latest");
    if (!id) return null;
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as GenerationJobState;
  } catch {
    return null;
  }
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
  const [resumeJob, setResumeJob] = useState<GenerationJobState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const job = loadLatestJob();
    if (job && job.status === "processing" && job.nextDayOffset < job.generationDays) {
      setResumeJob(job);
      setStartDate(job.startDate);
    }
  }, []);

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
  ): Promise<{ posts: any[]; error?: string }> {
    try {
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
    } catch (err: any) {
      return { posts: [], error: err.message || "실패" };
    }
  }

  function accumulateUsed(
    used: UsedRecord,
    slots: ContentSlot[],
    posts: any[]
  ): UsedRecord {
    const next = { ...used };
    for (const s of slots) {
      if (s.primaryTopic) next.usedTopics = [...next.usedTopics, s.primaryTopic];
      if (s.angle) next.usedAngles = [...next.usedAngles, s.angle];
    }
    for (const p of posts) {
      const { opening, conclusion } = extractOpeningConclusion(p.content || "");
      if (opening) next.usedOpenings = [...next.usedOpenings, opening];
      if (conclusion) next.usedConclusions = [...next.usedConclusions, conclusion];
    }
    return next;
  }

  async function runGeneration(existingJob?: GenerationJobState | null) {
    setLoading(true);
    setError(null);
    setResult(null);
    setPhase(null);
    setResumeJob(null);

    try {
      let jobId = existingJob?.jobId || crypto.randomUUID();
      let plan: ContentPlan | undefined = existingJob?.plan;
      let usedRecord: UsedRecord = existingJob?.usedRecord || emptyUsedRecord();
      let startFrom = existingJob?.nextDayOffset ?? 0;
      let mergedKeywords = existingJob?.mergedKeywords || keywords.trim();
      let audienceInterests: string[] = [];
      let audienceTopicCategories: string[] = [];
      let audienceSentiment: string | null = null;

      if (!existingJob) {
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
            if (extractData.sentiment) {
              audienceSentiment = String(extractData.sentiment);
            }
          } catch {
            setPhase("키워드 변환 생략 — 기본 계획으로 진행");
          }
        }

        setPhase("이번 주 슬롯 계획 중...");
        try {
          let recentTopics: string[] = [];
          try {
            const { data: recentRows } = await supabase
              .from("SeungContent")
              .select("content, status")
              .in("status", ["scheduled", "reviewed", "published", "draft"])
              .order("created_at", { ascending: false })
              .limit(40);
            const ranked = (recentRows || []).slice().sort((a: any, b: any) => {
              const rank = (s: string) =>
                s === "published" || s === "scheduled" ? 0 : s === "reviewed" ? 1 : 2;
              return rank(a.status) - rank(b.status);
            });
            recentTopics = ranked
              .map((r: { content?: string }) =>
                String(r.content || "").replace(/\s+/g, " ").trim().slice(0, 80)
              )
              .filter(Boolean)
              .slice(0, 20);
          } catch {
            /* non-fatal */
          }

          const planRes = await fetch("/api/grok/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate,
              keywords: keywords.trim() || undefined,
              mergedKeywords: mergedKeywords || undefined,
              generationDays: GENERATION_DAYS,
              recentTopics: recentTopics.length > 0 ? recentTopics : undefined,
              interests: audienceInterests.length > 0 ? audienceInterests : undefined,
              topicCategories:
                audienceTopicCategories.length > 0
                  ? audienceTopicCategories
                  : undefined,
              sentiment: audienceSentiment || undefined,
            }),
          });
          const planData = await readJson(planRes);
          plan = {
            generationDays: planData.generationDays || GENERATION_DAYS,
            days: planData.days || [],
            rationale: planData.rationale || undefined,
          };
        } catch (planErr: any) {
          const domainSlots = [
            { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" as TargetLength },
            { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" as TargetLength },
            { primaryTopic: "Robotaxi / 자율주행 관찰", angle: "장기 제품 방향에 대한 개인 해석", contentType: "opinion", targetLength: "medium" as TargetLength },
            { primaryTopic: "LAFC / 축구 일상", angle: "경기장·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" as TargetLength },
            { primaryTopic: "앱·업무 운영", angle: "개발·반복 테스트에서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" as TargetLength },
          ];
          plan = {
            generationDays: GENERATION_DAYS,
            days: Array.from({ length: GENERATION_DAYS }, (_, i) => ({
              dayOffset: i,
              posts: domainSlots.map((s, n) => ({
                slotId: `D${i + 1}P${n + 1}`,
                primaryTopic: s.primaryTopic,
                angle: s.angle,
                contentType: s.contentType,
                allowedContext: [],
                forbiddenTopics: ["주가", "등락", "매매"],
                targetLength: s.targetLength,
              })),
            })),
            rationale: `계획 실패 대체: ${String(planErr?.message || planErr).slice(0, 80)}`,
          };
        }

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
      }

      if (!plan || !plan.days?.length) {
        throw new Error("콘텐츠 계획이 비어 있습니다.");
      }

      const allPosts: any[] = [];
      const dayErrors: string[] = [];
      const generationDays = plan.generationDays || GENERATION_DAYS;

      for (let di = startFrom; di < generationDays; di++) {
        const day = plan.days.find((d) => d.dayOffset === di) || plan.days[di];
        if (!day || !day.posts?.length) {
          dayErrors.push(`D${di + 1}: 슬롯 없음`);
          continue;
        }
        setPhase(
          `Day ${di + 1}/${generationDays} 초안 생성 중... (슬롯 ${day.posts.length}개 · 누적 ${allPosts.length})`
        );
        saveJob({
          jobId,
          startDate,
          generationDays,
          nextDayOffset: di,
          usedRecord,
          status: "processing",
          updatedAt: new Date().toISOString(),
          plan,
          mergedKeywords,
        });
        const { posts, error: err } = await callGenerateDay(
          jobId,
          day.dayOffset,
          day.posts,
          usedRecord
        );
        if (posts.length) {
          allPosts.push(...posts);
          usedRecord = accumulateUsed(usedRecord, day.posts, posts);
        }
        if (err) dayErrors.push(`D${di + 1}: ${err}`);
        saveJob({
          jobId,
          startDate,
          generationDays,
          nextDayOffset: di + 1,
          usedRecord,
          status: di + 1 >= generationDays ? "completed" : "processing",
          updatedAt: new Date().toISOString(),
          plan,
          mergedKeywords,
        });
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
        model: "grok-4.5",
      });
    } catch (err: any) {
      setError(err.message || "알 수 없는 오류");
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    await runGeneration(null);
  }

  async function handleResume() {
    if (!resumeJob) return;
    await runGeneration(resumeJob);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">이번 주 계획</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            v6.2.3
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-zinc-400">
          이번 주 전략을 먼저 잡고, 날짜별 초안을 만듭니다. 관심사 키워드는 글에 넣지 않고 신호로만 씁니다.
        </p>

        {resumeJob && !loading && !result && (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm">
            <p className="text-amber-200">
              이전 작업이 중단되어 있습니다 (Day {resumeJob.nextDayOffset + 1}/
              {resumeJob.generationDays}부터).
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={handleResume} className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs hover:bg-amber-600">
                이어서 만들기
              </button>
              <button type="button" onClick={() => setResumeJob(null)} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600">
                새로 시작
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">시작 날짜</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">
              관심사 키워드 / 테마 (선택 · 글에 넣지 않음, 신호만)
            </label>
            <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="예: Terafab, Optimus, Grimes County" className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">키워드 스크린샷 (선택, 1장)</label>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center rounded-xl border border-dashed border-zinc-600 bg-zinc-900/80 px-4 py-5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
              🖼 스샷 / 사진 추가
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} className="hidden" />
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-zinc-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`keyword-${i}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removePreview(i)} className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-[10px] text-white">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="space-y-2 rounded-lg bg-red-900/30 px-3 py-3">
              <p className="text-xs text-red-300">{error}</p>
              <button type="button" onClick={() => router.push("/")} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600">홈으로 →</button>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
            {loading ? phase || "처리 중..." : "이번 주 전략 만들기"}
          </button>
        </form>

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm">
              <p className="font-medium text-emerald-300">{result.count}개 포스트가 draft로 저장되었습니다.</p>
              {result.plan && (
                <p className="mt-2 text-xs text-zinc-300">
                  계획:{" "}
                  {result.plan.map((d: any) => `D${d.dayOffset + 1}=${d.count}개` + (d.themes?.length ? `(${d.themes.slice(0, 2).join(", ")})` : "")).join(" · ")}
                </p>
              )}
              {result.rationale && <p className="mt-1 text-xs text-zinc-400">{result.rationale}</p>}
              {result.batchErrors?.length > 0 && (
                <p className="mt-1 text-xs text-amber-300">일부 날짜 실패: {result.batchErrors.join(" · ")}</p>
              )}
              <button onClick={() => router.push("/")} className="mt-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600">목록으로 →</button>
            </div>
            <div className="space-y-3">
              {result.posts?.map((p: any, i: number) => (
                <div key={p.id || i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                    <span>Day +{p.dayOffset ?? 0}</span>
                    {p.slotId && <span>{p.slotId}</span>}
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
