import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidePublicWindowAfterEmptyRound } from "../supabase/functions/weekly-plan/generation-job.ts";
import {
  abstractPublicDirection,
  buildXSearchTool,
  capSameClusterDirections,
  directionSeedsFromOfficialPosts,
  normalizeSeedDetailed,
} from "../supabase/functions/weekly-plan/creator-seed-reasoning.ts";
import { isClusterLabelSubject, isTweetProseSubject } from "../supabase/functions/weekly-plan/seed-scope.ts";
import { officialSearchQuery, publicQuerySlice } from "../supabase/functions/weekly-plan/public-x-seed-search.ts";
import { APP_VERSION, VERSION_SUMMARY_KO } from "../lib/version.ts";

const reasoning = readFileSync("supabase/functions/weekly-plan/creator-seed-reasoning.ts", "utf8");
const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
const search = readFileSync("supabase/functions/weekly-plan/public-x-seed-search.ts", "utf8");

assert.equal(APP_VERSION, "12.12.21");
assert.match(VERSION_SUMMARY_KO, /공개 추출은 계속됩니다/);
assert.match(VERSION_SUMMARY_KO, /방향/);
assert.match(VERSION_SUMMARY_KO, /Agent승/);
assert.match(VERSION_SUMMARY_KO, /원문/);

assert.match(reasoning, /tools: \[xSearchTool\]/);
assert.doesNotMatch(reasoning, /compact \? \{\} : \{ tools/);
assert.doesNotMatch(reasoning, /Zero new seeds is allowed when nothing new remains/);
assert.doesNotMatch(reasoning, /Zero is allowed\./);
assert.match(reasoning, /Zero is not success on this pass/);
assert.match(reasoning, /this_round_query/);
assert.match(reasoning, /x_search_query_slices/);
assert.match(job, /searchSliceIndex: sliceIndex/);
assert.match(job, /decidePublicWindowAfterEmptyRound/);
assert.match(search, /officialSearchQuery/);
assert.match(search, /refresh_token/);

const firstEmpty = decidePublicWindowAfterEmptyRound({
  rawReturned: 0,
  emptySearchAttempts: 1,
  officialMaterialLeft: false,
  budgetRemaining: 20,
  transientXai: false,
});
assert.equal(firstEmpty, "retry_slice");

const secondEmpty = decidePublicWindowAfterEmptyRound({
  rawReturned: 0,
  emptySearchAttempts: 2,
  officialMaterialLeft: false,
  budgetRemaining: 20,
  transientXai: false,
});
assert.equal(secondEmpty, "retry_slice");

const thirdEmpty = decidePublicWindowAfterEmptyRound({
  rawReturned: 0,
  emptySearchAttempts: 3,
  officialMaterialLeft: false,
  budgetRemaining: 20,
  transientXai: false,
});
assert.equal(thirdEmpty, "close_exhausted");

assert.equal(decidePublicWindowAfterEmptyRound({
  rawReturned: 0,
  emptySearchAttempts: 1,
  officialMaterialLeft: false,
  budgetRemaining: 20,
  transientXai: true,
}), "hold");

assert.equal(decidePublicWindowAfterEmptyRound({
  rawReturned: 0,
  emptySearchAttempts: 8,
  officialMaterialLeft: false,
  budgetRemaining: 0,
  transientXai: false,
}), "close_budget");

assert.equal(decidePublicWindowAfterEmptyRound({
  rawReturned: 0,
  emptySearchAttempts: 3,
  officialMaterialLeft: true,
  budgetRemaining: 12,
  transientXai: false,
}), "retry_slice");

const compactTool = buildXSearchTool({
  excludeHandle: "Seung4680",
  window: { from: "2026-08-12", to: "2026-08-19" },
});
assert.equal(compactTool.type, "x_search");
assert.deepEqual(compactTool.excluded_x_handles, ["Seung4680"]);
assert.equal(compactTool.from_date, "2026-08-12");
assert.ok(publicQuerySlice(0).includes("충전") || publicQuerySlice(0).includes("FSD") || publicQuerySlice(0).includes("그록"));
assert.match(officialSearchQuery(0), /lang:ko/);
assert.match(officialSearchQuery(0), /충전|FSD|주차|테슬라|그록|알림|직관/);
assert.doesNotMatch(officialSearchQuery(0), /lang:ko$/);

const official = directionSeedsFromOfficialPosts([
  {
    id: "111",
    text: "어제 밤 FSD 켜고 가다가 보행자가 갑자기 튀어나와서 급제동했는데 진짜 아찔했음. 야간이라 더 무서웠다.",
    replies: 24,
  },
  {
    id: "222",
    text: "슈퍼차저에서 앞에 차 두 대가 삼십 분째 안 움직이는데 이게 맞는지 모르겠다. 대기줄만 길어짐.",
    replies: 30,
  },
]);
assert.ok(official.length >= 1, "official posts should become direction seeds when Grok returns []");
for (const seed of official) {
  assert.ok(seed.concrete_subject.length < 80, seed.concrete_subject);
  assert.doesNotMatch(seed.concrete_subject, /실사용\s*후속/);
  assert.notEqual(seed.concrete_subject, official[0] && "");
  assert.ok(!/급제동했는데 진짜 아찔했음/.test(seed.concrete_subject));
  assert.ok(!(seed.allowed_facts || []).some((f) => /급제동했는데/.test(String(f))));
}

const chargingTweet =
  "슈퍼차저에서 앞에 차 두 대가 삼십 분째 안 움직이는데 이게 맞는지 모르겠다. 대기줄만 길어짐.";
const direction = abstractPublicDirection(chargingTweet);
assert.ok(direction);
assert.notEqual(direction, chargingTweet);
assert.ok(direction.length < chargingTweet.length);
assert.doesNotMatch(direction, /실사용\s*후속/);

assert.equal(normalizeSeedDetailed({ situation: "FSD 실사용 후속" }, 0).seed, null);
assert.equal(normalizeSeedDetailed({ situation: "DAILY 실사용 후속" }, 0).reason, "SLOT_LABEL_BODY");
assert.equal(normalizeSeedDetailed({ situation: "관찰 축" }, 0).seed, null);
assert.equal(normalizeSeedDetailed({ situation: "실사용 후속" }, 0).seed, null);
assert.ok(isClusterLabelSubject("FSD 실사용 후속"));
assert.ok(isClusterLabelSubject("DAILY 실사용 후속"));
assert.ok(isClusterLabelSubject("관찰 축"));

const tweetCopy = normalizeSeedDetailed({
  situation: "어제 밤 FSD 켜고 가다가 보행자가 갑자기 튀어나와서 급제동했는데 진짜 아찔했음 야간이라 더 무서웠다 https://x.com/a/status/1",
}, 0);
assert.equal(tweetCopy.seed, null);
assert.equal(tweetCopy.reason, "TWEET_PROSE_BODY");
assert.ok(isTweetProseSubject(tweetCopy.reason === "TWEET_PROSE_BODY"
  ? "어제 밤 FSD 켜고 가다가 보행자가 갑자기 튀어나와서 급제동했는데 진짜 아찔했음 야간이라 더 무서웠다 https://x.com/a/status/1"
  : ""));

const ok = normalizeSeedDetailed({
  situation: "야간 보행자 급등장 장면이 돌고 있음",
  observation_or_feeling: "공개 장면이 돌고 있음",
  source_id: "111",
}, 0);
assert.ok(ok.seed);
assert.equal(ok.seed?.concrete_subject, "야간 보행자 급등장 장면이 돌고 있음");

const flooded = capSameClusterDirections(
  Array.from({ length: 8 }, (_, i) => ({
    seed_id: `s${i}`,
    cluster: "FSD",
    dimension: "PUBLIC_SCENE",
    concrete_subject: `FSD 판단 장면 ${i}이 돌고 있음`,
    subject_signature: `fsd ${i}`,
  })),
  [],
);
assert.ok(flooded.length <= 4);

console.log("public-seed-extraction-direction ok", {
  firstEmpty,
  officialDirections: official.map((s) => s.concrete_subject),
  version: APP_VERSION,
});
