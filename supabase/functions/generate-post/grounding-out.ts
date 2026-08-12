/** ORDER 3+4 + stages + reaction + everyday language + density */
import { scoreVocabularyFidelity, detectUnsupportedAdditions } from "./vocabulary-fidelity.ts";
import { getCreatorStyle } from "./creator-style-data.ts";

export function buildGroundedPostsOut(
  qualityPosts: any[],
  slotById: Map<string, any>,
  offset: number,
  generatorVersion: string
): any[] {
  const style = getCreatorStyle();
  return qualityPosts.map((p: any) => {
    const slot = slotById.get(String(p.slotId)) || {};
    const xaiTag =
      slot.xai_api_tag ||
      (slot.xai_external_enrichment ? "[xAI API 이용]" : undefined);
    const fid = scoreVocabularyFidelity(String(p.content || ""));
    const unsupported = detectUnsupportedAdditions(String(p.content || ""), {
      do_not_invent: slot.do_not_invent || slot.postBrief?.do_not_invent,
      allowed_facts: slot.allowed_facts || slot.postBrief?.allowed_facts,
      factual_anchors: slot.factual_anchors,
      claim_types: slot.claim_types,
      grounding_status: slot.grounding_status,
      verified_entities: slot.verified_entities,
      verified_locations: slot.verified_locations,
      experience_facts: slot.experience_facts,
      current_facts: slot.current_facts,
    });
    const grounding_preserved = unsupported.length === 0;
    return {
      slotId: p.slotId,
      content: p.content,
      final_text: p.content,
      text: p.content,
      score: p.score,
      dayOffset: offset,
      planning_source: slot.planning_source,
      primaryTopic: slot.primaryTopic || slot.concrete_subject,
      editorial_mode: slot.editorial_mode,
      length_mode: slot.length_mode,
      core_thought: p.core_thought ?? null,
      thinking_rail: p.thinking_rail ?? null,
      audience_translation: p.audience_translation ?? null,
      reaction_mechanism: p.reaction_mechanism ?? null,
      reaction_reason: p.reaction_reason ?? null,
      everyday_language_clear: p.everyday_language_clear ?? null,
      everyday_rewrite_note: p.everyday_rewrite_note ?? null,
      natural_humor_present: p.natural_humor_present ?? false,
      natural_humor_fit: p.natural_humor_fit ?? "N/A",
      writing_density: p.writing_density ?? null,
      ai_tone_risk: p.ai_tone_risk ?? "UNKNOWN",
      unnecessary_length: p.unnecessary_length ?? false,
      claim_types: slot.claim_types || [],
      grounding_status: slot.grounding_status,
      grounding_reasons: slot.grounding_reasons || [],
      source_type: slot.source_type || slot.primary_source,
      source_id: slot.source_id || (Array.isArray(slot.evidence_source_ids) ? slot.evidence_source_ids[0] : undefined),
      evidence_source_ids: slot.evidence_source_ids || [],
      allowed_facts: slot.allowed_facts || slot.postBrief?.allowed_facts || [],
      factual_anchors: slot.factual_anchors || [],
      xai_api_tag: xaiTag,
      xai_external_enrichment: !!slot.xai_external_enrichment,
      voice_source: generatorVersion,
      style_data_version: style.version,
      vocabulary_fidelity: {
        score: fid.score,
        distance: fid.distance,
        pass: fid.pass,
        abstract_hits: fid.abstract_hits,
        length_distance: fid.length_distance,
        register_distance: fid.register_distance,
        abstraction_distance: fid.abstraction_distance,
        reasons: fid.reasons,
      },
      unsupported_additions: unsupported,
      grounding_preserved,
    };
  });
}

export function compactSlotForModel(s: any): Record<string, unknown> {
  const allowed =
    s.allowed_facts ||
    s.postBrief?.allowed_facts ||
    s.factual_anchors ||
    [];
  return {
    slotId: s.slotId,
    primaryTopic: s.primaryTopic || s.concrete_subject,
    angle: s.angle,
    editorial_mode: s.editorial_mode || null,
    length_mode: s.length_mode || "MEDIUM",
    writing_mode: s.writing_mode || null,
    core_point: s.postBrief?.core_point || s.concrete_subject,
    why: s.postBrief?.why_this_topic || s.angle,
    claim_types: s.claim_types || s.postBrief?.claim_types || [],
    grounding_status: s.grounding_status || null,
    grounding_reasons: s.grounding_reasons || [],
    source_type: s.source_type || s.primary_source || null,
    source_id: s.source_id || (Array.isArray(s.evidence_source_ids) ? s.evidence_source_ids[0] : null),
    evidence_source_ids: s.evidence_source_ids || [],
    allowed_facts: allowed,
    factual_anchors: s.factual_anchors || [],
    do_not_invent: s.do_not_invent || s.postBrief?.do_not_invent || [],
    historical_framing: s.historical_framing || s.historical_framing_required || false,
    experience_class: s.experience_class || null,
    verified_locations: s.verified_locations || [],
    verified_entities: s.verified_entities || [],
    experience_facts: s.experience_facts || [],
    static_facts: s.static_facts || [],
    current_facts: s.current_facts || [],
    creator_opinion: s.creator_opinion || [],
    xai_api_tag: s.xai_api_tag || (s.xai_external_enrichment ? "[xAI API 이용]" : undefined),
  };
}
