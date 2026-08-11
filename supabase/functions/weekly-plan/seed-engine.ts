/**
 * ORDER34 HOTFIX seed-engine
 * Base exports from main SOT (588f34a).
 * bootstrapCandidatesFromDimensions overridden with allowed_facts / factual_anchors propagation.
 */
export * from "https://raw.githubusercontent.com/conroyflowersPro/AutoPostPilot/588f34adf6522eaed1f13b8b5ea3bcdfc5e1b1f9/supabase/functions/weekly-plan/seed-engine.ts";

// Override: Evidence facts must reach Creator Engine
export {
  bootstrapCandidatesFromDimensions,
  type PublishedEvidenceRow,
} from "./seed-bootstrap.ts";
