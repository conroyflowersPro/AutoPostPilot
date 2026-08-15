/**
 * Operator DNA + Learning philosophy (v11.5.0).
 * Closed loop: Publish → Analytics Import → Feature Extraction → Performance/Revenue Analysis
 * → Learning → DNA/Memory update → next 3-day Planner reads it.
 */
export const LEARNING_PHILOSOPHY_VERSION = "learning-philosophy-v1-closed-loop";

export const LEARNING_CYCLE =
  "Publish → Analytics Import → Feature Extraction → Performance/Revenue Analysis → Learning → DNA/Memory Update → next 3-day Planner reads → new Planning";

export function audienceDnaPhilosophyBlock(): string {
  return [
    "AUDIENCE DNA: Not a follow-the-followers model. It explains, from real account data, what readers are reacting to, where interest is moving, and which content produces a better audience.",
    "Primary source: X Analytics reports. Fedica is an auxiliary signal only.",
    "Creator DNA is who I am. Audience DNA is who is looking now, what they react to, and where they are moving.",
    "JOBS: join followers gained, profile visits, bookmarks, replies, reposts, quotes, likes, impressions, detail expands, link actions to Topic / Subtopic / Content Type / Writing Feature. Extract Audience Interest, Reaction Pattern, Topic Movement, Audience Quality.",
    "The 3-day Planner MUST read current Audience DNA into seeds and editorial strategy. Audience DNA must not overwrite Creator DNA and must not become simple popularity chasing. Missing evidence is UNKNOWN, not zero.",
  ].join("\n");
}

export function performanceDnaPhilosophyBlock(): string {
  return [
    "PERFORMANCE DNA: Not a list of posts that did well. It is the validated relationship between published content features/strategy and account growth.",
    "Do not learn because AI generated it. Evidence is only Publishing + Analytics. Missing ≠ 0.",
    "IS: repeatedly validated feature↔outcome relationships. IS NOT: a high-view collection, a store of winning post wording, a sentence-copy database, or a raw engagement ranking.",
    "INTERPRET outcomes in this order: Followers Gained → Profile Visits → Revenue → Bookmarks → Replies → Reposts → Quotes → Likes → Impressions. Join Topic, Hook, Length, Opinion Strength, Technical Depth, Media, Experience, Discourse Shape to those results.",
    "The 3-day Planner reads this to decide which strategic patterns to experiment more or reduce — never what wording to copy. Must not overwrite Creator DNA.",
  ].join("\n");
}

export function revenueDnaPhilosophyBlock(): string {
  return [
    "REVENUE DNA: Not a standalone ad engine that maximizes money. It explains which content–audience relationships connect to durable revenue.",
    "Revenue matters. It must not outrank Creator authenticity, Audience Quality, Trust, or Authority.",
    "JOBS: analyze Revenue per Post / Impression / Engagement, and by Topic, Content Type, Publish Time, Media Type, from real revenue data so Planner can see profitable directions.",
    "Do not repeat a topic only because it paid. Do not steer the account where the Creator does not want to go. If revenue evidence is missing, keep UNKNOWN / insufficient evidence — never treat an empty value as a success pattern.",
  ].join("\n");
}

export function currentXContextPhilosophyBlock(): string {
  return [
    "CURRENT X CONTEXT: Not a news feed. It is the currentness model: what change, conversation, official announcement, debate, or new context is forming around this Creator and Audience on X right now.",
    "Long-term DNA changes slowly. Current X Context carries the fast external environment.",
    "JOBS: collect current context in Creator-interest fields, Audience-moving fields, related official accounts / product / company / policy / civic issues. Separate short-term noise from seed-worthy change.",
    "The 3-day Planner MUST read this to judge why this subject now. Never copy Current X Context itself into a post prompt.",
  ].join("\n");
}

export function plannerMemoryPhilosophyBlock(): string {
  return [
    "PLANNER MEMORY: Not a store of every post the system ever made. Long-term memory of strategic learning that Publishing + Analytics repeatedly validated.",
    "Generated post = hypothesis. Published post + Analytics = evidence. Only validated evidence becomes memory.",
    "JOBS: store abstract patterns tied to follower growth, profile visits, authority, revenue, bookmarks, meaningful discussion, long-term value. Example shape: 'personal experience expanded into structural observation → profile visits rose'. Never store a specific sentence.",
    "The 3-day Planner MUST read this on the next generate. Saving it only on the learning page does not close the loop.",
  ].join("\n");
}

export function analyticsImportPhilosophyBlock(): string {
  return [
    "ANALYTICS IMPORT: Not 'read a CSV'. It is the inlet that turns post-publish reality into a form the system can learn.",
    "Keep source format separate from the internal model so a provider change does not shake Learning Architecture.",
    "JOBS: ingest X Analytics reports first — Post ID, publish time, followers gained, profile visits, bookmarks, replies, reposts, quotes, likes, impressions, detail expands, link actions — into the canonical internal model. Fedica or a future source adds an adapter only.",
  ].join("\n");
}

export function featureExtractionPhilosophyBlock(): string {
  return [
    "CONTENT FEATURE EXTRACTION: Do not memorize successful sentences. Learn the abstracted features that influenced success.",
    "JOBS: from published posts extract Topic, Subtopic, Writing Style, Hook Style, Sentence Rhythm, Length, Media Type/Presence, Question Usage, Opinion Strength, Observation Level, Technical Depth, Emotional Level, Prediction Level, Personal Experience, Personal Story Level, CTA, Discourse Shape. Store features apart from raw text. Learning target is feature↔outcome, not wording.",
  ].join("\n");
}

export function performanceAnalysisPhilosophyBlock(): string {
  return [
    "PERFORMANCE ANALYSIS: Not 'which post got the most views this week'. It explains why some content contributed to account growth and Audience Quality.",
    "JOBS: join each post's features to Analytics. Find patterns tied to follower gain, profile visit, bookmark, meaningful reply, revenue. Separate a one-off viral hit from a repeatable signal. Split Manual vs AI outcomes. Trust evidence that repeats across publishing cycles more than a single post.",
  ].join("\n");
}

export function learningEnginePhilosophyBlock(): string {
  return [
    "LEARNING ENGINE: Not a system that looks at its own drafts and grows more sure. It promotes only reality-validated results into Intelligence and Planner Memory.",
    "The ~14-day cycle exists so learning sees at least two real Planning/Publishing cycles.",
    "JOBS: gather recent publishing results, run Performance Analysis, compare to existing Creator/Audience/Performance/Revenue DNA, update only changes with enough evidence. Block a self-reinforcement loop on average AI drafts. Keep a one-off success as hypothesis. Learning closes only when the next 3-day Planner actually reads the result.",
  ].join("\n");
}

export function manualPostLearningPhilosophyBlock(): string {
  return [
    "MANUAL POST LEARNING: A post the Creator thought and wrote is a stronger Creator Signal than an AI draft. A handmade post that outperforms expectation is premium evidence of a Creator interest, writing behavior, or audience response the model had not captured.",
    "JOBS: identify Manual posts; allow higher learning weight than same-condition AI posts. If a new topic, opinion style, humor, or observation pattern repeatedly succeeds, raise it as a candidate change to Creator DNA or Planner Memory. One Manual post must not swing Creator DNA hard.",
  ].join("\n");
}

export function revenueAnalysisPhilosophyBlock(): string {
  return [
    "REVENUE ANALYSIS: Not 'make more of the posts that made money'. It explains which content makes durable revenue without damaging Audience Trust or account growth.",
    "JOBS: join post revenue to Topic, Content Type, Publish Time, Media, Engagement, Audience Response. Compute Revenue per Post / Impression / Engagement. Warn Planner when a high-revenue pattern hurts follower quality or trust. Do not overweight strategy until enough revenue evidence exists.",
  ].join("\n");
}

export function dnaIntelligencePhilosophyBlock(): string {
  return [
    audienceDnaPhilosophyBlock(),
    performanceDnaPhilosophyBlock(),
    revenueDnaPhilosophyBlock(),
    currentXContextPhilosophyBlock(),
    plannerMemoryPhilosophyBlock(),
  ].join("\n");
}

export function learningLoopPhilosophyBlock(): string {
  return [
    `LEARNING CYCLE: ${LEARNING_CYCLE}`,
    analyticsImportPhilosophyBlock(),
    featureExtractionPhilosophyBlock(),
    performanceAnalysisPhilosophyBlock(),
    learningEnginePhilosophyBlock(),
    manualPostLearningPhilosophyBlock(),
    revenueAnalysisPhilosophyBlock(),
  ].join("\n");
}
