/**
 * GET/POST /api/context/current
 * Shared Current Context snapshot for Planner + Manual Composer.
 * Read-only situational model — does not mutate DNA.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildSharedCurrentContext,
  type KnownEvent,
} from "@/lib/context";

export const maxDuration = 15;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = buildSharedCurrentContext({ events: [], xTopics: [] });
    return NextResponse.json({ success: true, context: ctx });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? (body.events as KnownEvent[]) : [];
    const xTopics = Array.isArray(body.xTopics) ? body.xTopics : [];
    const planner = body.planner || {};
    const now = body.now || undefined;

    const ctx = buildSharedCurrentContext({
      now,
      events,
      xTopics,
      planner,
      timezone: body.timezone || "America/Los_Angeles",
    });

    return NextResponse.json({ success: true, context: ctx });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
