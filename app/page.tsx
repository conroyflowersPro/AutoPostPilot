import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BatchScheduleButton from "./components/BatchScheduleButton";

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

  const reviewedReady =
    posts?.filter(
      (p: any) =>
        p.status === "reviewed" &&
        p.pipeline_id === "42303" &&
        p.media_urls &&
        p.media_urls.length > 0
    ).length || 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">AutoPostPilot</h1>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              v1.3.1
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

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Posts</h2>
          <div className="flex gap-2">
            <Link
              href="/generate"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              ✨ Grok 자동 생성
            </Link>
            <Link
              href="/posts/new"
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600"
            >
              + 직접 작성
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="mb-3 text-xs text-zinc-400">
            한국어 일괄 스케줄: reviewed + 미디어만 · 17:00 LA 시작(지났으면
            다음 정시) · 최소 3시간 · 특화 Grok 시간 배정
          </p>
          <BatchScheduleButton reviewedCount={reviewedReady} />
        </div>

        {!posts || posts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
            <p>아직 포스트가 없습니다.</p>
            <p className="mt-2 text-sm">
              「Grok 자동 생성」으로 3일치 초안을 만들어보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-3 text-sm leading-relaxed text-zinc-200">
                    {post.content}
                  </p>
                  <StatusBadge status={post.status} />
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                  {post.scheduled_at && (
                    <span>
                      {new Date(post.scheduled_at).toLocaleString("ko-KR", {
                        timeZone: "America/Los_Angeles",
                      })}
                    </span>
                  )}
                  {post.pipeline_id && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                      {post.pipeline_id === "42303" ? "KR" : "EN"}
                    </span>
                  )}
                  {post.media_urls && post.media_urls.length > 0 && (
                    <span>📷 {post.media_urls.length}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-zinc-700 text-zinc-300",
    reviewed: "bg-blue-900/60 text-blue-300",
    scheduled: "bg-amber-900/60 text-amber-300",
    published: "bg-emerald-900/60 text-emerald-300",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
        colors[status] || colors.draft
      }`}
    >
      {status}
    </span>
  );
}
