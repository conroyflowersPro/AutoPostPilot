"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, AlertTriangle, ExternalLink, Copy, Check } from "lucide-react";
import { CalendarActivity, ControlCenterSummary } from "@/lib/calendar/types";

const ORIGIN_LABEL: Record<string, string> = {
  WEEKLY_PLANNER: "Planned",
  WILD_FREE: "Wild FREE",
  WILD_GROWTH: "Wild GROWTH",
  CREATOR_REQUEST: "Request",
  MANUAL_CREATOR: "Manual",
  X_ACTUAL: "X Actual",
};

const ORIGIN_COLOR: Record<string, string> = {
  WEEKLY_PLANNER: "bg-indigo-600/80",
  WILD_FREE: "bg-emerald-600/80",
  WILD_GROWTH: "bg-amber-600/80",
  CREATOR_REQUEST: "bg-purple-600/80",
  MANUAL_CREATOR: "bg-zinc-500/80",
  X_ACTUAL: "bg-sky-600/80",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  PUBLISHED: "published",
  GENERATED: "generated",
  SELECTED: "selected",
  REJECTED: "rejected",
  MANUAL_ACTION_REQUIRED: "manual action",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  NOT_RUN: "not run",
};

function buildSummary(activities: CalendarActivity[], focusDate: Date): ControlCenterSummary {
  const todayStr = format(focusDate, "yyyy-MM-dd");
  const todayActs = activities.filter((a) => a.date === todayStr);
  const wildFree = todayActs.find((a) => a.origin === "WILD_FREE");
  const wildGrowth = todayActs.find((a) => a.origin === "WILD_GROWTH");
  return {
    scheduled: todayActs.filter((a) => a.status === "SCHEDULED").length,
    wildFreeStatus: wildFree ? STATUS_LABEL[wildFree.status] || wildFree.status : "not run",
    wildGrowthStatus: wildGrowth ? STATUS_LABEL[wildGrowth.status] || wildGrowth.status : "not run",
    manualActions: todayActs.filter((a) => a.manual_action_required || a.status === "MANUAL_ACTION_REQUIRED").length,
    published: todayActs.filter((a) => a.status === "PUBLISHED").length,
    duplicateWarnings: todayActs.filter((a) => !!a.duplicate_warning).length,
    actualPublished: todayActs.filter((a) => a.origin === "X_ACTUAL" && a.status === "PUBLISHED").length,
  };
}

type Props = {
  initialActivities?: CalendarActivity[];
  syncStatus?: string;
};

export default function CalendarControlCenter({ initialActivities = [], syncStatus = "not_connected" }: Props) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activities = useMemo(() => {
    return initialActivities.filter((a) => {
      const d = new Date(a.date + "T12:00:00");
      return d.getMonth() === viewMonth.getMonth() && d.getFullYear() === viewMonth.getFullYear();
    });
  }, [initialActivities, viewMonth]);

  const summary = useMemo(
    () => buildSummary(activities, selectedDate || new Date()),
    [activities, selectedDate]
  );

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = calStart;
  while (cursor <= calEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarActivity[]>();
    for (const a of activities) {
      const list = map.get(a.date) || [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [activities]);

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedActs = selectedKey ? byDate.get(selectedKey) || [] : [];

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Today · Control Center</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 text-sm">
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <div className="text-[10px] text-zinc-500">Scheduled</div>
            <div className="font-semibold">{summary.scheduled}</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <div className="text-[10px] text-zinc-500">Wild FREE</div>
            <div className="font-semibold capitalize">{summary.wildFreeStatus}</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <div className="text-[10px] text-zinc-500">Wild GROWTH</div>
            <div className="font-semibold capitalize">{summary.wildGrowthStatus}</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <div className="text-[10px] text-zinc-500">Manual Actions</div>
            <div className={`font-semibold ${summary.manualActions > 0 ? "text-amber-400" : ""}`}>{summary.manualActions}</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <div className="text-[10px] text-zinc-500">Published</div>
            <div className="font-semibold">{summary.published}</div>
          </div>
          <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
            <div className="text-[10px] text-zinc-500">Duplicates</div>
            <div className={`font-semibold ${summary.duplicateWarnings > 0 ? "text-rose-400" : ""}`}>{summary.duplicateWarnings}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setViewMonth((m) => subMonths(m, 1))} className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700" aria-label="이전 달">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">{format(viewMonth, "yyyy년 M월", { locale: ko })}</h2>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700" aria-label="다음 달">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/80 text-center text-[11px] text-zinc-500">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="py-2 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-zinc-950">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const acts = byDate.get(key) || [];
            const inMonth = isSameMonth(day, viewMonth);
            const selected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            const hasManual = acts.some((a) => a.manual_action_required || a.status === "MANUAL_ACTION_REQUIRED");
            const hasDup = acts.some((a) => !!a.duplicate_warning);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`min-h-[72px] border-b border-r border-zinc-800/80 p-1 text-left transition-colors ${!inMonth ? "bg-zinc-950/40 text-zinc-600" : "hover:bg-zinc-900"} ${selected ? "bg-indigo-950/50 ring-1 ring-inset ring-indigo-500/50" : ""} ${today && !selected ? "bg-zinc-900/80" : ""}`}
              >
                <div className="mb-0.5 flex items-center justify-between px-0.5">
                  <span className={`text-xs font-medium ${today ? "rounded-full bg-indigo-600 px-1.5 text-white" : ""}`}>{format(day, "d")}</span>
                  <span className="flex gap-0.5">
                    {hasDup && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                    {hasManual && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {acts.slice(0, 3).map((a) => (
                    <div key={a.activity_id} className={`truncate rounded px-1 py-0.5 text-[9px] leading-tight text-white ${ORIGIN_COLOR[a.origin] || "bg-zinc-600"}`} title={`${ORIGIN_LABEL[a.origin] || a.origin} · ${a.status}`}>
                      {ORIGIN_LABEL[a.origin] || a.origin}
                    </div>
                  ))}
                  {acts.length > 3 && <div className="text-[9px] text-zinc-500">+{acts.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">
          {selectedDate ? format(selectedDate, "M월 d일 (EEE)", { locale: ko }) : "날짜를 선택하세요"}
        </h3>
        {selectedActs.length === 0 && (
          <p className="text-sm text-zinc-500">
            {syncStatus === "not_connected" || syncStatus === "never_synced"
              ? "No operational activity for this day (X not synced)."
              : "이 날짜에 등록된 활동이 없습니다."}
          </p>
        )}
        <div className="space-y-3">
          {selectedActs.map((a) => (
            <div key={a.activity_id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${ORIGIN_COLOR[a.origin] || "bg-zinc-600"}`}>{ORIGIN_LABEL[a.origin] || a.origin}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">{a.action_type}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{STATUS_LABEL[a.status] || a.status}</span>
                {a.topic && <span className="text-xs text-zinc-400">{a.topic}</span>}
              </div>
              {(a.final_text || a.generated_text) && (
                <p className="mb-2 whitespace-pre-wrap text-sm text-zinc-200">{a.final_text || a.generated_text}</p>
              )}
              {a.duplicate_warning && (
                <div className="mb-2 flex items-start gap-1.5 rounded bg-rose-950/40 px-2 py-1.5 text-xs text-rose-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{a.duplicate_warning}</span>
                </div>
              )}
              {(a.status === "MANUAL_ACTION_REQUIRED" || a.manual_action_required) && (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-zinc-800 pt-2">
                  {a.generated_text && (
                    <button type="button" onClick={() => copyText(a.activity_id, a.generated_text || "")} className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-zinc-700">
                      {copiedId === a.activity_id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy Text
                    </button>
                  )}
                  {a.source_post_url && (
                    <a href={a.source_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-zinc-700">
                      <ExternalLink className="h-3.5 w-3.5" /> Open on X
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        v5.2.0 · Operational calendar ·{" "}
        <Link href="/" className="text-zinc-500 underline hover:text-zinc-300">Home</Link>
      </p>
    </div>
  );
}
