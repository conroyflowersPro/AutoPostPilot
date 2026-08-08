import { NextResponse } from "next/server";
import { runXAccountSync } from "@/lib/x/sync";

const APP_ORIGIN =
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "https://autopostpilot.netlify.app";

/** Manual or scheduled X account sync. */
export async function POST() {
  try {
    const result = await runXAccountSync({ source: "manual" });
    const status = result.ok ? 200 : result.status === "not_connected" ? 401 : 500;
    return NextResponse.json(result, { status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync error";
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: msg,
        itemsFetched: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
      },
      { status: 500 }
    );
  }
}

/** Browser Sync Now — run sync then return to Home with query flag. */
export async function GET() {
  try {
    const result = await runXAccountSync({ source: "manual" });
    if (result.ok) {
      const q = new URLSearchParams({
        x_sync: "ok",
        fetched: String(result.itemsFetched),
        created: String(result.itemsCreated),
      });
      return NextResponse.redirect(`${APP_ORIGIN}/?${q.toString()}`);
    }
    const q = new URLSearchParams({
      x_sync: "error",
      reason: result.error || result.status || "failed",
    });
    return NextResponse.redirect(`${APP_ORIGIN}/?${q.toString()}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync_error";
    const q = new URLSearchParams({ x_sync: "error", reason: msg });
    return NextResponse.redirect(`${APP_ORIGIN}/?${q.toString()}`);
  }
}
