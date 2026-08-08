"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const q = searchParams.get("error");
    if (q) setError(decodeURIComponent(q));
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "forgot") {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
          }
        );
        if (resetError) throw resetError;
        setInfo(
          "비밀번호 재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요."
        );
        setLoading(false);
        return;
      }

      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setInfo("확인 이메일을 보냈습니다. 이메일을 확인해 주세요.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight">
          AutoPostPilot
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          @Seung4680 Content Hub
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading
              ? "처리 중..."
              : mode === "login"
                ? "로그인"
                : mode === "signup"
                  ? "회원가입"
                  : "재설정 메일 보내기"}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center text-xs text-zinc-400">
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setInfo(null);
                }}
                className="block w-full hover:text-zinc-200"
              >
                비밀번호를 잊으셨나요?
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
                className="block w-full hover:text-zinc-200"
              >
                계정이 없으신가요? 회원가입
              </button>
            </>
          )}
          {mode !== "login" && (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
              className="block w-full hover:text-zinc-200"
            >
              로그인으로 돌아가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
          로딩…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
