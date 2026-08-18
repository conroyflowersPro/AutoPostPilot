/**
 * Post origin for evidence routing. Next/app copy of the Edge classifier.
 * Do not treat missing origin as USER_DIRECT.
 * Own-account ORIGINAL/QUOTE with no AP match is USER_DIRECT.
 * Never downgrade a stored USER_DIRECT to UNKNOWN.
 */
export type EvidenceOrigin = "USER_DIRECT" | "AP_PIPELINE" | "UNKNOWN";

const AP_ORIGIN =
  /AP_PIPELINE|APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED|SYSTEM_ASSISTED/;
const DIRECT_ORIGIN = /USER_DIRECT|MANUAL|HANDMADE|CREATOR_DIRECT/;

export function classifyEvidenceOrigin(value: string | null | undefined): EvidenceOrigin {
  const v = String(value || "").toUpperCase().trim();
  if (!v) return "UNKNOWN";
  if (DIRECT_ORIGIN.test(v)) return "USER_DIRECT";
  if (AP_ORIGIN.test(v)) return "AP_PIPELINE";
  return "UNKNOWN";
}

export function isOwnAccountPublishableAction(actionType: string | null | undefined): boolean {
  const action = String(actionType || "").toUpperCase();
  if (!action) return true;
  if (action === "REPLY" || action === "REPOST" || action === "RETWEET" || action === "SKIP") return false;
  return action === "ORIGINAL" || action === "QUOTE";
}

export function classifyOwnTimelineOrigin(args: {
  apMatched: boolean;
  actionType?: string;
  ownAccount?: boolean;
}): EvidenceOrigin {
  if (args.apMatched) return "AP_PIPELINE";
  if (args.ownAccount === false) return "UNKNOWN";
  if (!isOwnAccountPublishableAction(args.actionType)) return "UNKNOWN";
  return "USER_DIRECT";
}

/** Incoming class from this sync vs what is already stored. AP evidence may upgrade. USER_DIRECT never falls to UNKNOWN. */
export function mergeStoredOriginClass(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): EvidenceOrigin {
  const prev = classifyEvidenceOrigin(existing);
  const next = classifyEvidenceOrigin(incoming);
  if (next === "AP_PIPELINE") return "AP_PIPELINE";
  if (prev === "USER_DIRECT") return "USER_DIRECT";
  if (next === "USER_DIRECT") return "USER_DIRECT";
  if (prev === "AP_PIPELINE") return "AP_PIPELINE";
  return "UNKNOWN";
}
