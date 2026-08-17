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
mustInclude(src, "DateTime: dateTime", "sends DateTime");
mustInclude(src, "PipelineId: pipelineId", "sends operator PipelineId");
mustInclude(src, "resolveTwitterAccounts", "resolves /accounts");

const helper = readFileSync("lib/fedica.ts", "utf8");
mustInclude(helper, "PipelineId: fedicaPipelineId(params.pipelineId)", "helper always sends pipeline");
mustInclude(helper, "body.DateTime = formatFedicaDateTime(params.dateTime)", "helper sends DateTime with pipeline");
mustInclude(helper, "Messages: [params.message]", "messages are strings");
mustInclude(helper, "timeZoneName: \"longOffset\"", "Pacific offset");

const svc = readFileSync("lib/services/schedule-service.ts", "utf8");
mustInclude(svc, "persistScheduled", "verifies scheduled persist");
mustInclude(svc, 'status: "scheduling"', "claim is scheduling only");
mustNotInclude(svc, "if (!info.providerPostId) return false", "Success is enough without Fedica Id");

const sch = readFileSync("lib/schedule.ts", "utf8");
mustInclude(sch, "FOR_YOU_START_HOUR = 14", "For You start");
mustInclude(sch, "FOR_YOU_PREFERRED_GAP_MS = 2 * 60 * 60 * 1000", "For You ~2h gap");

const batch = readFileSync("app/api/fedica/batch-schedule/route.ts", "utf8");
mustInclude(batch, "post.pipeline_id || pipelineId", "uses the post's assigned pipeline");

const ver = readFileSync("lib/version.ts", "utf8");
mustInclude(ver, 'APP_VERSION = "12.5.3"', "version 12.5.3");

const { formatFedicaDateTime, fedicaPostAccepted, fedicaPipelineId } = await import(
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
if (fedicaPipelineId("42303") !== 42303) {
  console.error("FAIL pipeline id");
  process.exit(1);
}
if (fedicaPostAccepted(true, { Success: true, Id: "9" }) !== true) {
  console.error("FAIL accepted Success+Id");
  process.exit(1);
}
if (fedicaPostAccepted(true, { Success: true }) !== true) {
  console.error("FAIL Success without Id must still schedule");
  process.exit(1);
}

console.log("fedica-schedule-interval-test: PASS");
