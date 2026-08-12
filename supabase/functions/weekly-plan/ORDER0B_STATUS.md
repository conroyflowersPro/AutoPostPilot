# ORDER 0B Manual Post Leakage Separation

## Pushed
- source-roles.ts
- manual-leakage-guard.ts (semantic/surface/reply + event-claim clusters)
- experience-evidence.ts (abstract subjects; seed_eligible=false default)

## Local (next commits)
- seed-engine.ts: ACCOUNT_ACTIVITY learning-only; DIMENSION_REGISTRY abstract SEED_SOURCE
- evidence-packet.ts: abstract fact labels for ACCOUNT_ACTIVITY
- index.ts: guard imports + select seed_eligible gate

## Root cause (FSD)
Manual text_body → extractExperienceMaterial body.slice → concrete_subject → pool.unshift HIGH_VALUE
+ bootstrapCandidatesFromDimensions publishedEvidence row → seed

## Tests
A–G acceptance logic PASS (local harness).
Netlify: NOT deployed.
