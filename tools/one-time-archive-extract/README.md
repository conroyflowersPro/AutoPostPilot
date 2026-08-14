# AutoPostPilot — One-Time Local X Archive Extractor

**ONE-TIME TOOL.** Run once on Master Creator Windows PC. Not a server service.

## What it does

- Reads your local X Archive (root or `data` folder)
- Auto-finds needed `.js` files
- Skips media binaries and private data (DM, keys, etc.)
- Builds one **Frozen** evidence package for Grok + ChatGPT (same files)

## Requirements

- Windows PC where the ~25GB archive already exists
- [Node.js 18+](https://nodejs.org/) installed

## Run (once)

```bat
cd tools\one-time-archive-extract
node extract.mjs --input "C:\Users\YOURNAME\Downloads\twitter-YYYY-MM-DD-xxxxx" --out ".\output"
```

Or point at the `data` folder:

```bat
node extract.mjs --input "C:\Users\YOURNAME\Downloads\twitter-...\data" --out ".\output"
```

## Output

Folder `output` contains:

- `00_manifest.json` (dataset_id, hashes, counts)
- `01_creator_publishing.jsonl` …
- `README_AI_ANALYSIS.md`
- `RUN_REPORT.json`

Zip **that output folder only** and share it.
**Do not upload the original 25GB archive.**

## After extract: experience ledger (v11)

Archive is **not** 말투 training. Convert lived episodes only:

```bat
node to-experience-ledger.mjs --input ".\output" --out ".\experience-ledger.json"
```

Zip `experience-ledger.json` (small) and give it to the agent. It replaces `supabase/functions/weekly-plan/experience-ledger.json`. Until that file is non-empty, EXPERIENCE seeds fail closed.

## After analysis

This tool is done. No scheduled re-run. No long-term Archive system.
