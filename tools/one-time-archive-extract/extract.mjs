#!/usr/bin/env node
/**
 * AutoPostPilot — ONE-TIME Local X Archive Extractor
 * Run on Master Creator Windows PC only.
 * Does NOT upload 25GB. Does NOT build long-term ingestion.
 *
 * Usage:
 *   node extract.mjs --input "C:\\path\\to\\archive-or-data" --out ".\\output"
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  createReadStream,
} from "fs";
import { createInterface } from "readline";
import { join, basename, resolve } from "path";
import { parseArchiveJs } from "./js-parse.mjs";
import { fileIntegrity } from "./hash.mjs";

const PRIVACY_SKIP = [
  "direct-message",
  "direct_message",
  "dm-",
  "ip_audit",
  "phone",
  "email",
  "device-token",
  "device_token",
  "personalization",
  "contact",
  "grok-chat",
  "grok_chat",
  "mute",
  "block",
  "session",
];

const MEDIA_DIR_HINTS = ["media", "tweet_media", "tweets_media", "assets"];

const WANTED_HINTS = [
  "tweets",
  "tweet-headers",
  "tweet_headers",
  "note-tweet",
  "note_tweet",
  "deleted-tweet",
  "deleted_tweet",
  "article",
  "ads-revenue",
  "ad-revenue",
  "revenue",
  "community-tweet",
  "community_tweet",
  "community-note",
  "community_note",
  "follower",
  "following",
  "account-suspension",
  "suspension",
  "protected-history",
  "screen-name",
  "manifest",
  "like",
];

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

function walkJsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  const st = statSync(dir);
  if (st.isFile()) {
    if (dir.endsWith(".js") || dir.endsWith(".json")) out.push(dir);
    return out;
  }
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      const low = name.toLowerCase();
      if (MEDIA_DIR_HINTS.some((h) => low.includes(h))) continue;
      walkJsFiles(p, out);
    } else if (name.endsWith(".js") || name.endsWith(".json")) {
      out.push(p);
    }
  }
  return out;
}

function isPrivacyFile(path) {
  const b = basename(path).toLowerCase();
  return PRIVACY_SKIP.some((k) => b.includes(k));
}

function classifySource(path) {
  const b = basename(path).toLowerCase();
  if (b.includes("manifest")) return "manifest";
  if (b.includes("note-tweet") || b.includes("note_tweet")) return "note_tweet";
  if (b.includes("deleted") && b.includes("tweet")) return "deleted_tweet";
  if (b.includes("tweet-header") || b.includes("tweet_header"))
    return "tweet_headers";
  if (b.startsWith("tweets") || b === "tweet.js" || b.startsWith("tweet-part"))
    return "tweets";
  if (b.includes("article")) return "article";
  if (
    b.includes("revenue") ||
    b.includes("ads-revenue") ||
    b.includes("ad-revenue")
  )
    return "revenue";
  if (b.includes("community-note-rating") || b.includes("community_note_rating"))
    return "community_note_rating";
  if (b.includes("community-note") || b.includes("community_note"))
    return "community_note";
  if (b.includes("community-tweet") || b.includes("community_tweet"))
    return "community_tweet";
  if (b.includes("follower")) return "follower";
  if (b.includes("following")) return "following";
  if (b.includes("suspension")) return "suspension";
  if (b.includes("protected")) return "protected_history";
  if (b.includes("screen-name") || b.includes("screen_name"))
    return "screen_name_change";
  if (b.includes("like")) return "like";
  return "other";
}

function extractTweetId(entry) {
  if (!entry || typeof entry !== "object") return null;
  const t = entry.tweet || entry.noteTweet || entry;
  const id =
    t.id_str || t.id || t.tweetId || t.tweet_id || entry.id_str || entry.id;
  return id != null ? String(id) : null;
}

function classifyPostType(tweet) {
  if (!tweet) return "UNKNOWN";
  if (tweet.retweeted_status || tweet.retweeted_status_id_str) return "REPOST";
  if (tweet.in_reply_to_status_id_str || tweet.in_reply_to_user_id_str)
    return "REPLY";
  if (tweet.quoted_status_id_str || tweet.quoted_status) return "QUOTE";
  return "ORIGINAL";
}

function mediaMeta(tweet) {
  const media =
    tweet?.extended_entities?.media || tweet?.entities?.media || [];
  if (!Array.isArray(media) || media.length === 0) {
    return { media_present: false, media_type: [], media_count: 0 };
  }
  const types = [...new Set(media.map((m) => m.type || "unknown"))];
  return {
    media_present: true,
    media_type: types,
    media_count: media.length,
  };
}

function makeDatasetId() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `APP-ARCHIVE-ONE-TIME-${y}${m}${day}-${seq}`;
}

function toJsonl(rows) {
  if (!rows.length) return "";
  return rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

async function loadApiIds(apiPath) {
  const set = new Set();
  if (!apiPath || !existsSync(apiPath)) return set;
  const rl = createInterface({
    input: createReadStream(apiPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.x_post_id) set.add(String(o.x_post_id));
    } catch {
      /* skip */
    }
  }
  return set;
}

function progress(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  const input = arg("--input");
  const outDir = resolve(arg("--out", "./archive-one-time-output"));
  const apiExport = arg("--api-export", null);

  if (!input) {
    console.error(`
AutoPostPilot ONE-TIME Local X Archive Extractor

Usage:
  node extract.mjs --input "C:\\Users\\YOU\\Downloads\\twitter-archive" --out ".\\output"

  --input   Archive root OR data folder (required)
  --out     Output folder (default: ./archive-one-time-output)
  --api-export  Optional JSONL of API evidence for x_post_id reconcile

ONE-TIME TOOL. Does not upload archive. Does not start a server.
`);
    process.exit(1);
  }

  const inputPath = resolve(input);
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  let root = inputPath;
  const dataSub = join(inputPath, "data");
  if (existsSync(dataSub) && statSync(dataSub).isDirectory()) {
    root = dataSub;
    progress(`Using data folder: ${root}`);
  } else {
    progress(`Using input path: ${root}`);
  }

  mkdirSync(outDir, { recursive: true });
  const checkpointPath = join(outDir, "_checkpoint.json");

  const allJs = walkJsFiles(root);
  progress(`Found ${allJs.length} .js/.json files (media dirs skipped)`);

  const sources = [];
  for (const f of allJs) {
    if (isPrivacyFile(f)) continue;
    const kind = classifySource(f);
    if (kind === "other") {
      const b = basename(f).toLowerCase();
      if (!WANTED_HINTS.some((h) => b.includes(h))) continue;
    }
    sources.push({ path: f, kind });
  }

  progress(`Selected ${sources.length} source files after privacy filter`);

  const postsById = new Map();
  const noteByTweetId = new Map();
  const articles = [];
  const revenue = [];
  const accountEvents = [];
  const community = [];
  const followers = [];
  const following = [];
  let likeCount = 0;
  const sourceInventory = [];
  const warnings = [];
  const parseFailures = [];

  for (const src of sources) {
    progress(`Reading ${src.kind}: ${basename(src.path)}`);
    let raw;
    try {
      raw = readFileSync(src.path, "utf8");
    } catch (e) {
      parseFailures.push({ file: src.path, error: String(e.message || e) });
      continue;
    }

    if (src.kind === "manifest") {
      sourceInventory.push({
        file: basename(src.path),
        kind: "manifest",
        bytes: Buffer.byteLength(raw),
      });
      writeFileSync(
        join(outDir, "_archive_manifest_raw.js"),
        raw.slice(0, 500000)
      );
      continue;
    }

    let arr;
    try {
      arr = parseArchiveJs(raw);
    } catch (e) {
      try {
        arr = JSON.parse(raw);
        if (!Array.isArray(arr)) arr = [arr];
      } catch (e2) {
        parseFailures.push({
          file: src.path,
          error: String(e.message || e),
        });
        continue;
      }
    }

    sourceInventory.push({
      file: basename(src.path),
      kind: src.kind,
      records: arr.length,
      bytes: Buffer.byteLength(raw),
    });

    for (const entry of arr) {
      try {
        if (src.kind === "note_tweet") {
          const nt = entry.noteTweet || entry;
          const tid = String(nt.tweetId || nt.tweet_id || "");
          const text =
            nt.noteTweetResults?.text || nt.core?.text || nt.text || null;
          if (tid) noteByTweetId.set(tid, text);
          continue;
        }

        if (
          src.kind === "tweets" ||
          src.kind === "deleted_tweet" ||
          src.kind === "community_tweet"
        ) {
          const tweet = entry.tweet || entry;
          const id = extractTweetId(entry);
          if (!id) continue;
          const postType = classifyPostType(tweet);
          const text =
            tweet.full_text || tweet.text || tweet.body?.text || null;
          const created =
            tweet.created_at || tweet.createdAt || tweet.timestamp || null;
          const media = mediaMeta(tweet);
          const existing = postsById.get(id) || {};
          postsById.set(id, {
            ...existing,
            x_post_id: id,
            post_type: postType,
            text: existing.text || text,
            published_at: created
              ? new Date(created).toISOString()
              : existing.published_at || null,
            media,
            source_provenance: "X_ARCHIVE",
            layer: "NORMALIZED",
            creator_intent: "UNKNOWN",
            provenance_kind: "UNKNOWN",
            deleted: src.kind === "deleted_tweet" || existing.deleted || false,
            community: src.kind === "community_tweet",
            in_reply_to_status_id: tweet.in_reply_to_status_id_str || null,
            in_reply_to_user_id: tweet.in_reply_to_user_id_str || null,
            conversation_id: tweet.conversation_id_str || null,
            public_metrics: null,
            metric_note: "MISSING_FROM_ARCHIVE_OR_EXPORT_TIME_ONLY",
          });
          continue;
        }

        if (src.kind === "article") {
          articles.push({
            layer: "RAW",
            record: entry,
            source_file: basename(src.path),
          });
          continue;
        }

        if (src.kind === "revenue") {
          revenue.push({
            layer: "RAW",
            record: entry,
            source_file: basename(src.path),
            note: "payout-level only; no per-post revenue invented",
          });
          continue;
        }

        if (
          src.kind === "suspension" ||
          src.kind === "protected_history" ||
          src.kind === "screen_name_change"
        ) {
          accountEvents.push({
            event_kind: src.kind,
            layer: "RAW",
            record: entry,
            source_file: basename(src.path),
          });
          continue;
        }

        if (
          src.kind === "community_note" ||
          src.kind === "community_note_rating"
        ) {
          community.push({
            kind: src.kind,
            layer: "RAW",
            record: entry,
            source_file: basename(src.path),
          });
          continue;
        }

        if (src.kind === "follower") {
          followers.push(entry);
          continue;
        }
        if (src.kind === "following") {
          following.push(entry);
          continue;
        }
        if (src.kind === "like") {
          likeCount += 1;
          continue;
        }
      } catch (e) {
        warnings.push({
          file: basename(src.path),
          error: String(e.message || e),
        });
      }
    }

    writeFileSync(
      checkpointPath,
      JSON.stringify(
        {
          last_file: src.path,
          posts: postsById.size,
          notes: noteByTweetId.size,
          updated_at: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }

  for (const [tid, noteText] of noteByTweetId) {
    const p = postsById.get(tid);
    if (p) {
      p.text = noteText || p.text;
      p.extended_note = true;
    } else {
      postsById.set(tid, {
        x_post_id: tid,
        post_type: "ORIGINAL",
        text: noteText,
        published_at: null,
        media: { media_present: false, media_type: [], media_count: 0 },
        source_provenance: "X_ARCHIVE",
        layer: "NORMALIZED",
        creator_intent: "UNKNOWN",
        provenance_kind: "UNKNOWN",
        extended_note: true,
        public_metrics: null,
      });
    }
  }

  const apiIds = await loadApiIds(apiExport);
  let overlap = 0;
  let archiveOnly = 0;
  for (const [id, p] of postsById) {
    if (apiIds.has(id)) {
      overlap += 1;
      p.source_provenance = "X_ARCHIVE_AND_API";
    } else {
      archiveOnly += 1;
    }
  }
  const apiOnly = Math.max(0, apiIds.size - overlap);

  const allPosts = [...postsById.values()];
  const creator = allPosts.filter(
    (p) => p.post_type === "ORIGINAL" || p.post_type === "QUOTE"
  );
  const replies = allPosts.filter((p) => p.post_type === "REPLY");

  let earliest = null;
  let latest = null;
  for (const p of allPosts) {
    if (!p.published_at) continue;
    if (!earliest || p.published_at < earliest) earliest = p.published_at;
    if (!latest || p.published_at > latest) latest = p.published_at;
  }

  const frozen_at = new Date().toISOString();
  const dataset_id = makeDatasetId();

  const featureDefs = {
    version: "feature-definitions-v1",
    note: "Derived fields are not raw facts",
    creator_intent: ["UNKNOWN", "AI_DERIVED", "CREATOR_CONFIRMED"],
    provenance_kind: [
      "FIRSTHAND",
      "SECONDHAND",
      "INTERPRETATION_ONLY",
      "UNKNOWN",
    ],
    layer: ["RAW", "NORMALIZED", "DERIVED"],
  };

  const likeSummary = {
    raw_like_count: likeCount,
    note: "Raw likes not expanded; LIKE ≠ belief/endorsement",
    aggregates: null,
  };

  const relationship = {
    follower_count: followers.length,
    following_count: following.length,
    note: "Snapshot counts only",
    sample_following_ids: following.slice(0, 50),
    sample_follower_ids: followers.slice(0, 50),
  };

  const readme = `# AutoPostPilot X Archive One-Time Evidence

## Same Data Guarantee
Grok and ChatGPT MUST use this identical frozen package.

Verify dataset_id, frozen_at, counts, SHA-256 in 00_manifest.json.
Mismatch → CROSS_MODEL_COMPARISON_INVALID

## Rules
- missing ≠ 0
- AI consensus ≠ Validation
- No DNA / Planner mutation
- Master Creator decides after Cross Review

## Scope
ONE-TIME extraction. Not a recurring Archive system.
`;

  const files = {
    "01_creator_publishing.jsonl": toJsonl(creator),
    "02_replies.jsonl": toJsonl(replies),
    "03_relationship_context.jsonl": JSON.stringify(relationship, null, 2),
    "04_articles.jsonl": toJsonl(articles),
    "05_revenue.json": JSON.stringify(
      { records: revenue, note: "payout-level only" },
      null,
      2
    ),
    "06_account_events.jsonl": toJsonl(accountEvents),
    "07_community_authority.jsonl": toJsonl(community),
    "08_like_summary.json": JSON.stringify(likeSummary, null, 2),
    "09_feature_definitions.json": JSON.stringify(featureDefs, null, 2),
    "README_AI_ANALYSIS.md": readme,
  };

  const integrity = Object.entries(files).map(([fn, content]) =>
    fileIntegrity(fn, content)
  );

  const populations = {
    total_posts: allPosts.length,
    creator_publishing: creator.length,
    ORIGINAL: allPosts.filter((p) => p.post_type === "ORIGINAL").length,
    QUOTE: allPosts.filter((p) => p.post_type === "QUOTE").length,
    REPLY: replies.length,
    REPOST: allPosts.filter((p) => p.post_type === "REPOST").length,
    articles: articles.length,
    revenue_records: revenue.length,
    account_events: accountEvents.length,
    community_records: community.length,
    like_raw_count: likeCount,
    follower_snapshot: followers.length,
    following_snapshot: following.length,
  };

  const manifest = {
    dataset_id,
    export_version: "archive-one-time-v1",
    status: "FROZEN",
    created_at: frozen_at,
    frozen_at,
    archive_source: root,
    historical_range: { earliest, latest },
    populations,
    reconciliation: {
      api_export_provided: Boolean(apiExport),
      overlap_posts: overlap,
      archive_only_posts: archiveOnly,
      api_only_posts: apiOnly,
    },
    source_inventory: sourceInventory,
    privacy_excluded: PRIVACY_SKIP,
    media_policy: "binary media not extracted; metadata only",
    missing_metric_policy: "missing ≠ 0",
    learning_mutation: "FORBIDDEN",
    one_time: true,
    warnings: warnings.slice(0, 50),
    parse_failures: parseFailures,
    files: integrity,
    same_data_guarantee: {
      rule: "Grok and ChatGPT must receive identical frozen dataset",
      verify: ["dataset_id", "frozen_at", "row_counts", "sha256"],
    },
  };

  files["00_manifest.json"] = JSON.stringify(manifest, null, 2);
  manifest.files = [
    fileIntegrity("00_manifest.json", files["00_manifest.json"]),
    ...integrity,
  ];
  files["00_manifest.json"] = JSON.stringify(manifest, null, 2);

  for (const [fn, content] of Object.entries(files)) {
    writeFileSync(join(outDir, fn), content);
  }

  const report = {
    ok: true,
    dataset_id,
    frozen_at,
    outDir,
    populations,
    source_files: sourceInventory.length,
    parse_failures: parseFailures.length,
    package_files: Object.keys(files),
  };
  writeFileSync(join(outDir, "RUN_REPORT.json"), JSON.stringify(report, null, 2));

  progress("DONE");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nNext:\n1) Zip folder: ${outDir}\n2) Share that zip (NOT 25GB archive)\n3) Tell Grok: 이어서\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
