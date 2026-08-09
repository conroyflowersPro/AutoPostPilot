/**
 * Global API Consent Layer — no paid/external API without explicit Creator action.
 * Approval is per user-initiated action, never permanent global auto-approve.
 */

export type ApiCostState =
  | "LOCAL_STORED"
  | "API_REQUIRED"
  | "API_READY"
  | "API_LOADING"
  | "API_RESULT"
  | "API_ERROR";

export type ExternalService = "X_API" | "XAI_GROK" | "OTHER";

export type ApiInvocationAudit = {
  feature: string;
  action: string;
  timestamp: string;
  service: ExternalService;
  purpose: string;
  user_initiated: true;
};

export type ExplicitApiConsent = {
  /** Must be true — set only after Creator clicks an action */
  user_initiated: true;
  feature: string;
  action: string;
  purpose: string;
  service: ExternalService;
};

export class ApiConsentError extends Error {
  code = "API_CONSENT_REQUIRED";
  constructor(message: string) {
    super(message);
    this.name = "ApiConsentError";
  }
}
