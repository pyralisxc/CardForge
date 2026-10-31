import { AccountToolAccessError } from '@/features/account/server';
import { createHash } from 'node:crypto';
import { getAccountToolAccessForUserId } from '@/features/account/server';
import { CARDFORGE_RENDERER_CONTRACT_VERSION, readRenderArtifact, renderCanonicalBrowserImages, writeRenderArtifact, type RenderArtifactDescriptor } from '@/features/render-artifacts/server';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';
import { sourceRenderRequestSchema, type SourceRenderRequest } from '../sourcePreview';
import { readSavedSourcePreview } from './savedSourcePreview';
import { createSavedSourcePreviewToken } from './studioDocumentPreviewToken';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

export async function renderSavedSource({ actorUserId, request, publicOrigin }: { actorUserId: string; request: SourceRenderRequest; publicOrigin: string }) {
  const input = sourceRenderRequestSchema.parse(request);
  const access = await getAccountToolAccessForUserId(actorUserId);
  const agent = { ...access, isContributor: access.entitlement.accessMode === 'contributor', scopes: [] };
  if (input.operation === 'clean-export' && !access.entitlement.capabilities.canExportClean) throw new AccountToolAccessError('Current entitlement does not permit clean export. Request an ordinary watermarked export.', 403);
  const snapshot = await readSavedSourcePreview(agent, input.source);
  if (snapshot.sourceVersion !== input.sourceVersion) throw new StudioDocumentStoreError('Exact source changed. Inspect it again before preview or export.', 409);
  if (snapshot.content.kind === 'unsupported') throw new StudioDocumentStoreError(snapshot.content.reason, 400);
  const branded = input.operation === 'preview' || !access.entitlement.capabilities.canExportClean;
  const sourceId = createHash('sha256').update(JSON.stringify(input.source)).digest('hex');
  const subjects = snapshot.content.kind === 'cards' ? snapshot.content.cardIds : [snapshot.content.kind === 'template' ? 'template' : 'specimen'];
  const descriptors: RenderArtifactDescriptor[] = subjects.map(subjectId => ({
    sourceKind: input.source.kind === 'google-drive' ? 'google-drive-project' : 'pipeline-revision', sourceId, sourceRevision: snapshot.sourceVersion,
    kind: 'card-preview', subjectId, face: 'front', profile: `virtual-150-source-${branded ? 'branded' : 'clean'}-v1`, rendererVersion: CARDFORGE_RENDERER_CONTRACT_VERSION,
  }));
  const cached = await Promise.all(descriptors.map(descriptor => readRenderArtifact({ ownerUserId: actorUserId, descriptor })));
  if (cached.some(a => !a)) {
    const budget = await consumeRateLimit({ action: 'studio-ai-render', identity: actorUserId, limit: 60, windowSeconds: 3600 });
    if (!budget.allowed) throw new StudioDocumentStoreError('Uncached render budget reached. Reuse the current exact artifact or try later.', 429);
    const token = createSavedSourcePreviewToken({ ownerUserId: actorUserId, request: { ...input, operation: branded ? 'preview' : 'clean-export' } });
    const images = await renderCanonicalBrowserImages({ publicOrigin, renderUrl: `${publicOrigin}/saved-source-preview?token=${encodeURIComponent(token)}`, selector: 'img[data-cardforge-render-artifact="saved-source"]', expectedCount: subjects.length });
    // Recheck source and current entitlement after rendering, before delivery/cache publication.
    const latest = await getAccountToolAccessForUserId(actorUserId);
    if (!branded && !latest.entitlement.capabilities.canExportClean) throw new AccountToolAccessError('Clean export entitlement changed. Request a watermarked export.', 403);
    const after = await readSavedSourcePreview({ ...latest, isContributor: latest.entitlement.accessMode === 'contributor', scopes: [] }, input.source);
    if (after.sourceVersion !== input.sourceVersion) throw new StudioDocumentStoreError('Source changed while rendering; no artifact was delivered.', 409);
    for (const [i, descriptor] of descriptors.entries()) {
      const image = images.find(image => image.subjectId === descriptor.subjectId);
      if (!image) throw new StudioDocumentStoreError('Canonical rendering omitted a selected native specimen.', 503);
      cached[i] ??= await writeRenderArtifact({ ownerUserId: actorUserId, descriptor, bytes: image.bytes });
    }
  }
  const deliveryAccess = await getAccountToolAccessForUserId(actorUserId);
  if (!branded && !deliveryAccess.entitlement.capabilities.canExportClean) throw new AccountToolAccessError('Clean export entitlement changed. Request a watermarked export.', 403);
  const deliverySource = await readSavedSourcePreview({ ...deliveryAccess, isContributor: deliveryAccess.entitlement.accessMode === 'contributor', scopes: [] }, input.source);
  if (deliverySource.sourceVersion !== input.sourceVersion) throw new StudioDocumentStoreError('Source changed before delivery.', 409);
  return { snapshot, branded, artifacts: cached.filter((a): a is NonNullable<typeof a> => !!a), openInCardForgeUrl: `${publicOrigin}/saved-source-preview?request=${encodeURIComponent(JSON.stringify({ ...input, operation: 'preview' }))}` };
}
