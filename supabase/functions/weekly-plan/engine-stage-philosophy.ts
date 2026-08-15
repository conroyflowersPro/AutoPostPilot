/**
 * Operator stage philosophy (v11.4.9).
 * Judgment criteria, not templates. No engine replaces the Creator.
 */
export const STAGE_PHILOSOPHY_VERSION = "stage-philosophy-v1-6-to-quality";

export function seedGenerationPhilosophyBlock(): string {
  return [
    "SEED GENERATION: A seed is not pulled from a frozen topic list or hardcoded category. Infer 'worth thinking about THIS week' from Creator DNA + Audience DNA (when evidence exists) + Current X Context + Performance DNA + Revenue DNA (when evidence exists) + recent published flow + this week's strategy.",
    "Infer. Do not paste examples. Never emit a phrase that appeared in this prompt as concrete_subject. DNA interest domains are bounds, not a topic menu. Few-shot seed subjects are forbidden.",
    "A seed starts thinking. It is not yet a post topic. A keyword appearing must not auto-promote into the post subject.",
    "JOBS: emit enough candidates for the needed post count and strategy; drop duplicates, low quality, and over-repeat; generate more if short until the inferred quota is filled. Store structured judgments only: topic, subtopic, why_now, creator relevance, audience relevance, evidence/context basis, exploration value. Do not store raw chain-of-thought.",
  ].join("\n");
}

export function seedInterpretationPhilosophyBlock(): string {
  return [
    "SEED INTERPRETATION: The same seed becomes a different post depending on what is fact, what is experience, and how far inference may go.",
    "This stage is not 'how should we say this'. It is 'what can actually be thought from this material'.",
    "JOBS: separate Fact / Observation / Personal Experience / Hypothesis / Opinion. Block exaggeration, fiction, and invented experience. Extract the explorable core question and tension inside the seed.",
  ].join("\n");
}

export function thinkingPhilosophyBlock(): string {
  return [
    "THINKING: Do not turn a seed into a familiar sentence. From one seed, explore several viewpoints, incentives, interests, time axes, and possible readings, then find the direction that actually means something.",
    "A Rail is an abstract path that helps that thinking. It is not a template that maps a topic to a rail.",
    "JOBS: structurally explore possible readings; compare viewpoints that fit how this creator thinks; filter forced readings and cheap reversals; emit Core Thought candidates.",
  ].join("\n");
}

export function coreThoughtPhilosophyBlock(): string {
  return [
    "CORE THOUGHT: Not a one-line summary of the post. It is the judgment this post actually wants to make.",
    "Do not pick it because it is new or because it might go viral. Ask: would this creator actually hold this judgment? Is there grounding? Does it mean something to a reader?",
    "JOBS: choose ONE central judgment from Thinking results. Mechanism, Rail, Style, and Writer must not damage it. Separate confidence in fact from confidence in opinion. HOLD a judgment that is not worth publishing.",
  ].join("\n");
}

export function audienceReactionPhilosophyBlock(): string {
  return [
    "AUDIENCE REACTION INTELLIGENCE: Not a 'will people like this' predictor. It understands what psychological reaction this post is likely to create in a reader.",
    "The goal is not to manipulate reaction. The goal is to see where delivery actually comes from.",
    "JOBS: assess self-projection, empathy, surprise, debate, reinterpretation, life-pattern recognition, evidence-grounded judgment, reply likelihood. Help Planner and Writer avoid over-explaining and forced reaction.",
  ].join("\n");
}

export function reactionMechanismPhilosophyBlock(): string {
  return [
    "REACTION MECHANISM: Surprise, Empathy, Evidence-Grounded Judgment, Life Pattern Exposure, NONE are not formulas for making a post. They describe how a reader may receive an already-decided Core Thought.",
    "A mechanism is not required. NONE is normal.",
    "JOBS: pick the reaction structure that is natural for this Core Thought and this post's character — or NONE. Avoid forced twist, forced question, forced emotion. Do not lock a topic to a mechanism.",
  ].join("\n");
}

export function topicDiversityPhilosophyBlock(): string {
  return [
    "TOPIC DIVERSITY / EXPLORATION: An account that only repeats currently-winning topics weakens over months. Random new topics also break identity.",
    "Expand from adjacent areas of existing interests. Validate by real reaction and long-term value.",
    "JOBS: track recent topic distribution and skew. Create Adjacent / Experimental exploration. Promote or drop by outcomes and repeat signals: Exploration → Emerging Interest → Secondary Interest → Core Interest. One published success does not promote. Need repeated follower / profile-visit / bookmark / meaningful-reply signals across analyze cycles.",
  ].join("\n");
}

export function weeklyEditorialPhilosophyBlock(): string {
  return [
    "WEEKLY EDITORIAL STRATEGY: The week is one editorial object, not 7 or 40 isolated posts.",
    "Opinion, experience, observation, exploration, technical, daily-life should not collapse to one side. Do not invent a forced quota to fake balance.",
    "JOBS: set this week's editorial balance from weekly goal, account growth stage, audience shift, recent outcomes, and topic diversity. Adjust each post's role and spacing. At week level, prevent the same structure, same emotion, and same conclusion in a row.",
  ].join("\n");
}

export function everydayLanguagePhilosophyBlock(): string {
  return [
    "EVERYDAY LANGUAGE: Lower the reader's entry barrier. Do not lower the depth of the thought.",
    "Swap hard words for immediately understood ones without losing accuracy. Easy must not mean shallow.",
    "JOBS: cut excess jargon, lecture tone, and AI abstractions. Prefer broader, immediately understood wording when it keeps the claim. No hardcoded word-substitution table. Meaning and context first.",
  ].join("\n");
}

export function creatorStylePhilosophyBlock(): string {
  return [
    "CREATOR STYLE: Not a 말투 set and not a persona. It is how Creator DNA shows up in actual sentences.",
    "Do not clone repeating surface habits. Preserve deeper traits: thought rhythm, sentence length, opinion strength, white space, way of observing.",
    "JOBS: fit rhythm, length, assertion level, white space, humor tone, and story unfolding to Creator DNA. Stop Writer from converging on average AI prose.",
  ].join("\n");
}

export function naturalHumorPhilosophyBlock(): string {
  return [
    "NATURAL HUMOR: Humor is this creator's natural reaction, not an engagement device.",
    "If the situation is serious, do not add humor. Do not force a punchline or ㅋㅋ to be funny.",
    "JOBS: when the context earns it, choose Mock-Formal Deadpan, Self-Deprecation, Pragmatic Oversharing, Observed Consequence, Wordplay, or Hidden Context — or NONE. Do not use humor that cuts down a relationship or attacks someone.",
  ].join("\n");
}

export function surfaceDiscoursePhilosophyBlock(): string {
  return [
    "SURFACE / DISCOURSE SHAPE: The same person does not need the same structure in every post.",
    "AI converges on observation → but → twist → reinterpret. Manage variety in how the post unfolds, not in swapped words.",
    "JOBS: vary hook, information order, unfold sequence, where the judgment sits, question use, narrative/observation/judgment mix, and ending type. Compare against recent posts this week and suppress structural repeat. Do not only blacklist conjunctions. Judge the whole unfold.",
  ].join("\n");
}

export function qualityPhilosophyBlock(): string {
  return [
    "QUALITY: Not an editor that makes prose smoother. The last defense: did this post preserve the intended thought and Creator identity? Is it fact-safe? Did it repeat?",
    "JOBS: check Core Thought preservation, Creator DNA fit, structural repeat, fact/experience boundary, excess AI voice, week-level duplicate, forced reader reaction. Do not stop at a soft warning when the post should REJECT or go to selective regeneration.",
  ].join("\n");
}

/** Planner + seed Grok: stages 6–13. */
export function planningStagePhilosophyBlock(): string {
  return [
    seedGenerationPhilosophyBlock(),
    seedInterpretationPhilosophyBlock(),
    thinkingPhilosophyBlock(),
    coreThoughtPhilosophyBlock(),
    audienceReactionPhilosophyBlock(),
    reactionMechanismPhilosophyBlock(),
    topicDiversityPhilosophyBlock(),
    weeklyEditorialPhilosophyBlock(),
  ].join("\n");
}

/** Writer ChatGPT: stages 14–17. Quality is Judge, not Writer. */
export function writingStagePhilosophyBlock(): string {
  return [
    everydayLanguagePhilosophyBlock(),
    creatorStylePhilosophyBlock(),
    naturalHumorPhilosophyBlock(),
    surfaceDiscoursePhilosophyBlock(),
    "QUALITY is the Judge's job, not yours. Do not smooth the post into average AI. Preserve Core Thought and Creator DNA.",
  ].join("\n");
}
