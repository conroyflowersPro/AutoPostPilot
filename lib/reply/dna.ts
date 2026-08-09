/**
 * Compressed Reply / Social DNA from Historical Creator Learning.
 * Publishing DNA is NOT applied to replies.
 * AI suggestions are NOT Creator evidence.
 */

export const REPLY_SOCIAL_DNA_V1 = {
  version: "reply_social_dna_v1",
  source: "archive_historical_learning + creator_answers",
  corpus_note: "REPLY 24,690 historical; REPOST excluded from writing",
  patterns: {
    length: "Prefer short natural conversation over long publishing posts",
    register: {
      casual: "common in replies",
      kk: "use when the thread is funny / communication purpose (creator-confirmed)",
      polite_inform: "when informing others, respectful form is intentional",
      eumseum: "recently emerging for light personal opinion in publishing; replies stay conversational",
    },
    social_acts: [
      "thanks",
      "congratulation",
      "support / encourage",
      "acknowledgment",
      "agreement",
      "light disagreement / correction",
      "technical answer",
      "experience-sharing when asked",
      "relationship maintenance",
    ],
    avoid: [
      "engagement farming",
      "identical bulk replies",
      "forced emoji or ㅋㅋ",
      "invented firsthand experience",
      "auto-publish",
      "relationship hallucination from frequency alone",
    ],
  },
  prompt_block: `REPLY/SOCIAL DNA (not Publishing DNA):
- Short, natural conversational Korean (해요체 + casual mix).
- ㅋㅋ only when the thread is actually funny / light communication.
- Thanks, support, congrats, acknowledgment are authentic reply modes.
- Technical answers and experience-sharing only when context supports; never invent trips/miles/incidents.
- Do not copy long ORIGINAL post structure into a reply.
- Do not force hooks, hashtags, or engagement bait.
- relationship_context unknown unless evidence says otherwise.`,
} as const;

export type IncomingReplySignals = {
  intents: string[];
  has_question: boolean;
  has_thanks: boolean;
  has_congrats: boolean;
  has_humor_cue: boolean;
  has_technical: boolean;
  has_experience_ask: boolean;
};

/** Lightweight intent heuristic — not Creator psychological fact */
export function classifyIncomingReply(text: string): IncomingReplySignals {
  const t = text || "";
  const intents: string[] = [];
  const has_question = /[?？]|인가요|나요|할까요|어때|어떻|무엇|뭐|왜|언제|어디/.test(t);
  const has_thanks = /감사|고마|thanks|thx|고맙/.test(t);
  const has_congrats = /축하|congrats|잘했|멋져|대박/.test(t);
  const has_humor_cue = /ㅋ|ㅎ|lol|lmao|ㅎㅎ|ㅋㅋ/.test(t);
  const has_technical = /FSD|HW|버전|업데이트|버그|설정|Cybertruck|토크|스펙|API|에러/.test(t);
  const has_experience_ask =
    /직접|경험|타보|써보|어때요|어떤가요|실사용|체감/.test(t);

  if (has_question) intents.push("QUESTION");
  if (has_thanks) intents.push("THANKS");
  if (has_congrats) intents.push("CONGRATULATION");
  if (has_humor_cue) intents.push("HUMOR");
  if (has_technical) intents.push("TECHNICAL_DISCUSSION");
  if (has_experience_ask) intents.push("EXPERIENCE_QUESTION");
  if (!intents.length) intents.push("CASUAL_REACTION");

  return {
    intents,
    has_question,
    has_thanks,
    has_congrats,
    has_humor_cue,
    has_technical,
    has_experience_ask,
  };
}
