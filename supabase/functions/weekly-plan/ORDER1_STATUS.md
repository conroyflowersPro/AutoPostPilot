# ORDER 1 — Independent Seed Interpretation Layer

Status: COMPLETE (wired + tested)

## Layer
`supabase/functions/weekly-plan/seed-interpretation.ts`

## Production wiring
`supabase/functions/weekly-plan/index.ts`
- import interpretSeed / isInterpretationPassable / isInterpretationBlocked
- interpretConcreteSeed helper
- compactSlot attaches `seed_interpretation` + `interpretation_status`
- select path: INTERPRETATION_BLOCKED skips slot (does not enter Content Queue)
- diagnostics: `order1_seed_interpretation: true`, interpretation_ok/weak/blocked counts
- APP_VERSION = 10.0.0-order1
- WEEKLY_ENGINE_VERSION = phased_v10_order1_seed_interpretation

## Flow
Seed → interpretSeed (multiple candidates) → select OK/WEAK/BLOCKED → compactSlot attaches seed_interpretation

## Not decided here
Reaction mechanism, Thinking Rail, Style, Humor, Final writing

## Preserved
ORDER 0A count recovery markers, ORDER 0B manual leakage separation

## Tests
`node tools/order1-seed-interpretation-test.mjs` — A–I ALL PASS
`node tools/order0b-manual-leakage-test.mjs` — regression ALL PASS
