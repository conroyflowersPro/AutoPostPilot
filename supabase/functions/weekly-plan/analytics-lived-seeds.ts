/**
 * Lived grounding from Analytics originals plus sync-gap originals.
 * Facts for EXPERIENCE slots only — not recyclable post Seeds. No archive fallback mix.
 */
import { BUNDLED_X_ANALYTICS_WINDOW } from "./x-analytics-30d-bundled.ts";
import { clusterFromText } from "./experience-evidence.ts";
import {
  abstractLivedSubject,
  LIVED_CITE_HINT,
  LIVED_DIRECTION_TENSION,
  livedExperienceFacts,
  sortLivedNewestFirst,
} from "./seed-ownership.ts";
import { subjectCopiesOperatorOriginal } from "./operator-original-guard.ts";
import { subjectSignature, type ConcreteSeed } from "./seed-engine.ts";

type AnalyticsPost = {
  post_id?: string;
  published_at?: string;
  content?: string;
  features?: { is_original?: boolean; isReply?: boolean };
};

function postsFromWindow(): AnalyticsPost[] {
  const raw = (BUNDLED_X_ANALYTICS_WINDOW as { posts?: AnalyticsPost[] }).posts;
  return Array.isArray(raw) ? raw : [];
}

export function analyticsLivedSeeds(opts?: { limit?: number }): ConcreteSeed[] {
  const limit = Math.max(1, Math.min(80, Math.round(Number(opts?.limit) || 80)));
  const out: ConcreteSeed[] = [];
  const seen = new Set<string>();
  const rows = sortLivedNewestFirst(
    postsFromWindow()
      .filter((p) => p?.features?.is_original !== false && p?.features?.isReply !== true)
      .map((p) => ({
        ...p,
        occurred_at: String(p.published_at || ""),
        published_at: String(p.published_at || ""),
      })),
  );
  let n = 0;
  for (const row of rows) {
    const body = String(row.content || "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
    if (body.length < 20) continue;
    const cluster = clusterFromText(body);
    const facts = livedExperienceFacts(body);
    const subject = abstractLivedSubject(body, cluster);
    if (!subject) continue;
    if (subjectCopiesOperatorOriginal(subject, [body])) continue;
    const sig = subjectSignature(`${cluster}|${String(row.post_id || subject)}`);
    if (seen.has(sig)) continue;
    seen.add(sig);
    n += 1;
    out.push({
      seed_id: `lived-30d-${n}`,
      cluster,
      dimension: "ANALYTICS_LIVED",
      concrete_subject: subject,
      subject_signature: sig,
      point_or_tension: LIVED_DIRECTION_TENSION,
      experience_facts: facts,
      primary_source: "ANALYTICS_LIVED",
      supporting_sources: ["X_ANALYTICS_30D"],
      status: "ELIGIBLE",
      requested_editorial_mode: "EXPERIENCE",
      creator_evidence_available: true,
      experience_required: true,
      source_type: "ANALYTICS_LIVED",
      source_role: "GROUNDING_EVIDENCE",
      claim_types: ["PERSONAL_EXPERIENCE"],
      owner: "SELF",
      seed_source: "ANALYTICS_LIVED",
      occurred_at: row.published_at,
      published_at: row.published_at,
      evidence_source_ids: [String(row.post_id || "")].filter(Boolean),
      do_not_invent: [
        "manual_body_narrative",
        "same_episode_retell",
        "source_sentence_rewrite",
        "N일_전_시점",
      ],
      cite_episode_hint: LIVED_CITE_HINT,
    } as ConcreteSeed);
    if (out.length >= limit) break;
  }
  return out;
}

/** Originals from 「지금 동기화」 that are not already Analytics post ids. */
export function syncGapLivedSeeds(args: {
  rows: Array<{
    x_post_id?: string | null;
    text_body?: string | null;
    published_at?: string | null;
    action_type?: string | null;
    post_type?: string | null;
  }>;
  analyticsPostIds: Set<string>;
  limit?: number;
  startN?: number;
}): ConcreteSeed[] {
  const limit = Math.max(1, Math.min(80, Math.round(Number(args.limit) || 40)));
  const out: ConcreteSeed[] = [];
  let n = Math.max(0, Number(args.startN) || 0);
  const seen = new Set<string>();
  for (const row of args.rows || []) {
    const action = String(row.action_type || row.post_type || "").toUpperCase();
    if (/REPLY|REPOST|RETWEET/.test(action)) continue;
    const id = String(row.x_post_id || "");
    if (id && args.analyticsPostIds.has(id)) continue;
    const body = String(row.text_body || "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
    if (body.length < 20) continue;
    const cluster = clusterFromText(body);
    const facts = livedExperienceFacts(body);
    const subject = abstractLivedSubject(body, cluster);
    if (!subject) continue;
    if (subjectCopiesOperatorOriginal(subject, [body])) continue;
    const sig = subjectSignature(`${cluster}|${id || subject}`);
    if (seen.has(sig)) continue;
    seen.add(sig);
    n += 1;
    out.push({
      seed_id: `lived-sync-${n}`,
      cluster,
      dimension: "ANALYTICS_LIVED",
      concrete_subject: subject,
      subject_signature: sig,
      point_or_tension: LIVED_DIRECTION_TENSION,
      experience_facts: facts,
      primary_source: "ANALYTICS_LIVED",
      supporting_sources: ["X_SYNC_GAP"],
      status: "ELIGIBLE",
      requested_editorial_mode: "EXPERIENCE",
      creator_evidence_available: true,
      experience_required: true,
      source_type: "ANALYTICS_LIVED",
      source_role: "GROUNDING_EVIDENCE",
      claim_types: ["PERSONAL_EXPERIENCE"],
      owner: "SELF",
      seed_source: "ANALYTICS_LIVED",
      occurred_at: String(row.published_at || ""),
      published_at: String(row.published_at || ""),
      evidence_source_ids: [id].filter(Boolean),
      do_not_invent: ["manual_body_narrative", "same_episode_retell", "source_sentence_rewrite", "N일_전_시점"],
      cite_episode_hint: LIVED_CITE_HINT,
    } as ConcreteSeed);
    if (out.length >= limit) break;
  }
  return out;
}
