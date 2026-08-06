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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">포스트 상세</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
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
      </main>
    </div>
  );
}
