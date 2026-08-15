import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CalendarControlCenter from "@/app/components/CalendarControlCenter";
import { getCalendarActivities, getAccountSyncState } from "@/lib/calendar/activity-provider";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const viewMonth = new Date();
  const [activities, syncState] = await Promise.all([
    getCalendarActivities(viewMonth),
    getAccountSyncState(),
  ]);

  const isDemo =
    process.env.NEXT_PUBLIC_CALENDAR_DEMO === "1" ||
    process.env.CALENDAR_DEMO === "1";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-medium">캘린더</h1>
        <p className="mt-1 text-xs text-zinc-500">
          계획 · 예약 · 실제 게시가 한곳에서 보입니다. 날짜를 고르면 계획/작성으로 이어집니다.
        </p>
      </div>

      {isDemo && (
        <div className="mb-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          DEMO 모드 — 예시 데이터만 표시됩니다.
        </div>
      )}

      {!isDemo && syncState.status === "not_connected" && (
        <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
          X 미연결 — 동기화 후 실제 활동이 채워집니다.
        </div>
      )}

      <CalendarControlCenter
        initialActivities={activities}
        syncStatus={syncState.status}
      />
    </main>
  );
}
