/**
 * content-evidence-v1 — Presentation | Substance | Provenance
 * Extraction may be empty; structure always available.
 */
import type { ProvenanceKind, ProvenanceSubtype } from "./contract-v1";
import { CONTENT_EVIDENCE_VERSION } from "./contract-v1";

export type PresentationEvidence = {
  hook_style?: string | null;
  emoji_usage?: boolean | null;
  opening_pattern?: string | null;
  sentence_structure?: string | null;
  sentence_rhythm?: string | null;
  post_length?: number | null;
  formatting?: string | null;
  question_usage?: boolean | null;
  cta_presence?: boolean | null;
  media_presentation?: string | null;
};

export type SubstanceEvidence = {
  topic?: string | null;
  subtopic?: string | null;
  information_novelty?: string | null;
  event_freshness?: string | null;
  utility?: string | null;
  practical_actionability?: string | null;
  technical_depth?: string | null;
  information_density?: string | null;
  observation_level?: string | null;
  opinion_strength?: string | null;
  emotional_level?: string | null;
  prediction_level?: string | null;
  personal_story_level?: string | null;
};

export type ProvenanceEvidence = {
  kind: ProvenanceKind;
  subtype?: ProvenanceSubtype;
  /** Never invent FIRSTHAND without creator evidence */
  evidence_backed: boolean;
};

export type ContentEvidence = {
  version: typeof CONTENT_EVIDENCE_VERSION;
  presentation: PresentationEvidence;
  substance: SubstanceEvidence;
  provenance: ProvenanceEvidence;
  extraction_status: "NOT_EXTRACTED" | "PARTIAL" | "EXTRACTED";
};

export function emptyContentEvidence(): ContentEvidence {
  return {
    version: CONTENT_EVIDENCE_VERSION,
    presentation: {},
    substance: {},
    provenance: {
      kind: "UNKNOWN",
      subtype: null,
      evidence_backed: false,
    },
    extraction_status: "NOT_EXTRACTED",
  };
}

/** Presentation-only = no substance keys with real values */
export function isPresentationOnly(ce: ContentEvidence): boolean {
  const s = ce.substance;
  const hasSubstance = Object.values(s).some(
    (v) => v != null && String(v).trim() !== ""
  );
  const hasPresentation = Object.values(ce.presentation).some(
    (v) => v != null && v !== false && String(v).trim() !== ""
  );
  return hasPresentation && !hasSubstance;
}
