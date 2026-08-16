/** Single source of truth for AutoPostPilot product version (UI badges + package + weekly-plan). */
export const APP_VERSION = "12.1.3";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const BUILD_STAMP = APP_VERSION;

/** One Korean line the operator can read in the app after a bump. */
export const VERSION_SUMMARY_KO =
  "큐는 작성된 글 현황·리뷰·Fedica 스케줄 도구입니다. 달력은 「지금 동기화」로 들어온 X 현황을 Planner가 숫자만 기입합니다. 7일 생성은 Planner가 칸을 잠그고 Seed가 탐색한 뒤 Writer가 쓰며 Semantic Judge가 PASS 개수를 셉니다. 최근 흐름은 최대 30일의 실제 X Analytics만 사용합니다.";
