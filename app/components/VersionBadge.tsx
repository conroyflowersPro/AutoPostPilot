"use client";

import { APP_VERSION_LABEL, VERSION_SUMMARY_KO } from "@/lib/version";

export default function VersionBadge({
  showSummary = false,
}: {
  showSummary?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5" title={VERSION_SUMMARY_KO}>
      <span className="shrink-0 rounded-md border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
        {APP_VERSION_LABEL}
      </span>
      {showSummary ? (
        <span className="truncate text-[11px] leading-tight text-zinc-400">{VERSION_SUMMARY_KO}</span>
      ) : null}
    </span>
  );
}
