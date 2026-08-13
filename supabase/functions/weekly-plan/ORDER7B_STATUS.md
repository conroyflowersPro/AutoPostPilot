# ORDER 7B — Independent Per-Post Generation

Status: COMPLETE

- Branch: order7b-independent-per-post-generation
- Tip: fb7b72bf451d430d3c69c8ed551c0932fad23da1
- Module: independent-post-generation.ts (20372 bytes)
- Index wired: generateIndependentPost after DeepGenerationContext (dry_run in select)
- APP: 10.0.0-order7b
- Engine: phased_v10_order7b_independent_generation
- Per-post isolation; batch transport ≠ shared reasoning
- Constraint-only instructions (no finished examples)
- Tests: tools/order7b-independent-generation-test.mjs — 52/52 PASS
- Netlify: NOT deployed
- ORDER 7C: NOT started
