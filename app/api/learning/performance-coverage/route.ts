/**
 * GET /api/learning/performance-coverage
 * Read-only Performance Evidence Coverage diagnostic.
 * No INSERT/UPDATE/DELETE. No DNA updates. No learning writes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseEvidenceAdapter } from "@/lib/performance-evidence/adapters/supabase-adapter";
import { runPerformanceDiagnostic } from "@/lib/performance-evidence/analyzers/run-diagnostic";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: conn, error: connErr } = await supabase
      .from("account_connections")
      .select("id, handle, platform")
      .eq("user_id", user.id)
      .eq("platform", "twitter")
      .maybeSingle();

    if (connErr) {
      return NextResponse.json(
        { error: `account_connections: ${connErr.message}` },
        { status: 500 }
      );
    }
    if (!conn?.id) {
      return NextResponse.json(
        { error: "No Twitter account_connection found" },
        { status: 404 }
      );
    }

    const adapter = new SupabaseEvidenceAdapter(supabase, conn.id);
    const report = await runPerformanceDiagnostic(adapter, {
      accountId: conn.id,
      pageSize: 200,
    });

    return NextResponse.json({
      version: "performance-evidence-v1",
      handle: conn.handle,
      report,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
