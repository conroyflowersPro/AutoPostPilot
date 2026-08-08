import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPhase1ACollectStatus } from "@/lib/x/batch-collect";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const status = await getPhase1ACollectStatus();
    return NextResponse.json({ version: "5.5.8", ...status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
