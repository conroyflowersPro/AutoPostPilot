# ORDER 2 — Reader Self-Projection + Reaction Mechanisms

Branch: order2-reader-mechanism
Base: order1-seed-interpretation (b1020a96)

## Modules
- reaction-mechanisms.ts — 9 structured definitions (no topic mapping)
- reader-self-projection.ts — self-projection reasoning + multi-candidate selection

## Pipeline
Seed → Interpretation (ORDER1) → Self-Projection + Mechanism (ORDER2) → (later Rail/Style/Writing)

## Guarantees
- selected_mechanism may be NONE
- question_required default false
- style_decision / thinking_rail_decision always null here
- ORDER 0B leakage preserved
- ORDER 1 interpretation not overwritten

## Tests
order2-reader-mechanism-test.mjs — ALL PASS
order0b-manual-leakage-test.mjs — 24/24 PASS
order1 structural (version string bump expected FAIL only)

## Deploy
Netlify: NOT deployed
