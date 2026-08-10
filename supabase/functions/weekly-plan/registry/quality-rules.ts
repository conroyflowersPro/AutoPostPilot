/**
 * STATIC REGISTRY — Quality / specificity pattern rules (not seed content).
 * ORDER 2: kept outside Seed Engine business flow ownership of templates.
 */

/** Generic AI advice — reject for AI topics in ANY editorial mode */
export const AI_GENERIC_PATTERNS: RegExp[] = [
  /ai\s*답변은\s*검증/,
  /전제를?\s*(확인|밝혀|남기|빠)/,
  /프롬프트를?\s*(명확|자세)/,
  /ai를?\s*맹신/,
  /톤과\s*정확도/,
  /톤을?\s*(한\s*번에\s*)?맞추/,
  /균형이\s*중요/,
  /검증해야\s*한다/,
  /확인해야\s*한다/,
  /중요하다$/,
  /최소\s*체크/,
  /수치보다\s*전제/,
  /전제\s*문장/,
  /전제가\s*빠/,
  /요약\s*도구가?\s*전제/,
  /맹신하면\s*안/,
  /always\s*verify/i,
  /don't\s*trust\s*ai/i,
  /clear\s*prompts?/i,
  /전제.*빠뜨/,
  /초안.*전제/,
  /톤을?\s*맞추다가/,
  /전제를?\s*먼저/,
];

export const INFO_WEAK_PATTERNS: RegExp[] = [
  /중요하다$/,
  /확인해야\s*한다/,
  /주의해야/,
  /알아두자$/,
  /생각해\s*보자$/,
  /명심/,
  /기본적으로/,
  /일반적으로\s*중요/,
  /누구나/,
  /항상\s*조심/,
];

export const INFO_STRONG_SIGNALS: RegExp[] = [
  /패턴|타이밍|병목|회전율|용량|실패율|체류|감속|합류|차선|커브사이드|피크|kW|빌드|버전|구조|동선|각도|배수|예측\s*오차|간격|콘\s*라인|제한속도/,
  /vs\.?|대비|before|after|이전|이후/,
  /작동|동작|반응|추종|유지\s*방식|시작\s*시점|종료\s*타이밍/,
];

/** Implementation examples must never become content candidates */
export const EXAMPLE_CONTAMINATION: RegExp[] = [
  /fsd\s*v10/i,
  /v10대/,
  /개발\s*오더/,
  /example\s*only/i,
  /implementation\s*example/i,
  /order\s*[123]\s*[\/\-]/i,
];
