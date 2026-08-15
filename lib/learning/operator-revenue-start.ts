/**
 * First Revenue DNA window. Operator X Payouts UI + this Analytics drop.
 * Account-level, not per-post. Video "Estimated Revenue" in the export is 0 — that is not this payout.
 */
export const OPERATOR_REVENUE_START = {
  amountUsd: 42.29,
  periodFrom: "2026-08-01",
  periodTo: "2026-08-15",
  nextPayout: "2026-08-28",
  source: "x_payouts_ui",
  perPost: false,
  status: "CANDIDATE",
} as const;

export function operatorRevenueStartBlock(): string {
  return [
    `REVENUE DNA START (CANDIDATE): account payout ${OPERATOR_REVENUE_START.amountUsd} USD`,
    `Window: ${OPERATOR_REVENUE_START.periodFrom}..${OPERATOR_REVENUE_START.periodTo}. Next payout ${OPERATOR_REVENUE_START.nextPayout}.`,
    "This is the first revenue evidence. It is not per-post. Do not invent a revenue number on each post.",
    "Video overview Estimated Revenue in this export is 0. That is not the payout. Do not treat 0 as the payout and do not treat the payout as video ads per clip.",
    "Do not tweet the dollar amount. Do not raise daily quota from this one window. Must not dominate Planner or outrank authenticity/trust.",
  ].join("\n");
}
