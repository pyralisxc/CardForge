import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { parsePipelineRetentionRequest, routePipelineRetentionClaims } from "./targeting.ts";
import { processRevisionPurge } from "./processor.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
type PurgeClaim = { submission_id: string; storage_bucket: string | null; storage_path: string | null };
const respond = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: JSON_HEADERS },
);

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return respond(405, { error: "method_not_allowed" });
  const cronSecret = request.headers.get("x-cardforge-cron-secret")?.trim();
  if (!cronSecret) return respond(401, { error: "retention_unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return respond(503, { error: "retention_not_configured" });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authorized, error: authorizationError } = await supabase.rpc(
    "cardforge_authorize_pipeline_revision_retention",
    { p_secret: cronSecret },
  );
  if (authorizationError) return respond(503, { error: "retention_authorization_unavailable" });
  if (!authorized) return respond(401, { error: "retention_unauthorized" });

  let selection: ReturnType<typeof parsePipelineRetentionRequest>;
  try { selection = parsePipelineRetentionRequest(await request.text()); }
  catch { return respond(400, { error: "invalid_retention_target" }); }
  const routed=await routePipelineRetentionClaims(selection,async (name,args)=>{
    const result = await supabase.rpc(name,args);
    return { data:result.data, error:result.error };
  });
  if(routed.error)return respond(routed.error==="target_not_eligible"?409:500,{error:routed.error,expired:routed.expired});
  const expired=routed.expired;
  const claims=routed.claims as PurgeClaim[];
  let purged = 0;
  let failed = 0;
  for (const claim of claims) {
    const result=await processRevisionPurge(supabase,claim);
    if(result.purged)purged++;
    if(result.failed)failed++;
  }
  return respond(failed ? 207 : 200, { expired: expired ?? 0, claimed: claims.length, purged, failed });
});
