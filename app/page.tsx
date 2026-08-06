import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PostList from "./components/PostList";

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">AutoPostPilot</h1>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              v4.0.1
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

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex gap-3">
          <Link
            href="/generate"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium hover:bg-indigo-500"
          >
            특화 Grok 자동 생성
          </Link>
          <Link
            href="/posts/new"
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm hover:bg-zinc-700"
          >
            수동 작성
          </Link>
        </div>

        <PostList posts={posts || []} />
      </main>
    </div>
  );
}
