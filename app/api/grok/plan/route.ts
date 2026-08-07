import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 26;

const MODEL = "grok-4.5";

const SYSTEM = `You are the weekly account-operating strategist for @Seung4680 — an AI account manager, not a post generator.

MISSION
Maximize long-term account growth while preserving authentic creator voice.
Every planning decision must answer: "Will this help grow this account over the next several months?"
NOT: "Can I generate another good-looking post?"
Impressions alone must never dominate. Prefer follower quality, profile curiosity, bookmarks, meaningful replies, and durable relevance.

HUMAN vs AI
- Human owns: real experiences, real opinions, original media, spontaneous posts.
- AI owns: weekly strategy, audience analysis, topic diversity, draft angles, scheduling shape.
- AI never replaces the creator. AI stays invisible.

CREATOR DNA (permanent — account must become MORE recognizable, not more generic)
- Cybertruck primary driver; MSP/M3P mostly family use
- FSD field tester (incl. v14 / Lite) & Robotaxi believer
- Honest ownership: admits costly mistakes, concrete numbers, no polished influencer gloss
- Long-term Tesla investor focused on Elon vision & product — NEVER short-term stock/TSLA chart/등락/매매 타이밍
- LAFC STH, Dogecoin & gaming, app/business/flower-shop when natural, US daily life
- Korean voice: mostly 해요체, natural mix; practical + observational + occasional vision essay

AUDIENCE DNA (from validated Fedica engagement, Jul–Aug 2026 — update only with real performance later)
- Core: Korean-language Tesla/FSD owners and followers; majority male, ~25–34; Science/Tech heavy
- Reach sweet spot: engagers often in 100–10K follower tier; many mutual follows
- What resonates: practical FSD/HW field notes with concrete detail; honest failure confessions; Korea-specific FSD experience; long-form ecosystem thesis (FSD × Grok × Optimus × compute)
- What does NOT define this audience: stock-price chatter, generic hype, keyword stuffing

PERFORMANCE MEMORY (validated high performers ONLY — never learn from raw AI drafts)
Seeded from real Fedica top posts (Jul–Aug 2026). Use as high-confidence editorial patterns, not templates to copy:
1) Practical HW3/FSD troubleshooting with concrete symptoms, numbers, and owner actions
2) Honest personal failure / cost confession — vulnerability + lesson without bait
3) Long-form ecosystem opinion connecting FSD, AI hardware, Grok, Optimus, compute
4) Korea-specific FSD/v14 Lite field notes
5) Clear, useful owner tips for HW3/FSD drivers
Weak or draft-only patterns must NOT shape strategy. Manual hits are premium signals.

SUCCESS SIGNAL PRIORITY
Followers gained > Profile visits > Revenue > Bookmarks > Replies quality > Reposts > Likes > Impressions
Never optimize the week only for impressions.

CONTENT DNA INTERSECTION
Weekly strategy emerges from Creator DNA ∩ Audience DNA ∩ Performance DNA.
Audience should feel: "this creator somehow keeps talking about exactly what I'm already interested in."
They should NEVER notice Fedica keywords themselves.

INTELLIGENCE MODEL ROLES (hard separation)
- Creator DNA = Writer identity (HOW posts are written). Fixed. Never overridden by Audience.
- Audience DNA = Weekly Editor (WHICH topics get slots this week). Scores candidates; does not write sentences.
- Performance DNA = Analyst. Adjusts priority after Audience scoring using validated patterns only.
- Revenue DNA = Business signals when available.
If Audience DNA changes, topic mix MUST change. Writing style must stay the same.

PIPELINE (strict order — do all steps mentally before outputting days)
1) CANDIDATE TOPIC GENERATION (Creator DNA only)
   Produce a large internal pool of ~80–100 natural discussion topics this creator could talk about.
   Cover: FSD field, Cybertruck ownership, Robotaxi/mobility, manufacturing/scale, AI infrastructure, Optimus/robotics, energy, owner tips, app/work, LAFC, long-term vision, honest failures, Korea-specific notes, US daily life.
   No filtering yet. No Fedica keywords as candidate labels.

2) AUDIENCE DNA SELECTION (score candidates — do NOT write posts)
   Score each candidate for this week:
   - rising relevance to follower interests
   - emerging discussion fit
   - topic diversity value
   - brand fit (still on-creator)
   Output: Audience Score per selected theme. Never "I must mention Terafab" — instead "manufacturing expansion / AI infrastructure is rising".

3) PERFORMANCE DNA PRIORITY ADJUSTMENT
   Raise themes that historically gained followers/profile visits/bookmarks.
   Lower themes that repeatedly underperformed.
   Refine selection; do not replace Audience ranking entirely.

4) WEEKLY SELECTION (~35 slots total across 7 days)
   Take highest combined scores into the week.
   Build topicDistribution: theme → planned count (must visibly shift when Audience signals change).
   Example normal: FSD 12, Cybertruck 10, Robotaxi 6, App 4, LAFC 3
   Example manufacturing-heavy Audience: FSD 8, Cybertruck 7, Manufacturing 5, AI Infrastructure 4, Optimus 3, Robotaxi 5, Energy 2, App 1

5) DAILY TOPICS → slots
   primaryTopic/angle = creator-framed Korean observations (e.g. "FSD 실사용 체감", "제조·스케일에 대한 관찰").
   FORBIDDEN as primaryTopic: raw Fedica keywords (Terafab, Grimes County, TSLA ticker, etc.).

FEDICA RULES
- Planning assistant only. Never writing assistant.
- Never force keywords into posts or angles.
- Keywords → Topic Intelligence themes first (Manufacturing, AI Infrastructure, Robotics, Mobility, Energy, FSD Field, Long-term Vision).

PLANNING RULES
- 7 days. Prefer 5–6 Korean slots/day (5–8 max; never fewer than 5). ~35 posts/week total preferred.
- One primaryTopic per slot; at most one allowedContext.
- Vary contentType and targetLength. Mix field note, observation, tip, occasional vision essay.
- No repeated detailed topic/example/opening/conclusion across the week.
- startDate is metadata only — no 오늘/방금/아까.
- Media attached later by human.
- Forbidden: 주가, 등락, 매매 타이밍, TSLA chart talk.
- Never sacrifice creator identity to chase trends.

Output JSON only:
- generationDays
- audienceRead: {
    interestGraph,
    sentiment,
    coverageNote,
    performanceLean,
    topicDistribution: { "theme": count, ... },
    candidateHighlights?: ["top themes considered"]
  }
- days[] with slots
- rationale (one short sentence: how Audience shifted the mix vs baseline)
slotId format: D{day+1}P{index}
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      startDate,
      keywords,
      mergedKeywords,
      generationDays = 7,
      recentTopics,
      interests,
      sentiment,
    } = body || {};

    let memoryBlock = "(no validated Planner Memory yet — use seeded PERFORMANCE MEMORY)";
    let creatorDnaBlock = "(use SYSTEM Creator DNA)";
    let audienceDnaBlock = "(use SYSTEM Audience DNA + Fedica signals)";
    let performanceDnaBlock = "(no Performance DNA yet — use seeded patterns)";
    let revenueDnaBlock = "(no Revenue DNA yet)";
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: mem } = await supabase
        .from("planner_memory")
        .select("version, patterns, summary_ko")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mem?.patterns && Array.isArray(mem.patterns) && mem.patterns.length) {
        memoryBlock =
          `v${mem.version}: ${mem.summary_ko || ""}\n` +
          mem.patterns
            .slice(0, 10)
            .map((p: string, i: number) => `${i + 1}. ${String(p).slice(0, 160)}`)
            .join("\n");
      }
      const { data: cdna } = await supabase
        .from("creator_dna")
        .select("version, data, summary_ko")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cdna?.summary_ko) {
        creatorDnaBlock = `v${cdna.version}: ${cdna.summary_ko}`;
        if (cdna.data && typeof cdna.data === "object") {
          const d = cdna.data as any;
          if (Array.isArray(d.successfulStructures) && d.successfulStructures.length) {
            creatorDnaBlock +=
              " | structures: " + d.successfulStructures.slice(0, 5).join(", ");
          }
        }
      }
      const { data: adna } = await supabase
        .from("audience_dna")
        .select("version, data, summary_ko")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (adna?.summary_ko) {
        audienceDnaBlock = `v${adna.version}: ${adna.summary_ko}`;
      }
      const { data: pdna } = await supabase
        .from("performance_dna")
        .select("version, data, summary_ko")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pdna?.summary_ko) {
        performanceDnaBlock = `v${pdna.version}: ${pdna.summary_ko}`;
        if (pdna.data && typeof pdna.data === "object") {
          const d = pdna.data as any;
          if (Array.isArray(d.topicWins) && d.topicWins.length)
            performanceDnaBlock += " | topics: " + d.topicWins.slice(0, 5).join(", ");
          if (Array.isArray(d.whyPatterns) && d.whyPatterns.length)
            performanceDnaBlock +=
              "\nWhy: " +
              d.whyPatterns
                .slice(0, 5)
                .map((p: string, i: number) => `${i + 1}. ${String(p).slice(0, 120)}`)
                .join("\n");
        }
      }
      const { data: rdna } = await supabase
        .from("revenue_dna")
        .select("version, data, summary_ko")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rdna?.summary_ko) {
        revenueDnaBlock = `v${rdna.version}: ${rdna.summary_ko}`;
      }
    } catch {
      /* tables may not exist yet */
    }

    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const daysCount = Math.min(7, Math.max(1, Number(generationDays) || 7));
    const topic =
      (typeof mergedKeywords === "string" && mergedKeywords.trim()) ||
      (typeof keywords === "string" && keywords.trim()) ||
      "";

    let recentBlock = "(none provided — rely on persona + X context)";
    if (Array.isArray(recentTopics) && recentTopics.length > 0) {
      recentBlock = recentTopics
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 24)
        .map((t: string, i: number) => `${i + 1}. ${t.slice(0, 80)}`)
        .join("\n");
    } else if (typeof recentTopics === "string" && recentTopics.trim()) {
      recentBlock = recentTopics.trim().slice(0, 1200);
    }

    let interestBlock = "(infer from categories + persona if empty)";
    if (Array.isArray(interests) && interests.length > 0) {
      interestBlock = interests
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 12)
        .join(", ");
    }

    let categoryBlock = "(none provided — derive themes from interests / persona)";
    const topicCategories = (body || {}).topicCategories;
    if (Array.isArray(topicCategories) && topicCategories.length > 0) {
      categoryBlock = topicCategories
        .map((t: unknown) => String(t).trim())
        .filter(Boolean)
        .slice(0, 10)
        .join(", ");
    } else if (interestBlock && !interestBlock.startsWith("(")) {
      categoryBlock = interestBlock;
    }

    const sentimentLabel =
      typeof sentiment === "string" && sentiment.trim()
        ? sentiment.trim().toLowerCase()
        : "unknown";

    const user = `Operate @Seung4680's X account for the next ${daysCount} days as a growth strategist (not a bulk generator).

Scheduling startDate (metadata only — NOT experience evidence): ${startDate || "(not provided)"}.

Audience DNA = Weekly Editor (score & select topics — NEVER rewrite creator voice):

Topic categories (allocation / scoring signals):
${categoryBlock}

Audience interest themes:
${interestBlock}

Raw Fedica keywords (INTERNAL ONLY — forbidden in primaryTopic, angle, content guidance):
${topic || "(none)"}

Audience sentiment: ${sentimentLabel}

REQUIRED PROCESS:
1) Build ~80–100 creator-native candidate topics (internal; need not list all in JSON).
2) Score candidates with Audience DNA (rising interest, emerging themes, diversity).
3) Adjust with Performance DNA / validated memory.
4) Select ~35 slots; set topicDistribution (theme → count) so the mix CLEARLY reflects Audience signals when present.
5) If Audience signals are empty, use baseline creator mix; wording style unchanged either way.
6) primaryTopic/angle = creator-framed only — never "Terafab", "Grimes County", ticker symbols.

VALIDATED Planner Memory (from real published performance only — never drafts):
${memoryBlock}

Evolving Creator DNA hint:
${creatorDnaBlock}

Evolving Audience DNA hint:
${audienceDnaBlock}

Performance DNA (why successful posts worked — validated only):
${performanceDnaBlock}

Revenue DNA:
${revenueDnaBlock}

Execute pipeline: candidates → Audience scores → Performance adjust → topicDistribution → daily slots.
Prefer VALIDATED Planner Memory / Performance DNA over generic seeds.
Do NOT copy keywords into primaryTopic/angle. Invent no false events.
Weak/average posts must not shape this week.

Recent topics for DEDUPE only (not learning):
${recentBlock}

Each day 5–8 slots (prefer 5–6). ~35 total for the week. Mix short/medium/long.
JSON only. audienceRead MUST include topicDistribution (theme→count) plus interestGraph, sentiment, coverageNote, performanceLean, optional candidateHighlights.
rationale: one line on how Audience shifted the weekly mix vs baseline creator mix.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let response: Response;
    try {
      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${xaiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
          temperature: 0.5,
          reasoning_effort: "low",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: "Grok plan failed", detail: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Plan non-JSON", detail: rawText.slice(0, 200) },
        { status: 502 }
      );
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    } catch {
      parsed = null;
    }

    const days: any[] = [];
    const srcDays = Array.isArray(parsed?.days) ? parsed.days : [];

    for (let i = 0; i < daysCount; i++) {
      const d = srcDays.find((x: any) => x.dayOffset === i) || srcDays[i] || {};
      let posts = Array.isArray(d.posts) ? d.posts : [];

      if (posts.length < 5) {
        const domainFallbacks = [
          { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" },
          { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" },
          { primaryTopic: "Robotaxi / 자율주행 관찰", angle: "장기 제품 방향에 대한 개인 해석", contentType: "opinion", targetLength: "medium" },
          { primaryTopic: "LAFC / 축구 일상", angle: "경기장·원정·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" },
          { primaryTopic: "앱·업무 운영", angle: "개발·반복 테스트에서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" },
          { primaryTopic: "AI / Grok 사용 메모", angle: "실제 업무·콘텐츠에 써본 체감", contentType: "tech_insight", targetLength: "short" },
          { primaryTopic: "장기 투자 관점", angle: "제품·비전 중심의 장기 시각 (주가 제외)", contentType: "opinion", targetLength: "medium" },
          { primaryTopic: "소유 팁", angle: "실소유 경험에서 나온 실용 메모", contentType: "observation", targetLength: "short" },
        ];
        while (posts.length < 5) {
          const idx = posts.length + 1;
          const fb = domainFallbacks[(i * 3 + posts.length) % domainFallbacks.length];
          posts.push({
            slotId: `D${i + 1}P${idx}`,
            primaryTopic: fb.primaryTopic,
            angle: fb.angle,
            contentType: fb.contentType,
            allowedContext: [],
            forbiddenTopics: ["주가", "등락", "매매"],
            targetLength: fb.targetLength,
          });
        }
      }
      if (posts.length > 8) posts = posts.slice(0, 8);

      posts = posts.map((p: any, pi: number) => ({
        slotId: String(p.slotId || `D${i + 1}P${pi + 1}`),
        primaryTopic: String(p.primaryTopic || "관찰"),
        angle: String(p.angle || ""),
        contentType: String(p.contentType || "observation"),
        allowedContext: Array.isArray(p.allowedContext)
          ? p.allowedContext.map(String).slice(0, 2)
          : [],
        forbiddenTopics: Array.isArray(p.forbiddenTopics)
          ? p.forbiddenTopics.map(String)
          : ["주가", "등락"],
        targetLength: ["short", "medium", "long"].includes(p.targetLength)
          ? p.targetLength
          : "medium",
      }));

      days.push({ dayOffset: i, posts });
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: daysCount,
      days,
      rationale: parsed?.rationale || null,
      audienceRead: parsed?.audienceRead || null,
      totalPlanned: days.reduce((s: number, d: any) => s + d.posts.length, 0),
    });
  } catch (err: any) {
    console.error(err);
    const domainSlots = [
      { primaryTopic: "FSD 실사용 체감", angle: "도심·고속도로에서 느낀 판단 변화", contentType: "fsd_field", targetLength: "medium" },
      { primaryTopic: "Cybertruck 일상 활용", angle: "적재·주차·실사용에서 체감한 디테일", contentType: "observation", targetLength: "short" },
      { primaryTopic: "Robotaxi / 자율주행 관찰", angle: "장기 제품 방향에 대한 개인 해석", contentType: "opinion", targetLength: "medium" },
      { primaryTopic: "LAFC / 축구 일상", angle: "경기장·시즌 분위기 관찰", contentType: "other_interest", targetLength: "short" },
      { primaryTopic: "앱·업무 운영", angle: "개발·반복 테스트에서 느낀 실무 포인트", contentType: "observation", targetLength: "medium" },
    ];
    const fallbackDays = Array.from({ length: 7 }, (_, i) => ({
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
    }));
    return NextResponse.json({
      success: true,
      model: MODEL,
      generationDays: 7,
      days: fallbackDays,
      rationale: "계획 지연 — 기본 7일 슬롯 캘린더 사용",
      totalPlanned: 35,
      fallback: true,
      detail: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 120),
    });
  }
}
