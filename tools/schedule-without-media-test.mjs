import { readFileSync } from "fs";

function mustInclude(hay, needle, label) {
  if (!hay.includes(needle)) {
    console.error(`FAIL ${label}: missing ${JSON.stringify(needle)}`);
    process.exit(1);
  }
}

function mustNotInclude(hay, needle, label) {
  if (hay.includes(needle)) {
    console.error(`FAIL ${label}: found ${JSON.stringify(needle)}`);
    process.exit(1);
  }
}

const media = readFileSync("lib/services/media-service.ts", "utf8");
mustInclude(media, "requireMedia === true", "media-service: only explicit true");
mustNotInclude(media, "if (requireMedia !== false", "media-service: old default-true");

const sched = readFileSync("lib/services/schedule-service.ts", "utf8");
mustInclude(sched, "requireMedia = false", "schedule-service default false");

const batch = readFileSync("app/api/fedica/batch-schedule/route.ts", "utf8");
mustInclude(batch, "requireMedia === true", "batch-schedule explicit true");

const single = readFileSync("app/api/fedica/schedule/route.ts", "utf8");
mustInclude(single, "requireMedia === true", "schedule route explicit true");

const list = readFileSync("app/components/PostList.tsx", "utf8");
mustInclude(list, "eq(\"user_id\", user.id)", "PostList refetch by user");
mustInclude(
  list,
  '["draft", "reviewed", "scheduling", "schedule_failed"]',
  "PostList queue statuses"
);
mustNotInclude(list, "media_urls && post.media_urls.length", "PostList media gate");
mustInclude(list, "requireMedia: false", "PostList batch requireMedia false");
mustInclude(list, "visibilitychange", "PostList refetch on tab focus");

const page = readFileSync("app/page.tsx", "utf8");
mustInclude(page, 'export const dynamic = "force-dynamic"', "home force-dynamic");
mustInclude(page, 'eq("user_id", user.id)', "home user_id");
mustInclude(page, "limit(800)", "home queue limit");

const detail = readFileSync("app/posts/[id]/page.tsx", "utf8");
mustInclude(detail, 'export const dynamic = "force-dynamic"', "detail force-dynamic");
mustInclude(detail, 'eq("user_id", user.id)', "detail user_id");

const actions = readFileSync("app/posts/[id]/PostActions.tsx", "utf8");
mustInclude(actions, "미디어가 없어도 스케줄할 수 있습니다", "detail copy");
mustNotInclude(actions, "if (!hasMedia) {", "detail next blocked by media");

const btn = readFileSync("app/components/BatchScheduleButton.tsx", "utf8");
mustInclude(btn, "requireMedia: false", "batch button requireMedia false");

const ver = readFileSync("lib/version.ts", "utf8");
mustInclude(ver, 'APP_VERSION = "12.4.2"', "version 12.4.2");

console.log("schedule-without-media-test: PASS");
