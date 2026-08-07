import { CalendarActivity } from "./types";
import { format, addDays, startOfMonth } from "date-fns";

/** Demo activities for current month so the Calendar is usable before full data wiring. */

function dayOffset(base: Date, n: number) {
  return format(addDays(base, n), "yyyy-MM-dd");
}

export function getDemoActivities(viewMonth: Date): CalendarActivity[] {
  const base = startOfMonth(viewMonth);
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();

  // Only generate for the viewed month
  const items: CalendarActivity[] = [
    {
      activity_id: "plan-1",
      date: dayOffset(base, 6),
      origin: "WEEKLY_PLANNER",
      action_type: "ORIGINAL",
      status: "SCHEDULED",
      topic: "FSD 관찰",
      final_text: "최근 FSD 경로 선택이 이전보다 더 자연스러워진 느낌…",
      fedica_pipeline_id: "42303",
      scheduled_at: new Date(y, m, 7, 10, 0).toISOString(),
    },
    {
      activity_id: "wild-free-1",
      date: dayOffset(base, 6),
      origin: "WILD_FREE",
      action_type: "ORIGINAL",
      status: "GENERATED",
      topic: "Grok 보이스",
      generated_text: "Grok에 보이스가 또 추가됐네요.",
    },
    {
      activity_id: "wild-growth-1",
      date: dayOffset(base, 6),
      origin: "WILD_GROWTH",
      action_type: "QUOTE",
      status: "MANUAL_ACTION_REQUIRED",
      topic: "FSD 차선",
      manual_action_required: true,
      source_post_url: "https://x.com/example/status/1",
      generated_text: "비슷한 차선 선택이 예전 버전에서도…",
      duplicate_warning: "오늘 Planned Original과 주제 유사 (FSD 차선/경로)",
    },
    {
      activity_id: "plan-2",
      date: dayOffset(base, 10),
      origin: "WEEKLY_PLANNER",
      action_type: "ORIGINAL",
      status: "DRAFT",
      topic: "Robotaxi 의견",
    },
    {
      activity_id: "manual-1",
      date: dayOffset(base, 3),
      origin: "MANUAL_CREATOR",
      action_type: "ORIGINAL",
      status: "PUBLISHED",
      topic: "일상 + Cybertruck",
      published_at: new Date(y, m, 4, 18, 30).toISOString(),
      performance_summary: "+8 Followers · 42 Profile",
    },
    {
      activity_id: "wild-free-prev",
      date: dayOffset(base, 2),
      origin: "WILD_FREE",
      action_type: "ORIGINAL",
      status: "REJECTED",
      topic: "기타 관찰",
    },
    {
      activity_id: "wild-growth-prev",
      date: dayOffset(base, 2),
      origin: "WILD_GROWTH",
      action_type: "ORIGINAL",
      status: "SELECTED",
      topic: "Terafab",
    },
    {
      activity_id: "plan-pub",
      date: dayOffset(base, 1),
      origin: "WEEKLY_PLANNER",
      action_type: "ORIGINAL",
      status: "PUBLISHED",
      topic: "제품 비전",
      performance_summary: "+15 Followers · 91 Profile",
    },
  ];

  return items.filter((a) => {
    const d = new Date(a.date + "T12:00:00");
    return d.getMonth() === m && d.getFullYear() === y;
  });
}
