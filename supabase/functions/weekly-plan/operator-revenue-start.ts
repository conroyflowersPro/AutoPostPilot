/**
 * Edge lockstep of lib/learning/operator-revenue-start.ts (Edge cannot import lib/).
 */
export const OPERATOR_REVENUE_START_USD = 42.29;
export const OPERATOR_REVENUE_PERIOD_FROM = "2026-08-01";
export const OPERATOR_REVENUE_PERIOD_TO = "2026-08-15";
export const OPERATOR_REVENUE_NEXT_PAYOUT = "2026-08-28";

export function operatorRevenueStartBlock(): string {
  return [
    `REVENUE DNA START (CANDIDATE): account payout ${OPERATOR_REVENUE_START_USD} USD`,
    `Window: ${OPERATOR_REVENUE_PERIOD_FROM}..${OPERATOR_REVENUE_PERIOD_TO}. Next payout ${OPERATOR_REVENUE_NEXT_PAYOUT}.`,
    "This is the first revenue evidence. It is not per-post. Do not invent a revenue number on each post.",
    "Video overview Estimated Revenue in this export is 0. That is not the payout. Do not treat 0 as the payout and do not treat the payout as video ads per clip.",
    "Do not tweet the dollar amount. Do not raise daily quota from this one window. Must not dominate Planner or outrank authenticity/trust.",
  ].join("\n");
}
