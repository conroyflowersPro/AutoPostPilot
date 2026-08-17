export const dynamic = "force-static";

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 text-zinc-100">
      <h1 className="text-xl font-semibold">AP 파일 받기</h1>
      <p className="text-sm text-zinc-400">
        클릭하면 이 컴퓨터에 zip이 저장됩니다. GitHub 페이지가 열리지 않습니다.
      </p>
      <a
        href="/downloads/autopostpilot-v12.5.5-source.zip"
        download="autopostpilot-v12.5.5-source.zip"
        className="inline-flex rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500"
      >
        AP 소스 zip 다운로드
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
