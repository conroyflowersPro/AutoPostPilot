/**
 * EMERGENCY CORS STUB — full engine being restored
 * Access-Control-Allow-Methods fix for Failed to fetch
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      success: false,
      error: "weekly-plan temporarily in emergency stub — full engine restore in progress (ORDER 8D)",
      days: [],
      engine: "emergency_cors_stub",
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
