import { NextResponse } from "next/server";
import { runXAccountSync } from "@/lib/x/sync";

/** Manual or scheduled X account sync. */
export async function POST() {
  try {
    const result = await runXAccountSync({ source: "manual" });
    const status = result.ok ? 200 : result.status === "not_connected" ? 401 : 500;
    return NextResponse.json(result, { status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync error";
    return NextResponse.json(
      { ok: false, status: "failed", error: msg, itemsFetched: 0, itemsCreated: 0, itemsUpdated: 0 },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Allow simple trigger from browser while testing
  return POST();
}
