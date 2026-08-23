import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const STUDIO_DOCUMENT_ASSET_BUCKET = "cardforge-studio-document-assets";
const RENDER_ARTIFACT_BUCKET = "cardforge-render-artifacts";
const JSON_HEADERS = { "Content-Type": "application/json" };

type PurgeClaim = {
  document_id: string;
  owner_user_id: string;
};

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
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Assistant draft retention is missing its built-in Supabase environment.");
    return respond(503, { error: "retention_not_configured" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authorized, error: authorizationError } = await supabase.rpc(
    "cardforge_authorize_assistant_draft_retention",
    { p_secret: cronSecret },
  );
  if (authorizationError) {
    console.error("Unable to authorize assistant draft retention:", authorizationError);
    return respond(503, { error: "retention_authorization_unavailable" });
  }
  if (!authorized) return respond(401, { error: "retention_unauthorized" });

  const { data: expiredCount, error: expireError } = await supabase.rpc(
    "cardforge_expire_studio_documents",
    { p_limit: 250 },
  );
  if (expireError) {
    console.error("Unable to expire inactive assistant drafts:", expireError);
    return respond(500, { error: "expiry_failed" });
  }

  const { data: claimData, error: claimError } = await supabase.rpc(
    "cardforge_claim_studio_document_purges",
    { p_limit: 100 },
  );
  if (claimError) {
    console.error("Unable to claim assistant draft purges:", claimError);
    return respond(500, { error: "purge_claim_failed", expired: expiredCount ?? 0 });
  }

  const claims = (claimData ?? []) as PurgeClaim[];
  let purged = 0;
  let failed = 0;

  const removePrefixObjects = async (bucket: string, prefix: string) => {
    const { data: objects, error: listError } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000 });
    if (listError) throw listError;

    const paths = (objects ?? [])
      .filter((object) => object.name && !object.id === false)
      .map((object) => `${prefix}/${object.name}`);
    if (paths.length === 0) return;
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  };

  for (const claim of claims) {
    try {
      const prefix = `${claim.owner_user_id}/${claim.document_id}`;
      await removePrefixObjects(STUDIO_DOCUMENT_ASSET_BUCKET, prefix);
      await removePrefixObjects(RENDER_ARTIFACT_BUCKET, prefix);

      const { data: finalized, error: finalizeError } = await supabase.rpc(
        "cardforge_finalize_studio_document_purge",
        {
          p_owner_user_id: claim.owner_user_id,
          p_document_id: claim.document_id,
        },
      );
      if (finalizeError) throw finalizeError;
      if (finalized) purged += 1;
    } catch (error) {
      failed += 1;
      console.error("Assistant draft purge will be retried:", {
        documentId: claim.document_id,
        error,
      });
      const { error: releaseError } = await supabase.rpc(
        "cardforge_release_studio_document_purge",
        {
          p_owner_user_id: claim.owner_user_id,
          p_document_id: claim.document_id,
        },
      );
      if (releaseError) {
        console.error("Unable to release assistant draft purge claim:", releaseError);
      }
    }
  }

  return respond(failed > 0 ? 207 : 200, {
    expired: expiredCount ?? 0,
    claimed: claims.length,
    purged,
    failed,
  });
});
