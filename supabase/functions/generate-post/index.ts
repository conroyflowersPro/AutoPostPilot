import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleGeneratePost } from "./generate-core.ts";

Deno.serve((req) => handleGeneratePost(req));
