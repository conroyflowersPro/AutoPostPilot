import Link from "next/link";
import type { InscribedDay } from "@/lib/calendar/planner-inscribe";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default function QueueMonthCalendar(props: {
  year: number;
  month: number;
  days: InscribedDay[];
  lastSyncAt?: string | null;
}) {
  const { year, month, days, lastSyncAt } = props;
  const byDate = new Map(days.map((d) => [d.date, d.kinds]));
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const dim = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string; inMonth: boolean; dayNum: number } | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) {
    cells.push({ date: ymd(year, month, d), inMonth: true, dayNum: d });
  }
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const title = `${year}년 ${month}월`;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-200">계정 현황</h2>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={`/?cal=${prev.year}-${String(prev.month).padStart(2, "0")}`}
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800"
          >
            ←
          </Link>
          <span className="min-w-[7rem] text-center text-zinc-300">{title}</span>
          <Link
            href={`/?cal=${next.year}-${String(next.month).padStart(2, "0")}`}
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800"
          >
            →
          </Link>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-zinc-500">
        Planner가 「지금 동기화」 기록과, Fedica 글 ID가 있는 scheduled만 예약으로 기입합니다. 수제·AP·인용·재게시는 그날 있는 종류만 숫자로 나옵니다.
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`pad-${i}`} className="min-h-[4.2rem] rounded-lg bg-zinc-950/20" />;
          }
          const kinds = byDate.get(cell.date) || [];
          return (
            <div
              key={cell.date}
              className="min-h-[4.2rem] rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-1"
            >
              <div className="text-[10px] text-zinc-500">{cell.dayNum}</div>
              <div className="mt-0.5 space-y-0.5">
                {kinds.map((k) => (
                  <div key={k.key} className="text-[10px] leading-tight text-zinc-300">
                    {k.label} {k.n}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {lastSyncAt ? (
        <p className="mt-2 text-[10px] text-zinc-600">마지막 동기화 {lastSyncAt}</p>
      ) : (
        <p className="mt-2 text-[10px] text-zinc-600">동기화 전이면 게시 숫자는 비어 있고, 예약만 보일 수 있습니다.</p>
      )}
    </section>
  );
}
