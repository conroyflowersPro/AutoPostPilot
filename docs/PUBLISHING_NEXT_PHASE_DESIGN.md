# AutoPostPilot Publishing Next-Phase Design (no implementation)

Status: design only — no migrations in v4.5.6  
Date: 2026-08-07

## Layer Boundaries

| Layer | Owns | Must not own |
|-------|------|----------------|
| Intelligence | DNA models, Planner, editorial strategy | Fedica calls, binary media processing |
| Media | upload, validate, analyze, edit, render | post text strategy, DNA learning |
| Publishing | schedule, provider, retry, job state | topic selection |
| Analytics/Learning | published metrics, DNA updates | live schedule execution |

Publishing failures must never write into Planner Memory / DNA tables.

## publish_jobs (future)

- id, post_id, provider, status
- idempotency_key UNIQUE
- attempt_count, last_error, provider_job_id
- scheduled_at, started_at, completed_at, created_at, updated_at

Status: queued | processing | completed | failed | retrying | cancelled

Worker: insert job (conflict=return) → processing → ScheduleService → completed/failed

## publish_attempts (future)

- id, publish_job_id, attempt_number, stage
- started_at, finished_at, success
- error_code, error_message, provider_response_id

## media_assets (future)

- id, post_id, type, original_url, processed_url, thumbnail_url
- mime_type, file_size, duration, width, height, codec, frame_rate, aspect_ratio
- status: uploaded | validating | analyzing | editing | rendering | ready | failed
- metadata jsonb

Scheduler accepts only status=ready.

## Queue introduction triggers

Start Queue/Worker when any of:
- AI video editing
- FFmpeg render required
- median media processing tens of seconds+
- 20+ posts normal batch
- automatic multi-attempt retry needed
- work must continue without browser request

Until then: thin API + ScheduleService + batch chunk size 3.

## Crash window residual

Fedica success before DB fedica_post_id write.
v4.5.6 mitigates with immediate minimal success write.
Full idempotency needs publish_jobs unique key.

## Product priority

Core value = Intelligence Layer + growth learning.
Publishing = reliably hand content to a provider.
