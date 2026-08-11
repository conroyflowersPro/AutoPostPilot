# ORDER 3 — Evidence-Based Seed Reasoning & Grounding Repair

**Status:** COMPLETE (code + offline tests)  
**Branch:** `order3-evidence-seed-reasoning`  
**Date:** 2026-08-11  
**xAI_API_USED:** NO

## Problems fixed

### §1 bootstrapCandidatesFromDimensions avoid-set bug
**Before (local full engine):** `avoid = Set(all publishedSubjects)` then loop same list → every candidate `continue`.  
**Main:** function returned `[]` entirely (no evidence reasoning).  
**After:** `emitted` only tracks seeds already produced this run; structured `publishedEvidence` rows preferred.

### §2 Raw published text ≠ Seed
Removed `concrete_subject: text.slice(0, 100)`.  
Seeds are derived via Evidence Packet → `reasonSeedSubjectFromPacket`.

### §3 Evidence Packet
New module: `supabase/functions/weekly-plan/evidence-packet.ts`  
Fields: source_ids, topic, entities, verified_locations, experience_facts, static_facts, current_facts, creator_opinion, relationship_edges, time_sensitivity, factual_anchors — **no sentence templates**.

### §4–6 Grounding
`runtime-grounding.ts`: location/entity must be in verified set; Korean location ≠ language; expanded CURRENT_CONTEXT signals (match day, price, software, policy).

### §7 Provenance chain
`compactSlot` now carries: source_type, source_id, evidence_source_ids, claim_types, inference_type, grounding_status, grounding_reasons, idea_angle_family, verified_*, relationship_evidence_ids, xai_would_have_been_required.

### §8–9 Reasoning / count
No unsupported seed invention to hit count. Diagnostics: `VALID_INTERNAL`, `SHORTFALL`, `XAI_WOULD_HAVE_BEEN_REQUIRED`. Thin anchors mark `xai_would_have_been_required` honestly without calling xAI.

## Offline tests
All passed (see tools/order3-selfcheck/offline.mjs).

## Live acceptance (Master Creator)
Requires recent 14d X Sync data in production after Edge deploy:
- raw post copy 0
- unsupported location/entity/cross-interest/experience 0
- provenance on slots
- natural daily topic distribution

## Known residual
- Live 14d acceptance not run in sandbox (no production credentials).
- Semantic angle quality still local-deterministic; richer synthesis remains `XAI_WOULD_HAVE_BEEN_REQUIRED` until explicit user-enabled batch reasoning.
- ORDER 2 Archive server query path is complementary; merge order2 branch if Archive EXPERIENCE fallback needed.
