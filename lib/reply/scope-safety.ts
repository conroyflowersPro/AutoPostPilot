/** Offline safety checks for TARGET-only policy */

export function assertTargetOnlyScope(result: {
  other_reply_fetch_count: number;
  conversation_pagination_count: number;
  other_replies_requested?: boolean;
}): void {
  if (result.other_reply_fetch_count !== 0) {
    throw new Error("SAFETY FAIL: other_reply_fetch_count must be 0 for target-only");
  }
  if (result.conversation_pagination_count !== 0) {
    throw new Error("SAFETY FAIL: conversation_pagination_count must be 0 for target-only");
  }
  if (result.other_replies_requested === true) {
    throw new Error("SAFETY FAIL: other_replies_requested must be false for target-only");
  }
}

export function runOfflineScopeTests(): { name: string; pass: boolean }[] {
  const tests: { name: string; pass: boolean }[] = [];
  try {
    assertTargetOnlyScope({
      other_reply_fetch_count: 0,
      conversation_pagination_count: 0,
      other_replies_requested: false,
    });
    tests.push({ name: "T2_target_zero_other_replies", pass: true });
  } catch {
    tests.push({ name: "T2_target_zero_other_replies", pass: false });
  }
  try {
    assertTargetOnlyScope({
      other_reply_fetch_count: 1,
      conversation_pagination_count: 0,
    });
    tests.push({ name: "T3_reject_nonzero", pass: false });
  } catch {
    tests.push({ name: "T3_reject_nonzero", pass: true });
  }
  return tests;
}
