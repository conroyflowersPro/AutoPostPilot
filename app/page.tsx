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
      return "동기화됨";
    case "failed":
      return "최근 동기화 실패";
    case "never_synced":
      return "아직 동기화 없음";
    default:
      return "X 미연결";
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
        <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-400/80">
            오늘 할 일
          </div>
          <p className="text-sm text-zinc-300">
            오늘은 무엇을 할까요? 계획·작성·대화·캘린더로 바로 이동하세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/today"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              오늘 시작하기
            </Link>
            <Link
              href="/generate"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              이번 주 계획
            </Link>
            <Link
              href="/today/write"
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
            >
              지금 쓰기
            </Link>
            <Link
              href="/today/reply"
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
            >
              답글 작성
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
            >
              캘린더
            </Link>
            <Link
              href="/learning"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
            >
              인사이트
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">X 계정</div>
              <div className="mt-1 text-lg font-medium">
                {account.handle ? `@${account.handle}` : "@ —"}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                상태: <span className="text-zinc-200">{syncLabel(account.status)}</span>
              </div>
              {account.lastSuccessfulSyncAt ? (
                <div className="mt-0.5 text-xs text-zinc-500">
                  최근 동기화: {account.lastSuccessfulSyncAt}
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-zinc-500">
                  {account.status === "not_connected"
                    ? "X를 연결하면 프로필·동기화를 쓸 수 있습니다."
                    : "연결됨 — 필요 시 아래에서 데이터 업데이트를 실행하세요."}
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              <div className="text-zinc-500 text-xs">팔로워</div>
              <div className="font-semibold">
                {account.followersCount != null ? account.followersCount : "—"}
              </div>
              <div className="mt-1 text-zinc-500 text-xs">팔로잉</div>
              <div className="font-semibold">
                {account.followingCount != null ? account.followingCount : "—"}
              </div>
              <div className="mt-3 flex flex-col items-end gap-1.5">
                {account.status === "not_connected" ? (
                  <a
                    href="/api/x/oauth/start"
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium hover:bg-sky-500"
                  >
                    X 연결
                  </a>
                ) : (
                  <>
                    <a
                      href="/api/x/sync"
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500"
                    >
                      지금 동기화
                    </a>
                    <form action="/api/x/oauth/disconnect" method="post">
                      <button
                        type="submit"
                        className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-600"
                      >
                        X 연결 해제
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
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              오늘 요약
            </div>
            <Link href="/today" className="text-xs text-emerald-400 hover:underline">
              오늘 화면 열기
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 text-sm">
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">실제 게시</div>
              <div className="font-semibold">{today.actualPublished}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">예약</div>
              <div className="font-semibold">{today.scheduled}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">자유 콘텐츠</div>
              <div className="font-semibold capitalize">{today.wildFreeStatus}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">성장 콘텐츠</div>
              <div className="font-semibold capitalize">{today.wildGrowthStatus}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">직접 작성</div>
              <div className="font-semibold">{today.manualActions}</div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 px-3 py-2">
              <div className="text-[10px] text-zinc-500">유사 주의</div>
              <div className="font-semibold">{today.duplicateWarnings}</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              최근 X 활동
            </div>
            <Link href="/calendar" className="text-xs text-indigo-400 hover:underline">
              캘린더
            </Link>
          </div>
          {recentActual.length === 0 ? (
            <p className="text-sm text-zinc-500">
              아직 불러온 X 활동이 없습니다. X 연결 후 데이터 업데이트를 실행하세요.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentActual.map((a) => (
                <li key={a.activity_id} className="rounded-lg bg-zinc-950/50 px-3 py-2">
                  <span className="text-xs text-sky-400">{a.action_type}</span>{" "}
                  <span className="text-zinc-300">
                    {a.final_text || a.topic || a.x_post_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {account.status !== "not_connected" && (
          <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-zinc-500">
              고급 · 데이터 / 진단
            </summary>
            <p className="mt-2 text-[11px] text-zinc-600">
              평소 사용에는 필요 없습니다. 수집·커버리지·내보내기 등 운영 도구입니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CollectMaxButton />
              <PerformanceCoverageButton />
              <EvidenceExportButton />
            </div>
          </details>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">콘텐츠 큐</h2>
        </div>

        <PostList posts={posts || []} />
      </main>
    </div>
  );
}
