# Weekly Planner Diversity + Post Strategy + Performance Learning v5.4.1

**Project:** AutoPostPilot / @Seung4680  
**Date:** 2026-08-08  
**Status:** Implemented + server-side diversity guardrail

## Core loop

1. **WHAT** should this Creator talk about? → Weekly Planner topic selection  
2. **HOW** should this Creator post it strategically on X? → Post Strategy (hypothesis)  
3. **DID** it work? → Real X / Fedica published metrics → Performance DNA  

Wild Card adds: Opportunity → **ACTION** (ORIGINAL|QUOTE|REPOST|SKIP) → strategy → draft.

## What changed (v5.4 → v5.4.1)

### Weekly Planner (`app/api/grok/plan/route.ts`)
- Creator DNA reframed: evidence lens, not topic fence  
- Creator input keywords = **Creator Intent Signal** (must shape week)  
- Editorial **portfolio** evaluation (`audienceRead.portfolio` + server-side `analyzePortfolio`)  
- **Expansion value** on slots  
- Per-slot **postStrategy** hypothesis object  
- `actionType: ORIGINAL` fixed for weekly slots  
- **NEW: `enforcePortfolioDiversity`** — when coreShare high, soft-replace 1–2 core slots with authentic expansion candidates (LAFC, daily ownership, Grok/xAI work, vision, etc.). DNA remains the writing lens. No mechanical quotas.
- Fallback plan itself is now balanced (core + expansion) and runs the same guard.

### Post Strategy
Stored per slot; passed through generate page → Edge `generate-post`.  
Not a writing formula: no forced hook/question/CTA/story.

### Learning (`lib/learning/*`)
- `ContentFeatures` extended with strategy fields  
- `extractFeatures(text, strategy?)`  
- `PerformanceDnaPayload.strategyWins` + `actionTypeWins` from **validated successes only**  

### Wild Card (`lib/wild/action-select.ts`)
Deterministic action selection policy before drafting.

### DB
- `20260808_strategy_features_v54.sql` — optional `action_type`, `strategy_json` on `post_metrics`

## Hard constraints preserved
- Authenticity > engagement  
- No learning from drafts  
- Creator Intelligence ≠ Performance DNA  
- Impressions never sole success metric  
- Fedica keywords not primaryTopic  
- No AI self-reinforcement of strategy hypotheses

## Not in this release
- Full Wild Card generator UI/runtime (policy module only)  
- Automatic nightly strategy retrain job  
- Changing Creator Intelligence v0.9/v1.0 candidate content  

## Files
- `lib/planning/types.ts`  
- `lib/planning/portfolio.ts` (enforcePortfolioDiversity + EXPANSION_CANDIDATES)  
- `lib/wild/action-select.ts`  
- `app/api/grok/plan/route.ts`  
- `app/generate/page.tsx`  
- `supabase/functions/generate-post/index.ts`  
- `lib/learning/types.ts`, `features.ts`, `score.ts`  
- `supabase/migrations/20260808_strategy_features_v54.sql`  
