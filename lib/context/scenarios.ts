/**
 * Offline scenario checks for Shared Current Context (no network).
 */
import { buildSharedCurrentContext } from "./build-shared-context";
import { seedEventsForTests } from "./known-events";
import type { KnownEvent } from "./types";

export type ScenarioResult = { id: string; pass: boolean; detail: string };

export function runSharedContextScenarios(now = new Date()): ScenarioResult[] {
  const results: ScenarioResult[] = [];

  {
    const events = seedEventsForTests(now);
    const ctx = buildSharedCurrentContext({ now, events });
    const pre = ctx.upcoming_events.some(
      (e) => e.event_type === "LAFC_MATCH" && (e.phase === "PRE_EVENT" || e.phase === "UPCOMING")
    );
    results.push({
      id: "A_LAFC_2d_before",
      pass: pre,
      detail: pre
        ? `upcoming/pre count=${ctx.upcoming_events.length}`
        : "expected LAFC upcoming/pre",
    });
  }

  {
    const start = new Date(now);
    start.setUTCHours(now.getUTCHours() - 1, 0, 0, 0);
    const events: KnownEvent[] = [
      {
        event_id: "live-lafc",
        event_type: "LAFC_MATCH",
        event_name: "LAFC vs Opponent",
        start_time: start.toISOString(),
        home_away: "home",
        opponent: "SEA",
        source: "test",
        creator_relevance: "high",
      },
    ];
    const ctx = buildSharedCurrentContext({ now, events });
    const live = ctx.active_events.some((e) => e.phase === "LIVE");
    const ind = ctx.indicators.includes("LAFC Match Day");
    results.push({
      id: "B_LAFC_match_day",
      pass: live && ind,
      detail: `live=${live} indicator=${ind}`,
    });
  }

  {
    const start = new Date(now);
    start.setUTCHours(now.getUTCHours() - 8, 0, 0, 0);
    const events: KnownEvent[] = [
      {
        event_id: "post-lafc",
        event_type: "LAFC_MATCH",
        event_name: "LAFC vs Opponent",
        start_time: start.toISOString(),
        source: "test",
        creator_relevance: "high",
      },
    ];
    const ctx = buildSharedCurrentContext({ now, events });
    const post = ctx.recent_events.some(
      (e) => e.phase === "POST_EVENT" || e.phase === "RECENT"
    );
    results.push({
      id: "C_LAFC_after",
      pass: post,
      detail: `recent=${ctx.recent_events.map((e) => e.phase).join(",")}`,
    });
  }

  {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + 1);
    const events: KnownEvent[] = [
      {
        event_id: "fsd",
        event_type: "FSD_RELEASE",
        event_name: "FSD v-next",
        start_time: start.toISOString(),
        source: "test",
        creator_relevance: "high",
      },
    ];
    const ctx = buildSharedCurrentContext({ now, events });
    const ok = ctx.upcoming_events.some((e) => e.event_type === "FSD_RELEASE");
    results.push({ id: "D_FSD_release", pass: ok, detail: ok ? "fsd window" : "missing" });
  }

  {
    const ctx = buildSharedCurrentContext({ now, events: [] });
    const ok =
      ctx.active_events.length === 0 &&
      ctx.upcoming_events.length === 0 &&
      !ctx.indicators.some((i) => i.includes("Match"));
    results.push({
      id: "E_no_event",
      pass: ok,
      detail: `indicators=${ctx.indicators.join("|") || "none"}`,
    });
  }

  {
    const ctx = buildSharedCurrentContext({
      now,
      events: [],
      xTopics: [
        {
          topic: "FSD v14 discussion",
          status: "active",
          relevance: "high",
          observed_at: now.toISOString(),
          source: "test",
          evidence_type: "hint",
        },
      ],
    });
    const ok =
      ctx.x_context.length === 1 &&
      ctx.indicators.includes("Current X Context Active");
    results.push({ id: "F_x_active", pass: ok, detail: ctx.prompt_block.slice(0, 80) });
  }

  {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + 1);
    const events: KnownEvent[] = [
      {
        event_id: "lafc-quiet-x",
        event_type: "LAFC_MATCH",
        event_name: "LAFC home",
        start_time: start.toISOString(),
        source: "test",
        creator_relevance: "high",
      },
    ];
    const ctx = buildSharedCurrentContext({
      now,
      events,
      xTopics: [
        {
          topic: "unrelated meme",
          status: "quiet",
          relevance: "none",
          observed_at: now.toISOString(),
          source: "test",
          evidence_type: "hint",
        },
      ],
    });
    const kept = ctx.upcoming_events.some((e) => e.event_type === "LAFC_MATCH");
    results.push({
      id: "G_creator_event_kept",
      pass: kept,
      detail: kept ? "LAFC kept despite weak X" : "dropped incorrectly",
    });
  }

  return results;
}
