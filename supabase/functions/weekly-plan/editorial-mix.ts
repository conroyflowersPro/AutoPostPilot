/**
 * Weekly Editorial Mix — Planner-only allocation (ORDER 1/3)
 * Does NOT touch Seed Engine / Semantic Judge / Creator DNA / Performance DNA.
 * HUMOR is excluded from weekly (Daily Wild Card only).
 */

export const EDITORIAL_MODES = [
  "INFORMATIVE",
  "COMPARE",
  "OPINION",
  "EXPERIENCE",
  "CASUAL_OBSERVATION",
] as const;

export type EditorialMode = (typeof EDITORIAL_MODES)[number];

export const DEFAULT_EDITORIAL_RATIO: Record<EditorialMode, number> = {
  INFORMATIVE: 35,
  COMPARE: 15,
  OPINION: 20,
  EXPERIENCE: 18,
  CASUAL_OBSERVATION: 12,
};

const REDUCE_PRIORITY: EditorialMode[] = [
  "CASUAL_OBSERVATION",
  "COMPARE",
  "EXPERIENCE",
  "OPINION",
  "INFORMATIVE",
];

const ADD_PRIORITY: EditorialMode[] = [
  "INFORMATIVE",
  "OPINION",
  "EXPERIENCE",
  "COMPARE",
  "CASUAL_OBSERVATION",
];

export function normalizeRatioInput(
  raw: unknown
): Record<EditorialMode, number> {
  const out = { ...DEFAULT_EDITORIAL_RATIO };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const m of EDITORIAL_MODES) {
    const v = Number(obj[m]);
    out[m] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  return out;
}

export function allocateEditorialSlots(
  baseRequiredSlots: number,
  ratioInput: unknown
): {
  allocation: Record<EditorialMode, number>;
  final_slots: number;
  base_required_slots: number;
  ratio_sum: number;
  adjusted: boolean;
} {
  const base = Math.max(0, Math.floor(Number(baseRequiredSlots) || 0));
  const ratio = normalizeRatioInput(ratioInput);
  const ratio_sum = EDITORIAL_MODES.reduce((s, m) => s + ratio[m], 0);
  const allocation = {} as Record<EditorialMode, number>;
  for (const m of EDITORIAL_MODES) allocation[m] = 0;
  if (base === 0) {
    return { allocation, final_slots: 0, base_required_slots: 0, ratio_sum, adjusted: false };
  }
  if (ratio_sum <= 0) {
    const each = Math.floor(base / EDITORIAL_MODES.length);
    let rem = base - each * EDITORIAL_MODES.length;
    for (const m of EDITORIAL_MODES) {
      allocation[m] = each + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
  } else {
    const parts = EDITORIAL_MODES.map((m) => {
      const exact = (ratio[m] / ratio_sum) * base;
      const floor = Math.floor(exact);
      return { m, floor, frac: exact - floor };
    });
    parts.sort((a, b) => b.frac - a.frac);
    let total = parts.reduce((s, p) => s + p.floor, 0);
    let need = base - total;
    for (let i = 0; i < parts.length && need > 0; i++) {
      parts[i].floor += 1;
      need -= 1;
    }
    for (const p of parts) allocation[p.m] = p.floor;
  }
  let final = EDITORIAL_MODES.reduce((s, m) => s + allocation[m], 0);
  let adjusted = false;
  if (final < base) {
    adjusted = true;
    let i = 0;
    while (final < base && i < base + 50) {
      const m = ADD_PRIORITY[i % ADD_PRIORITY.length];
      allocation[m] += 1;
      final += 1;
      i += 1;
    }
  }
  if (final > base + 1) {
    adjusted = true;
    let i = 0;
    while (final > base + 1 && i < final + 50) {
      const m = REDUCE_PRIORITY[i % REDUCE_PRIORITY.length];
      if (allocation[m] > 0) {
        allocation[m] -= 1;
        final -= 1;
      }
      i += 1;
    }
  }
  if (final < base) {
    allocation.INFORMATIVE += base - final;
    final = base;
    adjusted = true;
  }
  return { allocation, final_slots: final, base_required_slots: base, ratio_sum, adjusted };
}

export function buildEditorialQueue(
  allocation: Record<EditorialMode, number>
): EditorialMode[] {
  const queue: EditorialMode[] = [];
  const remaining = { ...allocation };
  let left = EDITORIAL_MODES.reduce((s, m) => s + (remaining[m] || 0), 0);
  while (left > 0) {
    let progressed = false;
    for (const m of EDITORIAL_MODES) {
      if ((remaining[m] || 0) > 0) {
        queue.push(m);
        remaining[m] -= 1;
        left -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return queue;
}

export function lengthForEditorial(mode: EditorialMode | string): "SHORT" | "MEDIUM" | "LONG" {
  if (mode === "CASUAL_OBSERVATION") return "SHORT";
  if (mode === "EXPERIENCE") return "MEDIUM";
  return "MEDIUM";
}

export function preferredEditorialFromSeed(seed: {
  intent?: string;
  writing_mode?: string;
  seed_type?: string;
}): EditorialMode {
  const intent = String(seed.intent || seed.seed_type || "").toUpperCase();
  const wm = String(seed.writing_mode || "").toUpperCase();
  if (intent === "COMPARE" || wm.includes("COMPARE")) return "COMPARE";
  if (intent === "EXPERIENCE" || wm.includes("EXPERIENCE") || wm.includes("PERSONAL")) return "EXPERIENCE";
  if (intent === "OPINION" || intent === "ANALYSIS" || intent === "PROBLEM") return "OPINION";
  if (wm.includes("CASUAL") || wm.includes("COMMUNITY")) return "CASUAL_OBSERVATION";
  return "INFORMATIVE";
}
