/**
 * POST /api/reply/post
 * One-click reply publish via X API (not Fedica).
 * Requires explicit Creator 「게시」 + tweet.write.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postReplyToX } from "@/lib/reply/post-reply";
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
    const text = String(body.text || body.my_reply || "").trim();
    const inReplyTo = String(
      body.in_reply_to_tweet_id ||
        body.inReplyToTweetId ||
        body.target_id ||
        body.status_id ||
        ""
    ).trim();

    let consent;
    try {
      consent = requireExplicitApiConsent(body, {
        feature: "reply_manual",
        action: "POST_REPLY",
        service: "X_API",
      });
    } catch (err) {
      if (err instanceof ApiConsentError) {
        return NextResponse.json(
          {
            error: err.message,
            code: "API_CONSENT_REQUIRED",
            hint: "Click 「게시」 — background post is blocked.",
            paid_api_called: false,
          },
          { status: 402 }
        );
      }
      throw err;
    }

    if (!text) {
      return NextResponse.json({ error: "Reply text required" }, { status: 400 });
    }
    if (!inReplyTo) {
      return NextResponse.json(
        {
          error:
            "Target tweet id required. Use read target first, or paste is copy-only.",
        },
        { status: 400 }
      );
    }

    const result = await postReplyToX({
      text,
      inReplyToTweetId: inReplyTo,
    });

    const audit = {
      ...buildAudit(consent),
      request_scope: "POST_REPLY",
      other_replies_requested: false,
      other_reply_fetch_count: 0,
      x_endpoint: result.x_endpoint,
    };

    return NextResponse.json({
      success: true,
      paid_api_called: true,
      service_kind: "X_DATA_API",
      mode: "post_reply",
      audit,
      posted: result,
      learning_note:
        "AI draft is not evidence. This published reply may later be treated as Creator action evidence.",
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
