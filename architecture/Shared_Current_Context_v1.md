# Shared Current Context v1

## Purpose
Planner and Manual Composer read the **same** situational model so they do not invent separate worlds.

## Location
- `lib/context/types.ts`
- `lib/context/known-events.ts` (phase windows, angles, media hints)
- `lib/context/build-shared-context.ts` (builder)
- `lib/context/scenarios.ts` (offline scenario checks)
- `app/api/context/current/route.ts`

## Consumers
- `app/api/grok/plan/route.ts` — injects `prompt_block` before topic selection
- `app/api/grok/transform/route.ts` — Manual Composer priority + same context
- `app/today/write/page.tsx` — optional indicator chips

## Not Creator DNA
Current Context is temporal. X topic trends are never written into Creator DNA here.

## Event phases
UPCOMING → PRE_EVENT → LIVE → POST_EVENT → RECENT

## Manual priority
1 User Immediate Input  
2 Current Event Context  
3 Creator DNA  
4 Current X Context  
5 Planner Context
