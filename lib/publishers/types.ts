/**
 * Publisher Provider interface — Fedica is one implementation.
 * ScheduleService must not call Fedica endpoints directly.
 */

export type PublishAccount = {
  Platform: string;
  AccountId: string;
};

export type SchedulePostInput = {
  content: string;
  scheduledAtISO: string;
  pipelineId: string | number;
  mediaIds: string[];
  accounts?: PublishAccount[];
  /** Idempotency hint for logs / future providers */
  idempotencyKey?: string;
};

export type SchedulePostResult = {
  success: boolean;
  providerPostId?: string;
  raw?: unknown;
  error?: string;
  retryable?: boolean;
};

export type MediaUploadResult = {
  mediaId: string;
};

export interface PublisherProvider {
  readonly name: string;
  uploadMediaFromUrl(url: string, altText?: string): Promise<MediaUploadResult>;
  schedulePost(input: SchedulePostInput): Promise<SchedulePostResult>;
}
