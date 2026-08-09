/**
 * Zero-cost Daily Engagement Recommendations from stored Shared Current Context.
 * No X API / paid search on page load.
 */

import { buildSharedCurrentContext } from "@/lib/context";
import type { BuildContextInput } from "@/lib/context/types";
import type { EngagementOpportunity } from "./types";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildStoredEngagementRecommendations(
  input: BuildContextInput = {}
): {
  opportunities: EngagementOpportunity[];
  api_required_actions: Array<{ label: string; action: string; purpose: string }>;
  context_timestamp: string;
  indicators: string[];
} {
  const shared = buildSharedCurrentContext(input);
  const opportunities: EngagementOpportunity[] = [];

  for (const ev of [
    ...shared.active_events,
    ...shared.upcoming_events,
    ...shared.recent_events,
  ]) {
    if (ev.creator_relevance === "none" || ev.creator_relevance === "low") continue;
    if (ev.phase === "UNKNOWN") continue;

    const phaseLabel = ev.phase;
    let why = `${ev.event_name} (${phaseLabel}) — Creator 관심사와 연결된 대화 기회`;
    let intent: EngagementOpportunity["suggested_intent"] = "LIGHT_OPINION";
    let type: EngagementOpportunity["opportunity_type"] = "EVENT_DISCUSSION";

    if (ev.event_type === "LAFC_MATCH" || ev.event_type === "SPORTS_MATCH") {
      type = phaseLabel === "LIVE" ? "FAN_INTERACTION" : "EVENT_DISCUSSION";
      intent =
        phaseLabel === "LIVE"
          ? "FAN_INTERACTION"
          : phaseLabel === "POST_EVENT"
            ? "EXPERIENCE_SHARE"
            : "LIGHT_OPINION";
      why =
        phaseLabel === "PRE_EVENT"
          ? "홈/경기 전 팬 대화·기대 포인트 참여 기회"
          : phaseLabel === "LIVE"
            ? "경기 당일 커뮤니티 반응·현장 분위기 대화 기회"
            : phaseLabel === "POST_EVENT"
              ? "경기 후 소감·장면 공유 대화 기회"
              : why;
    } else if (
      ev.event_type === "FSD_RELEASE" ||
      ev.event_type === "SOFTWARE_UPDATE" ||
      ev.event_type === "TESLA_EVENT"
    ) {
      type = "TECHNICAL_DISCUSSION";
      intent = "TECHNICAL_ANSWER";
      why = `${ev.event_name} 관련 기술/경험 대화 기회 (존재 경험만)`;
    }

    opportunities.push({
      id: uid("eng"),
      opportunity_type: type,
      topic: ev.event_name,
      why_relevant: why,
      relationship_context: "UNKNOWN",
      event_context: { event_name: ev.event_name, phase: ev.phase },
      suggested_intent: intent,
      context_freshness: "STORED",
      api_required: false,
      api_action_label: null,
      source: "SHARED_CONTEXT",
    });
  }

  for (const x of shared.x_context) {
    if (x.freshness_hours != null && x.freshness_hours > 72) continue;
    if (x.relevance === "none") continue;
    opportunities.push({
      id: uid("x"),
      opportunity_type: "CURRENT_TOPIC",
      topic: x.topic,
      why_relevant: `저장된 X context (${x.status}) — 추가 API 없이 참고만`,
      relationship_context: "UNKNOWN",
      event_context: null,
      suggested_intent: "LIGHT_OPINION",
      context_freshness:
        x.freshness_hours != null && x.freshness_hours <= 24 ? "FRESH" : "STORED",
      api_required: false,
      source: "STORED",
    });
  }

  const api_required_actions = [
    {
      label: "오늘 Engagement 찾기",
      action: "find_engagement_opportunities",
      purpose: "Search current X conversations for reply opportunities",
    },
    {
      label: "현재 X 문맥 불러오기",
      action: "refresh_x_context",
      purpose: "Refresh current X topic context",
    },
  ];

  const capped = opportunities.slice(0, 5);

  return {
    opportunities: capped,
    api_required_actions,
    context_timestamp: shared.context_timestamp,
    indicators: shared.indicators,
  };
}
