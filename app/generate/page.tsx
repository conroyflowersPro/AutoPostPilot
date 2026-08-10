"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_VERSION_LABEL, BUILD_STAMP } from "@/lib/version";

const GENERATION_DAYS = 7;

async function readJson(res: Response) {
  const rawText = await res.text();
  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`서버 응답 오류 (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
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
  const [lafcMatches, setLafcMatches] = useState<{ match_date: string; opponent: string; home_or_away?: string; venue?: string }[]>([]);
  const [lafcDate, setLafcDate] = useState("");
  const [lafcOpponent, setLafcOpponent] = useState("");
  const [lafcHome, setLafcHome] = useState("UNKNOWN");
  const supabase = createClient();

  useEffect(() => { if (startParam) setStartDate(startParam); }, [startParam]);

  async function runPlanAndGenerate() {
    setBusy(true); setError(""); setDoneCount(0); setPlanSummary("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("로그인이 필요합니다.");
      setPhase("주간 Dynamic Seed + Semantic Judge (1회)…");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("SUPABASE URL 없음");
      const planRes = await fetch(`${supabaseUrl}/functions/v1/weekly-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          generationDays: GENERATION_DAYS,
          startDate,
          topic: topic.trim() || undefined,
          creatorIntent: topic.trim() || undefined,
          publishedTopics21d: [],
          scheduledTopics: [],
          lafc_matches: lafcMatches,
          skipSemanticJudge: false,
          useXaiSeedExpand: true,
        }),
      });
      const planData = await readJson(planRes);
      if (!planData.success || !Array.isArray(planData.days) || planData.days.length === 0) {
        throw new Error(planData.detail || planData.error || "주간 계획 실패");
      }
      const days = [...planData.days].sort((a: any, b: any) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0));
      setPlanSummary([
        `history_mode: ${planData.history_mode || ""}`,
        `quality_mode: ${planData.quality_mode || ""}`,
        planData.topic_supply_low ? "TOPIC_SUPPLY_LOW" : "",
        planData.diagnostics ? `diag: ${JSON.stringify(planData.diagnostics)}` : "",
        ...days.map((d: any) => `D${(d.dayOffset ?? 0) + 1} ${(d.posts || []).length}개`),
      ].filter(Boolean).join("\n"));
      let totalSaved = 0;
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        if (!day?.posts?.length) continue;
        setPhase(`Day ${i + 1}/${days.length} 초안 생성…`);
        const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-post`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({ startDate, dayOffset: day.dayOffset ?? i, slots: day.posts }),
        });
        const genData = await readJson(genRes);
        if (Array.isArray(genData.posts)) {
          for (const p of genData.posts) {
            const text = String(p.final_text || p.content || "").trim();
            if (!text) continue;
            const { error: insErr } = await supabase.from("SeungContent").insert({
              content: text, status: "draft", pipeline_id: "42303", user_id: session.user.id,
            });
            if (!insErr) totalSaved += 1;
          }
        }
        setDoneCount(totalSaved);
      }
      setPhase(`완료: ${totalSaved}개 draft 저장`);
    } catch (e: any) {
      setError(e?.message || String(e)); setPhase("");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">이번 주 계획 · 작성</h1>
        <span className="text-xs text-zinc-500">{APP_VERSION_LABEL} · {BUILD_STAMP}</span>
      </div>
      <p className="text-sm text-zinc-400 mb-4">Dynamic Seed + Semantic Judge. Fedica 주간 스샷 미사용.</p>
      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2" />
      <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="Creator Intent" className="w-full mb-4 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2" />
      <div className="mb-4 rounded-xl border border-zinc-700 p-3 text-sm">
        <div className="mb-2">LAFC 경기 (D-1만)</div>
        <input type="date" value={lafcDate} onChange={(e) => setLafcDate(e.target.value)} className="mr-2 mb-2 rounded bg-zinc-900 border border-zinc-700 px-2 py-1" />
        <input type="text" value={lafcOpponent} onChange={(e) => setLafcOpponent(e.target.value)} placeholder="상대" className="mr-2 mb-2 rounded bg-zinc-900 border border-zinc-700 px-2 py-1" />
        <button type="button" className="text-xs underline" onClick={() => {
          if (!lafcDate || !lafcOpponent.trim()) return;
          setLafcMatches((p) => [...p, { match_date: lafcDate, opponent: lafcOpponent.trim(), home_or_away: lafcHome, venue: lafcHome === "HOME" ? "BMO" : undefined }]);
          setLafcDate(""); setLafcOpponent("");
        }}>추가</button>
        <div className="text-xs text-zinc-400">{lafcMatches.map((m) => `${m.match_date} vs ${m.opponent}`).join(" · ")}</div>
      </div>
      {error && <div className="mb-4 text-red-300 text-sm">{error}</div>}
      {planSummary && <pre className="mb-4 text-xs text-zinc-400 whitespace-pre-wrap max-h-48 overflow-auto">{planSummary}</pre>}
      {phase && <p className="mb-2 text-violet-300 text-sm">{phase}</p>}
      {doneCount > 0 && <p className="mb-4 text-emerald-400 text-sm">{doneCount}개 draft · <a href="/" className="underline">홈</a></p>}
      <button type="button" disabled={busy} onClick={runPlanAndGenerate} className="w-full rounded-xl bg-violet-600 py-3 font-medium disabled:opacity-50">{busy ? "생성 중…" : "이번 주 전략 만들기"}</button>
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
