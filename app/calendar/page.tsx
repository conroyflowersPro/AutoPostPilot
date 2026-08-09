import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CalendarControlCenter from "@/app/components/CalendarControlCenter";
import { getCalendarActivities, getAccountSyncState } from "@/lib/calendar/activity-provider";
import { APP_VERSION_LABEL } from "@/lib/version";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-semibold tracking-tight hover:text-zinc-300">
              AutoPostPilot
            </Link>
            <span className="rounded bg-indigo-900/60 px-1.5 py-0.5 text-[10px] text-indigo-300">
              {APP_VERSION_LABEL}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-medium">Activity Calendar</h1>
          <div className="flex gap-2">
            <Link href="/" className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-600">
              Home
            </Link>
            <Link href="/generate" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500">
              Grok 생성
            </Link>
          </div>
        </div>

        {isDemo && (
          <div className="mb-3 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            DEMO mode — fixtures only. Not real account activity.
          </div>
        )}

        {!isDemo && syncState.status === "not_connected" && (
          <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            X account not connected. Calendar shows operational data only (empty until Daily Sync + OAuth).
          </div>
        )}

        <CalendarControlCenter initialActivities={activities} syncStatus={syncState.status} />
      </main>
    </div>
  );
}
