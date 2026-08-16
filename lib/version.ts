/** Single source of truth for AutoPostPilot product version (UI badges + package + weekly-plan). */
export const APP_VERSION = "11.12.0";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const BUILD_STAMP = APP_VERSION;

/** One Korean line the operator can read in the app after a bump. */
export const VERSION_SUMMARY_KO =
  "7일 생성은 Seed Pool 탐색 → Planner 전략 → Planner 선택·배차 → Writer → Semantic Judge 순서입니다. Judge의 Creator 검사는 유사도 점수가 아니라 명백한 정체성·사실 충돌만 봅니다. 새 주제나 낮은 과거 유사도는 허용합니다. Reject는 Planner가 기존 Pool에서 먼저 재배차합니다. 최근 흐름은 최대 30일의 실제 X Analytics만 사용합니다.";
