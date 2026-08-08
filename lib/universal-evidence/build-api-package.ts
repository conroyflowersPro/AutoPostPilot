/**
 * Build Universal package files from Production API normalized records.
 */
import type { UniversalManifest, PopulationCounts } from "./contract";
import {
  makeDatasetId,
  SCHEMA_VERSION,
  UNIVERSAL_EVIDENCE_EXPORT_VERSION,
} from "./contract";
import { fileIntegrity } from "./hash";
import {
  LIKE_POLICY,
  MEDIA_POLICY,
  MISSING_METRIC_POLICY,
  PRIVACY_EXCLUDED,
} from "./privacy";

export type ApiNormalizedPost = {
  x_post_id: string | null;
  published_at: string | null;
  post_type: string;
  origin: string | null;
  text: string | null;
  public_metrics: Record<string, number> | null;
  organic_metrics: Record<string, number> | null;
  non_public_metrics: Record<string, number> | null;
  metric_availability: {
    public: boolean;
    organic: boolean;
    non_public: boolean;
  };
  snapshot_count: number;
  media?: { present: boolean; types: string[]; count: number };
  conversation_id?: string | null;
  in_reply_to_user_id?: string | null;
  source_provenance?: "X_API" | "X_ARCHIVE" | "X_ARCHIVE_AND_API";
  layer?: "RAW" | "NORMALIZED" | "DERIVED";
  creator_intent?: "UNKNOWN" | "AI_DERIVED" | "CREATOR_CONFIRMED";
  provenance_kind?:
    | "FIRSTHAND"
    | "SECONDHAND"
    | "INTERPRETATION_ONLY"
    | "UNKNOWN";
};

function toJsonl(rows: unknown[]): string {
  if (!rows.length) return "";
  return rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

export function buildApiOnlyUniversalPackage(input: {
  posts: ApiNormalizedPost[];
  apiCutoff: string | null;
  handle?: string;
}): {
  dataset_id: string;
  frozen_at: string;
  files: Record<string, string>;
  manifest: UniversalManifest;
} {
  const frozen_at = new Date().toISOString();
  const dataset_id = makeDatasetId();

  const counts: PopulationCounts = {
    creator_publishing: 0,
    ORIGINAL: 0,
    QUOTE: 0,
    REPLY: 0,
    REPOST: 0,
    MENTION: 0,
    articles: 0,
    community_tweets: 0,
    community_notes: 0,
    revenue_records: 0,
    account_events: 0,
    like_raw_count: 0,
    total_normalized_posts: input.posts.length,
  };

  const creator: ApiNormalizedPost[] = [];
  const replies: ApiNormalizedPost[] = [];
  const social: ApiNormalizedPost[] = [];

  for (const p of input.posts) {
    const enriched = {
      ...p,
      source_provenance: p.source_provenance || ("X_API" as const),
      layer: "NORMALIZED" as const,
      creator_intent: "UNKNOWN" as const,
      provenance_kind: "UNKNOWN" as const,
    };
    const t = (p.post_type || "").toUpperCase();
    if (t === "ORIGINAL") {
      counts.ORIGINAL += 1;
      counts.creator_publishing += 1;
      creator.push(enriched);
    } else if (t === "QUOTE") {
      counts.QUOTE += 1;
      counts.creator_publishing += 1;
      creator.push(enriched);
    } else if (t === "REPLY") {
      counts.REPLY += 1;
      replies.push(enriched);
    } else if (t === "REPOST") {
      counts.REPOST += 1;
      social.push(enriched);
    } else if (t === "MENTION") {
      counts.MENTION += 1;
      social.push(enriched);
    } else {
      social.push(enriched);
    }
  }

  const featureDefs = {
    version: "feature-definitions-v1",
    note: "Derived features are not raw facts",
    fields: {
      creator_intent: ["UNKNOWN", "AI_DERIVED", "CREATOR_CONFIRMED"],
      provenance_kind: [
        "FIRSTHAND",
        "SECONDHAND",
        "INTERPRETATION_ONLY",
        "UNKNOWN",
      ],
      layer: ["RAW", "NORMALIZED", "DERIVED"],
    },
  };

  const readme = `# AutoPostPilot Universal X Evidence

## Same Data Guarantee
Grok and ChatGPT MUST analyze this identical frozen dataset.

Verify before analysis:
- dataset_id
- export_version
- frozen_at
- population counts
- SHA-256 in 00_manifest.json

If any differ → CROSS_MODEL_COMPARISON_INVALID

## Rules
- missing ≠ 0
- AI consensus ≠ Validation
- No DNA/Planner mutation during analysis
- Master Creator decides after Cross Review

## Source mode
API_ONLY (Archive not yet merged into this snapshot)
`;

  const files: Record<string, string> = {
    "01_creator_publishing.jsonl": toJsonl(creator),
    "02_replies.jsonl": toJsonl(replies),
    "03_social_network.jsonl": toJsonl(social),
    "04_articles.jsonl": "",
    "05_revenue.json": JSON.stringify(
      { records: [], note: "NOT_AVAILABLE in API_ONLY snapshot" },
      null,
      2
    ),
    "06_account_events.jsonl": "",
    "07_community_authority.jsonl": "",
    "08_like_interest_summary.json": JSON.stringify(
      {
        raw_like_count: null,
        note: LIKE_POLICY,
        aggregates: null,
      },
      null,
      2
    ),
    "09_feature_definitions.json": JSON.stringify(featureDefs, null, 2),
    "README_AI_ANALYSIS.md": readme,
  };

  const integrity = Object.entries(files).map(([filename, content]) =>
    fileIntegrity(filename, content)
  );

  const manifest: UniversalManifest = {
    dataset_id,
    export_version: UNIVERSAL_EVIDENCE_EXPORT_VERSION,
    schema_version: SCHEMA_VERSION,
    status: "FROZEN",
    created_at: frozen_at,
    frozen_at,
    api_cutoff: input.apiCutoff,
    archive_generation_date: null,
    source_mode: "API_ONLY",
    populations: counts,
    files: integrity,
    reconciliation: {
      api_only_posts: input.posts.length,
      archive_only_posts: 0,
      overlap_posts: 0,
    },
    privacy_excluded: [...PRIVACY_EXCLUDED],
    media_policy: MEDIA_POLICY,
    like_policy: LIKE_POLICY,
    missing_metric_policy: MISSING_METRIC_POLICY,
    learning_mutation: "FORBIDDEN_DURING_EXPORT",
    same_data_guarantee: {
      rule: "Grok and ChatGPT must receive identical frozen dataset",
      verify: [
        "dataset_id",
        "export_version",
        "frozen_at",
        "row_counts",
        "sha256",
        "feature_definitions",
        "population_definitions",
        "api_cutoff",
        "archive_source",
      ],
    },
  };

  files["00_manifest.json"] = JSON.stringify(manifest, null, 2);
  const allFiles = [
    fileIntegrity("00_manifest.json", files["00_manifest.json"]),
    ...integrity,
  ];
  manifest.files = allFiles;
  files["00_manifest.json"] = JSON.stringify(manifest, null, 2);

  return { dataset_id, frozen_at, files, manifest };
}
