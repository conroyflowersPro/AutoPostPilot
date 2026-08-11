/**
 * ORDER 4 — Creator Style Data Layer (Edge)
 * Engine reads style/voice via getters. This module holds DATA snapshots only.
 * No sentence templates. No preferred-word injection as style substitute.
 * Engine code must not hardcode vehicle/interest identity — data does.
 */

export type CreatorStyleIntelligence = {
  version: string;
  source_dataset_id: string;
  writing_mode: "PUBLISHING";
  reply_style_separated: true;
  xai_used: false;
  sample_n: number;
  sentence_length: {
    mean_chars_per_sentence: number;
    mean_max_sentence_chars: number;
    tendency: "SHORT" | "MEDIUM" | "LONG";
  };
  ending_style: {
    haeyo_hits_per_post_avg: number;
    eumseum_proxy_per_post_avg: number;
    dominant_register_proxy: string;
  };
  emoji_usage_avg: number;
  kk_usage_avg: number;
  hh_usage_avg: number;
  question_usage_avg: number;
  technical_term_hits_avg: number;
  mean_post_chars: number;
  median_post_chars: number;
  templates_stored: false;
  by_editorial_mode: Record<string, { note: string; register_hint?: string }>;
  note: string;
};

export type CreatorDnaVoiceSnapshot = {
  version: string;
  source: string;
  who_summary: string;
  why_write: string[];
  how_publishing: string;
  how_reply: string;
  not_this: string[];
  register_by_intent: Record<string, string>;
  corpus_stats: {
    sample_n: number;
    mean_post_chars: number;
    median_post_chars: number;
    haeyo_pct: number;
    eumseum_pct: number;
    kk_pct: number;
    emoji_pct: number;
  };
};

const STYLE_INTEL: CreatorStyleIntelligence = {
  version: "creator_style_intelligence_v1_order3",
  source_dataset_id: "APP-ARCHIVE-ONE-TIME-20260809-107",
  writing_mode: "PUBLISHING",
  reply_style_separated: true,
  xai_used: false,
  sample_n: 6950,
  sentence_length: {
    mean_chars_per_sentence: 47.1,
    mean_max_sentence_chars: 63.3,
    tendency: "MEDIUM",
  },
  ending_style: {
    haeyo_hits_per_post_avg: 0.094,
    eumseum_proxy_per_post_avg: 0.793,
    dominant_register_proxy: "EUMSEUM_LEAN",
  },
  emoji_usage_avg: 0.457,
  kk_usage_avg: 0.049,
  hh_usage_avg: 0.003,
  question_usage_avg: 0.153,
  technical_term_hits_avg: 0.36,
  mean_post_chars: 112.1,
  median_post_chars: 96,
  templates_stored: false,
  by_editorial_mode: {
    INFORMATIVE: {
      note: "audience-facing polite when explaining",
      register_hint: "해요체 intentional for inform/explain",
    },
    OPINION: {
      note: "light opinion may use 음슴체 (recent preference)",
      register_hint: "음슴체 allowed for light opinion; not forced",
    },
    COMPARE: {
      note: "natural A/B axis, not textbook contrast essay",
      register_hint: "clear axis in natural speech",
    },
    EXPERIENCE: {
      note: "only with evidence; first-person OK with known context",
      register_hint: "evidence-backed only",
    },
    CASUAL_OBSERVATION: {
      note: "short concrete; 해요체+casual mix",
      register_hint: "short lived observation",
    },
  },
  note: "Deterministic corpus proxies. No sentence templates. Reply style separate.",
};

const DNA_VOICE: CreatorDnaVoiceSnapshot = {
  version: "creator-dna-engine-v1.3.1-creator-answers",
  source: "Creator_DNA_Historical_v1.1 + archive ORIGINAL stats",
  who_summary:
    "Korean Tesla multi-vehicle owner-creator; real-world FSD/product observation primary; plural interests (gaming, daily, LAFC) retained.",
  why_write: ["inform/explain", "share experience", "light opinion", "observation"],
  how_publishing:
    "Two-speed; media often; informational → polite intentional; light opinion eumseum = recent preference not long-archive dominant.",
  how_reply: "Short, communicative; ㅋㅋ when thread funny — REPLY DNA separate, not used for ORIGINAL generation.",
  not_this: [
    "stock-daytrade primary",
    "single global tone",
    "REPOST as writing voice",
    "personal experience mandatory every post",
    "pure 반말",
    "inventing tests",
  ],
  register_by_intent: {
    INFORMATIVE: "해요체·존칭 intentional (audience-facing polite)",
    OPINION: "요즘 들어서 음슴체 가능 (RECENTLY_EMERGING; not forced)",
    CASUAL_OBSERVATION: "short, concrete, 해요체+casual mix",
    COMPARE: "clear A/B axis in natural speech, not textbook contrast essay",
    EXPERIENCE: "only if evidence exists; first-person OK with known context only",
  },
  corpus_stats: {
    sample_n: 6954,
    mean_post_chars: 112.1,
    median_post_chars: 96,
    haeyo_pct: 34.9,
    eumseum_pct: 0.2,
    kk_pct: 4.7,
    emoji_pct: 24.9,
  },
};

export function getCreatorStyle(): CreatorStyleIntelligence {
  return STYLE_INTEL;
}

export function getCreatorDnaVoiceSnapshot(): CreatorDnaVoiceSnapshot {
  return DNA_VOICE;
}

export function getStyleBaseline(): {
  mean_post_chars: number;
  median_post_chars: number;
  kk_usage_avg: number;
  emoji_usage_avg: number;
  sentence_tendency: "SHORT" | "MEDIUM" | "LONG";
  haeyo_pct: number;
  eumseum_pct: number;
} {
  const s = STYLE_INTEL;
  const d = DNA_VOICE.corpus_stats;
  return {
    mean_post_chars: s.mean_post_chars,
    median_post_chars: s.median_post_chars ?? d.median_post_chars,
    kk_usage_avg: s.kk_usage_avg,
    emoji_usage_avg: s.emoji_usage_avg,
    sentence_tendency: s.sentence_length.tendency,
    haeyo_pct: d.haeyo_pct,
    eumseum_pct: d.eumseum_pct,
  };
}

export function getCreatorDnaVoice(): string {
  const d = DNA_VOICE;
  const s = STYLE_INTEL;
  const reg = Object.entries(d.register_by_intent)
    .map(([k, v]) => `- ${k} → ${v}`)
    .join("\n");
  return `CREATOR DNA (HOW to write — Publishing voice only; from Data Layer ${d.version}):
WHO (data): ${d.who_summary}
WHY WRITE (data): ${d.why_write.join(" · ")}
HOW PUBLISHING (data): ${d.how_publishing}
REGISTER BY INTENT (data):
${reg}
CORPUS SURFACE (Publishing ORIGINAL n=${s.sample_n}):
- median length ~${s.median_post_chars} chars (mean ~${s.mean_post_chars})
- sentence tendency: ${s.sentence_length.tendency}
- register proxy: ${s.ending_style.dominant_register_proxy}
- kk avg ${s.kk_usage_avg}, emoji avg ${s.emoji_usage_avg}, question avg ${s.question_usage_avg}
NOT THIS (data): ${d.not_this.join("; ")}
Performance DNA is reference only — do NOT lock onto one past high-engagement style.
REPLY style is separate — do not use reply rhythm for ORIGINAL posts.`;
}

export function getVocabularyFidelityInstructions(): string {
  const b = getStyleBaseline();
  return `VOCABULARY FIDELITY (Data Layer baseline — HOW):
- Success = sounds like this Creator's Publishing corpus, NOT “more professional / refined / essay-like”.
- Baseline: median ~${b.median_post_chars} chars, mean ~${b.mean_post_chars}, tendency ${b.sentence_tendency}.
- Prefer lived surface over polished abstract analysis. Do NOT force-insert any fixed preferred-word list.
- If seed/source already uses creator-natural wording, KEEP meaning and surface — do NOT re-abstract into report language.
- Avoid stacking report markers: 측면/구성/핵심/중요성/전반/효과적/체계적/종합적/본질/시사점/결론적으로/요약하면/이를 통해.
- Do not “upgrade” casual observation into lecture or whitepaper tone (semantic elevation banned).
- One main point; length near corpus median when MEDIUM; no padded conclusion paragraph.
- ㅋㅋ/emoji only when natural for the observation — corpus kk rate is low (~${(b.kk_usage_avg * 100).toFixed(1)}% posts).`;
}
