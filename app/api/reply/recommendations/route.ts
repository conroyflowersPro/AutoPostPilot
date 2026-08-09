/**
 * GET/POST /api/reply/recommendations
 * Default: LOCAL_STORED only — zero paid API on load.
 * X search only when explicit api_consent is provided.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStoredEngagementRecommendations } from "@/lib/reply/recommendations";
import {
  requireExplicitApiConsent,
  buildAudit,
  ApiConsentError,
} from "@/lib/api-consent";

export const maxDuration = 26;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = buildStoredEngagementRecommendations({});
    return NextResponse.json({
      success: true,
      mode: "LOCAL_STORED",
      paid_api_called: false,
      ...result,
      note: "Page-load safe. Use explicit action to search live X conversations.",
    });
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
    const wantLive = Boolean(body.find_live || body.refresh_x);

    if (!wantLive) {
      const result = buildStoredEngagementRecommendations({
        events: Array.isArray(body.events) ? body.events : [],
        xTopics: Array.isArray(body.xTopics) ? body.xTopics : [],
      });
      return NextResponse.json({
        success: true,
        mode: "LOCAL_STORED",
        paid_api_called: false,
        ...result,
      });
    }

    let consent;
    try {
      consent = requireExplicitApiConsent(body, {
        feature: "reply_engagement",
        action: body.refresh_x ? "refresh_x_context" : "find_engagement_opportunities",
        service: "X_API",
      });
    } catch (err) {
      if (err instanceof ApiConsentError) {
        return NextResponse.json(
          {
            error: err.message,
            code: "API_CONSENT_REQUIRED",
            paid_api_called: false,
          },
          { status: 402 }
        );
      }
      throw err;
    }

    const result = buildStoredEngagementRecommendations({
      events: Array.isArray(body.events) ? body.events : [],
      xTopics: Array.isArray(body.xTopics) ? body.xTopics : [],
    });

    return NextResponse.json({
      success: true,
      mode: "API_CONSENTED_STORED_FALLBACK",
      paid_api_called: false,
      audit: buildAudit(consent),
      message:
        "Consent recorded. Live X conversation search not yet wired; returning stored Shared Context opportunities only.",
      ...result,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
