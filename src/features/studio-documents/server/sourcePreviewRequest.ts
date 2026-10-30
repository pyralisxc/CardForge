import { AccountToolAccessError } from '@/features/account/server';
import { getAccountToolAccessForUserId, getCurrentAccountToolAccess } from '@/features/account/server';
import { sourceRenderRequestSchema } from '../sourcePreview';
import { readSavedSourcePreview } from './savedSourcePreview';
import { readSavedSourcePreviewToken } from './studioDocumentPreviewToken';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

/** Every render/export request resolves CURRENT identity/access before reading source or cache. */
export async function readSourcePreviewRequest(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const capability = token ? readSavedSourcePreviewToken(token) : null;
  if (token && !capability) throw new StudioDocumentStoreError('This exact render capability expired or is invalid.', 404);
  const account = capability ? await getAccountToolAccessForUserId(capability.ownerUserId) : await getCurrentAccountToolAccess();
  let raw: unknown;
  try { raw = capability?.request ?? JSON.parse(url.searchParams.get('request') ?? 'null'); }
  catch { throw new StudioDocumentStoreError('Provide a valid exact source request.', 400); }
  const parsed = sourceRenderRequestSchema.safeParse(raw);
  if (!parsed.success) throw new StudioDocumentStoreError('Provide complete exact source and version pins.', 400);
  const input = parsed.data;
  if (input.operation === 'clean-export' && !account.entitlement.capabilities.canExportClean) throw new AccountToolAccessError('Clean export is not included in the current account entitlement. Request an ordinary watermarked export.', 403);
  const snapshot = await readSavedSourcePreview({ ...account, isContributor: account.entitlement.accessMode === 'contributor', scopes: [] }, input.source);
  if (snapshot.sourceVersion !== input.sourceVersion) throw new StudioDocumentStoreError('The exact source changed. Inspect it again; no newer source was substituted.', 409);
  return { ...snapshot, branded: capability ? input.operation === 'preview' || !account.entitlement.capabilities.canExportClean : !account.entitlement.capabilities.canExportClean };
}
