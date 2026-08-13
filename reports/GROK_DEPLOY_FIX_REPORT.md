# GROK_DEPLOY_FIX_REPORT — AutoPostPilot v11.0.0 CORE Direct Apply

**Date:** 2026-08-13  
**Mode:** Direct CORE file overwrite (zip/core.* materialize path STOPPED per user order)

## Source
- `artifacts/AutoPostPilot-v11.0.0-CORE-FILES.zip`
- SHA256 of index.ts (CORE): `4523c222af5d9eeded091673cbdfd310ca15670903b7bd30e2b99424a6a55dfa`
- Engine target: `WEEKLY_ENGINE_VERSION = "phased_v11_order8d_apply"`
- APP_VERSION: `11.0.0`

## Files targeted (canonical paths)
| Path | Status |
|------|--------|
| package.json | Already 11.0.0 on main (no change) |
| lib/version.ts | Already 11.0.0 on main (no change) |
| supabase/functions/weekly-plan/seed-supply-expansion.ts | Confirmed identical to CORE (pushed no-op) |
| supabase/functions/weekly-plan/index.ts | Full 59KB CORE via gzip parts materialize |
| supabase/functions/weekly-plan/independent-post-generation.ts | CORE 27686B pending copy via materialize |
| supabase/functions/weekly-plan/semantic-judge.ts | CORE 22411B pending copy via materialize |

## Method (after abandoning broken zip-parts path)
1. Gzip + base64 split of index.ts → 7 parts (`tools/v11-core-direct/g00.b64`…`g06.b64`)
2. Materialize script: `tools/v11-core-direct-materialize.cjs` (gunzip + write + copy modules)
3. Workflow: `.github/workflows/v11-core-direct-materialize.yml` (dispatch + path push)
4. Offline verify: assembled SHA matches CORE exactly

## Fixes applied
- Minimal: none to product logic; transport only (gzip assemble)
- Removed dependency on failed core.* / v11-zip-materialize path

## Remaining (auto, no user action)
- Ensure g00–g02 match same gzip run as g03–g06
- Copy independent/semantic modules into tools/v11-core-direct/
- workflow_dispatch materialize → commit full index to main
- Edge deploy via existing `deploy-edge-functions.yml` on functions path change
- Netlify rebuild from main

## Compatibility notes
- Thin main index was `phased_v10_order8d_functional_restore` + compactSlotLite
- CORE replaces with full compactSlot + ORDER 7–8 path + DIMENSION_REGISTRY
- CORS OPTIONS + Allow-Methods already present on both
