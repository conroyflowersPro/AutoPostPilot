/** Single source of truth for AutoPostPilot product version (UI badges + package + weekly-plan). */
export const APP_VERSION = "11.11.0";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const BUILD_STAMP = APP_VERSION;

/** One Korean line the operator can read in the app after a bump. */
export const VERSION_SUMMARY_KO =
  "7일 생성은 Seed Pool 탐색 → Planner 전략 → Planner 선택·배차 → Writer → Semantic Judge 순서입니다. Reject는 Planner가 기존 Pool에서 먼저 재배차하고 필요할 때만 분야를 지정해 추가 탐색합니다. Writer는 Seed와 Planner Intent를 이해한 뒤 스스로 생각하고 씁니다. 최근 흐름은 최대 30일의 실제 X Analytics만 사용합니다.";
