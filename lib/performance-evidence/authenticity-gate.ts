/**
 * Authenticity Gate — AI must not invent FIRSTHAND creator experience.
 */
import type { ProvenanceKind } from "./contract-v1";

export type AuthenticityDecision =
  | { allow: true; mode: "PUBLISHABLE" }
  | {
      allow: false;
      mode: "CREATOR_INPUT_REQUIRED" | "EXPERIENCE_OPPORTUNITY" | "BLOCKED";
      reason: string;
    };

const FIRSTHAND_CLAIM_PATTERNS: RegExp[] = [
  /내가\s*(운전|경험|직접|테스트|조사|구매|방문|겪)/,
  /직접\s*(봤|관찰|측정|확인|조사)/,
  /우리\s*(차|집|아이|가족).*(겪|사고)/,
  /\bI\s+(drove|tested|experienced|personally|investigated)\b/i,
];

export function textLooksLikeFirsthandClaim(
  text: string | null | undefined
): boolean {
  if (!text) return false;
  return FIRSTHAND_CLAIM_PATTERNS.some((re) => re.test(text));
}

/**
 * If planner/generator wants firsthand framing but provenance is not backed,
 * require creator input instead of inventing experience.
 */
export function authenticityGate(input: {
  intendedProvenance: ProvenanceKind;
  evidenceBacked: boolean;
  draftText?: string | null;
}): AuthenticityDecision {
  const wantsFirsthand = input.intendedProvenance === "FIRSTHAND";
  const textClaims = textLooksLikeFirsthandClaim(input.draftText);

  if ((wantsFirsthand || textClaims) && !input.evidenceBacked) {
    return {
      allow: false,
      mode: "CREATOR_INPUT_REQUIRED",
      reason:
        "FIRSTHAND claim requires real creator evidence — AI must not invent experience",
    };
  }

  if (wantsFirsthand && input.evidenceBacked) {
    return { allow: true, mode: "PUBLISHABLE" };
  }

  return { allow: true, mode: "PUBLISHABLE" };
}
