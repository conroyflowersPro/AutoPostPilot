# ORDER 7B — Independent Per-Post Generation

Status: COMPLETE

- Branch: order7b-independent-per-post-generation
- Module: independent-post-generation.ts
- Writer: generateIndependentPost(DeepGenerationContext) → IndependentPostResult
- Per-post isolation; batch transport ≠ shared reasoning
- APP: 10.0.0-order7b
- Engine: phased_v10_order7b_independent_generation
- dry_run in weekly-plan select (no silent slot drop)
- Constraint-only instructions (no finished examples)
- Tests: tools/order7b-independent-generation-test.mjs
- Netlify: NOT deployed
- ORDER 7C: NOT started
