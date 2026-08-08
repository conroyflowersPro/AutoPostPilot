export const PRIVACY_EXCLUDED = [
  "direct_messages",
  "encrypted_messages",
  "ip_logs",
  "phone",
  "email",
  "device_tokens",
  "auth_session",
  "keys",
  "private_credentials",
  "mute_raw_list",
  "block_raw_list",
  "grok_chat",
] as const;

export const MEDIA_POLICY =
  "Binary media excluded from universal package; media_present/type/count/reference only";

export const LIKE_POLICY =
  "Raw likes (~179k) not shipped; aggregate interest summary only; LIKE ≠ belief/endorsement";

export const MISSING_METRIC_POLICY =
  "missing ≠ 0; PRESENT_ZERO vs MISSING distinct; no revenue_per_post invention";
