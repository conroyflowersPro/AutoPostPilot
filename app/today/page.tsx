import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: scheduled } = await supabase
    .from("SeungContent")
    .select("id, content, status, pipeline_id, created_at")
    .eq("user_id", user.id)
    .in("status", ["scheduled", "draft", "reviewed"])
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">Today</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            optional
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-zinc-500">
          할 일 할당량이 아닙니다. 오늘 할 수 있는 기회만 보여 줍니다. 아무것도
          안 해도 됩니다.
        </p>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Write my own
          </h2>
          <p className="mt-1 text-sm text-zinc-300">
            평소처럼 한 칸에 생각을 적습니다. 주제/프롬프트 입력 없음.
          </p>
          <Link
            href="/today/write"
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            직접 쓰기
          </Link>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Suggested opportunities
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Planner 카드는 아직 optional 자리만 있습니다. 강제 과제 없음.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            EXPERIENCE_OPPORTUNITY / CREATOR_INPUT_REQUIRED 패턴은 이후 Weekly
            연동 시 채웁니다.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Conversation opportunities
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            0–5 dynamic · post-level · 지금은 비어 있을 수 있음. 자동 답글 없음.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Drafts / scheduled
          </h2>
          {!scheduled?.length ? (
            <p className="text-sm text-zinc-600">표시할 초안이 없습니다.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {scheduled.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/posts/${p.id}`}
                    className="block rounded-lg bg-zinc-950/50 px-3 py-2 hover:bg-zinc-900"
                  >
                    <span className="text-[10px] uppercase text-sky-400">
                      {p.status}
                    </span>{" "}
                    <span className="text-zinc-300">
                      {(p.content || "").slice(0, 80)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
