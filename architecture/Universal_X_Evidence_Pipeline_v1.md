# Universal X Evidence Pipeline v1

## Philosophy
ONE CREATOR → ONE CANONICAL EVIDENCE BASE → ONE FROZEN DATASET → TWO INDEPENDENT ANALYSES → ONE MASTER CREATOR DECISION

## Runtime
- Netlify limit ~26s → batch budget 16s
- POST /api/evidence/universal/start → 202 + job_id (no 25GB wait)
- POST /api/evidence/universal/tick → one batch
- GET /api/evidence/universal/status?job_id=

## Freeze
- dataset_id APP-EVIDENCE-YYYYMMDD-NNN
- status FROZEN immutable for that id
- SHA-256 per file in 00_manifest.json

## Modes
- API_ONLY: implemented (tick freezes package from account_activities)
- ARCHIVE_ONLY / API_AND_ARCHIVE: selective part upload required; never full ZIP in function RAM

## Migration
supabase/20260808_universal_evidence_jobs_v1.sql

## Analysis safety
No DNA / Planner / Success Memory mutation during export or independent review.
