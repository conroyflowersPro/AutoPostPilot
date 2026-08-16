/** Single source of truth for AutoPostPilot product version (UI badges + package + weekly-plan). */
export const APP_VERSION = "11.13.0";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const BUILD_STAMP = APP_VERSION;

/** One Korean line the operator can read in the app after a bump. */
export const VERSION_SUMMARY_KO =
  "7일 생성은 Planner가 칸 수를 잠근 뒤 Seed Generator가 그 개수+10을 만들고, Planner가 고른 뒤 Writer가 쓰며 Semantic Judge가 최종만 봅니다. 별도 Quota 호출은 없습니다. Writer는 Agent Tools로 공개 사실만 확인합니다. 최근 흐름은 최대 30일의 실제 X Analytics만 사용합니다.";
