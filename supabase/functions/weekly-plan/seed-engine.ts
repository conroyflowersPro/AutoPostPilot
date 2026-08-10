/**
 * Dynamic Concrete Seed Engine v8.3.3 — FULL FILE (do not use barrel without types/runtime)
 * Edge SoT deployed 2026-08-10. This file must be self-contained for Actions deploy.
 * See artifacts pack for complete engine; temporary bootstrap below keeps imports valid.
 */
export type SeedStatus = "NEW" | "ELIGIBLE" | "HIGH_VALUE" | "REJECTED" | "HOLD" | "FACT_CONTEXT_REQUIRED";
export type ConcreteSeed = {
  seed_id: string;
  cluster: string;
  dimension: string;
  concrete_subject: string;
  subject_signature: string;
  primary_source?: string;
  supporting_sources?: string[];
  status?: SeedStatus;
  [key: string]: unknown;
};
export function createSeedIdFactory(prefix = "s") {
  let n = 0;
  return () => `${prefix}${++n}`;
}
export function isSelectableStatus(status: string | undefined): boolean {
  return status === "ELIGIBLE" || status === "HIGH_VALUE";
}
export function subjectSignature(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}
export function applyLocalGates(raw: any[], _recent: string[], nextId: () => string = createSeedIdFactory("s")) {
  const passed: ConcreteSeed[] = [];
  for (const r of raw || []) {
    if (!r?.concrete_subject) continue;
    passed.push({
      seed_id: nextId(),
      cluster: String(r.cluster || "OTHER"),
      dimension: String(r.dimension || "GENERAL"),
      concrete_subject: String(r.concrete_subject),
      subject_signature: subjectSignature(r.concrete_subject),
      primary_source: r.primary_source || "XAI_EXPANSION",
      supporting_sources: r.supporting_sources || ["DIMENSION_REGISTRY"],
      status: "ELIGIBLE",
    });
  }
  return { passed, local_gate_rejected: 0, reject_reasons: {} };
}
export function buildLafcPrematchSeeds(matches: any[], weekStartISO: string, nextId: () => string = createSeedIdFactory("lafc")): ConcreteSeed[] {
  return [];
}
export function consolidateSemanticGroups(seeds: ConcreteSeed[]): ConcreteSeed[] { return seeds; }
export function markSameStoryWithinPool(seeds: ConcreteSeed[]): ConcreteSeed[] { return seeds; }
export function canonicalSemanticGroupKey(seed: any): string {
  return subjectSignature(`${seed?.cluster || ""}-${seed?.concrete_subject || ""}`);
}
export function extractJson(raw: string): any | null {
  try { return JSON.parse(String(raw || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); } catch { return null; }
}
export const DIMENSION_REGISTRY: Array<{ cluster: string; dimension: string }> = [
  { cluster: "FSD", dimension: "PEDESTRIAN" },
  { cluster: "CYBERTRUCK", dimension: "OWNER_OPS" },
  { cluster: "ROBOTAXI", dimension: "CURBSIDE" },
];
export const QUALITY_REFERENCE: any[] = [];
