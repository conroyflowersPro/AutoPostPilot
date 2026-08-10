"use client";

import { Suspense } from "react";

function GenerateStub() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <p className="text-lg font-medium">작성 페이지 복구 중</p>
        <p className="text-sm text-zinc-400">
          잠시 후 전체 기능이 복구됩니다. Edge weekly-plan은 별도 배포가 필요합니다.
        </p>
        <a href="/today" className="inline-block text-sm text-violet-400 underline">
          오늘로 이동
        </a>
      </div>
    </main>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">로딩…</div>}>
      <GenerateStub />
    </Suspense>
  );
}
