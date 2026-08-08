/**
 * universal-evidence-v1 — ONE canonical frozen dataset for Grok + ChatGPT
 */
export const UNIVERSAL_EVIDENCE_EXPORT_VERSION = "universal-evidence-v1";
export const SCHEMA_VERSION = "evidence-schema-v1";

export type DatasetStatus =
  | "BUILDING"
  | "FROZEN"
  | "SUPERSEDED"
  | "FAILED";

export type JobPhase =
  | "QUEUED"
  | "PARSING"
  | "NORMALIZING"
  | "RECONCILING"
  | "PACKAGING"
  | "HASHING"
  | "FROZEN"
  | "COMPLETE"
  | "FAILED";

export type EvidenceSourceKind = "X_API" | "X_ARCHIVE" | "X_ARCHIVE_AND_API";

export type DatasetIdentity = {
  dataset_id: string;
  export_version: typeof UNIVERSAL_EVIDENCE_EXPORT_VERSION;
  schema_version: typeof SCHEMA_VERSION;
  status: DatasetStatus;
  created_at: string;
  frozen_at: string | null;
  api_cutoff: string | null;
  archive_generation_date: string | null;
  source_mode: "API_ONLY" | "ARCHIVE_ONLY" | "API_AND_ARCHIVE";
};

export type FileIntegrity = {
  filename: string;
  row_count: number;
  file_size: number;
  sha256: string;
};

export type PopulationCounts = {
  creator_publishing: number;
  ORIGINAL: number;
  QUOTE: number;
  REPLY: number;
  REPOST: number;
  MENTION: number;
  articles: number;
  community_tweets: number;
  community_notes: number;
  revenue_records: number;
  account_events: number;
  like_raw_count: number;
  total_normalized_posts: number;
};

export type UniversalManifest = DatasetIdentity & {
  populations: PopulationCounts;
  files: FileIntegrity[];
  reconciliation: {
    api_only_posts: number;
    archive_only_posts: number;
    overlap_posts: number;
  };
  privacy_excluded: string[];
  media_policy: string;
  like_policy: string;
  missing_metric_policy: string;
  learning_mutation: "FORBIDDEN_DURING_EXPORT";
  same_data_guarantee: {
    rule: "Grok and ChatGPT must receive identical frozen dataset";
    verify: Array<
      | "dataset_id"
      | "export_version"
      | "frozen_at"
      | "row_counts"
      | "sha256"
      | "feature_definitions"
      | "population_definitions"
      | "api_cutoff"
      | "archive_source"
    >;
  };
};

export function makeDatasetId(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `APP-EVIDENCE-${y}${m}${day}-${seq}`;
}

/** Netlify function timeout ~26s; keep batch under safety margin */
export const BATCH_RUNTIME_BUDGET_MS = 16_000;
