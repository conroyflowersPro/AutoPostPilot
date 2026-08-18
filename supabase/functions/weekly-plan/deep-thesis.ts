/**
 * ORDER 4 — Deep Thesis / Structural Discovery inside THINK.
 * Optional. Not a writing template. Not a length mode. Not a rail.
 */
import type { SemanticSeedPacket } from "./semantic-seed-packet.ts";

export type DeepThesisFit = {
  use: boolean;
  reasons: string[];
  entity_name_survivable: boolean | null;
  already_present_forces: string[];
};

const ENTITY_RE =
  /\b(Tesla|Elon|Musk|FSD|Cybertruck|Optimus|xAI|Grok|NVIDIA|Nvidia|OpenAI|SpaceX|XMoney)\b|테슬라|일론|머스크|사이버트럭|옵티머스/gi;

function realDelta(v: string): boolean {
  const t = String(v || "").trim();
  if (t.length < 8) return false;
  return !/^(none|limited novelty|no clear novelty)/i.test(t) && !/forced/.test(t);
}

function realHuman(v: string): boolean {
  const t = String(v || "").trim();
  if (t.length < 4 || t === "NONE" || t === "LOW") return false;
  return !/^possible (recognition|shared)/i.test(t);
}
function blob(packet: SemanticSeedPacket, interp: Record<string, unknown>): string {
  return [
    packet.scene,
    packet.factual_event,
    packet.change_or_delta,
    packet.contrast_or_tension,
    packet.human_relevance,
    packet.subject,
    interp.what_is_actually_happening,
    interp.what_is_new_or_interesting,
    interp.possible_reader_connection,
  ]
    .map((x) => String(x || ""))
    .join(" ");
}

export function namedEntityIndependence(text: string): boolean | null {
  const raw = String(text || "");
  if (!ENTITY_RE.test(raw)) return null;
  ENTITY_RE.lastIndex = 0;
  const stripped = raw.replace(ENTITY_RE, " ").replace(/\s+/g, " ").trim();
  return stripped.length >= 18;
}

export function assessDeepThesisFit(
  packet: SemanticSeedPacket,
  interp: Record<string, unknown> | null | undefined,
): DeepThesisFit {
  const ip = interp || {};
  const status = String(ip.status || "");
  const reasons: string[] = [];
  const already: string[] = [];
  if (status === "INTERPRETATION_BLOCKED" || status === "INTERPRETATION_WEAK") {
    return { use: false, reasons: ["thin_seed"], entity_name_survivable: null, already_present_forces: [] };
  }
  const text = blob(packet, ip);
  const contrast = String(packet.contrast_or_tension || "").trim();
  const delta = realDelta(String(packet.change_or_delta || "")) ? String(packet.change_or_delta) : "";
  const scene = String(packet.scene || "").trim();
  const human = realHuman(String(packet.human_relevance || ip.concrete_human_element || ""))
    ? String(packet.human_relevance || ip.concrete_human_element || "")
    : "";
  const facts = packet.experience_evidence || [];
  const novelty = String(ip.novelty_signal || "");

  if ((facts.length >= 2 || (scene.length >= 8 && delta)) && contrast.length >= 8) {
    reasons.push("several_phenomena_may_share_a_principle");
  }
  if (contrast.length >= 8 && (delta || /달라|오히려|예상|상식|충돌|vs|대비/.test(text))) {
    reasons.push("common_sense_vs_result");
    already.push("expect_vs_actual");
  }
  if (scene.length >= 8 && contrast.length >= 8 && human) {
    reasons.push("small_case_may_show_a_larger_structure");
    already.push("concreteness");
  }
  if (novelty === "MEDIUM" || novelty === "HIGH") {
    reasons.push("surface_explanation_likely_incomplete");
  }
  if (String(ip.possible_macro_implication || "").length >= 8) {
    reasons.push("current_phenomenon_may_imply_direction");
  }
  if (/중간|단계|기반|연결|시스템|구조|원리/.test(text)) {
    reasons.push("events_may_share_one_axis");
    already.push("discovery");
  }

  const use = reasons.length >= 2;
  if (use) {
    if (/빈틈|아직|왜/.test(text)) already.push("information_gap");
    if (/체감|사람|습관|기억/.test(text)) already.push("resonance");
    if (/규모|전체|다시|올리면/.test(text)) already.push("scale_shift");
  }
  return {
    use,
    reasons: use ? reasons : reasons.length ? ["insufficient_for_deep_thesis"] : ["no_structural_signal"],
    entity_name_survivable: namedEntityIndependence(text),
    already_present_forces: use ? [...new Set(already)] : [],
  };
}

export function deepThesisCollectionNote(fit: DeepThesisFit): string {
  if (!fit.use) return "";
  const present = fit.already_present_forces.length
    ? "Already in this thought: " + fit.already_present_forces.join(", ") + ". Do not re-apply a card that only duplicates those."
    : "Discovery already carries force. Prefer zero cards unless a card does a different delivery job.";
  return [
    "DEEP THESIS COLLECTION: thought is already closed. Collection does not choose the discovery.",
    present,
    "Zero cards is allowed and often better.",
  ].join(" ");
}

export function deepThesisWriteLines(fit: DeepThesisFit): string[] {
  if (!fit.use) return [];
  const entity =
    fit.entity_name_survivable === true
      ? "Named-entity check: the thought still stands if famous names are set aside. You may lead with the phenomenon. This is not a ban on names."
      : fit.entity_name_survivable === false
        ? "Named-entity check: without the names the thought thins. Keep the names. Do not hide them as a trick."
        : "Named-entity check: no famous-name center.";
  return [
    "DEEP THESIS (optional inside THINK — only if you actually find hidden structure, shared dependency, constraint, expect-vs-result clash, causal link, or meaningful scale shift):",
    "Depth is not length. Short is correct if the discovery is already on the page. Do not cut the logic for a character quota. Do not add after it lands.",
    "Do not open by summarizing the whole conclusion. Leave room for the reader to connect. Discovery must happen as the thought moves, not as a hidden punchline.",
    "If the seed already has a concrete world (action, scene, use, money, time, people), you may pass through it. Do not invent an analogy.",
    entity,
    "Creator judgment is required, but it may be a question, direction, or cautious read — not a prophecy or investment call. Do not state uncertainty as fact.",
    "Do not print discovery questions or step names. Do not reuse the last post's shop example, step list, twist, or future bow.",
    "Fail if: fake depth, conclusion-first then evidence, forced analogy, same discovery template, AI-era/industry-revolution ending, or the famous name doing the work of the thought.",
  ];
}
