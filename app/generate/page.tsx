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
  } catch {}
}

function GeneratePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start") || "";
  const [startDate, setStartDate] = useState(startParam || new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [planSummary, setPlanSummary] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (startParam) setStartDate(startParam);
  }, [startParam]);

  async function runPlanAndGenerate() {
    setBusy(true);
    setError("");
    setDoneCount(0);
    setPlanSummary("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("로그인이 필요합니다.");

      let audienceInterests: string[] = [];
      let audienceTopicCategories: string[] = [];
      let audienceSentiment: string | null = null;
      let topKeyword: string | null = null;
      let topKeywordInterest: string | null = null;
      let rankedKeywords: { keyword: string; visualRank: number; relativeWeight: string }[] = [];
      let mergedKeywords = topic.trim();

      if (files.length > 0 || topic.trim()) {
        setPhase("키워드·스샷 신호 추출 중…");
        try {
          let imageUrls: string[] = [];
          if (files.length > 0) {
            const f = files[0];
            const blob = await compressImage(f);
            const path = `kw/${session.user.id}/${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("media")
              .upload(path, blob, { contentType: "image/jpeg", upsert: true });
            if (!upErr) {
              const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
              if (pub?.publicUrl) imageUrls = [pub.publicUrl];
            }
          }
          const extractRes = await fetch("/api/grok/extract-keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              images: imageUrls,
              keywords: topic.trim() || undefined,
            }),
          });
          const extractData = await readJson(extractRes);
          mergedKeywords =
            extractData.mergedKeywords ||
            (extractData.keywords || []).join(", ") ||
            topic.trim();
          if (Array.isArray(extractData.interests)) {
            audienceInterests = extractData.interests.map(String).filter(Boolean);
          }
          if (Array.isArray(extractData.topicCategories)) {
            audienceTopicCategories = extractData.topicCategories.map(String).filter(Boolean);
          }
          if (extractData.sentiment) audienceSentiment = String(extractData.sentiment);
          if (extractData.topKeyword) topKeyword = String(extractData.topKeyword).trim();
          if (extractData.topKeywordInterest)
            topKeywordInterest = String(extractData.topKeywordInterest).trim();
          if (Array.isArray(extractData.rankedKeywords)) {
            rankedKeywords = extractData.rankedKeywords
              .map((r: any) => ({
                keyword: String(r?.keyword || "").trim(),
                visualRank: Number(r?.visualRank) || 99,
                relativeWeight: String(r?.relativeWeight || "medium"),
              }))
              .filter((r: any) => r.keyword)
              .slice(0, 12);
          }
        } catch {
          setPhase("키워드 변환 생략");
        }
      }

      setPhase("최근 발행·예약 주제 조회…");
      let publishedTopics: string[] = [];
      let scheduledTopics: string[] = [];
      try {
        const { data: published } = await supabase
          .from("SeungContent")
          .select("content, final_text, topic")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(20);
        publishedTopics = (published || [])
          .map((r: any) => String(r.topic || r.content || r.final_text || "").slice(0, 80))
          .filter(Boolean);
        const { data: scheduled } = await supabase
          .from("SeungContent")
          .select("content, final_text, topic")
          .eq("status", "scheduled")
          .order("created_at", { ascending: false })
          .limit(15);
        scheduledTopics = (scheduled || [])
          .map((r: any) => String(r.topic || r.content || r.final_text || "").slice(0, 80))
          .filter(Boolean);
      } catch {}

      setPhase("주간 계획 생성 (compact Edge)…");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("SUPABASE URL 없음");

      const dayBatches: number[][] = [];
      for (let s = 0; s < GENERATION_DAYS; s += 2) {
        dayBatches.push(
          Array.from({ length: Math.min(2, GENERATION_DAYS - s) }, (_, j) => s + j)
        );
      }

      const basePlanBody = {
        generationDays: GENERATION_DAYS,
        topic: topic.trim() || mergedKeywords,
        keywords: mergedKeywords,
        mergedKeywords,
        publishedTopics,
        scheduledTopics,
        interests: audienceInterests.length ? audienceInterests : undefined,
        topicCategories: audienceTopicCategories.length
          ? audienceTopicCategories
          : undefined,
        sentiment: audienceSentiment || undefined,
        topKeyword: topKeyword || undefined,
        topKeywordInterest: topKeywordInterest || undefined,
        rankedKeywords: rankedKeywords.length ? rankedKeywords : undefined,
        useLlm: false,
      };

      const mergedDays: ContentPlanDay[] = [];
      let planRationale = "";
      let planData: any = {};
      let priorUsedSubjects: string[] = [];
      let priorCooldown: Record<string, number> = {};
      for (let bi = 0; bi < dayBatches.length; bi++) {
        const offsets = dayBatches[bi];
        setPhase(
          `주간 계획 ${bi + 1}/${dayBatches.length} (D${offsets[0] + 1}–D${offsets[offsets.length - 1] + 1})…`
        );
        const planRes = await fetch(`${supabaseUrl}/functions/v1/weekly-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            ...basePlanBody,
            dayOffsets: offsets,
            priorUsedSubjects,
            priorCooldown,
          }),
        });
        const part = await readJson(planRes);
        if (!part.success || !Array.isArray(part.days) || part.days.length === 0) {
          throw new Error(
            part.detail
              ? `${part.error || "주간 계획 실패"}: ${part.detail}`
              : part.error ||
                `주간 계획 분할 ${bi + 1}/${dayBatches.length} 실패. 자동 대체 초안 없음.`
          );
        }
        for (const d of part.days) mergedDays.push(d);
        if (part.rationale) planRationale = part.rationale;
        planData = part;
        if (part.prior_handoff?.used_subjects) {
          priorUsedSubjects = part.prior_handoff.used_subjects;
        }
        if (part.prior_handoff?.cooldown) {
          priorCooldown = part.prior_handoff.cooldown;
        }
      }

      mergedDays.sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0));

      const plan: ContentPlan = {
        generationDays: GENERATION_DAYS,
        days: mergedDays,
        rationale: planRationale || planData.rationale,
      };

      const lines = plan.days.map((d) => {
        const topics = (d.posts || []).map((p: any) => p.primaryTopic || p.concrete_subject).join(", ");
        return `D${d.dayOffset + 1}  ${d.posts?.length || 0}개  ${topics}`;
      });
      setPlanSummary(
        [
          plan.rationale || "",
          topKeyword ? `Top keyword: ${topKeyword}` : "",
          `DNA: ${JSON.stringify(planData.dna_sources || {})}`,
          planData.timing ? `timing: ${JSON.stringify(planData.timing)}` : "",
          ...lines,
        ]
          .filter(Boolean)
          .join("\n")
      );

      const jobId = `job_${Date.now()}`;
      let usedRecord = emptyUsedRecord();
      saveJob({
        jobId,
        startDate,
        generationDays: plan.generationDays,
        nextDayOffset: 0,
        usedRecord,
        status: "processing",
        updatedAt: new Date().toISOString(),
        plan,
        mergedKeywords,
      });

      let totalSaved = 0;
      for (let dayOffset = 0; dayOffset < plan.days.length; dayOffset++) {
        const day = plan.days[dayOffset];
        if (!day?.posts?.length) continue;
        setPhase(`Day ${dayOffset + 1}/${plan.days.length} 초안 생성…`);
        const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-post`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            startDate,
            dayOffset: day.dayOffset ?? dayOffset,
            slots: day.posts,
            usedRecord,
            mergedKeywords,
          }),
        });
        const genData = await readJson(genRes);
        if (Array.isArray(genData.posts)) {
          for (const p of genData.posts) {
            const text = String(p.final_text || p.content || p.text || "").trim();
            if (!text) continue;
            let insErr = (
              await supabase.from("SeungContent").insert({
                content: text,
                status: "draft",
                pipeline_id: "42303",
                user_id: session.user.id,
                topic: String(p.primaryTopic || day.posts[0]?.primaryTopic || ""),
              })
            ).error;
            if (insErr) {
              insErr = (
                await supabase.from("SeungContent").insert({
                  content: text,
                  status: "draft",
                  pipeline_id: "42303",
                  user_id: session.user.id,
                })
              ).error;
            }
            if (!insErr) totalSaved += 1;
            else console.warn("draft insert", insErr.message);
          }
        }
        if (genData.usedRecord) usedRecord = genData.usedRecord;
        setDoneCount(totalSaved);
        saveJob({
          jobId,
          startDate,
          generationDays: plan.generationDays,
          nextDayOffset: dayOffset + 1,
          usedRecord,
          status: dayOffset + 1 >= plan.days.length ? "completed" : "processing",
          updatedAt: new Date().toISOString(),
          plan,
          mergedKeywords,
        });
      }

      setPhase(`완료: ${totalSaved}개 draft 저장`);
      setDoneCount(totalSaved);
    } catch (e: any) {
      setError(e?.message || String(e));
      setPhase("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">이번 주 계획 · 작성</h1>
        <span className="text-xs text-zinc-500">
          {APP_VERSION_LABEL} · {BUILD_STAMP}
        </span>
      </div>

      <p className="text-sm text-zinc-400 mb-4">
        주간 계획 = compact topic 할당 (xAI 계획 생략으로 타임아웃 방지). 초안 문장은 generate-post가 작성합니다.
      </p>

      <label className="block text-sm mb-1 text-zinc-300">시작일</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
      />

      <label className="block text-sm mb-1 text-zinc-300">의도 / 키워드 (선택)</label>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="Creator Intent 또는 텍스트 키워드"
        className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full mb-4 rounded-xl border border-dashed border-zinc-600 py-4 text-sm text-zinc-300"
      >
        키워드 스샷 / 사진 추가 {files.length ? `(${files.length})` : ""}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />

      {error && (
        <div className="mb-4 rounded-xl bg-red-950/80 border border-red-800 p-3 text-sm text-red-200">
          {error}
          <div className="mt-2">
            <button type="button" onClick={() => router.push("/")} className="text-xs px-3 py-1 rounded bg-zinc-800">
              홈으로 →
            </button>
          </div>
        </div>
      )}

      {planSummary && (
        <pre className="mb-4 text-xs whitespace-pre-wrap text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800 max-h-48 overflow-auto">
          {planSummary}
        </pre>
      )}

      {phase && <p className="mb-2 text-sm text-violet-300">{phase}</p>}
      {doneCount > 0 && (
        <p className="mb-4 text-sm text-emerald-400">
          {doneCount}개 draft 저장됨 ·{" "}
          <a href="/" className="underline text-violet-300">
            홈 콘텐츠 큐에서 보기
          </a>
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={runPlanAndGenerate}
        className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-3 font-medium"
      >
        {busy ? "생성 중…" : "이번 주 전략 만들기"}
      </button>
    </main>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">화면 준비 중…</div>}>
      <GeneratePageInner />
    </Suspense>
  );
}
