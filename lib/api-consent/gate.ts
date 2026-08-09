import type { ExplicitApiConsent, ApiInvocationAudit } from "./types";
import { ApiConsentError } from "./types";

/**
 * Require explicit Creator action before any cost-bearing external API call.
 * Page load / background / paste-only must NOT pass.
 */
export function requireExplicitApiConsent(
  body: unknown,
  expected: { feature: string; action: string; service: ExplicitApiConsent["service"] }
): ExplicitApiConsent {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const consent = (b.api_consent || b.apiConsent) as Record<string, unknown> | undefined;

  const userInitiated =
    consent?.user_initiated === true ||
    consent?.userInitiated === true ||
    b.user_initiated === true ||
    b.userInitiated === true;

  if (!userInitiated) {
    throw new ApiConsentError(
      `External API blocked: Creator must explicitly approve action "${expected.action}" for ${expected.feature}.`
    );
  }

  const action = String(consent?.action || b.action || expected.action);
  const feature = String(consent?.feature || b.feature || expected.feature);
  const purpose = String(consent?.purpose || b.purpose || expected.action);
  const service = (consent?.service || expected.service) as ExplicitApiConsent["service"];

  if (feature !== expected.feature) {
    throw new ApiConsentError(
      `Consent feature mismatch: expected ${expected.feature}, got ${feature}`
    );
  }

  return {
    user_initiated: true,
    feature,
    action,
    purpose,
    service,
  };
}

export function buildAudit(consent: ExplicitApiConsent): ApiInvocationAudit {
  return {
    feature: consent.feature,
    action: consent.action,
    timestamp: new Date().toISOString(),
    service: consent.service,
    purpose: consent.purpose,
    user_initiated: true,
  };
}

export { ApiConsentError };
