# ORDER 0B Manual Post Leakage Separation — COMPLETE

**Status: COMPLETE**  
**Branch:** `order0b-manual-leakage`  
**Netlify:** NOT deployed (per order)

## Tip verification
- `weekly-plan/index.ts` materialized with ORDER 0B expand/select guards
- APP_VERSION = `10.0.0-order0b`
- WEEKLY_ENGINE_VERSION = `phased_v10_order0b_manual_leakage`
- Diagnostics: `order0b_manual_leakage_separation: true`

## Modules on tip
| File | Role |
|------|------|
| source-roles.ts | SourceRole enum; isSeedEligibleRole; defaultRoleForAccountActivity |
| manual-leakage-guard.ts | semantic + surface + eventClaimClusterScore |
| experience-evidence.ts | abstract subject only; seed_eligible default false; CREATOR_LEARNING_SIGNAL |
| seed-engine.ts | no ACCOUNT_ACTIVITY auto-SEED; DIMENSION_REGISTRY abstract SEED_SOURCE |
| evidence-packet.ts | abstract fact labels for ACCOUNT_ACTIVITY (no narrative anchors) |
| index.ts | expand + select leakage filter; seed_eligible gate; no auto-unshift manuals |

## Acceptance tests
`node tools/order0b-manual-leakage-test.mjs` → **24 passed, 0 failed** (A–G + file + bootstrap + experience + index + evidence-packet).

## Root cause closed
Manual `text_body` → `body.slice` → concrete_subject → pool.unshift **blocked**.  
Bootstrap no longer emits ACCOUNT_ACTIVITY rows as SEED_SOURCE.

## Preserved
- ORDER 0A dynamic target / count recovery
- Creator / Performance learning signals (non-seed roles)
- No narrative/wording reuse of recent manuals as seeds
