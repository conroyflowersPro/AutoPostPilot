/**
 * POST /api/reply/fetch-context
 * Explicit Creator action only: "API로 댓글 읽기"
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractStatusId } from "@/lib/reply/url";
import { fetchThreadContextByStatusId } from "@/lib/reply/fetch-tweet";
import { classifyIncomingReply } from "@/lib/reply/dna";
import {
  requireExplicitApiConsent,
  buildAudit,
  ApiConsentError,
} from "@/lib/api-consent";

export const maxDuration = 26;

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
    const urlOrId = String(body.url || body.status_id || body.statusId || "").trim();
    const statusId = extractStatusId(urlOrId);

    if (!statusId) {
      return NextResponse.json(
        { error: "Valid X status URL or numeric id required" },
        { status: 400 }
      );
    }

    let consent;
    try {
      consent = requireExplicitApiConsent(body, {
        feature: "reply_manual",
        action: "fetch_comment_context",
        service: "X_API",
      });
    } catch (err) {
      if (err instanceof ApiConsentError) {
        return NextResponse.json(
          {
            error: err.message,
            code: "API_CONSENT_REQUIRED",
            hint: "Click 「API로 댓글 읽기」 — paste alone does not call X API.",
            paid_api_called: false,
          },
          { status: 402 }
        );
      }
      throw err;
    }

    const thread = await fetchThreadContextByStatusId(statusId);
    const signals = classifyIncomingReply(thread.target_text);

    return NextResponse.json({
      success: true,
      paid_api_called: true,
      audit: buildAudit(consent),
      thread,
      signals,
      relationship_context: "UNKNOWN",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "error",
        paid_api_called: true,
      },
      { status: 500 }
    );
  }
}
