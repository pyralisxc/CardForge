import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { validateWebsitePresentationManifest, type WebsitePresentationManifest } from '../model/websitePresentation';

export class WebsiteEditionStoreError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
const database = () => {
  const db = getSupabaseServerClient();
  if (!db) throw new WebsiteEditionStoreError('Website revisions are unavailable.', 503);
  return db;
};
const assertId = (id: string): void => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) {
    throw new WebsiteEditionStoreError('Invalid website revision identity.', 400);
  }
};
const translate = (error: { message?: string }): never => {
  const message = error.message ?? '';
  if (message.includes('website_revision_conflict') || message.includes('website_activation_conflict') || message.includes('website_operation_conflict')) {
    throw new WebsiteEditionStoreError('Website state changed. Read the authoritative revision before trying again.', 409);
  }
  if (message.includes('website_edition_unavailable') || message.includes('website_revision_unavailable')) {
    throw new WebsiteEditionStoreError('The selected website edition or revision is unavailable.', 404);
  }
  if (message.includes('website_invalid_input')) throw new WebsiteEditionStoreError('Website revision input is invalid.', 400);
  throw new WebsiteEditionStoreError('Website revision service is unavailable.', 503);
};
export async function readLiveWebsiteRevision(): Promise<{ revisionId: string | null; generation: number }> {
  const { data, error } = await database().from('cardforge_website_state')
    .select('live_revision_id,generation').eq('id', 'cardforge').single();
  if (error || !data) throw new WebsiteEditionStoreError('Website activation state is unavailable.', 503);
  return { revisionId: data.live_revision_id as string | null, generation: data.generation as number };
}
export async function readWebsiteRevision(revisionId: string): Promise<WebsitePresentationManifest> {
  assertId(revisionId);
  const { data, error } = await database().from('cardforge_website_revisions')
    .select('manifest').eq('id', revisionId).single();
  if (error || !data) throw new WebsiteEditionStoreError('Website revision not found.', 404);
  return validateWebsitePresentationManifest(data.manifest);
}
export async function saveWebsiteRevision(input: {
  editionId: string; expectedRevisionId: string | null; operationId: string;
  actor: string; manifest: unknown;
}): Promise<string> {
  assertId(input.editionId); assertId(input.operationId);
  if (input.expectedRevisionId) assertId(input.expectedRevisionId);
  const manifest = validateWebsitePresentationManifest(input.manifest);
  const { data, error } = await database().rpc('cardforge_website_save_revision', {
    p_edition_id: input.editionId, p_expected_revision_id: input.expectedRevisionId,
    p_operation_id: input.operationId, p_actor: input.actor,
    p_manifest: manifest, p_media: manifest.media,
  });
  if (error) translate(error);
  if (typeof data !== 'string') throw new WebsiteEditionStoreError('Save result is unconfirmed. Read back before retry.', 503);
  return data;
}
export async function activateWebsiteRevision(input: {
  revisionId: string; expectedGeneration: number; operationId: string; actor: string;
}): Promise<number> {
  assertId(input.revisionId); assertId(input.operationId);
  // Callers must validate exact media retention, schema compatibility, route disposition
  // and the same saved revision before this transaction is considered eligible.
  const { data, error } = await database().rpc('cardforge_website_activate', {
    p_revision_id: input.revisionId, p_expected_generation: input.expectedGeneration,
    p_operation_id: input.operationId, p_actor: input.actor,
  });
  if (error) translate(error);
  if (!Number.isSafeInteger(data)) throw new WebsiteEditionStoreError('Activation result is unconfirmed. Read back before retry.', 503);
  return data as number;
}
