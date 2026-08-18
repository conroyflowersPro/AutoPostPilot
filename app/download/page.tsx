export const dynamic = "force-static";

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 text-zinc-100">
      <h1 className="text-xl font-semibold">AP 파일 받기</h1>
      <p className="text-sm text-zinc-400">
        지금 작업본(Agent승 스펙 브랜치)입니다. 배포 사이트 v12.5.5가 아닙니다. 클릭하면 zip이 저장됩니다.
      </p>
      <a
        href="/downloads/autopostpilot-spec-source.zip"
        download="autopostpilot-spec-source.zip"
        className="inline-flex rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
      >
        AP 작업본 zip 다운로드
      </a>
      <div>
        <a
          href="/downloads/operator-handoff-latest.md"
          download="operator-handoff-latest.md"
          className="text-sm text-emerald-400 underline"
        >
          인수인계 메모 다운로드
        </a>
      </div>
    </main>
  );
}
