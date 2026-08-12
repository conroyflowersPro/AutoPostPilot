/**
 * Edge-local count integrity helpers (ORDER 0A)
 */

export type SlotAttempt = {
  slotId: string;
  attempt: number;
  status: "ok" | "parse_fail" | "empty" | "latin_filter" | "dup" | "unknown_id" | "missing";
};

export type GenerateCountReport = {
  requested_slots: number;
  received_from_model: number;
  accepted: number;
  rejected: number;
  parser_failures: number;
  retried_slots: number;
  unresolved_slot_ids: string[];
  mapping_errors: string[];
  attempts: SlotAttempt[];
};

export const MAX_SLOT_RETRIES = 2;

export function missingSlotIds(
  requestedIds: string[],
  acceptedIds: Set<string>
): string[] {
  return requestedIds.filter((id) => id && !acceptedIds.has(id));
}

export function buildGenerateCountReport(input: {
  requestedIds: string[];
  acceptedIds: Set<string>;
  receivedFromModel: number;
  rejected: number;
  parserFailures: number;
  retriedSlots: number;
  mappingErrors: string[];
  attempts: SlotAttempt[];
}): GenerateCountReport {
  const unresolved = missingSlotIds(input.requestedIds, input.acceptedIds);
  return {
    requested_slots: input.requestedIds.length,
    received_from_model: input.receivedFromModel,
    accepted: input.acceptedIds.size,
    rejected: input.rejected,
    parser_failures: input.parserFailures,
    retried_slots: input.retriedSlots,
    unresolved_slot_ids: unresolved,
    mapping_errors: input.mappingErrors,
    attempts: input.attempts,
  };
}
