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

const src = readFileSync("lib/publishers/fedica-provider.ts", "utf8");
mustInclude(src, "DateTime: formatFedicaDateTime(input.scheduledAtISO)", "sends DateTime");
mustInclude(src, "replace(/\\.\\d{3}Z$/, \"Z\")", "ISO without milliseconds");
mustNotInclude(src, "PipelineId: Number(input.pipelineId)", "must not send PipelineId with DateTime");

const helper = readFileSync("lib/fedica.ts", "utf8");
mustInclude(helper, "if (params.dateTime)", "legacy helper DateTime path");
mustInclude(helper, "body.PipelineId = Number(params.pipelineId)", "pipeline only without DateTime");

const ver = readFileSync("lib/version.ts", "utf8");
mustInclude(ver, 'APP_VERSION = "12.5.0"', "version 12.5.0");

console.log("fedica-schedule-interval-test: PASS");
