"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * After password-reset email link → /auth/callback → here.
 * User is already in a recovery session; they set the new password.
 */
export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setError(
          "세션이 없습니다. 비밀번호 재설정 메일 링크를 다시 열어 주세요."
        );
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase.auth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "비밀번호 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        세션 확인 중…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-1 text-center text-xl font-semibold tracking-tight">
          새 비밀번호 설정
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          재설정 링크로 인증되었습니다. 새 비밀번호를 입력하세요.
        </p>

        {success ? (
          <p className="rounded-lg bg-emerald-900/40 px-3 py-3 text-center text-sm text-emerald-300">
            비밀번호가 변경되었습니다. 홈으로 이동합니다…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400">
                새 비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400">
                새 비밀번호 확인
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "변경 중…" : "비밀번호 변경"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-4 w-full text-center text-xs text-zinc-400 hover:text-zinc-200"
        >
          로그인으로 돌아가기
        </button>
      </div>
    </div>
  );
}
