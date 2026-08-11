/**
 * ORDER34 HOTFIX seed-engine
 * Base exports from main SOT (588f34a).
 * Overrides: bootstrapCandidatesFromDimensions + applyLocalGates for fact propagation.
 */
export * from "https://raw.githubusercontent.com/conroyflowersPro/AutoPostPilot/588f34adf6522eaed1f13b8b5ea3bcdfc5e1b1f9/supabase/functions/weekly-plan/seed-engine.ts";

import { createSeedIdFactory } from "https://raw.githubusercontent.com/conroyflowersPro/AutoPostPilot/588f34adf6522eaed1f13b8b5ea3bcdfc5e1b1f9/supabase/functions/weekly-plan/seed-engine.ts";
import type { ConcreteSeed, SeedStatus } from "https://raw.githubusercontent.com/conroyflowersPro/AutoPostPilot/588f34adf6522eaed1f13b8b5ea3bcdfc5e1b1f9/supabase/functions/weekly-plan/seed-engine.ts";
import { subjectSignature } from "https://raw.githubusercontent.com/conroyflowersPro/AutoPostPilot/588f34adf6522eaed1f13b8b5ea3bcdfc5e1b1f9/supabase/functions/weekly-plan/seed-engine.ts";

export {
  bootstrapCandidatesFromDimensions,
  type PublishedEvidenceRow,
} from "./seed-bootstrap.ts";

/** Preserve allowed_facts / factual_anchors through local gates */
export function applyLocalGates(
  raw: any[],
  _recent: string[],
  nextId: () => string = createSeedIdFactory("s")
) {
  const passed: ConcreteSeed[] = [];
  for (const r of raw || []) {
    if (!r?.concrete_subject) continue;
    const sub = String(r.concrete_subject);
    if (sub.length > 120 && /[.!?。]/.test(sub)) continue;
    passed.push({
      seed_id: nextId(),
      cluster: String(r.cluster || "OTHER"),
      dimension: String(r.dimension || "GENERAL"),
      concrete_subject: sub,
      subject_signature: subjectSignature(sub),
      primary_source: r.primary_source || "EVIDENCE_DERIVED",
      supporting_sources: r.supporting_sources || ["EVIDENCE_PACKET"],
      status: (r.status as SeedStatus) || "ELIGIBLE",
      creator_evidence_available: !!r.creator_evidence_available,
      point_or_tension: r.point_or_tension,
      requested_editorial_mode: r.requested_editorial_mode,
      experience_required: !!r.experience_required,
      evidence_source_ids: r.evidence_source_ids,
      claim_types: r.claim_types,
      inference_type: r.inference_type,
      grounding_status: r.grounding_status,
      grounding_reasons: r.grounding_reasons,
      source_type: r.source_type,
      idea_angle_family: r.idea_angle_family,
      verified_locations: r.verified_locations,
      verified_entities: r.verified_entities,
      relationship_evidence_ids: r.relationship_evidence_ids,
      xai_would_have_been_required: !!r.xai_would_have_been_required,
      allowed_facts: Array.isArray(r.allowed_facts) ? r.allowed_facts.map(String) : undefined,
      factual_anchors: Array.isArray(r.factual_anchors) ? r.factual_anchors.map(String) : undefined,
      do_not_invent: Array.isArray(r.do_not_invent) ? r.do_not_invent.map(String) : undefined,
      experience_facts: Array.isArray(r.experience_facts) ? r.experience_facts.map(String) : undefined,
      static_facts: Array.isArray(r.static_facts) ? r.static_facts.map(String) : undefined,
      current_facts: Array.isArray(r.current_facts) ? r.current_facts.map(String) : undefined,
      creator_opinion: Array.isArray(r.creator_opinion) ? r.creator_opinion.map(String) : undefined,
    } as ConcreteSeed);
  }
  return { passed, local_gate_rejected: 0, reject_reasons: {} };
}
