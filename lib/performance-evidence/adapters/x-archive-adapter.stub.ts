/**
 * XArchiveAdapter — STUB ONLY.
 * Does not load 25GB ZIP into Netlify RAM.
 * Future: client-side selective extraction / streaming / object storage.
 */
import type { EvidenceSourceAdapter, NormalizedEvidence } from "../types";

export class XArchiveAdapter implements EvidenceSourceAdapter {
  readonly source = "X_ARCHIVE" as const;

  /**
   * Not implemented in contract v1.
   * When implemented: stream normalized records without full unzip in serverless memory.
   */
  async *iterateEvidence(): AsyncGenerator<
    NormalizedEvidence[],
    void,
    unknown
  > {
    throw new Error(
      "XArchiveAdapter not implemented — use selective/streaming ingestion in a future order. Never upload full 25GB ZIP to Netlify Functions."
    );
    // Unreachable — keeps AsyncGenerator typing honest for future implementers
    yield [];
  }

  async estimateCount(): Promise<number | null> {
    return null;
  }
}

export const ARCHIVE_ADAPTER_SLOT =
  "XArchiveAdapter → NormalizedEvidence → analyzers (no analyzer rewrite)";
