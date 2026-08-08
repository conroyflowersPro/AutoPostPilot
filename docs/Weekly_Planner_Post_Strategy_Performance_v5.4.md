# Weekly Planner / Post Strategy Refinement v5.4.2

**Project:** AutoPostPilot / @Seung4680  
**Date:** 2026-08-08  
**Status:** Implemented per Creator-approved ORDER

## Core loop (unchanged)

1. **WHAT** → Weekly Planner topic selection  
2. **HOW** → Post Strategy (hypothesis)  
3. **DID** → Real X / Fedica published metrics → Performance DNA  

Wild Card: Opportunity → **ACTION** → Claim Gate → Creator Voice Pass → suggestion

## v5.4.2 product changes

### 1. Diversity guardrail (soft, multi-signal)
- Still soft replace (~1 at coreShare≥55%, ~2 at ≥75%) — **not** hard quotas
- Narrowing also considers: angle similarity, writingApproach repetition, sequential same-cluster runs
- Prefer replacing the most similar core slots

### 2. Dynamic expansion (not fixed whitelist)
- EXPANSION_SEED_CANDIDATES are seeds for server soft-replace only
- Model may propose broader legitimate topics; CI answers "what can this Creator say", not "topic forbidden"

### 3. Authenticity + expansion
- Expansion does not require prior personal episode
- Observation / limited analysis / genuine question / attribution allowed
- Never invent experience

### 4. Creator Intent strength
- explicit_focus | preferred | open | absent
- Explicit core focus → soft guardrail relaxed
- Weak/absent Intent → protect breadth more actively

### 5. Performance learning confidence
- Progressive: observed → emerging → validated
- Single success is evidence, not a strong Planner weight
- strategyWinEntries with observation counts

### 6–7. Wild Card real loop
- FREE + GROWTH preserved
- Action selection returns requiresClaimGate / requiresCreatorVoicePass
- runClaimGate() blocks unsupported first-person experience claims
- Claim Gate + Creator Voice Pass are required on the generation path

### 8. Portfolio UI product language
- Prefer weeklyStrategy / "This Week's Strategy"
- Avoid framing as Creator identity (identityStatement kept only as legacy alias)
- Surface: weekly direction, Intent reflection, narrowing risk, portfolioAdjustment

### 9. Intentional whitespace
- Default remains 7-day planning
- Short observation Originals are legitimate
- No autonomous drop to 5-post weeks

### 10–17. Strategy lifetime (recency decay), evidence classification, CI independence preserved

## Files
- lib/planning/portfolio.ts
- lib/planning/types.ts
- lib/learning/types.ts, score.ts
- lib/wild/action-select.ts
- app/api/grok/plan/route.ts
