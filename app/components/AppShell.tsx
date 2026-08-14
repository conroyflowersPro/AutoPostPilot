"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import VersionBadge from "./VersionBadge";

const NAV = [
  { href: "/today", label: "오늘", match: (p: string) => p === "/today" || p.startsWith("/today/") },
  { href: "/generate", label: "계획", match: (p: string) => p.startsWith("/generate") },
  { href: "/calendar", label: "캘린더", match: (p: string) => p.startsWith("/calendar") },
  {
    href: "/today/write",
    label: "작성",
    match: (p: string) =>
      p.startsWith("/today/write") || p.startsWith("/today/reply"),
  },
  { href: "/learning", label: "인사이트", match: (p: string) => p.startsWith("/learning") },
] as const;

function hideShell(pathname: string) {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/auth")) return true;
  return false;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (hideShell(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="truncate text-sm font-semibold tracking-tight hover:text-zinc-300">
              AutoPostPilot
            </Link>
            <VersionBadge />
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-white"
                      : "rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/"
              className="ml-1 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              홈
            </Link>
          </nav>
        </div>
      </header>

      <div className="pb-20 sm:pb-6">{children}</div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-1 py-1">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium text-emerald-400"
                    : "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] text-zinc-500"
                }
              >
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
