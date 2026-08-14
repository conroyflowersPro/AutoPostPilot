"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION_LABEL, BUILD_STAMP } from "@/lib/version";

const GENERATION_DAYS = 7;
const POSTS_PER_DAY = 6;
const REQUIRED_SLOTS = GENERATION_DAYS * POSTS_PER_DAY;
const JUDGE_BATCH = 8;
const WRITE_CHUNK = 3;
const COLLISION_DAYS = 30;

type LafcMatch = { match_date: string; opponent: string; home_or_away?: string; venue?: string };

async function readJson(res: Response) {
  const rawText = await res.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`서버 응답 오류 (${res.status}): ${rawText.slice(0, 120) || "타임아웃/비JSON"}`);
  }
  if (!res.ok) {
    throw new Error(
      data.detail
        ? `${data.error || "요청 실패"}: ${String(data.detail).slice(0, 200)}`
        : data.error || `요청 실패 (${res.status})`
    );
  }
  return data;
}

function pickSeeds(part: any): any[] {
  if (Array.isArray(part?.gated_seeds) && part.gated_seeds.length) return part.gated_seeds;
  if (Array.isArray(part?.candidates) && part.candidates.length) return part.candidates;
  if (Array.isArray(part?.seeds) && part.seeds.length) return part.seeds;
  if (Array.isArray(part?.gated_seeds)) return part.gated_seeds;
  if (Array.isArray(part?.candidates)) return part.candidates;
  if (Array.isArray(part?.seeds)) return part.seeds;
  return [];
}

function GeneratePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start") || "";
  const [startDate, setStartDate] = useState(startParam || new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [planSummary, setPlanSummary] = useState("");
  const [lafcMatches, setLafcMatches] = useState<LafcMatch[]>([]);
  const [lafcDate, setLafcDate] = useState("");
  const [lafcOpponent, setLafcOpponent] = useState("");
  const [lafcHome, setLafcHome] = useState<"HOME" | "AWAY" | "UNKNOWN">("UNKNOWN");
  const supabase = createClient();

  useEffect(() => {
    if (startParam) setStartDate(startParam);
  }, [startParam]);

  function addLafcMatch() {
    if (!lafcDate || !lafcOpponent.trim()) return;
    setLafcMatches((prev) => [
      ...prev,
      {
        match_date: lafcDate,
        opponent: lafcOpponent.trim(),
        home_or_away: lafcHome,
        venue: lafcHome === "HOME" ? "BMO" : undefined,
      },
    ]);
    setLafcDate("");
    setLafcOpponent("");
    setLafcHome("UNKNOWN");
  }

  async function edgeCall(session: any, body: Record<string, unknown>) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("SUPABASE URL 없음");
    const res = await fetch(`${supabaseUrl}/functions/v1/weekly-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify(body),
    });
    return readJson(res);
  }

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

      setPhase(`최근 ${COLLISION_DAYS}일 발행·예약 주제 조회…`);
      let publishedTopics21d: string[] = [];
      let scheduledTopics: string[] = [];
      try {
        const since = new Date();
        since.setDate(since.getDate() - COLLISION_DAYS);
        const sinceIso = since.toISOString();
        let published: any[] | null = null;
        const q1 = await supabase
          .from("SeungContent")
          .select("content, final_text, topic, published_at, created_at")
          .eq("status", "published")
          .gte("published_at", sinceIso)
          .order("published_at", { ascending: false })
          .limit(80);
        if (!q1.error && q1.data) published = q1.data;
        else {
          const q2 = await supabase
            .from("SeungContent")
            .select("content, final_text, topic, created_at")
            .eq("status", "published")
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(80);
          published = q2.data || [];
        }
        publishedTopics21d = (published || [])
          .map((r: any) => String(r.topic || r.content || r.final_text || "").slice(0, 100))
          .filter(Boolean);
        const { data: scheduled } = await supabase
          .from("SeungContent")
          .select("content, final_text, topic")
          .eq("status", "scheduled")
          .order("created_at", { ascending: false })
          .limit(20);
        scheduledTopics = (scheduled || [])
          .map((r: any) => String(r.topic || r.content || r.final_text || "").slice(0, 100))
          .filter(Boolean);
      } catch {}

      const base = {
        generationDays: GENERATION_DAYS,
        postsPerDay: POSTS_PER_DAY,
        startDate,
        topic: topic.trim() || undefined,
        creatorIntent: topic.trim() || undefined,
        publishedTopics21d,
        publishedTopics: publishedTopics21d,
        scheduledTopics,
        lafc_matches: lafcMatches,
        expand_with_xai: true,
        allow_xai_enrich: true,
      };

      const allGated: any[] = [];
      let priorSubjects: string[] = [];
      let idCounter = 0;
      let dimBatch = 0;
      let dimTotal = 1;
      let expandDone = false;
      let lastExpandDiag: any = null;
      while (!expandDone) {
        setPhase(`Seed Expand ${dimBatch + 1}/${dimTotal}…`);
        const part = await edgeCall(session, {
          ...base,
          phase: "expand",
          dim_batch_index: dimBatch,
          prior_subjects: priorSubjects,
          id_counter: idCounter,
          expand_with_xai: true,
          allow_xai_enrich: true,
        });
        if (!part.success) {
          throw new Error(part.detail || part.error || `Expand ${dimBatch + 1} 실패`);
        }
        lastExpandDiag = part;
        dimTotal = Number(part.dim_batch_total) || dimTotal;
        const seeds = pickSeeds(part);
        allGated.push(...seeds);
        for (const s of seeds) {
          if (s.concrete_subject) priorSubjects.push(String(s.concrete_subject));
        }
        priorSubjects = priorSubjects.slice(-80);
        idCounter = Number(part.id_counter) || idCounter + seeds.length;
        expandDone = part.expand_done !== false;
        dimBatch = Number(part.next_dim_batch_index) || dimBatch + 1;
        if (dimBatch > 8) break;
        if (part.expand_done === true && dimTotal <= 1 && allGated.length >= REQUIRED_SLOTS) break;
      }

      if (allGated.length < REQUIRED_SLOTS) {
        const d = lastExpandDiag || {};
        const xai = d.diagnostics?.xai_seed_expansion || d.xai_seed_expansion || {};
        throw new Error(
          [
            `시드 추론 부족: ${allGated.length}/${REQUIRED_SLOTS}. 고정 템플릿으로 채우지 않습니다.`,
            d.error ? `error=${d.error}` : null,
            xai.error ? `xai_error=${xai.error}` : null,
            xai.returned != null ? `xai_returned=${xai.returned}` : null,
            d.seed_count != null ? `seed_count=${d.seed_count}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        );
      }

      const allJudged: any[] = [];
      for (let i = 0; i < allGated.length; i += JUDGE_BATCH) {
        const batch = allGated.slice(i, i + JUDGE_BATCH);
        const bi = Math.floor(i / JUDGE_BATCH) + 1;
        const bt = Math.ceil(allGated.length / JUDGE_BATCH) || 1;
        setPhase(`Semantic Judge ${bi}/${bt}…`);
        const part = await edgeCall(session, {
          ...base,
          phase: "judge",
          seeds: batch,
          candidates: batch,
        });
        if (!part.success) {
          throw new Error(part.detail || part.error || `Judge ${bi} 실패`);
        }
        const judged = Array.isArray(part.judged) ? part.judged : batch;
        allJudged.push(...judged);
      }

      const judgedEligible = allJudged.filter((s: any) =>
        s?.status === "ELIGIBLE" || s?.status === "HIGH_VALUE"
      );
      if (judgedEligible.length < REQUIRED_SLOTS) {
        throw new Error(
          `판정 통과 시드 ${judgedEligible.length}/${REQUIRED_SLOTS}. 부족한 주를 저장하지 않습니다.`
        );
      }

      setPhase("Weekly Select…");
      const planData = await edgeCall(session, {
        ...base,
        phase: "select",
        seeds: allJudged,
        candidates: allJudged,
      });
      if (!planData.success || !Array.isArray(planData.days) || planData.days.length === 0) {
        throw new Error(planData.detail || planData.error || "Select 결과가 비어 있습니다.");
      }

      const mergedDays = [...planData.days].sort(
        (a: any, b: any) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0)
      );
      const lines = mergedDays.map((d: any) => {
        const topics = (d.posts || [])
          .map((p: any) => p.primaryTopic || p.concrete_subject)
          .join(", ");
        return `D${(d.dayOffset ?? 0) + 1}  ${d.posts?.length || 0}개  ${topics}`;
      });
      const totalPlanned = mergedDays.reduce((s: number, d: any) => s + (d.posts?.length || 0), 0);
      setPlanSummary(
        [
          `expand_seeds: ${allGated.length} · judged: ${allJudged.length} · planned: ${totalPlanned} · required: ${REQUIRED_SLOTS}`,
          planData.mode_supply_low ? "MODE_SUPPLY_LOW" : "",
          planData.topic_supply_low ? "TOPIC_SUPPLY_LOW" : "",
          planData.diagnostics ? `diag: ${JSON.stringify(planData.diagnostics)}` : "",
          ...lines,
        ]
          .filter(Boolean)
          .join("\n")
      );

      if (totalPlanned < REQUIRED_SLOTS) {
        throw new Error(
          `주간 계획이 ${totalPlanned}개뿐입니다 (목표 ${REQUIRED_SLOTS}). 고정 축/부족한 주로 초안을 저장하지 않습니다.`
        );
      }

      let totalSaved = 0;
      for (let dayOffset = 0; dayOffset < mergedDays.length; dayOffset++) {
        const day = mergedDays[dayOffset];
        if (!day?.posts?.length) continue;
        setPhase(`Day ${dayOffset + 1}/${mergedDays.length} 초안 생성…`);
        const daySlots = Array.isArray(day.posts) ? day.posts : [];
        for (let si = 0; si < daySlots.length; si += WRITE_CHUNK) {
          const chunk = daySlots.slice(si, si + WRITE_CHUNK);
          const genData = await edgeCall(session, {
            ...base,
            phase: "write",
            slots: chunk,
          });
          if (!genData.success) {
            throw new Error(genData.detail || genData.error || `Write D${dayOffset + 1} 실패`);
          }
          const written = Array.isArray(genData.posts) ? genData.posts : [];
          for (const p of written) {
            const text = String(p.final_text || p.content || p.text || "").trim();
            if (!text) continue;
            let insErr = (
              await supabase.from("SeungContent").insert({
                content: text,
                status: "draft",
                pipeline_id: "42303",
                user_id: session.user.id,
                topic: String(p.primaryTopic || p.concrete_subject || ""),
                strategy_json: {
                  system_origin_class: "AP_PIPELINE",
                  slotId: p.slotId || null,
                  writer_model: "grok-4.6",
                  engine: "v11_order08_wired_grok46",
                },
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
          }
          setDoneCount(totalSaved);
        }
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
        v11: Expand → Judge → Select → ORDER 7B 독립 작성. 리뷰·원본 미디어 후에만 발행.
      </p>
      <label className="block text-sm mb-1 text-zinc-300">시작일</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
      />
      <label className="block text-sm mb-1 text-zinc-300">Creator Intent (선택)</label>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="이번 주 직접 말하고 싶은 구체 주제"
        className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
      />
      <div className="mb-4 rounded-xl border border-zinc-700 p-3">
        <div className="text-sm text-zinc-300 mb-2">LAFC 경기 (선택 · D-1만 자동 시드)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <input
            type="date"
            value={lafcDate}
            onChange={(e) => setLafcDate(e.target.value)}
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={lafcOpponent}
            onChange={(e) => setLafcOpponent(e.target.value)}
            placeholder="상대팀"
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          />
          <select
            value={lafcHome}
            onChange={(e) => setLafcHome(e.target.value as any)}
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
          >
            <option value="HOME">HOME (BMO)</option>
            <option value="AWAY">AWAY</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>
        <button
          type="button"
          onClick={addLafcMatch}
          className="text-xs px-3 py-1 rounded bg-zinc-800 border border-zinc-600"
        >
          LAFC 경기 추가
        </button>
        {lafcMatches.length > 0 && (
          <ul className="mt-2 text-xs text-zinc-400 space-y-1">
            {lafcMatches.map((m, i) => (
              <li key={i}>
                {m.match_date} vs {m.opponent} ({m.home_or_away || "?"})
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setLafcMatches((prev) => prev.filter((_, j) => j !== i))}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <div className="mb-4 rounded-xl bg-red-950/80 border border-red-800 p-3 text-sm text-red-200">
          {error}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs px-3 py-1 rounded bg-zinc-800"
            >
              홈으로 →
            </button>
          </div>
        </div>
      )}
      {planSummary && (
        <pre className="mb-4 text-xs whitespace-pre-wrap text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-800 max-h-64 overflow-auto">
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
