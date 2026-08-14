"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION_LABEL, VERSION_SUMMARY_KO } from "@/lib/version";

const GENERATION_DAYS = 7;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const phaseName = String(body.phase || "");
    const ms =
      phaseName === "job_tick" || phaseName === "expand"
        ? 55000
        : phaseName === "write"
          ? 50000
          : phaseName === "quota"
            ? 45000
            : 30000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms);
    let res: Response;
    try {
      res = await fetch(`${supabaseUrl}/functions/v1/weekly-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error(
          `${phaseName || "요청"}이 ${Math.round(ms / 1000)}초 안에 끝나지 않았습니다. 시드는 이어서 채우고, 초안은 저장된 것만 남습니다.`
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
    return readJson(res);
  }

  function applyJob(job: any) {
    if (job?.label_ko) setPhase(String(job.label_ko));
    if (job?.summary) setPlanSummary(String(job.summary));
    if (typeof job?.saved_count === "number") setDoneCount(job.saved_count);
  }

  async function followJob(session: any, jobId: string) {
    for (let i = 0; i < 80; i++) {
      const started = Date.now();
      try {
        const job = await edgeCall(session, { phase: "job_tick", job_id: jobId });
        applyJob(job);
        if (job.status === "done") {
          setPhase(`완료: ${job.saved_count || 0}개 draft 저장`);
          return;
        }
        if (job.status === "error") {
          throw new Error(job.error || job.label_ko || "주간 생성 실패");
        }
      } catch (e: any) {
        const msg = String(e?.message || e);
        const timedOut = /초 안에 끝나지 않았습니다/.test(msg);
        if (!timedOut) throw e;
        const st = await edgeCall(session, { phase: "job_status", job_id: jobId });
        applyJob(st);
        if (st.status === "done") {
          setPhase(`완료: ${st.saved_count || 0}개 draft 저장`);
          return;
        }
        if (st.status === "error") {
          throw new Error(st.error || st.label_ko || "주간 생성 실패");
        }
      }
      if (Date.now() - started < 2000) await sleep(3000);
      else await sleep(400);
    }
    throw new Error("작업이 너무 깁니다. 새로고침하면 이어서 진행합니다.");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      try {
        const st = await edgeCall(session, { phase: "job_status" });
        if (cancelled || !st?.success || !st.job_id || st.status !== "running") return;
        setBusy(true);
        applyJob(st);
        await followJob(session, String(st.job_id));
      } catch {
        /* operator can press generate */
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Resume a running weekly job once on mount. Video is out of scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      setPhase("주간 작업 시작…");
      const started = await edgeCall(session, {
        generationDays: GENERATION_DAYS,
        startDate,
        topic: topic.trim() || undefined,
        creatorIntent: topic.trim() || undefined,
        publishedTopics21d,
        publishedTopics: publishedTopics21d,
        scheduledTopics,
        lafc_matches: lafcMatches,
        phase: "job_start",
      });
      if (!started.success || !started.job_id) {
        throw new Error(started.detail || started.error || "주간 작업을 시작하지 못했습니다.");
      }
      applyJob(started);
      await followJob(session, String(started.job_id));
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
        <span className="text-xs font-semibold tabular-nums text-emerald-300">{APP_VERSION_LABEL}</span>
      </div>
      <p className="text-sm text-zinc-400 mb-4">{VERSION_SUMMARY_KO}</p>
      <label className="block text-sm mb-1 text-zinc-300">시작일</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
      />
      <label className="block text-sm mb-1 text-zinc-300">이번 주 메모 (선택)</label>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        rows={2}
        placeholder="이번만 넣고 싶은 주제. 의지는 엔진·DNA에 있습니다."
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
