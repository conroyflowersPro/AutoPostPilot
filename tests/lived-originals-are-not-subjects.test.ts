import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION, VERSION_SUMMARY_KO } from "../lib/version.ts";
import { analyticsLivedSeeds, syncGapLivedSeeds } from "../supabase/functions/weekly-plan/analytics-lived-seeds.ts";
import { abstractLivedSubject } from "../supabase/functions/weekly-plan/seed-ownership.ts";
import {
  abstractPublicDirection,
  directionSeedsFromOfficialPosts,
  normalizeSeedDetailed,
} from "../supabase/functions/weekly-plan/creator-seed-reasoning.ts";
import {
  bundledOperatorOpenings,
  bundledOperatorOriginals,
  nearlyCopiesOpening,
  subjectCopiesOperatorOriginal,
} from "../supabase/functions/weekly-plan/operator-original-guard.ts";

const FORBIDDEN = ["써니 핀", "유성들", "퍼와서", "SpaceX 로켓", "Grok language detection", "language detection"];

assert.equal(APP_VERSION, "12.12.23");
assert.match(VERSION_SUMMARY_KO, /11·15·19/);
assert.match(VERSION_SUMMARY_KO, /하루 3개/);
assert.match(VERSION_SUMMARY_KO, /4시간/);

const openings = bundledOperatorOpenings();
assert.ok(openings.some((o) => /써니\s*핀|선착순/.test(o)), "bundled should include 써니 핀 opening");
assert.ok(openings.some((o) => /유성/.test(o)), "bundled should include 유성 opening");
assert.ok(openings.some((o) => /퍼와서/.test(o)), "bundled should include 퍼와서 opening");
assert.ok(openings.some((o) => /SpaceX|로켓/.test(o)), "bundled should include SpaceX 로켓 opening");
assert.ok(openings.some((o) => /language detection/i.test(o)), "bundled should include Grok language detection opening");

const originals = bundledOperatorOriginals();
assert.ok(subjectCopiesOperatorOriginal("선착순 15,000 명에게 써니 핀 지급!!!", originals));
assert.ok(subjectCopiesOperatorOriginal("한 낮에도 유성들을 볼 수 있다니", originals));
assert.ok(subjectCopiesOperatorOriginal("남 거 퍼와서 수익 내던 사람들", originals));
assert.ok(subjectCopiesOperatorOriginal("SpaceX 로켓과 Tesla 자동차는 전혀 다른 물건인데", originals));
assert.ok(subjectCopiesOperatorOriginal("Grok has automatic language detection that just works", originals));
assert.equal(subjectCopiesOperatorOriginal("야간 보행자 장면에서의 판단", originals), false);
assert.equal(nearlyCopiesOpening("일상 AI 사용 장면에서의 판단", "Grok has automatic language detection that just works."), false);

const livedSamples = [
  "선착순 15,000 명에게 써니 핀 지급!!! 가즈아",
  "한 낮에도 유성들을 볼 수 있다니! 페르세우스 자리에 유성우가 왜 쏟아지는거니?",
  "한마디로, “남 거 퍼와서 수익 내던 사람들”을 걸러내고, 진짜 자기 콘텐츠 만드는 크리에이터 위주로 돈을 주겠다는 정책 변경",
  "SpaceX 로켓과 Tesla 자동차는 전혀 다른 물건인데 보다보면 닮은 부분 있습니다.",
  "Grok has automatic language detection that just works. Korean, English, Spanish, Japanese — it detects the user’s language.",
];
for (const body of livedSamples) {
  const subject = abstractLivedSubject(body, "");
  assert.ok(subject.length >= 8, body);
  for (const phrase of FORBIDDEN) {
    assert.ok(!subject.toLowerCase().includes(phrase.toLowerCase()), `${subject} copies ${phrase}`);
  }
  assert.equal(subjectCopiesOperatorOriginal(subject, [body, ...originals]), false, subject);
  assert.notEqual(subject, body);
}

const packets = analyticsLivedSeeds({ limit: 80 });
assert.ok(packets.length > 0);
for (const seed of packets) {
  const subject = String(seed.concrete_subject || "");
  for (const phrase of FORBIDDEN) {
    assert.ok(!subject.toLowerCase().includes(phrase.toLowerCase()), `lived subject copies ${phrase}: ${subject}`);
  }
  assert.equal(subjectCopiesOperatorOriginal(subject, originals), false, subject);
  for (const open of openings) {
    assert.equal(nearlyCopiesOpening(subject, open), false, `${subject} ≈ ${open}`);
  }
  assert.ok(Array.isArray((seed as any).experience_facts));
  assert.ok(((seed as any).experience_facts as string[]).length > 0);
  assert.doesNotMatch(subject, /실사용\s*후속/);
}

const facts = packets.flatMap((s) => ((s as any).experience_facts as string[]) || []);
assert.ok(facts.some((f) => /써니|선착순|유성|퍼와서|SpaceX|language detection/i.test(f)), "facts keep original grounding");

const gap = syncGapLivedSeeds({
  rows: livedSamples.map((text, i) => ({
    x_post_id: `sync-${i}`,
    text_body: text,
    published_at: "2026-08-18T00:00:00.000Z",
    action_type: "ORIGINAL",
  })),
  analyticsPostIds: new Set(),
});
for (const seed of gap) {
  const subject = String(seed.concrete_subject || "");
  for (const phrase of FORBIDDEN) {
    assert.ok(!subject.toLowerCase().includes(phrase.toLowerCase()), `sync subject copies ${phrase}: ${subject}`);
  }
}

for (const body of livedSamples) {
  const direction = abstractPublicDirection(body);
  if (direction) {
    for (const phrase of FORBIDDEN) {
      assert.ok(!direction.toLowerCase().includes(phrase.toLowerCase()), `public direction copies ${phrase}: ${direction}`);
    }
    assert.equal(subjectCopiesOperatorOriginal(direction, originals), false, direction);
  }
  const copied = normalizeSeedDetailed({ situation: body }, 0);
  assert.equal(copied.seed, null);
  assert.ok(copied.reason === "OPERATOR_ORIGINAL_COPY" || copied.reason === "TWEET_PROSE_BODY");
}

const official = directionSeedsFromOfficialPosts(
  livedSamples.map((text, i) => ({ id: `op-${i}`, text, replies: 24 })),
);
for (const seed of official) {
  const subject = String(seed.concrete_subject || "");
  for (const phrase of FORBIDDEN) {
    assert.ok(!subject.toLowerCase().includes(phrase.toLowerCase()), `official subject copies ${phrase}: ${subject}`);
  }
}

const job = readFileSync("supabase/functions/weekly-plan/generation-job.ts", "utf8");
const livedSrc = readFileSync("supabase/functions/weekly-plan/analytics-lived-seeds.ts", "utf8");
const own = readFileSync("supabase/functions/weekly-plan/seed-ownership.ts", "utf8");
assert.match(job, /OPERATOR_ORIGINAL_COPY/);
assert.match(job, /excludeHandle: OPERATOR_HANDLE/);
assert.match(livedSrc, /LIVED_DIRECTION_TENSION/);
assert.match(own, /Never store the original sentence/);
assert.doesNotMatch(livedSrc, /cite the dated Analytics episode; related follow-up/);

console.log("lived-originals-are-not-subjects ok", {
  lived: packets.length,
  openings: openings.length,
  version: APP_VERSION,
});
