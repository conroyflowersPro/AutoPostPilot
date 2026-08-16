import { readFileSync } from "node:fs";
import path from "node:path";
import { coverageFromWindow, type AnalyticsCalendarCoverage } from "./analytics-coverage";

const BUNDLE_REL = "supabase/functions/weekly-plan/x-analytics-30d-window.json";

let cached: AnalyticsCalendarCoverage | null = null;

export function loadBundledAnalyticsCoverage(): AnalyticsCalendarCoverage {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), BUNDLE_REL), "utf8"));
    cached = coverageFromWindow(raw);
    return cached;
  } catch {
    cached = { from: "", to: "", imported_at: "", originals: 0, originalsByDate: {} };
    return cached;
  }
}
