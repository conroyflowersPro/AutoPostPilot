/**
 * ORDER 4 / v9.1.2 — Edge-local runtime grounding (canonical for weekly-plan).
 * Keep in conceptual sync with lib/runtime/grounding.ts — Edge cannot import lib/.
 * No xAI. Reject only; never rewrite seeds.
 */

export type ClaimType =
  | "PERSONAL_EXPERIENCE"
  | "CURRENT_FACT"
  | "STATIC_FACT"
  | "OPINION"
  | "OBSERVATION"
  | "HYPOTHESIS";

export type GroundingStatus =
  | "GROUNDED"
  | "REJECTED"
  | "CURRENT_CONTEXT_REQUIRED"
  | "EXPERIENCE_SUPPLY_LOW"
  | "NEEDS_RELATIONSHIP_EVIDENCE"
  | "XAI_WOULD_HAVE_BEEN_REQUIRED";

export type SeedProvenance = {
  source_type: string;
  source_id?: string;
  claim_types: ClaimType[];
  inference_type: "EVIDENCE_DERIVED" | "REGISTRY_AXIS" | "CREATOR_INTENT" | "UNKNOWN";
  grounding_status: GroundingStatus;
  reasons: string[];
};

export type GroundingInput = {
  concrete_subject: string;
  point_or_tension?: string;
  editorial_mode?: string;
  cluster?: string;
  creator_evidence_available?: boolean;
  experience_required?: boolean;
  evidence_source_ids?: string[];
  primary_source?: string;
  relationship_evidence_ids?: string[];
  runtime_joint_context_id?: string;
  interests?: string[];
  /** ORDER 3 verified sets from Evidence Packet */
  verified_locations?: string[];
  verified_entities?: string[];
  verified_events?: string[];
};

const EXPERIENCE_CLAIM = [
  /직접\s*(해|타|가|보)/,
  /내가\s*(해|타|가|보|느)/,
  /직접\s*경험/,
  /체감했/,
  /타\s*보/,
  /운전했/,
  /충전했/,
  /직관\s*(갔|함)/,
  /어제\s*(충전|주행|직관|게임)/,
  /오늘\s*(충전|주행|직관)/,
  /해봤/,
  /가봤/,
];

const CURRENT_FACT = [
  /지금\s*(은|은\s*)?/,
  /현재\s*(는|은)?/,
  /오늘\s*(부터|기준|시점)/,
  /방금\s*(공개|출시|업데이트)/,
  /최신\s*(버전|빌드|업데이트)/,
  /이번\s*주\s*(출시|공개)/,
];

const GENERIC_AI = [
  /전제\s*확인/,
  /검증해야/,
  /중요한\s*측면/,
  /핵심\s*구성/,
  /전반적인\s*접근/,
  /효과적으로\s*활용/,
];

const INTEREST_KEYWORDS: Array<{ id: string; re: RegExp }> = [
  { id: "FSD", re: /fsd|오토파일럿|자율/i },
  { id: "CYBERTRUCK", re: /cybertruck|사이버/i },
  { id: "ROBOTAXI", re: /robotaxi|로보\s*택시/i },
  { id: "LAFC", re: /lafc|bmo|직관/i },
  { id: "GAMING", re: /게임|스팀|플스/i },
  { id: "AI_TECH", re: /\bai\b|grok|그록|gpt/i },
];

function textOf(input: GroundingInput): string {
  return `${input.concrete_subject || ""} ${input.point_or_tension || ""}`.trim();
}

export function detectClaimTypes(input: GroundingInput): ClaimType[] {
  const t = textOf(input);
  const types: ClaimType[] = [];
  if (EXPERIENCE_CLAIM.some((r) => r.test(t)) || input.experience_required) types.push("PERSONAL_EXPERIENCE");
  if (CURRENT_FACT.some((r) => r.test(t))) types.push("CURRENT_FACT");
  if (/생각|보임|의견|반대|찬성/.test(t)) types.push("OPINION");
  if (/보면|관찰|패턴|구조/.test(t)) types.push("OBSERVATION");
  if (!types.length) types.push("OBSERVATION");
  return [...new Set(types)];
}

export function detectInterests(text: string): string[] {
  return INTEREST_KEYWORDS.filter((k) => k.re.test(text)).map((k) => k.id);
}

export function judgeSeedGrounding(input: GroundingInput): {
  pass: boolean;
  provenance: SeedProvenance;
} {
  const claim_types = detectClaimTypes(input);
  const t = textOf(input);
  const reasons: string[] = [];

  if (claim_types.includes("PERSONAL_EXPERIENCE")) {
    const hasEvidence =
      !!input.creator_evidence_available ||
      (input.evidence_source_ids && input.evidence_source_ids.length > 0) ||
      /RECENT_MANUAL|ARCHIVE|PUBLISHED|CREATOR_INTENT|EXPERIENCE/i.test(String(input.primary_source || ""));
    if (!hasEvidence) {
      return {
        pass: false,
        provenance: {
          source_type: String(input.primary_source || "UNKNOWN"),
          source_id: input.evidence_source_ids?.[0],
          claim_types,
          inference_type: "UNKNOWN",
          grounding_status: "REJECTED",
          reasons: ["UNSUPPORTED_PERSONAL_EXPERIENCE"],
        },
      };
    }
    reasons.push("EXPERIENCE_EVIDENCE_PRESENT");
  }

  if (claim_types.includes("CURRENT_FACT")) {
    const hasEvidence =
      !!input.creator_evidence_available || (input.evidence_source_ids?.length ?? 0) > 0;
    if (!hasEvidence) {
      return {
        pass: false,
        provenance: {
          source_type: String(input.primary_source || "UNKNOWN"),
          source_id: input.evidence_source_ids?.[0],
          claim_types,
          inference_type: "UNKNOWN",
          grounding_status: "CURRENT_CONTEXT_REQUIRED",
          reasons: ["UNSUPPORTED_CURRENT_FACT", "XAI_WOULD_HAVE_BEEN_REQUIRED"],
        },
      };
    }
  }

  const interests = input.interests?.length ? input.interests : detectInterests(t);
  if (interests.length >= 2) {
    if (!input.relationship_evidence_ids?.length && !input.runtime_joint_context_id) {
      return {
        pass: false,
        provenance: {
          source_type: String(input.primary_source || "UNKNOWN"),
          source_id: input.evidence_source_ids?.[0],
          claim_types,
          inference_type: "UNKNOWN",
          grounding_status: "NEEDS_RELATIONSHIP_EVIDENCE",
          reasons: ["CROSS_INTEREST_WITHOUT_RELATIONSHIP"],
        },
      };
    }
  }

  // ORDER 3: entity/location must appear in verified Evidence Packet sets
  const LOCATION_TOKENS = [
    { id: "BMO", re: /\bbmo\b|비모/i },
    { id: "SEOUL", re: /서울|seoul/i },
    { id: "INCHEON", re: /인천/i },
    { id: "JEJU", re: /제주/i },
    { id: "HONGDAE", re: /홍대/i },
    { id: "SF", re: /샌프란|san\s*francisco/i },
    { id: "REDWOOD_CITY", re: /레드우드|redwood/i },
    { id: "LA", re: /로스앤젤레스|\bla\b(?![a-z])/i },
  ];
  const claimedLocs = LOCATION_TOKENS.filter((l) => l.re.test(t)).map((l) => l.id);
  const verifiedLoc = new Set((input.verified_locations || []).map((x) => String(x).toUpperCase()));
  for (const loc of claimedLocs) {
    if (!verifiedLoc.has(loc) && !verifiedLoc.has(loc.toUpperCase())) {
      if (!(input.verified_locations || []).length) {
        return {
          pass: false,
          provenance: {
            source_type: String(input.primary_source || "UNKNOWN"),
            source_id: input.evidence_source_ids?.[0],
            claim_types,
            inference_type: "UNKNOWN",
            grounding_status: "REJECTED",
            reasons: ["UNSUPPORTED_LOCATION", loc],
          },
        };
      }
      if (!verifiedLoc.has(loc)) {
        return {
          pass: false,
          provenance: {
            source_type: String(input.primary_source || "UNKNOWN"),
            source_id: input.evidence_source_ids?.[0],
            claim_types,
            inference_type: "UNKNOWN",
            grounding_status: "REJECTED",
            reasons: ["LOCATION_NOT_IN_VERIFIED_SET", loc],
          },
        };
      }
    }
  }

  // Korean language ≠ Korea location
  if (/서울|인천|제주|홍대|경부고속|한국\s*지하철/.test(t)) {
    const ok = (input.verified_locations || []).some((v) =>
      /SEOUL|INCHEON|JEJU|HONGDAE|KOREA/i.test(String(v))
    );
    if (!ok) {
      return {
        pass: false,
        provenance: {
          source_type: String(input.primary_source || "UNKNOWN"),
          source_id: input.evidence_source_ids?.[0],
          claim_types,
          inference_type: "UNKNOWN",
          grounding_status: "REJECTED",
          reasons: ["KOREAN_LOCATION_WITHOUT_EVIDENCE"],
        },
      };
    }
  }

  // Expanded current-context signals (match day, price, software, policy)
  const CURRENT_EXPANDED = [
    /현재\s*(경기|스쿼드|로테이션|라인업)/,
    /오늘\s*(경기|직관)/,
    /선수\s*(상태|출전|부상)/,
    /가격|재고|availab/i,
    /최신\s*(소프트웨어|빌드|버전|업데이트)/,
    /현재\s*(요금|정책|규정)/,
    /지금\s*(타는|운영|운행)/,
  ];
  if (CURRENT_EXPANDED.some((r) => r.test(t))) {
    const hasEvidence =
      !!input.creator_evidence_available || (input.evidence_source_ids?.length ?? 0) > 0;
    if (!hasEvidence) {
      return {
        pass: false,
        provenance: {
          source_type: String(input.primary_source || "UNKNOWN"),
          source_id: input.evidence_source_ids?.[0],
          claim_types,
          inference_type: "UNKNOWN",
          grounding_status: "CURRENT_CONTEXT_REQUIRED",
          reasons: ["UNSUPPORTED_CURRENT_CONTEXT", "XAI_WOULD_HAVE_BEEN_REQUIRED"],
        },
      };
    }
  }

  const isAi =
    /ai|그록|grok|gpt|프롬프트/i.test(t) || String(input.cluster || "").toUpperCase() === "AI_TECH";
  if (isAi && GENERIC_AI.some((r) => r.test(t))) {
    return {
      pass: false,
      provenance: {
        source_type: String(input.primary_source || "UNKNOWN"),
        source_id: input.evidence_source_ids?.[0],
        claim_types,
        inference_type: "UNKNOWN",
        grounding_status: "REJECTED",
        reasons: ["AI_GENERIC"],
      },
    };
  }

  const inference_type =
    input.creator_evidence_available || (input.evidence_source_ids?.length ?? 0) > 0
      ? "EVIDENCE_DERIVED"
      : /INTENT/i.test(String(input.primary_source || ""))
        ? "CREATOR_INTENT"
        : "UNKNOWN";

  return {
    pass: true,
    provenance: {
      source_type: String(input.primary_source || "UNKNOWN"),
      source_id: input.evidence_source_ids?.[0],
      claim_types,
      inference_type,
      grounding_status: "GROUNDED",
      reasons,
    },
  };
}

export function countIntegrityOk(
  base_required: number,
  final_count: number
): { ok: boolean; reason?: string } {
  if (final_count < base_required) return { ok: false, reason: "BELOW_BASE_REQUIRED" };
  if (final_count > base_required + 1) return { ok: false, reason: "ABOVE_BASE_PLUS_ONE" };
  return { ok: true };
}
