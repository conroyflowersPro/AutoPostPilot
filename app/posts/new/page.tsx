"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewPostPage() {
  const [content, setContent] = useState("");
  const [pipelineId, setPipelineId] = useState("42303");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const { data, error: insertError } = await supabase
        .from("SeungContent")
        .insert({
          content: content.trim(),
          status: "draft",
          pipeline_id: pipelineId,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      router.push(`/posts/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">
            ←
          </Link>
          <h1 className="text-lg font-semibold">새 포스트</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">트랙</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPipelineId("42303")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  pipelineId === "42303"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                한국어 (42303)
              </button>
              <button
                type="button"
                onClick={() => setPipelineId("20121")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  pipelineId === "20121"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                영어 (20121)
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-relaxed outline-none focus:border-emerald-500"
              placeholder="포스트 내용을 입력하세요..."
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장하고 검수하기"}
          </button>
        </form>
      </main>
    </div>
  );
}
