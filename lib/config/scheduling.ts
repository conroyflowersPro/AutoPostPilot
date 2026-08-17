/**
 * Publishing / scheduling config — single source of truth.
 * Future Queue/Worker should import from here.
 */

export const SCHEDULING_CONFIG = {
  /** Posts per API request (UI auto-chains batches) */
  batchSize: 3,

  /** Max posts allowed in one UI session request list */
  maxSelection: 40,

  /** Transient upload/publish retries (idempotent paths only) */
  mediaUploadRetries: 2,
  publishRetries: 1,

  /** Delays (ms) */
  retryDelayMs: 800,
  providerTimeoutMs: 15_000,

  /** Media limits (bytes) — soft guards before provider */
  maxImageBytes: 15 * 1024 * 1024,
  maxVideoBytes: 512 * 1024 * 1024,

  allowedImageMimes: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ] as const,

  allowedVideoMimes: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ] as const,

  /** Default KR pipeline */
  defaultPipelineId: "42303",

  providerName: "fedica" as const,
} as const;

export type SchedulingConfig = typeof SCHEDULING_CONFIG;
