import { createHash } from 'node:crypto';
import { SITE_MEDIA_BUCKET } from '../model/siteMedia';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { validateWebsitePresentationManifest, websiteManifestFromPublished, validateWebsiteUrlDisposition, type WebsitePresentationManifest } from '../model/websitePresentation';

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
/**
 * Exact media proof happens at the trusted server boundary. Bytes are read from
 * existing public-site Storage, not copied to a second bucket or embedded in JSON.
 */
export async function verifyWebsiteMediaBytes(manifest: WebsitePresentationManifest): Promise<void> {
  const db = database();
  for (const ref of manifest.media) {
    if (!ref.storagePath) continue;
    const { data, error } = await db.storage.from(SITE_MEDIA_BUCKET).download(ref.storagePath);
    if (error || !data) throw new WebsiteEditionStoreError('A referenced website image is missing.', 409);
    const digest = createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex');
    if (digest !== ref.sha256) throw new WebsiteEditionStoreError('Website image bytes changed. Reload before saving.', 409);
  }
}

export async function saveWebsiteRevision(input: {
  editionId: string; expectedRevisionId: string | null; operationId: string;
  actor: string; manifest: unknown;
}): Promise<string> {
  assertId(input.editionId); assertId(input.operationId);
  if (input.expectedRevisionId) assertId(input.expectedRevisionId);
  const manifest = validateWebsitePresentationManifest(input.manifest);
  await verifyWebsiteMediaBytes(manifest);
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
  urlDisposition: unknown;
}): Promise<number> {
  assertId(input.revisionId); assertId(input.operationId);
  const manifest = await readWebsiteRevision(input.revisionId);
  await verifyWebsiteMediaBytes(manifest);
  const current = await readLiveWebsiteRevision();
  if (current.generation !== input.expectedGeneration) {
    throw new WebsiteEditionStoreError('Live website changed. Reload activation state.', 409);
  }
  const previous = current.revisionId ? await readWebsiteRevision(current.revisionId) : null;
  const disposition = validateWebsiteUrlDisposition(previous, manifest, input.urlDisposition);
  const { data, error } = await database().rpc('cardforge_website_activate', {
    p_revision_id: input.revisionId, p_expected_generation: input.expectedGeneration,
    p_operation_id: input.operationId, p_actor: input.actor,
    p_url_disposition: disposition,
  });
  if (error) translate(error);
  if (!Number.isSafeInteger(data)) throw new WebsiteEditionStoreError('Activation result is unconfirmed. Read back before retry.', 503);
  return data as number;
}

export async function createWebsiteEdition(name: string): Promise<string> {
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    throw new WebsiteEditionStoreError('Edition name must be 1–100 characters.', 400);
  }
  const { data, error } = await database().from('cardforge_website_editions')
    .insert({ name: name.trim() }).select('id').single();
  if (error || !data?.id) throw new WebsiteEditionStoreError('Unable to create website edition.', 503);
  return data.id as string;
}
export async function listWebsiteEditions(): Promise<{ id: string; name: string; archivedAt: string | null }[]> {
  const { data, error } = await database().from('cardforge_website_editions')
    .select('id,name,archived_at').order('created_at', { ascending: true });
  if (error) throw new WebsiteEditionStoreError('Unable to list website editions.', 503);
  return (data ?? []).map((row) => ({
    id: row.id as string, name: row.name as string, archivedAt: row.archived_at as string | null,
  }));
}
export async function archiveWebsiteEdition(editionId: string): Promise<void> {
  assertId(editionId);
  const { data, error } = await database().rpc('cardforge_website_archive_edition', { p_edition_id: editionId });
  if (error?.message?.includes('website_edition_active')) {
    throw new WebsiteEditionStoreError('The current live edition cannot be archived.', 409);
  }
  if (error) translate(error);
  if (data !== true) throw new WebsiteEditionStoreError('Edition is already archived or missing.', 404);
}

/**
 * Idempotent initial adoption. Published settings and existing media remain
 * unchanged. The database atomically compares all source update tokens before
 * installing the first live revision; any concurrent edit rejects adoption.
 */
export async function initializeWebsiteEditions(actor: string, operationId: string): Promise<string> {
  assertId(operationId);
  const db = database();
  const [settings, copy, media] = await Promise.all([
    import('./siteConfigurationStore').then((m) => m.getPublicSiteConfiguration()),
    import('./contentStore').then((m) => m.getSiteContentBlocks()),
    import('./siteMediaStore').then((m) => m.getSiteMedia()),
  ]);
  const refs = await Promise.all(media.map(async (asset) => {
    if (!asset.storagePath) return {
      slot: asset.slot, storagePath: null, sha256: null, alt: asset.alt,
      width: asset.width, height: asset.height, presentation: asset.presentation,
    };
    const { data, error } = await db.storage.from(SITE_MEDIA_BUCKET).download(asset.storagePath);
    if (error || !data) throw new WebsiteEditionStoreError('Current published media is unreadable.', 503);
    return {
      slot: asset.slot, storagePath: asset.storagePath,
      sha256: createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex'),
      alt: asset.alt, width: asset.width, height: asset.height, presentation: asset.presentation,
    };
  }));
  const manifest = websiteManifestFromPublished({ configuration: settings, content: copy, media: refs });
  const copyEpochs = Object.fromEntries(copy.filter((item) => item.updatedAt !== null)
    .map((item) => [item.slug, item.updatedAt]));
  const mediaEpochs = Object.fromEntries(media.filter((item) => item.updatedAt !== null)
    .map((item) => [item.slot, item.updatedAt]));
  const { data, error } = await db.rpc('cardforge_website_initialize', {
    p_manifest: manifest, p_media: manifest.media, p_config_epoch: settings.updatedAt ?? null,
    p_copy_epochs: copyEpochs, p_media_epochs: mediaEpochs,
    p_operation_id: operationId, p_actor: actor,
  });
  if (error?.message?.includes('website_bootstrap_conflict')) {
    throw new WebsiteEditionStoreError('Published website changed while adopting it. Reload before retrying.', 409);
  }
  if (error?.message?.includes('website_already_initialized')) {
    throw new WebsiteEditionStoreError('Website editions have already been initialized. Read current activation.', 409);
  }
  if (error) translate(error);
  if (typeof data !== 'string') throw new WebsiteEditionStoreError('Initial adoption is unconfirmed. Read live state before retrying.', 503);
  return data;
}

export async function readActivatedWebsiteRedirect(
 generation: number, slug: string,
): Promise<string | null> {
 const { data, error } = await database().from('cardforge_website_activations')
   .select('url_disposition').eq('generation',generation).maybeSingle();
 if (error) throw new WebsiteEditionStoreError('Website redirects unavailable.',503);
 const value=(data?.url_disposition as Record<string,unknown>|undefined)?.[slug];
 if (!value || typeof value!=='object' || Array.isArray(value)) return null;
 const row=value as Record<string,unknown>;
 return row.kind==='redirect' && typeof row.destination==='string' ? row.destination : null;
}
export async function readWebsiteRevisionIdentity(revisionId: string):
 Promise<{ editionId: string; ordinal: number }> {
 assertId(revisionId);
 const {data,error}=await database().from('cardforge_website_revisions')
  .select('edition_id,ordinal').eq('id',revisionId).single();
 if(error || !data) throw new WebsiteEditionStoreError('Website revision unavailable.',404);
 return {editionId:data.edition_id as string,ordinal:data.ordinal as number};
}
export async function listWebsiteRevisions(editionId: string): Promise<
 {id:string;ordinal:number;createdAt:string}[]> {
 assertId(editionId);
 const {data,error}=await database().from('cardforge_website_revisions')
  .select('id,ordinal,created_at').eq('edition_id',editionId).order('ordinal',{ascending:false});
 if(error) throw new WebsiteEditionStoreError('Website history unavailable.',503);
 return (data??[]).map((item)=>({id:item.id as string,ordinal:item.ordinal as number,createdAt:item.created_at as string}));
}

/** Exact operation-id readback; only called from a verified Owner route. */
export async function readSavedWebsiteOperation(operationId: string): Promise<string | null> {
 assertId(operationId);
 const { data, error } = await database().from('cardforge_website_revisions')
  .select('id').eq('operation_id',operationId).maybeSingle();
 if (error) throw new WebsiteEditionStoreError('Cannot check saved operation.',503);
 return typeof data?.id==='string'?data.id:null;
}
