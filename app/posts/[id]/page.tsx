import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import PostActions from "./PostActions";
import PostContentEditor from "./PostContentEditor";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("SeungContent")
    .select("*")
    .eq("id", id)
    .single();

  if (!post) notFound();

  // Same order as home list for prev/next
  const { data: allIds } = await supabase
    .from("SeungContent")
    .select("id")
    .order("created_at", { ascending: false });

  const ids = (allIds || []).map((r: { id: string }) => r.id);
  const idx = ids.indexOf(id);
  const newerId = idx > 0 ? ids[idx - 1] : null;
  const olderId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">포스트 상세</h1>
          <span className="ml-auto text-[10px] text-zinc-500">
            {idx >= 0 ? `${idx + 1} / ${ids.length}` : ""}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex gap-2">
          {olderId ? (
            <Link
              href={`/posts/${olderId}`}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/60 py-2.5 text-center text-sm hover:border-zinc-500"
            >
              ← 이전
            </Link>
          ) : (
            <span className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-center text-sm text-zinc-600">
              ← 이전
            </span>
          )}
          {newerId ? (
            <Link
              href={`/posts/${newerId}`}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/60 py-2.5 text-center text-sm hover:border-zinc-500"
            >
              다음 →
            </Link>
          ) : (
            <span className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-center text-sm text-zinc-600">
              다음 →
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 uppercase">
            {post.status}
          </span>
          <span className="rounded-full bg-zinc-800 px-2.5 py-1">
            {post.pipeline_id === "42303" ? "한국어" : "영어"}
          </span>
          {post.scheduled_at && (
            <span className="text-zinc-400">
              {new Date(post.scheduled_at).toLocaleString("ko-KR", {
                timeZone: "America/Los_Angeles",
              })}
            </span>
          )}
        </div>

        <PostContentEditor
          postId={post.id}
          content={post.content}
          status={post.status}
        />

        <PostActions post={post} />

        <div className="flex gap-2 pb-8">
          {olderId ? (
            <Link
              href={`/posts/${olderId}`}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/60 py-2.5 text-center text-sm hover:border-zinc-500"
            >
              ← 이전
            </Link>
          ) : (
            <span className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-center text-sm text-zinc-600">
              ← 이전
            </span>
          )}
          {newerId ? (
            <Link
              href={`/posts/${newerId}`}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-medium hover:bg-indigo-500"
            >
              다음 →
            </Link>
          ) : (
            <Link
              href="/"
              className="flex-1 rounded-lg bg-emerald-700 py-2.5 text-center text-sm font-medium hover:bg-emerald-600"
            >
              목록으로 (일괄 스케줄)
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
