import { assertContainedSource, assertContainedTemplate } from './savedSourceContainment';
import { AccountToolAccessError } from '@/features/account/server';
import { createHash } from 'node:crypto';
import type { StudioAgentAccess } from './studioAgentAccess';
import { readExactCandidateReview, exactCandidateIdentitySchema, readExactPublishedSource, isRepositoryStyle, isRepositoryTemplate } from '@/features/pipeline/server';
import { decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/server';
import { readConnectedProjectForAgent } from './mcpProjectSourceBridge';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { savedSourceSelectionSchema, type SavedSourceSelection, type NativeSourceSnapshot, type NativeSourceContent } from '../sourcePreview';

export async function readSavedSourcePreview(access: StudioAgentAccess, raw: SavedSourceSelection): Promise<NativeSourceSnapshot> {
  const source = savedSourceSelectionSchema.parse(raw);
  if (source.kind === 'pipeline-candidate') {
    if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for exact pending Template review.', 403);
    const parsed = exactCandidateIdentitySchema.safeParse(source.identity);
    if (!parsed.success) throw new StudioDocumentStoreError('Provide the complete native exact candidate identity and base pins.', 400);
    const identity = parsed.data;
    const candidate = await readExactCandidateReview(identity);
    assertContainedTemplate(candidate.template);
    return { title: candidate.template.name, sourceVersion: candidate.hydratedSha256, content: { kind: 'template', template: candidate.template }, identity: { submissionId: identity.submissionId, lineageId: identity.lineageId, assetId: identity.assetId, revisionNumber: identity.revisionNumber } };
  }
  if (source.kind === 'google-drive') {
    const result = await readConnectedProjectForAgent({ access, provider: 'google-drive', ...source });
    if (source.setId && source.cardIds) validateCards(result.document, source.setId, source.cardIds);
    const content = selectCards(result.document, source.setId, source.cardIds);
    return {
      title: result.summary.name,
      sourceVersion: createHash('sha256').update(JSON.stringify({ identity: { projectId: source.projectId, providerRevision: source.expectedProviderRevision, projectRevision: source.expectedProjectRevision }, accountId: result.summary.accountId, bytes: createHash('sha256').update(result.bytes).digest('hex') })).digest('hex'),
      identity: { provider: 'google-drive', projectId: source.projectId, providerRevision: source.expectedProviderRevision, projectRevision: source.expectedProjectRevision },
      content, availableSelections: selections(result.document),
    };
  }
  const result = await readExactPublishedSource(access, source);
  let content: NativeSourceContent;
  let availableSelections: NativeSourceSnapshot['availableSelections'];
  if (result.assetType === 'templates' && isRepositoryTemplate(result.content)) content = { kind: 'template', template: result.content };
  else if (result.assetType === 'elementPresets' && isRepositoryStyle(result.content)) content = { kind: 'recipe', recipe: result.content };
  else if (result.assetType === 'sets' && result.bytes) {
    const document = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(new Uint8Array(result.bytes)));
    availableSelections = selections(document);
    content = selectCards(document, source.setId, source.cardIds);
  } else if (result.bytes && result.mimeType && /^(?:image\/(?:png|jpeg|webp|svg\+xml)|font\/(?:woff2?|ttf|otf))$/u.test(result.mimeType)) {
    content = { kind: result.assetType === 'fonts' ? 'font' : 'media', presentation: result.presentation, dataUrl: `data:${result.mimeType};base64,${result.bytes.toString('base64')}` };
  } else content = { kind: 'unsupported', reason: 'This exact source has no supported native specimen. Inspect the selected revision in CardForge.' };
  if (content.kind === 'template') assertContainedTemplate(content.template);
  if (content.kind === 'recipe') assertContainedSource(content.recipe);
  return { title: result.title, availableSelections, identity: result.identity, sourceVersion: result.sourceVersion, content };
}
function validateCards(document: Extract<NativeSourceContent, {kind:'cards'}>['document'], setId: string, cardIds: string[]) {
  if (!document.cardSets.some(s => s.id === setId) || cardIds.some(id => !document.storedCards.some(c => c.uniqueId === id && c.setId === setId))) {
    throw new StudioDocumentStoreError('The exact saved source does not contain all selected Set/card identities.', 404);
  }
}

function selections(document: Extract<NativeSourceContent, {kind:'cards'}>['document']) {
  return document.cardSets.slice(0, 25).map(set => ({ setId: set.id, name: set.name,
    totalCards: document.storedCards.filter(c => c.setId === set.id).length,
    cardIds: document.storedCards.filter(c => c.setId === set.id).slice(0, 100).map(c => c.uniqueId) }));
}
function selectCards(document: Extract<NativeSourceContent, {kind:'cards'}>['document'], setId?: string, cardIds?: string[]): NativeSourceContent {
  if (!setId || !cardIds) return {kind:'unsupported',reason:'Choose one saved Set and one to twelve stable card ids from availableSelections; discovery is limited to 25 Sets and the first 100 ids per Set.'};
  validateCards(document, setId, cardIds);
  const cards = document.storedCards.filter(c => c.setId === setId && cardIds.includes(c.uniqueId));
  const required = new Set(cards.map(c => c.templateId));
  const templates = document.userTemplates.filter(t => required.has(t.id ?? ''));
  const fonts = new Set((document.customFonts ?? []).map(f => f.value));
  assertContainedSource({ cards, fonts: document.customFonts }, fonts);
  for (const card of cards) {
    const template = templates.find(t => t.id === card.templateId);
    if (!template) throw new StudioDocumentStoreError('Exact card Template is unavailable; no fallback was substituted.', 400);
    assertContainedTemplate(template, card.data, fonts);
  }
  return { kind:'cards', setId, cardIds, document:{...document,cardSets:document.cardSets.filter(s=>s.id===setId),storedCards:cards,userTemplates:templates} };
}
