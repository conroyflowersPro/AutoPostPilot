import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import PostActions from "./PostActions";
import PostContentEditor from "./PostContentEditor";

export const dynamic = "force-dynamic";

const QUEUE_STATUSES = ["draft", "reviewed", "scheduling", "schedule_failed"] as const;
const DONE_STATUSES = ["scheduled", "published"] as const;

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
    .eq("user_id", user.id)
    .maybeSingle();

  if (!post) notFound();

  const [{ data: queueIds }, { data: doneIds }] = await Promise.all([
    supabase
      .from("SeungContent")
      .select("id, created_at")
      .eq("user_id", user.id)
      .in("status", [...QUEUE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("SeungContent")
      .select("id, created_at")
      .eq("user_id", user.id)
      .in("status", [...DONE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const ids = [...(queueIds || []), ...(doneIds || [])]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((r: { id: string }) => r.id);
  const idx = ids.indexOf(id);
  // list is newest-first: "next" in workflow = older draft (idx+1)
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;
  const prevId = idx > 0 ? ids[idx - 1] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ← 큐
          </Link>
          <span className="ml-auto text-[10px] text-zinc-500">
            {idx >= 0 ? `${idx + 1} / ${ids.length}` : ""}
          </span>
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

        <PostActions post={post} nextId={nextId} prevId={prevId} />
      </main>
    </div>
  );
}
