/**
 * Post origin for evidence routing. Next/app copy of the Edge classifier.
 * Do not treat missing origin as USER_DIRECT.
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
