# ORDER 7A — Deep Generation Architecture Foundation

Status: COMPLETE (module + tests; index materialize required for full SOT)

- Branch: order7a-deep-generation-context
- Module: supabase/functions/weekly-plan/deep-generation-context.ts (live on branch)
- Core Thought: structured (primary_claim / judgment / tension / implication), seed-derived, not prose
- Pipeline: Style → Humor → buildCoreThought → buildDeepGenerationContext → downstream
- APP: 10.0.0-order7a
- Engine: phased_v10_order7a_deep_generation
- Per-post isolation; batch transport ≠ shared reasoning
- Generator consumes upstream decisions (no re-decide)
- Tests: tools/order7a-deep-generation-test.mjs — 52/52 PASS (with wired index)
- Index: use `node tools/order7a-materialize-index.mjs` after parts are complete, OR merge patched index
- Netlify: NOT deployed
- ORDER 7B: NOT started
