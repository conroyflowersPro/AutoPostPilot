/**
 * GET /api/learning/contract-check
 * Offline Performance DNA Architecture Contract self-check (no DB writes).
 */
import { NextResponse } from "next/server";
import {
  allContractChecksPass,
  runContractSelfCheck,
  PERFORMANCE_DNA_CONTRACT_VERSION,
} from "@/lib/performance-evidence";

export const maxDuration = 10;

export async function GET() {
  const checks = runContractSelfCheck();
  const pass = allContractChecksPass();
  return NextResponse.json({
    version: PERFORMANCE_DNA_CONTRACT_VERSION,
    pass,
    checks,
  });
}
