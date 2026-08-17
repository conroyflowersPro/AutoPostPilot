import { readFileSync } from "fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

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

const src = readFileSync("lib/publishers/fedica-provider.ts", "utf8");
mustInclude(src, "DateTime: dateTime", "sends DateTime variable");
mustInclude(src, "resolveTwitterAccounts", "resolves /accounts");
mustNotInclude(src, "PipelineId: Number(input.pipelineId)", "must not send PipelineId with DateTime");
mustNotInclude(src, "PipelineId: Number(input.pipelineId) || 42303", "old pipeline+datetime combo");

const helper = readFileSync("lib/fedica.ts", "utf8");
mustInclude(helper, "if (params.dateTime)", "legacy helper DateTime path");
mustInclude(helper, "body.PipelineId = Number(params.pipelineId)", "pipeline only without DateTime");
mustInclude(helper, "Messages: [params.message]", "messages are strings");
mustInclude(helper, "timeZoneName: \"longOffset\"", "Pacific offset not Z-only");

const svc = readFileSync("lib/services/schedule-service.ts", "utf8");
mustInclude(svc, "scheduled_at: scheduledAtISO", "claim writes scheduled_at");
mustInclude(svc, "persistScheduled", "verifies scheduled persist");

const cal = readFileSync("lib/calendar/activity-provider.ts", "utf8");
mustInclude(cal, "mergeBookedScheduleDays", "queue month includes booked");
mustInclude(cal, "eq(\"user_id\", user.id)", "planned posts scoped to user");

const ver = readFileSync("lib/version.ts", "utf8");
mustInclude(ver, 'APP_VERSION = "12.5.1"', "version 12.5.1");

const { formatFedicaDateTime, fedicaPostAccepted } = await import(
  pathToFileURL(path.join(process.cwd(), "lib/fedica.ts")).href
);

const winter = formatFedicaDateTime("2026-01-15T22:00:00.000Z");
if (!winter.startsWith("2026-01-15T14:00:00-08:00")) {
  console.error("FAIL winter PT offset", winter);
  process.exit(1);
}
const summer = formatFedicaDateTime("2026-08-17T21:00:00.000Z");
if (!summer.startsWith("2026-08-17T14:00:00-07:00")) {
  console.error("FAIL summer PT offset", summer);
  process.exit(1);
}
if (fedicaPostAccepted(true, { Success: true, Id: "9" }) !== true) {
  console.error("FAIL accepted Success true");
  process.exit(1);
}
if (fedicaPostAccepted(true, { Success: false }) !== false) {
  console.error("FAIL rejected Success false");
  process.exit(1);
}

console.log("fedica-schedule-interval-test: PASS");
