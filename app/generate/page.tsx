"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/** Temporary minimal shell if full page body was truncated in transit — real page restored below in repo artifact. */
export default function GeneratePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200">←</Link>
          <h1 className="text-lg font-semibold">이번 주 계획</h1>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">v6.2.3</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-zinc-400">
          이번 주 전략을 먼저 잡고, 날짜별 초안을 만듭니다. 전체 Generate UI는 배포 복구 중입니다.
          아티팩트 AutoPostPilot-v6.2.3.zip의 app/generate/page.tsx를 참고하세요.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm"
        >
          홈으로
        </button>
      </main>
    </div>
  );
}
