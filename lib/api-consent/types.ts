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
  request_scope?: string;
  other_replies_requested?: boolean;
  other_reply_fetch_count?: number;
  conversation_pagination_count?: number;
  x_endpoint?: string;
  x_query_summary?: string;
};

export type ExplicitApiConsent = {
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
