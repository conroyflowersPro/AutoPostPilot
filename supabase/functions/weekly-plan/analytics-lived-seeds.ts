/**
 * Experience seeds from the 30-day X Analytics window only.
 * Generator material — Planner does not extract. No archive fallback mix.
 */
import { BUNDLED_X_ANALYTICS_WINDOW } from "./x-analytics-30d-bundled.ts";
import { clusterFromText } from "./experience-evidence.ts";
import { abstractLivedSubject, sortLivedNewestFirst } from "./seed-ownership.ts";
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
    const subject = abstractLivedSubject(body, cluster);
    if (!subject) continue;
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
      point_or_tension: "Cite the lived episode by situation only. Related follow-up. 동일 내용 금지.",
      primary_source: "ANALYTICS_LIVED",
      supporting_sources: ["X_ANALYTICS_30D"],
      status: "ELIGIBLE",
      requested_editorial_mode: "EXPERIENCE",
      creator_evidence_available: true,
      experience_required: true,
      source_type: "ANALYTICS_LIVED",
      source_role: "SEED_SOURCE",
      claim_types: ["PERSONAL_EXPERIENCE"],
      owner: "SELF",
      seed_source: "ANALYTICS_LIVED",
      occurred_at: row.published_at,
      published_at: row.published_at,
      evidence_source_ids: [String(row.post_id || "")].filter(Boolean),
      do_not_invent: [
        "manual_body_narrative",
        "same_episode_retell",
        "N일_전_시점",
      ],
      cite_episode_hint: "cite the dated Analytics episode; related follow-up, 동일 내용 금지",
    } as ConcreteSeed);
    if (out.length >= limit) break;
  }
  return out;
}
