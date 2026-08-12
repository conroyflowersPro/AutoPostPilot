# ORDER 1 — Independent Seed Interpretation Layer

Status: MODULE + TESTS ON REMOTE; INDEX FULL BODY IN ARTIFACTS PACK

## Layer
`supabase/functions/weekly-plan/seed-interpretation.ts` — ON REMOTE

## Production wiring (full body)
**Source of Truth (full index.ts):** `artifacts/ORDER1_INDEX_PRODUCTION.ts`
**Pack:** `artifacts/AutoPostPilot-ORDER1-seed-interpretation.zip`

Remote `index.ts` must be restored from that SOT (previous MCP payload truncations left a thin/broken tip).

Wiring contract in full body:
- import interpretSeed / isInterpretationPassable / isInterpretationBlocked
- interpretConcreteSeed helper
- compactSlot attaches `seed_interpretation` + `interpretation_status`
- select path: INTERPRETATION_BLOCKED skips slot
- diagnostics: `order1_seed_interpretation: true`
- APP_VERSION = 10.0.0-order1
- WEEKLY_ENGINE_VERSION = phased_v10_order1_seed_interpretation
- ORDER 0B seed_eligible gate preserved

## Flow
Seed → interpretSeed (multiple candidates) → select OK/WEAK/BLOCKED → compactSlot attaches seed_interpretation

## Not decided here
Reaction mechanism, Thinking Rail, Style, Humor, Final writing

## Preserved
ORDER 0A count recovery markers, ORDER 0B manual leakage separation

## Tests
`node tools/order1-seed-interpretation-test.mjs` — A–I ALL PASS (on full body)
`node tools/order0b-manual-leakage-test.mjs` — regression ALL PASS (on full body)

## Remote tip action required
Replace `supabase/functions/weekly-plan/index.ts` on branch `order1-seed-interpretation` with contents of `artifacts/ORDER1_INDEX_PRODUCTION.ts` (sha256 c52b891d3fc9cd49c7d0bcc1cd6211b990334980c14f07521ee0ba25f2bec0a8).
