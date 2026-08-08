/**
 * GET /api/learning/evidence-export
 * Read-only ChatGPT independent evidence export.
 * No DNA, no scores, no invented metrics. missing ≠ 0.
 *
 * Query:
 *   ?manifest=1
 *   ?population=all|creator_publishing|replies|mentions_reposts&offset=0&limit=500
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEvidenceRecord } from "@/lib/export/build-evidence-record";

export const maxDuration = 60;

type Population =
  | "all"
  | "creator_publishing"
  | "replies"
  | "mentions_reposts";

function matchesPopulation(
  postType: string,
  population: Population
): boolean {
  if (population === "all") return true;
  if (population === "creator_publishing")
    return postType === "ORIGINAL" || postType === "QUOTE";
  if (population === "replies") return postType === "REPLY";
  if (population === "mentions_reposts")
    return postType === "MENTION" || postType === "REPOST";
  return true;
}

async function loadSnapMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  accountId: string
) {
  const map = new Map<string, { count: number; latestAt: string | null }>();
  let off = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("x_metric_snapshots")
      .select("x_post_id, snapshot_at")
      .eq("account_id", accountId)
      .order("snapshot_at", { ascending: true })
      .range(off, off + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data) {
      const pid = String(r.x_post_id || "");
      if (!pid) continue;
      const prev = map.get(pid) || { count: 0, latestAt: null };
      prev.count += 1;
      const at = (r.snapshot_at as string) || null;
      if (at && (!prev.latestAt || at > prev.latestAt)) prev.latestAt = at;
      map.set(pid, prev);
    }
    if (data.length < page) break;
    off += page;
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: conn } = await supabase
      .from("account_connections")
      .select("id, handle")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    if (!conn?.id) {
      return NextResponse.json(
        { error: "No X account_connection" },
        { status: 404 }
      );
    }

    const accountId = conn.id;
    const url = req.nextUrl;
    const wantManifest = url.searchParams.get("manifest") === "1";
    const population = (url.searchParams.get("population") ||
      "all") as Population;
    const offset = Math.max(
      0,
      parseInt(url.searchParams.get("offset") || "0", 10) || 0
    );
    const limit = Math.min(
      500,
      Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200)
    );

    const snapMap = await loadSnapMap(supabase, accountId);

    const allRows: ReturnType<typeof buildEvidenceRecord>[] = [];
    {
      let off = 0;
      const page = 500;
      for (;;) {
        const { data, error } = await supabase
          .from("account_activities")
          .select(
            "x_post_id, published_at, origin, action_type, post_type, text_body, source_post_url, conversation_id, in_reply_to_user_id, x_author_id, collection_source, meta"
          )
          .eq("account_id", accountId)
          .order("published_at", { ascending: true, nullsFirst: false })
          .range(off, off + page - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        for (const row of data) {
          const pid = String((row as { x_post_id?: string }).x_post_id || "");
          const rec = buildEvidenceRecord(
            row as Record<string, unknown>,
            snapMap.get(pid)
          );
          allRows.push(rec);
        }
        if (data.length < page) break;
        off += page;
      }
    }

    if (wantManifest) {
      const counts: Record<string, number> = {
        ORIGINAL: 0,
        QUOTE: 0,
        REPLY: 0,
        REPOST: 0,
        MENTION: 0,
        OTHER: 0,
      };
      let pubAvail = 0;
      let orgAvail = 0;
      let nonAvail = 0;
      let emptyText = 0;
      let nullText = 0;
      let earliest: string | null = null;
      let latest: string | null = null;
      const seenIds = new Set<string>();
      let dupIds = 0;

      for (const rec of allRows) {
        const t = rec.post_type;
        if (t in counts) counts[t] += 1;
        else counts.OTHER += 1;
        if (rec.metric_availability.public) pubAvail += 1;
        if (rec.metric_availability.organic) orgAvail += 1;
        if (rec.metric_availability.non_public) nonAvail += 1;
        if (rec.text == null) nullText += 1;
        else if (!rec.text.trim()) emptyText += 1;
        if (rec.published_at) {
          if (!earliest || rec.published_at < earliest)
            earliest = rec.published_at;
          if (!latest || rec.published_at > latest) latest = rec.published_at;
        }
        if (rec.x_post_id) {
          if (seenIds.has(rec.x_post_id)) dupIds += 1;
          else seenIds.add(rec.x_post_id);
        }
      }

      const { count: snapCount } = await supabase
        .from("x_metric_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const creatorPublishing = counts.ORIGINAL + counts.QUOTE;

      return NextResponse.json({
        export_version: "chatgpt-evidence-v1",
        generated_at: new Date().toISOString(),
        handle: conn.handle,
        historical_start: earliest,
        historical_end: latest,
        total_records: allRows.length,
        counts_by_type: counts,
        creator_publishing: creatorPublishing,
        public_metric_available: pubAvail,
        organic_metric_available: orgAvail,
        non_public_metric_available: nonAvail,
        snapshot_count: snapCount ?? 0,
        text_integrity: {
          null_text: nullText,
          empty_text: emptyText,
          duplicate_x_post_id: dupIds,
        },
        source_tables: ["account_activities", "x_metric_snapshots"],
        missing_value_policy:
          "missing ≠ 0. Absent metric keys are omitted or null, never filled with zero.",
        known_limitations: [
          "Organic/non_public metrics present on a subset only (API family availability).",
          "Most posts have a single metric snapshot (collection-time observation).",
          "No follower-gain or revenue fields (not available in this evidence store).",
          "No Grok interpretation scores included by design.",
          "Media binary files not included — presence/type/keys only.",
        ],
        populations: {
          creator_publishing: "ORIGINAL + QUOTE",
          replies: "REPLY",
          mentions_reposts: "MENTION + REPOST",
          all: "entire account_activities for this X connection",
        },
        expected_reconciliation: {
          total: 3839,
          ORIGINAL: 380,
          QUOTE: 328,
          REPLY: 2026,
          REPOST: 276,
          MENTION: 829,
          creator_publishing: 708,
        },
      });
    }

    const filtered = allRows.filter((r) =>
      matchesPopulation(r.post_type, population)
    );
    const slice = filtered.slice(offset, offset + limit);
    const nextOffset =
      offset + slice.length < filtered.length ? offset + slice.length : null;

    return NextResponse.json({
      export_version: "chatgpt-evidence-v1",
      handle: conn.handle,
      population,
      total_in_population: filtered.length,
      offset,
      limit,
      next_offset: nextOffset,
      records: slice,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
