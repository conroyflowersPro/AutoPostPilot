import type { ContentFeatures } from "./types";

/** Rule-based feature extraction — no Grok calls */
export function extractFeatures(text: string): ContentFeatures {
  const t = String(text || "").trim();
  const charCount = t.length;
  let lengthBucket: ContentFeatures["lengthBucket"] = "medium";
  if (charCount < 80) lengthBucket = "short";
  else if (charCount > 220) lengthBucket = "long";

  const hasQuestion = /[?？]|까요|나요|인가요|일까요/.test(t);
  const hasMediaLink = /https?:\/\/|t\.co\//i.test(t);
  const isReply = /^@\w+/.test(t);
  const koreanChars = (t.match(/[가-힣]/g) || []).length;
  const latinChars = (t.match(/[A-Za-z]/g) || []).length;
  const isKorean = koreanChars > 8 || koreanChars >= latinChars;
  const isEnglish = latinChars > 20 && latinChars > koreanChars * 2;
  const hasNumbers = /\d/.test(t);
  const hasEmoji =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|ㅋ{2,}|ㅎ{2,}|😂|🤣|🔥|🫠|🥹/u.test(t);
  const hasCta =
    /확인해|보세요|해보세요|눌러|업데이트|링크|더 보기|follow|check/i.test(t);

  let topicGuess = "other";
  const lower = t.toLowerCase();
  if (/fsd|hw3|v14|lite|오토파일럿|자율/.test(lower)) topicGuess = "fsd_field";
  else if (/cybertruck|사이버트럭|적재/.test(lower)) topicGuess = "cybertruck";
  else if (/robotaxi|로보택시|cybercab/.test(lower)) topicGuess = "robotaxi";
  else if (/grok|xai|컬렉션|한도/.test(lower)) topicGuess = "grok_xai";
  else if (/lafc|리그|손흥민|bmo|축구/.test(lower)) topicGuess = "lafc";
  else if (/테라팹|terafab|칩|optimus|옵티머스|생태계/.test(lower))
    topicGuess = "ecosystem";
  else if (/주가|tsla|매매|등락/.test(lower)) topicGuess = "stock_noise";
  else if (isReply) topicGuess = "reply";
  else if (/솔직|실패|수리|비용|고백/.test(t)) topicGuess = "honest_fail";

  return {
    lengthBucket,
    charCount,
    hasQuestion,
    hasMediaLink,
    isReply,
    isEnglish,
    isKorean,
    hasNumbers,
    hasEmoji,
    hasCta,
    topicGuess,
  };
}
