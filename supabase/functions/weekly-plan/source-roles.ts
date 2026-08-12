/**
 * ORDER 0B — Source Role Separation
 * Manual posts are learning signals by default, never automatic SEED_SOURCE.
 */

export type SourceRole =
  | "USER_EXPLICIT_SEED"
  | "SEED_SOURCE"
  | "GROUNDING_EVIDENCE"
  | "CREATOR_LEARNING_SIGNAL"
  | "PERFORMANCE_LEARNING_SIGNAL";

export type SourceType =
  | "ACCOUNT_ACTIVITY"
  | "CREATOR_INTENT"
  | "DIMENSION_REGISTRY"
  | "ARCHIVE"
  | "PUBLISHED_HISTORY"
  | "USER_EXPLICIT"
  | "UNKNOWN";

export type SourceTrace = {
  source_role: SourceRole;
  source_type: SourceType;
  source_id?: string;
  seed_origin?: string;
  grounding_source_ids?: string[];
  creator_learning_source_ids?: string[];
  manual_source_used: boolean;
  manual_text_exposed_to_generation: boolean;
  semantic_recent_post_overlap?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  leakage_guard_result?: "PASS" | "BLOCK_SEED" | "BLOCK_WORDING" | "BLOCK_SEMANTIC";
};

/** Roles that may become generation seeds without explicit user request */
export function isSeedEligibleRole(role: SourceRole): boolean {
  return role === "USER_EXPLICIT_SEED" || role === "SEED_SOURCE";
}

/** Manual X activity defaults: learning only */
export function defaultRoleForAccountActivity(opts?: {
  user_explicit?: boolean;
  as_grounding?: boolean;
}): SourceRole {
  if (opts?.user_explicit) return "USER_EXPLICIT_SEED";
  if (opts?.as_grounding) return "GROUNDING_EVIDENCE";
  return "CREATOR_LEARNING_SIGNAL";
}

export function emptyTrace(partial?: Partial<SourceTrace>): SourceTrace {
  return {
    source_role: "SEED_SOURCE",
    source_type: "UNKNOWN",
    manual_source_used: false,
    manual_text_exposed_to_generation: false,
    ...partial,
  };
}

export function attachTrace<T extends Record<string, unknown>>(
  seed: T,
  trace: SourceTrace
): T & { source_trace: SourceTrace; source_role: SourceRole } {
  return {
    ...seed,
    source_role: trace.source_role,
    source_trace: trace,
  };
}
