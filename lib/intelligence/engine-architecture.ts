/**
 * Next.js lockstep of weekly-plan/engine-architecture.ts (Edge cannot import lib/).
 * Learning/analyze must honor the same role split.
 */
export const ARCHITECTURE_PRINCIPLE =
  "No engine replaces the Creator. Each engine has one job. Roles do not mix.";
export const ARCHITECTURE_NO_ENGINE_REPLACES_CREATOR = true as const;
export const ARCHITECTURE_PERFORMANCE_DOES_NOT_OVERWRITE_CREATOR_DNA = true as const;
export const ARCHITECTURE_REVENUE_DOES_NOT_DOMINATE = true as const;
export const ARCHITECTURE_WRITER_IS_NOT_PLANNER = true as const;
export const ARCHITECTURE_POST_IS_NOT_WEEKLY = true as const;
export const ARCHITECTURE_JUDGE_IS_INDEPENDENT = true as const;

export const ARCHITECTURE_PIPELINE =
  "Data/Evidence → Audience DNA (X status) → Creator DNA (RETURN/BRIDGE/REACH + type) → Weekly Agent승 place/time/Seeds → Seed Pool(explore to locked count + buffer) → Post Agent승 thinks then writes → Semantic Judge final validate → reject returns that slot to Post Agent승 → Publish → Analytics → Validated Learning → Planner Memory";

export const ARCHITECTURE_FORBIDDEN_MIXES =
  "Writer must not become Planner. Post Agent승 must not become Weekly Agent승. Performance DNA must not overwrite Creator DNA. Revenue DNA must not dominate strategy. Judge must not rewrite. Unpublished AI drafts must not train Planner Memory. A separate Writer must not re-think the post.";

export const LEARNING_CYCLE =
  "Publish → Analytics Import → Feature Extraction → Performance/Revenue Analysis → Learning → DNA/Memory Update → next seven-day Planner reads → new Planning";

export const AUDIENCE_DNA_PRIMARY = "x_analytics";
export const AUDIENCE_DNA_AUXILIARY = "fedica";
