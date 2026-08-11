import {
  extractEvidencePacket,
  reasonSeedSubjectFromPacket,
  type EvidencePacket,
} from "./evidence-packet.ts";
import {
  subjectSignature,
  DIMENSION_REGISTRY,
  type ConcreteSeed,
} from "./seed-core.ts";

const DEFAULT_DO_NOT_INVENT = [
  "오늘/어제/이번 주 시점 발명",
  "출퇴근 경로 발명",
  "방문 장소 발명",
  "직접 테스트/체험 발명",
  "구체 거리/시간/횟수 발명",
  "Evidence 없는 한국/특정 장소",
];

function buildAllowedFacts(packet: EvidencePacket): string[] {
  const parts = [
    ...(packet.factual_anchors || []),
    ...(packet.experience_facts || []),
    ...(packet.static_facts || []),
    ...(packet.current_facts || []),
    ...(packet.creator_opinion || []),
  ].map((s) => String(s || "").trim()).filter((s) => s.length >= 4);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of parts) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 12) break;
  }
  return out;
}

export type PublishedEvidenceRow = {
  text: string;
  source_id?: string;
  published_at?: string;
  post_type?: string;
};

/** ORDER 3 — Evidence-based seed reasoning (NOT raw post copy). */
export function bootstrapCandidatesFromDimensions(opts: {
  publishedSubjects: string[];
  intentText?: string;
  publishedEvidence?: PublishedEvidenceRow[];
}): any[] {
  const out: any[] = [];
  const emitted = new Set<string>();
  const packets: EvidencePacket[] = [];
  const rows: PublishedEvidenceRow[] = Array.isArray(opts.publishedEvidence) && opts.publishedEvidence.length
    ? opts.publishedEvidence
    : (opts.publishedSubjects || []).map((t) => ({ text: String(t) }));

  for (const row of rows.slice(0, 24)) {
    const text = String(row.text || "").trim();
    if (text.length < 12) continue;
    const packet = extractEvidencePacket(text, {
      source_id: row.source_id || row.published_at,
      source_type: "ACCOUNT_ACTIVITY",
      published_at: row.published_at,
    });
    if (!packet) continue;
    if (packet.topic === "OTHER" && packet.entities.length === 0 && packet.experience_facts.length === 0) continue;
    packets.push(packet);
    const reasoned = reasonSeedSubjectFromPacket(packet);
    const sig = subjectSignature(reasoned.concrete_subject);
    if (emitted.has(sig)) continue;
    emitted.add(sig);
    out.push({
      cluster: packet.topic,
      dimension: packet.subtopic,
      concrete_subject: reasoned.concrete_subject,
      subject_signature: sig,
      point_or_tension: reasoned.point_or_tension,
      primary_source: "EVIDENCE_DERIVED",
      supporting_sources: ["EVIDENCE_PACKET", packet.source_type],
      evidence_source_ids: packet.source_ids.length ? packet.source_ids : ["PUB"],
      creator_evidence_available: true,
      experience_required: packet.experience_facts.length > 0,
      source_type: packet.source_type,
      claim_types: packet.experience_facts.length
        ? ["PERSONAL_EXPERIENCE"]
        : packet.creator_opinion.length
          ? ["OPINION"]
          : ["OBSERVATION"],
      inference_type: "EVIDENCE_DERIVED",
      grounding_status: reasoned.needs_xai ? "XAI_WOULD_HAVE_BEEN_REQUIRED" : "GROUNDED",
      grounding_reasons: reasoned.needs_xai ? ["THIN_ANCHORS"] : ["PACKET_REASONED"],
      idea_angle_family: reasoned.idea_angle_family,
      verified_locations: packet.verified_locations,
      verified_entities: packet.entities,
      relationship_evidence_ids: [],
      xai_would_have_been_required: reasoned.needs_xai,
      status: "ELIGIBLE",
      allowed_facts: buildAllowedFacts(packet),
      factual_anchors: packet.factual_anchors || [],
      do_not_invent: DEFAULT_DO_NOT_INVENT,
      experience_facts: packet.experience_facts || [],
      static_facts: packet.static_facts || [],
      current_facts: packet.current_facts || [],
      creator_opinion: packet.creator_opinion || [],
    });
  }

  const intent = String(opts.intentText || "").trim();
  if (intent.length >= 10) {
    const packet = extractEvidencePacket(intent, { source_id: "INTENT", source_type: "CREATOR_INTENT" });
    if (packet && packet.topic !== "OTHER") {
      const reasoned = reasonSeedSubjectFromPacket(packet);
      const sig = subjectSignature(reasoned.concrete_subject);
      if (!emitted.has(sig)) {
        emitted.add(sig);
        out.push({
          cluster: packet.topic,
          dimension: packet.subtopic || "CREATOR_INTENT",
          concrete_subject: reasoned.concrete_subject,
          subject_signature: sig,
          point_or_tension: reasoned.point_or_tension,
          primary_source: "CREATOR_INTENT",
          supporting_sources: ["CREATOR_INTENT"],
          evidence_source_ids: ["INTENT"],
          creator_evidence_available: true,
          experience_required: false,
          source_type: "CREATOR_INTENT",
          claim_types: ["OBSERVATION"],
          inference_type: "CREATOR_INTENT",
          grounding_status: "GROUNDED",
          grounding_reasons: ["INTENT_PACKET"],
          idea_angle_family: reasoned.idea_angle_family,
          verified_locations: packet.verified_locations,
          verified_entities: packet.entities,
          xai_would_have_been_required: false,
          status: "ELIGIBLE",
          allowed_facts: buildAllowedFacts(packet),
          factual_anchors: packet.factual_anchors || [],
          do_not_invent: DEFAULT_DO_NOT_INVENT,
          experience_facts: packet.experience_facts || [],
          static_facts: packet.static_facts || [],
          current_facts: packet.current_facts || [],
          creator_opinion: packet.creator_opinion || [],
        });
      }
    }
  }

  void DIMENSION_REGISTRY.length;
  void packets.length;
  return out;
}
