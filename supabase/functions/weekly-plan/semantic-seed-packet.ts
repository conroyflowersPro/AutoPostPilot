/**
 * ORDER 2 — Semantic Seed Packet for Post Agent승.
 * Only keep fields that already exist. Never invent structure.
 */
function s(v: unknown, max = 180): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function keep(v: unknown, max = 180): string | undefined {
  const t = s(v, max);
  return t.length >= 2 ? t : undefined;
}

export type SemanticSeedPacket = {
  subject?: string;
  scene?: string;
  factual_event?: string;
  change_or_delta?: string;
  contrast_or_tension?: string;
  human_relevance?: string;
  ownership?: string;
  experience_evidence?: string[];
  time_sensitivity?: string;
  source_boundary?: string;
};

export type ExperiencePacket = {
  creator_experienced: boolean;
  evidence_supported: boolean;
  must_not_claim_first_person: boolean;
  did?: string;
  situation?: string;
  observed?: string;
  result?: string;
  facts: string[];
};

export type PostThought = {
  observation: string;
  creator_interpretation: string;
  core_thought: string;
  reader_entry: string;
  stop_point: string;
};

export function buildSemanticSeedPacket(
  seed: Record<string, unknown> | null | undefined,
  interp: Record<string, unknown> | null | undefined,
): SemanticSeedPacket {
  const sd = seed || {};
  const ip = interp || {};
  const packet: SemanticSeedPacket = {};
  const subject = keep(ip.seed_subject || sd.concrete_subject);
  const scene = keep(ip.what_is_actually_happening || sd.situation || ip.concrete_human_element);
  const factual = keep(
    Array.isArray(ip.factual_boundaries)
      ? (ip.factual_boundaries as any[])
          .filter((x) => x && x.status === "confirmed")
          .map((x) => x.item)
          .join("; ")
      : "",
  );
  const tension = keep(sd.point_or_tension);
  const noveltyRaw = s(ip.what_is_new_or_interesting, 180);
  const delta =
    noveltyRaw.length >= 4 &&
    !/^(none|limited novelty)/i.test(noveltyRaw) &&
    !/forced/.test(noveltyRaw)
      ? keep(noveltyRaw)
      : keep(sd.change_or_delta || ip.change_or_delta);
  const human = keep(ip.possible_reader_connection || ip.concrete_human_element || ip.human_element);
  const owner = keep(sd.owner || ip.experience_boundaries && (ip.experience_boundaries as any).owner);
  const facts = Array.isArray(sd.experience_facts)
    ? (sd.experience_facts as unknown[]).map((x) => s(x, 120)).filter((x) => x.length >= 4).slice(0, 6)
    : [];
  const time = keep(sd.occurred_at || (ip.experience_boundaries as any)?.occurred_at);
  const boundary = keep(
    sd.source_type || sd.seed_source || (owner && String(owner).toUpperCase() === "OTHER" ? "OTHER_PUBLIC" : ""),
  );
  if (subject) packet.subject = subject;
  if (scene) packet.scene = scene;
  if (factual) packet.factual_event = factual;
  if (delta) packet.change_or_delta = delta;
  if (tension) packet.contrast_or_tension = tension;
  if (human) packet.human_relevance = human;
  if (owner) packet.ownership = String(owner).toUpperCase();
  if (facts.length) packet.experience_evidence = facts;
  if (time) packet.time_sensitivity = time;
  if (boundary) packet.source_boundary = boundary;
  return packet;
}

export function buildExperiencePacket(
  seed: Record<string, unknown> | null | undefined,
  interp: Record<string, unknown> | null | undefined,
): ExperiencePacket {
  const sd = seed || {};
  const bound = ((interp as any)?.experience_boundaries || {}) as Record<string, unknown>;
  const facts = Array.isArray(sd.experience_facts)
    ? (sd.experience_facts as unknown[]).map((x) => s(x, 140)).filter((x) => x.length >= 4).slice(0, 6)
    : [];
  const hasContent = facts.length > 0;
  const owner = String(sd.owner || bound.owner || "").toUpperCase();
  const self = owner === "SELF" || owner === "ANALYTICS_LIVED";
  const experienced = self && hasContent;
  return {
    creator_experienced: experienced,
    evidence_supported: experienced && bound.evidence_supported !== false,
    must_not_claim_first_person: !experienced,
    did: facts[0],
    situation: keep(sd.concrete_subject) || keep((interp as any)?.what_is_actually_happening),
    observed: facts[1] || keep(sd.point_or_tension),
    result: facts[2],
    facts,
  };
}

export function buildPostThought(
  interp: Record<string, unknown> | null | undefined,
  core: {
    creator_judgment?: string;
    tension?: string;
    reader_relevant_meaning?: string;
    primary_claim?: string;
  } | null | undefined,
): PostThought {
  const ip = interp || {};
  const observation = s(ip.what_is_actually_happening || ip.seed_subject, 220);
  const creator_interpretation = s(
    ip.why_it_might_matter_to_creator || ip.why_it_matters_now || ip.what_is_new_or_interesting,
    220,
  );
  const labeled = /^(judgment_axis|tension_around|reader_bridge)\s*:/i.test(
    String(core?.creator_judgment || ""),
  );
  const core_thought = s(
    (labeled ? "" : core?.creator_judgment) || creator_interpretation || observation,
    220,
  );
  const reader_entry = s(
    ip.possible_reader_connection || ip.concrete_human_element || core?.reader_relevant_meaning,
    180,
  );
  return {
    observation,
    creator_interpretation,
    core_thought,
    reader_entry,
    stop_point: "Stop when this core thought is already on the page. No lesson, summary, outlook, CTA, or extra question.",
  };
}

export function presentPacketLines(packet: SemanticSeedPacket): string[] {
  const lines: string[] = ["SEMANTIC SEED (existing fields only; not original wording to copy):"];
  if (packet.subject) lines.push("subject: " + packet.subject);
  if (packet.scene) lines.push("scene: " + packet.scene);
  if (packet.factual_event) lines.push("factual_event: " + packet.factual_event);
  if (packet.change_or_delta) lines.push("change_or_delta: " + packet.change_or_delta);
  if (packet.contrast_or_tension) lines.push("contrast_or_tension: " + packet.contrast_or_tension);
  if (packet.human_relevance) lines.push("human_relevance: " + packet.human_relevance);
  if (packet.ownership) lines.push("ownership: " + packet.ownership);
  if (packet.experience_evidence?.length) lines.push("experience_evidence: " + packet.experience_evidence.join(" | "));
  if (packet.time_sensitivity) lines.push("time_sensitivity: " + packet.time_sensitivity);
  if (packet.source_boundary) lines.push("source_boundary: " + packet.source_boundary);
  if (lines.length === 1) return ["SEMANTIC SEED: thin. Do not invent missing fields."];
  return lines;
}
