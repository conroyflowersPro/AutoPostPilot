import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PostList from "./components/PostList";
import CollectMaxButton from "./components/CollectMaxButton";
import PerformanceCoverageButton from "./components/PerformanceCoverageButton";
import EvidenceExportButton from "./components/EvidenceExportButton";
import { getHomeDashboardData } from "@/lib/calendar/activity-provider";
import { APP_VERSION_LABEL } from "@/lib/version";

function syncLabel(status: string) {
  switch (status) {
    case "ok":
      return "Synced";
    case "failed":
      return "Last sync failed";
    case "never_synced":
      return "Never synced";
    default:
      return "X not connected";
  }
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: posts } = await supabase
    .from("SeungContent")
    .select("*")
    .order("created_at", { ascending: false });

  const home = await getHomeDashboardData();
  const { account, today, recentActual } = home;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">AutoPostPilot</h1>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {APP_VERSION_LABEL}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">X Account</div>
              <div className="mt-1 text-lg font-medium">
                {account.handle ? `@${account.handle}` : "@ —"}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Status: <span className="text-zinc-200">{syncLabel(account.status)}</span>
              </div>
              {account.lastSuccessfulSyncAt ? (
                <div className="mt-0.5 text-xs text-zinc-500">
                  Last sync: {account.lastSuccessfulSyncAt}
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-zinc-500">
                  {account.status === "not_connected"
                    ? "Connect X to enable profile + Daily Sync."
                    : "Connected — 오른쪽 Phase1A 상태 박스 확인"}
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              <div className="text-zinc-500 text-xs">Followers</div>
              <div className="font-semibold">
                {account.followersCount != null ? account.followersCount : "—"}
              </div>
              <div className="mt-1 text-zinc-500 text-xs">Following</div>
              <div className="font-semibold">
                {account.followingCount != null ? account.followingCount : "—"}
              </div>
              <div className="mt-3 flex flex-col items-end gap-1.5">
                {account.status === "not_connected" ? (
                  <a
                    href="/api/x/oauth/start"
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium hover:bg-sky-500"
                  >
                    Connect X
                  </a>
                ) : (
                  <>
                    <CollectMaxButton />
                    <PerformanceCoverageButton />
                    <EvidenceExportButton />
                    <a
                      href="/api/x/sync"
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500"
                    >
                      Sync Now
                    </a>
                    <form action="/api/x/oauth/disconnect" method="post">
                      <button
                        type="submit"
                        className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600"
                      >
                        Disconnect X
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Today</div>
            <Link href="/today" className="text-xs text-emerald-400 hover:underline">
              Open Today Plan
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 text-sm">
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">Actual published</div>
              <div className="font-semibold">{today.actualPublished}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">Scheduled</div>
              <div className="font-semibold">{today.scheduled}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">Wild FREE</div>
              <div className="font-semibold capitalize">{today.wildFreeStatus}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">Wild GROWTH</div>
              <div className="font-semibold capitalize">{today.wildGrowthStatus}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">Manual actions</div>
              <div className="font-semibold">{today.manualActions}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">Duplicates</div>
              <div className="font-semibold">{today.duplicateWarnings}</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recent X activity</div>
            <Link href="/calendar" className="text-xs text-indigo-400 hover:underline">Open Calendar</Link>
          </div>
          {recentActual.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No actual X activity loaded. Connect X and run Phase1A 최대 수집.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentActual.map((a) => (
                <li key={a.activity_id} className="rounded-lg bg-zinc-950/50 px-3 py-2">
                  <span className="text-xs text-sky-400">{a.action_type}</span>{" "}
                  <span className="text-zinc-300">{a.final_text || a.topic || a.x_post_id}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Content queue</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/today" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600">Today</Link>
            <Link href="/today/write" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500">직접 쓰기</Link>
            <Link href="/calendar" className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600">Calendar</Link>
            <Link href="/generate" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500">Grok 자동 생성</Link>
            <Link href="/learning" className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600">주간 학습</Link>
          </div>
        </div>

        <PostList posts={posts || []} />
      </main>
    </div>
  );
}
