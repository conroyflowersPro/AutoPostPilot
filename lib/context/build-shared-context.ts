/**
 * buildSharedCurrentContext — single source for Planner + Manual Composer.
 */
import {
  CREATOR_INTEREST_TAGS,
  computePhase,
  mediaHints,
  suggestedAngles,
} from "./known-events";
import type {
  BuildContextInput,
  EventContextItem,
  KnownEvent,
  SharedCurrentContext,
  XContextTopic,
} from "./types";

function asDate(now?: Date | string): Date {
  if (!now) return new Date();
  if (now instanceof Date) return now;
  const d = new Date(now);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function enrichEvent(ev: KnownEvent, now: Date): EventContextItem {
  const { phase, lead_time_hours } = computePhase(
    ev.event_type,
    ev.start_time,
    ev.end_time,
    now
  );
  return {
    ...ev,
    phase,
    lead_time_hours,
    content_window: {
      pre_ok: phase === "PRE_EVENT" || phase === "UPCOMING",
      live_ok: phase === "LIVE",
      post_ok: phase === "POST_EVENT" || phase === "RECENT",
    },
    suggested_angles: suggestedAngles(ev.event_type, phase),
    media_hints: mediaHints(ev.event_type, phase),
  };
}

function normalizeXTopics(
  raw: BuildContextInput["xTopics"],
  now: Date
): XContextTopic[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((t) => {
    const observed = t.observed_at ? new Date(t.observed_at) : now;
    const fresh =
      observed && !Number.isNaN(observed.getTime())
        ? Math.round(((now.getTime() - observed.getTime()) / 3_600_000) * 10) / 10
        : null;
    return {
      topic: String(t.topic || "").slice(0, 120),
      status: (t.status as XContextTopic["status"]) || "unknown",
      relevance: (t.relevance as XContextTopic["relevance"]) || "low",
      evidence_type: String(t.evidence_type || "manual_or_hint"),
      source: String(t.source || "caller"),
      observed_at: observed.toISOString(),
      freshness_hours: fresh,
    };
  });
}

function buildPromptBlock(ctx: Omit<SharedCurrentContext, "prompt_block">): string {
  const lines: string[] = [];
  lines.push(`[Shared Current Context @ ${ctx.context_timestamp}]`);
  lines.push(
    "Rules: evidence only — not a posting command. Creator authentic events stay valid even if X is quiet. Do not invent experience."
  );

  const pack = (label: string, list: EventContextItem[]) => {
    if (!list.length) {
      lines.push(`${label}: (none)`);
      return;
    }
    lines.push(`${label}:`);
    for (const e of list.slice(0, 8)) {
      lines.push(
        `- ${e.event_type} | ${e.event_name} | phase=${e.phase} | relevance=${e.creator_relevance}` +
          (e.opponent ? ` | vs ${e.opponent}` : "") +
          (e.lead_time_hours != null ? ` | lead_h=${e.lead_time_hours}` : "")
      );
      if (e.suggested_angles.length) {
        lines.push(`  angles: ${e.suggested_angles.join("; ")}`);
      }
      if (e.media_hints.length) {
        lines.push(`  media: ${e.media_hints.join("; ")}`);
      }
    }
  };

  pack("ACTIVE/LIVE", ctx.active_events);
  pack("UPCOMING/PRE", ctx.upcoming_events);
  pack("RECENT/POST", ctx.recent_events);

  if (ctx.x_context.length) {
    lines.push("X_CONTEXT (not Creator DNA; freshness required):");
    for (const x of ctx.x_context.slice(0, 8)) {
      lines.push(
        `- ${x.topic} | ${x.status} | rel=${x.relevance} | age_h=${x.freshness_hours ?? "?"}`
      );
    }
  } else {
    lines.push("X_CONTEXT: (none provided)");
  }

  if (ctx.planner_context.related_planned_topic || ctx.planner_context.editorial_intent) {
    lines.push(
      `PLANNER_SLICE: topic=${ctx.planner_context.related_planned_topic || "-"} intent=${ctx.planner_context.editorial_intent || "-"}`
    );
  }

  lines.push(
    `CREATOR_INTERESTS: ${ctx.creator_context.relevant_interests.join(", ")}`
  );
  if (ctx.indicators.length) {
    lines.push(`INDICATORS: ${ctx.indicators.join(" | ")}`);
  }
  return lines.join("\n");
}

export function buildSharedCurrentContext(
  input: BuildContextInput = {}
): SharedCurrentContext {
  const now = asDate(input.now);
  const events = Array.isArray(input.events) ? input.events : [];
  const enriched = events
    .filter((e) => e && e.event_name && e.start_time)
    .map((e) => enrichEvent(e, now))
    .filter((e) => e.phase !== "UNKNOWN" || (e.lead_time_hours != null && e.lead_time_hours < 24 * 14));

  const active_events = enriched.filter((e) => e.phase === "LIVE");
  const upcoming_events = enriched.filter(
    (e) => e.phase === "UPCOMING" || e.phase === "PRE_EVENT"
  );
  const recent_events = enriched.filter(
    (e) => e.phase === "POST_EVENT" || e.phase === "RECENT"
  );

  const x_context = normalizeXTopics(input.xTopics, now).filter((t) => {
    if (t.freshness_hours != null && t.freshness_hours > 72) return false;
    return Boolean(t.topic);
  });

  const indicators: string[] = [];
  for (const e of [...active_events, ...upcoming_events, ...recent_events]) {
    if (e.creator_relevance === "none") continue;
    if (e.event_type === "LAFC_MATCH" && e.phase === "LIVE") {
      indicators.push("LAFC Match Day");
    } else if (e.event_type === "LAFC_MATCH" && e.phase === "PRE_EVENT") {
      indicators.push("LAFC Pre-Match");
    } else if (e.event_type === "LAFC_MATCH" && e.phase === "POST_EVENT") {
      indicators.push("LAFC Post-Match");
    } else if (e.event_type === "FSD_RELEASE") {
      indicators.push("FSD Update Context");
    } else if (e.phase === "LIVE" || e.phase === "PRE_EVENT") {
      indicators.push(`${e.event_type}:${e.phase}`);
    }
  }
  if (x_context.some((x) => x.status === "active" || x.status === "emerging")) {
    indicators.push("Current X Context Active");
  }

  const base: Omit<SharedCurrentContext, "prompt_block"> = {
    context_timestamp: now.toISOString(),
    timezone: input.timezone || "America/Los_Angeles",
    active_events,
    upcoming_events,
    recent_events,
    x_context,
    planner_context: {
      related_planned_topic: input.planner?.related_planned_topic || null,
      editorial_intent: input.planner?.editorial_intent || null,
    },
    creator_context: {
      relevant_interests: [...CREATOR_INTEREST_TAGS],
      relevant_patterns: [
        "LAFC season-ticket holder — match windows are authentic opportunities",
        "FSD/Tesla product experience — release windows matter",
        "Manual Creator input always outranks planner suggestion",
      ],
    },
    indicators: [...new Set(indicators)],
    provenance: {
      events_source: events.length ? "caller_events" : "empty",
      x_context_source: x_context.length ? "caller_xTopics" : "empty",
      built_by: "shared_current_context_v1",
    },
  };

  return {
    ...base,
    prompt_block: buildPromptBlock(base),
  };
}

/** Infer event-ish context from free text for Manual Composer assist only. */
export function inferHintsFromUserText(text: string): string[] {
  const t = (text || "").toLowerCase();
  const hints: string[] = [];
  if (/lafc|경기장|직관|홈경기|원정|축구|뱅크오브/.test(t)) {
    hints.push("Possible match-day / stadium observation — prefer event context if active");
  }
  if (/fsd|v\d+|오토파일럿|로보택시|robotaxi/.test(t)) {
    hints.push("Possible FSD/product observation");
  }
  if (/분위기 미쳤|현장|오늘 경기/.test(t)) {
    hints.push("Live atmosphere language — do not treat as generic daily fluff");
  }
  return hints;
}

export function manualComposerPriorityNote(): string {
  return [
    "Manual Composer priority (hard):",
    "1) User Immediate Input",
    "2) Current Event Context",
    "3) Creator DNA",
    "4) Current X Context",
    "5) Planner Context",
    "Never let Planner dominate manual intent.",
  ].join("\n");
}
