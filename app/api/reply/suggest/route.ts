/**
 * POST /api/reply/suggest
 * Frozen in v11. Comment/reply status stays on the dashboard. No xAI.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Reply suggest is frozen in v11. Comment status stays on the dashboard.",
      frozen: true,
      paid_api_called: false,
    },
    { status: 410 }
  );
}
