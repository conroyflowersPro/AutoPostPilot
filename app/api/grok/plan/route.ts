import { NextRequest } from "next/server";
import { handleWeeklyPlanPost } from "@/lib/planning/weekly-plan-post";

export const maxDuration = 26;

export async function POST(req: NextRequest) {
  return handleWeeklyPlanPost(req);
}
