/**
 * Creator-relevant event seeds + phase rules.
 * General event model — not LAFC-only.
 * Real schedules should be passed via BuildContextInput.events when available.
 */
import type { CreatorRelevance, EventPhase, EventType, KnownEvent } from "./types";

/** Standing creator interests used for relevance (not Current Context itself). */
export const CREATOR_INTEREST_TAGS = [
  "LAFC",
  "soccer",
  "Tesla",
  "FSD",
  "Cybertruck",
  "Robotaxi",
  "xAI",
  "Grok",
  "gaming",
] as const;

export function defaultCreatorRelevance(eventType: EventType): CreatorRelevance {
  switch (eventType) {
    case "LAFC_MATCH":
    case "SPORTS_MATCH":
    case "FSD_RELEASE":
    case "TESLA_EVENT":
      return "high";
    case "XAI_AI_EVENT":
    case "GAME_RELEASE":
    case "GAME_UPDATE":
    case "SOFTWARE_UPDATE":
      return "medium";
    default:
      return "low";
  }
}

/** Phase windows in hours relative to start (and optional end). */
export function phaseWindows(eventType: EventType): {
  preHours: number;
  liveHoursAfterStart: number;
  postHours: number;
  recentHours: number;
} {
  switch (eventType) {
    case "LAFC_MATCH":
    case "SPORTS_MATCH":
      return { preHours: 48, liveHoursAfterStart: 4, postHours: 36, recentHours: 72 };
    case "FSD_RELEASE":
    case "SOFTWARE_UPDATE":
      return { preHours: 72, liveHoursAfterStart: 24, postHours: 96, recentHours: 168 };
    case "GAME_RELEASE":
    case "GAME_UPDATE":
      return { preHours: 48, liveHoursAfterStart: 24, postHours: 72, recentHours: 120 };
    case "TESLA_EVENT":
    case "XAI_AI_EVENT":
      return { preHours: 72, liveHoursAfterStart: 8, postHours: 72, recentHours: 120 };
    default:
      return { preHours: 24, liveHoursAfterStart: 6, postHours: 24, recentHours: 48 };
  }
}

export function computePhase(
  eventType: EventType,
  startIso: string,
  endIso: string | null | undefined,
  now: Date
): { phase: EventPhase; lead_time_hours: number | null } {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return { phase: "UNKNOWN", lead_time_hours: null };
  }
  const end = endIso ? new Date(endIso) : null;
  const endValid = end && !Number.isNaN(end.getTime()) ? end : null;
  const w = phaseWindows(eventType);
  const ms = now.getTime() - start.getTime();
  const hoursFromStart = ms / 3_600_000;
  const lead = (start.getTime() - now.getTime()) / 3_600_000;

  if (hoursFromStart < -w.preHours) {
    return { phase: "UPCOMING", lead_time_hours: Math.round(lead * 10) / 10 };
  }
  if (hoursFromStart < 0) {
    return { phase: "PRE_EVENT", lead_time_hours: Math.round(lead * 10) / 10 };
  }
  const liveEndHours = endValid
    ? (endValid.getTime() - start.getTime()) / 3_600_000
    : w.liveHoursAfterStart;
  if (hoursFromStart <= Math.max(liveEndHours, w.liveHoursAfterStart)) {
    return { phase: "LIVE", lead_time_hours: 0 };
  }
  if (hoursFromStart <= w.postHours) {
    return { phase: "POST_EVENT", lead_time_hours: null };
  }
  if (hoursFromStart <= w.recentHours) {
    return { phase: "RECENT", lead_time_hours: null };
  }
  return { phase: "UNKNOWN", lead_time_hours: null };
}

export function suggestedAngles(eventType: EventType, phase: EventPhase): string[] {
  const lafc: Record<string, string[]> = {
    PRE_EVENT: ["pre-match 기대", "상대팀/시즌 흐름", "직관 예정 자연 언급"],
    LIVE: ["경기장 분위기", "현장 관찰", "fan experience"],
    POST_EVENT: ["직관 소감", "인상 장면", "개인 observation"],
    UPCOMING: ["주간 일정 속 경기 위치"],
    RECENT: ["여운/짧은 회고"],
  };
  const fsd: Record<string, string[]> = {
    PRE_EVENT: ["변경점 기대", "테스트 예정"],
    LIVE: ["설치/첫 체감", "observation"],
    POST_EVENT: ["실제 경험 비교", "technical explanation", "Article candidate"],
    UPCOMING: ["릴리스 윈도우 인지"],
    RECENT: ["짧은 후기"],
  };
  if (eventType === "LAFC_MATCH" || eventType === "SPORTS_MATCH") {
    return lafc[phase] || [];
  }
  if (
    eventType === "FSD_RELEASE" ||
    eventType === "SOFTWARE_UPDATE" ||
    eventType === "TESLA_EVENT"
  ) {
    return fsd[phase] || [];
  }
  if (eventType === "GAME_RELEASE" || eventType === "GAME_UPDATE") {
    if (phase === "PRE_EVENT") return ["기대/개인 의견"];
    if (phase === "LIVE") return ["first reaction"];
    if (phase === "POST_EVENT") return ["actual play experience"];
  }
  return [];
}

export function mediaHints(eventType: EventType, phase: EventPhase): string[] {
  if (eventType === "LAFC_MATCH" || eventType === "SPORTS_MATCH") {
    if (phase === "LIVE" || phase === "PRE_EVENT") {
      return ["경기장 사진", "crowd atmosphere video", "live moment"];
    }
    if (phase === "POST_EVENT") return ["직관 사진/영상"];
  }
  if (eventType === "FSD_RELEASE" || eventType === "SOFTWARE_UPDATE") {
    return ["driving video", "screen/version evidence"];
  }
  if (eventType === "GAME_RELEASE" || eventType === "GAME_UPDATE") {
    return ["gameplay capture"];
  }
  return [];
}

/**
 * Optional demo/seed events for offline tests — not forced into production
 * when empty calendar is intentional.
 */
export function seedEventsForTests(now = new Date()): KnownEvent[] {
  const day = (offsetDays: number, hour = 19) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    d.setUTCHours(hour, 30, 0, 0);
    return d.toISOString();
  };
  return [
    {
      event_id: "seed-lafc-plus2",
      event_type: "LAFC_MATCH",
      event_name: "LAFC home match (seed)",
      start_time: day(2),
      home_away: "home",
      opponent: "TBD",
      source: "seed_test",
      creator_relevance: "high",
      notes: "STH authentic opportunity window",
    },
  ];
}
