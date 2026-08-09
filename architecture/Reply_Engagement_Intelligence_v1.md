# Reply & Engagement Intelligence System v1

Version: 6.2.0  
Status: Implemented

## Workflows

### A. Daily Engagement Recommendations
- Location: `/today` → Today's Engagement
- Default source: Shared Current Context (LOCAL / STORED)
- Page load: **0** paid/external API calls
- Explicit actions: 「오늘 Engagement 찾기」, 「현재 X 문맥 불러오기」

### B. Manual Reply Assistance
- Location: `/today/reply`
- Paste URL → no API until 「API로 댓글 읽기」
- Direct text mode (paste comment) → no X API required
- 「답글 제안」 / 「내 답글 다듬기」 → explicit XAI consent
- Copy only — **no auto-publish**

## Global API Consent
- `lib/api-consent` — `requireExplicitApiConsent`
- Per-action approval; no permanent global auto-approve
- Audit: feature, action, timestamp, service, purpose, user_initiated=true

## Reply DNA
- `lib/reply/dna.ts` — social/reply patterns from Historical Learning
- Publishing DNA not applied to replies
- AI suggestions ≠ Creator evidence

## Shared Current Context
- Event phases drive zero-cost opportunity cards
- LAFC PRE/LIVE/POST angles supported when event context exists

## Tests (design)
| ID | Expectation |
|----|-------------|
| A | Daily load paid API = 0 |
| C | URL paste paid API = 0 |
| D | Fetch only after button |
| H | Auto publish = 0 |
| J | AI suggestion not stored as Creator evidence |
