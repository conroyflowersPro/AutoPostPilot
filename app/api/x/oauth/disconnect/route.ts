import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_ORIGIN = process.env.URL || "https://autopostpilot.netlify.app";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_ORIGIN}/login`);
  }

  await supabase
    .from("account_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", "x");

  return NextResponse.redirect(`${APP_ORIGIN}/?x_oauth=disconnected`, {
    status: 303,
  });
}
