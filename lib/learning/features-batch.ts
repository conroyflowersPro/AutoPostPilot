/** Minimal feature extract for 14d batch (rule-based, no paid API). */
export type ContentFeatures = {
  lengthBucket: "short" | "medium" | "long";
  charCount: number;
  hasQuestion: boolean;
  hasMediaLink: boolean;
  isReply: boolean;
  topicGuess: string;
  actionType?: "ORIGINAL" | "QUOTE" | "REPOST" | "REPLY" | "UNKNOWN";
  experienceUsage?: string;
  mediaPresence?: boolean;
};

export function extractFeatures(text: string): ContentFeatures {
  const t = String(text || "").trim();
  const charCount = t.length;
  let lengthBucket: ContentFeatures["lengthBucket"] = "medium";
  if (charCount < 80) lengthBucket = "short";
  else if (charCount > 220) lengthBucket = "long";
  const hasQuestion = /[?？]|까요|나요/.test(t);
  const hasMediaLink = /https?:\/\//i.test(t);
  const isReply = /^@\w+/.test(t);
  let topicGuess = "other";
  const lower = t.toLowerCase();
  if (/fsd|hw3|v14|자율/.test(lower)) topicGuess = "fsd_field";
  else if (/cybertruck|사이버트럭/.test(lower)) topicGuess = "cybertruck";
  else if (/robotaxi|로보택시/.test(lower)) topicGuess = "robotaxi";
  else if (/lafc|축구/.test(lower)) topicGuess = "lafc";
  let actionType: ContentFeatures["actionType"] = "ORIGINAL";
  if (isReply) actionType = "REPLY";
  else if (/^rt\s|rt @/i.test(t)) actionType = "REPOST";
  return {
    lengthBucket,
    charCount,
    hasQuestion,
    hasMediaLink,
    isReply,
    topicGuess,
    actionType,
    experienceUsage: "unknown",
    mediaPresence: hasMediaLink,
  };
}
