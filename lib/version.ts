/** Single source of truth for AutoPostPilot product version (UI badges + package + weekly-plan). */
export const APP_VERSION = "11.12.5";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const BUILD_STAMP = APP_VERSION;

/** One Korean line the operator can read in the app after a bump. */
export const VERSION_SUMMARY_KO =
  "7일 생성은 Seed Pool 탐색 → Planner 전략 → Planner 선택·배차 → Writer → Semantic Judge 순서입니다. 생성 화면에 시드·작성·거절·재배차 보고서가 남습니다. Judge가 같은 Seed를 3번 거절하면 Planner가 그 Seed만 버리고 슬롯은 다른 Seed나 그 분야 시드 10개로 채웁니다. Writer는 작성만 합니다. 최근 흐름은 최대 30일의 실제 X Analytics만 사용합니다.";
