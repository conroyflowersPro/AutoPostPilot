export const dynamic = "force-static";

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 text-zinc-100">
      <h1 className="text-xl font-semibold">AP 파일 받기</h1>
      <p className="text-sm text-zinc-400">
        현재 작업본 v12.11.1 전체 소스입니다. node_modules · .git · 비밀키는 빠져 있습니다. 클릭하면 zip이 저장됩니다.
      </p>
      <a
        href="/downloads/autopostpilot-v12.11.1.zip"
        download="autopostpilot-v12.11.1.zip"
        className="inline-flex rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
      >
        AP 전체 파일 zip 다운로드
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
