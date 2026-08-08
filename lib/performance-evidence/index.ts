export * from "./types";
export * from "./metric-utils";
export * from "./contract-v1";
export * from "./content-evidence";
export * from "./outcome-vector";
export * from "./authenticity-gate";
export * from "./promotion-guardrail";
export * from "./confidence";
export { SupabaseEvidenceAdapter } from "./adapters/supabase-adapter";
export {
  XArchiveAdapter,
  ARCHIVE_ADAPTER_SLOT,
} from "./adapters/x-archive-adapter.stub";
export { runPerformanceDiagnostic } from "./analyzers/run-diagnostic";
export {
  runContractSelfCheck,
  allContractChecksPass,
} from "./contract-self-check";
