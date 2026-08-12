/**
 * ORDER 0A HOTFIX 3 — Shared Content Queue eligibility (UI + integrity same rules).
 */

export type QueueEligibilityInput = {
  status?: string | null;
  topic?: string | null;
  pipeline_id?: string | null;
  user_id?: string | null;
  hidden?: boolean | null;
  deleted?: boolean | null;
  generation_run_id?: string | null;
};

export type QueueEligibilityOpts = {
  user_id: string;
  generation_run_id?: string | null;
  require_run_in_topic?: boolean;
};

export function isQueueEligible(
  row: QueueEligibilityInput,
  opts: QueueEligibilityOpts
): boolean {
  if (!row) return false;
  if (row.deleted === true || row.hidden === true) return false;
  if (String(row.status || "").toLowerCase() !== "draft") return false;
  if (opts.user_id && row.user_id && row.user_id !== opts.user_id) return false;
  if (opts.require_run_in_topic && opts.generation_run_id) {
    const topic = String(row.topic || "");
    if (!topic.includes(opts.generation_run_id)) return false;
  }
  return true;
}

export function countQueueEligible(
  rows: QueueEligibilityInput[],
  opts: QueueEligibilityOpts
): { eligible: number; hidden: number; hidden_reasons: string[] } {
  let eligible = 0;
  let hidden = 0;
  const hidden_reasons: string[] = [];
  for (const r of rows || []) {
    if (isQueueEligible(r, opts)) eligible++;
    else {
      hidden++;
      if (r.deleted) hidden_reasons.push("deleted");
      else if (r.hidden) hidden_reasons.push("hidden");
      else if (String(r.status || "").toLowerCase() !== "draft")
        hidden_reasons.push(`status:${r.status}`);
      else hidden_reasons.push("filter_mismatch");
    }
  }
  return { eligible, hidden, hidden_reasons: [...new Set(hidden_reasons)] };
}

export function queueEligibilityQueryHints(opts: QueueEligibilityOpts): {
  status: string;
  user_id: string;
  topic_like?: string;
} {
  return {
    status: "draft",
    user_id: opts.user_id,
    topic_like: opts.generation_run_id ? `%${opts.generation_run_id}%` : undefined,
  };
}
