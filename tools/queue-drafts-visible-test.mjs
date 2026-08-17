import { readFileSync } from "fs";

function mustInclude(hay, needle, label) {
  if (!hay.includes(needle)) {
    console.error(`FAIL ${label}: missing ${JSON.stringify(needle)}`);
    process.exit(1);
  }
}

const list = readFileSync("app/components/PostList.tsx", "utf8");
mustInclude(list, "livePosts !== null ? livePosts : posts", "keep server posts until live load");
mustInclude(list, "if (active.error && rest.error) return", "do not wipe list unless both queries fail");
mustInclude(
  list,
  "id, content, status, pipeline_id, media_urls, scheduled_at, created_at, user_id",
  "PostList selects columns that exist in production"
);
if (/select\(cols\)[\s\S]{0,40}final_text/.test(list) || /cols =\s*\n?\s*"id, content, final_text/.test(list)) {
  console.error("FAIL PostList still selects missing final_text/topic columns");
  process.exit(1);
}

const shell = readFileSync("app/components/AppShell.tsx", "utf8");
mustInclude(shell, 'if (item.href === "/")', "queue uses hard navigation");
mustInclude(shell, "<a key={item.href} href=\"/\"", "queue is a real <a href=/>");

const ver = readFileSync("lib/version.ts", "utf8");
mustInclude(ver, 'APP_VERSION = "12.5.2"', "version 12.5.2");

console.log("queue-drafts-visible-test: PASS");
