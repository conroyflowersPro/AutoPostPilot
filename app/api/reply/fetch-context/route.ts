/**
 * POST /api/reply/fetch-context
 *
 * Modes (explicit Creator action + consent):
 * - target (default): TARGET_POST_ONLY | TARGET_REPLY_ONLY
 * - parent: READ_PARENT_POST
 * - root: READ_ROOT_POST
 * - other_reactions: READ_OTHER_REACTIONS (capped 10|20|50, no pagination)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractStatusId } from "@/lib/reply/url";
import {
  fetchTargetOnly,
  fetchSingleRelated,
  fetchOtherReactions,
} from "@/lib/reply/fetch-tweet";
import { classifyIncomingReply } from "@/lib/reply/dna";
import {
  requireExplicitApiConsent,
  buildAudit,
  ApiConsentError,
} from "@/lib/api-consent";

export const maxDuration = 26;

const ACTION_BY_MODE: Record<string, { action: string; purpose: string }> = {
  target: {
    action: "READ_TARGET",
    purpose: "Fetch single target post or reply only",
  },
  parent: {
    action: "READ_PARENT_POST",
    purpose: "Fetch parent post/reply body only",
  },
  root: {
    action: "READ_ROOT_POST",
    purpose: "Fetch root post body only",
  },
  other_reactions: {
    action: "READ_OTHER_REACTIONS",
    purpose: "Fetch capped sample of other replies in conversation",
  },
};

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
    const mode = String(body.mode || "target").toLowerCase();
    const urlOrId = String(body.url || body.status_id || body.statusId || "").trim();
    const statusId = extractStatusId(urlOrId);
    const conversationId = body.conversation_id
      ? String(body.conversation_id)
      : null;
    const maxReactions = Number(body.max_reactions || 10);

    if (mode !== "other_reactions" && !statusId) {
      return NextResponse.json(
        { error: "Valid X status URL or numeric id required" },
        { status: 400 }
      );
    }

    const actionSpec = ACTION_BY_MODE[mode] || ACTION_BY_MODE.target;

    let consent;
    try {
      consent = requireExplicitApiConsent(body, {
        feature: "reply_manual",
        action: actionSpec.action,
        service: "X_API",
      });
    } catch (err) {
      if (err instanceof ApiConsentError) {
        return NextResponse.json(
          {
            error: err.message,
            code: "API_CONSENT_REQUIRED",
            hint: "Explicit button required — paste alone does not call X API.",
            paid_api_called: false,
          },
          { status: 402 }
        );
      }
      throw err;
    }

    if (mode === "target" || !ACTION_BY_MODE[mode]) {
      const result = await fetchTargetOnly(statusId!);
      const signals = classifyIncomingReply(result.target.target_text);

      const audit = {
        ...buildAudit(consent),
        request_scope: result.request_scope,
        other_replies_requested: false,
        other_reply_fetch_count: 0,
        conversation_pagination_count: 0,
        x_endpoint: result.x_endpoint,
        x_query_summary: result.x_query_summary,
      };

      return NextResponse.json({
        success: true,
        paid_api_called: true,
        service_kind: "X_DATA_API",
        mode: "target",
        audit,
        thread: result.target,
        is_reply: result.is_reply,
        parent_id_hint: result.parent_id_hint,
        conversation_id: result.conversation_id,
        signals,
        relationship_context: "UNKNOWN",
        scope_note:
          "TARGET ONLY — other users' replies not fetched. Reply count on post does not change cost.",
      });
    }

    if (mode === "parent" || mode === "root") {
      const related = await fetchSingleRelated(
        statusId!,
        mode === "parent" ? "parent" : "root"
      );
      const audit = {
        ...buildAudit(consent),
        request_scope: related.request_scope,
        other_replies_requested: false,
        other_reply_fetch_count: 0,
        conversation_pagination_count: 0,
        x_endpoint: related.x_endpoint,
        x_query_summary: related.x_query_summary,
      };

      return NextResponse.json({
        success: true,
        paid_api_called: true,
        service_kind: "X_DATA_API",
        mode,
        audit,
        related: {
          id: related.id,
          text: related.text,
          author_username: related.author_username,
        },
      });
    }

    if (mode === "other_reactions") {
      let conv = conversationId;
      if (!conv && statusId) {
        const t = await fetchTargetOnly(statusId);
        conv = t.conversation_id || statusId;
      }
      if (!conv) {
        return NextResponse.json(
          { error: "conversation_id or target url required for other reactions" },
          { status: 400 }
        );
      }

      const allowed = [10, 20, 50].includes(maxReactions)
        ? (maxReactions as 10 | 20 | 50)
        : 10;

      const reactions = await fetchOtherReactions(conv, allowed);
      const audit = {
        ...buildAudit(consent),
        request_scope: "OTHER_REACTIONS",
        other_replies_requested: true,
        other_reply_fetch_count: reactions.other_reply_fetch_count,
        conversation_pagination_count: 0,
        x_endpoint: reactions.x_endpoint,
        x_query_summary: reactions.x_query_summary,
      };

      return NextResponse.json({
        success: true,
        paid_api_called: true,
        service_kind: "X_DATA_API",
        mode: "other_reactions",
        audit,
        reactions: reactions.replies,
        max_requested: reactions.max_requested,
        scope_note: "Capped sample only — no full conversation pagination.",
      });
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
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
