import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanCompletedDeletionReferences } from '@/features/project/model/completedDeletionCleanup';
import { prepareCompletedDeletionCleanup } from '@/features/project/client/completedDeletionCleanup';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';
import type { TCGCardTemplate } from '@/domain/templates';
import { getCardFaceCanvas } from '@/domain/rendering';
import { resolveFreeformImageUrl } from '@/features/card-rendering/model/elementStyles';

const dead = 'https://staging.supabase.co/storage/v1/object/public/art/removed.png';
const live = 'https://external.example/original.png';
const template: TCGCardTemplate = { id: 'shared', name: 'Shared', aspectRatio: '63:88', templateSource: 'user',
  fieldContracts: [{ key: 'art', type: 'image', elementId: 'picture', required: true }],
  freeformCanvas: { width: 630, height: 880, hierarchyVersion: 2, elements: [
    { id: 'picture', name: 'Picture', type: 'image', imageSource: '{{art}}', x: 10, y: 20, width: 100, height: 100, zIndex: 1 },
    { id: 'label', name: 'Label', type: 'text', parentId: 'picture', content: '{{art}}', x: 5, y: 6, width: 50, height: 20, zIndex: 2 },
  ] } };
const document = () => createProjectDocumentFromState({ userTemplates: [structuredClone(template)], cardSets: [{ id: 'set', name: 'Set', templateIds: ['shared'] }],
  storedCards: [
    { uniqueId: 'deleted', templateId: 'shared', setId: 'set', data: { art: dead, description: dead } },
    { uniqueId: 'other', templateId: 'shared', setId: 'set', data: { art: live } },
  ], appearanceStyles: [] });

afterEach(() => vi.unstubAllGlobals());
describe('completed public deletion cleanup', () => {
  it('isolates card artwork, preserves shared live artwork, unrelated text and child world placement', () => {
    const original = document();
    const before = JSON.stringify(original);
    const result = cleanCompletedDeletionReferences(original, new Set([dead]));
    expect(result.changed).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
    const [cleaned, other] = result.document.storedCards;
    expect(other.templateId).toBe('shared');
    expect(other.data.art).toBe(live);
    expect(cleaned.templateId).not.toBe('shared');
    expect(cleaned.data).toEqual({ art: dead, description: dead });
    const fork = result.document.userTemplates.find((item) => item.id === cleaned.templateId)!;
    expect(fork.freeformCanvas!.elements).toEqual([
      expect.objectContaining({ id: 'picture', x: 10, y: 20, width: 100, height: 100, imageSource: '__cardforge_deleted_media_blank__' }),
      expect.objectContaining({ id: 'label', x: 5, y: 6, parentId: 'picture', content: '{{art}}' }),
    ]);
    expect(fork.fieldContracts).toEqual(template.fieldContracts);
    expect(result.document.userTemplates.find((item) => item.id === 'shared')!.freeformCanvas!.elements).toHaveLength(2);
    const again = cleanCompletedDeletionReferences(result.document, new Set([dead]));
    if (again.changed) console.info('completed-deletion-repeat-diff', JSON.stringify({
      templatesBefore: result.document.userTemplates.map(t => ({ id: t.id, elements: t.freeformCanvas?.elements })),
      templatesAfter: again.document.userTemplates.map(t => ({ id: t.id, elements: t.freeformCanvas?.elements })),
      cardBefore: result.document.storedCards.map(c => ({ id: c.uniqueId, templateId: c.templateId, backingTemplateId: c.backingTemplateId })),
      cardAfter: again.document.storedCards.map(c => ({ id: c.uniqueId, templateId: c.templateId, backingTemplateId: c.backingTemplateId })),
    }));
    expect(again.changed).toBe(false);
  });

  it('keeps a repaired image blank through canonical field materialization with retained card data and contracts', () => {
    const original = document();
    const repaired = cleanCompletedDeletionReferences(original, new Set([dead])).document;
    const card = repaired.storedCards[0];
    const fork = repaired.userTemplates.find(t => t.id === card.templateId)!;
    expect(fork.fieldContracts).toEqual(template.fieldContracts);
    expect(card.data).toEqual({ art: dead, description: dead });
    const rendered = getCardFaceCanvas({ uniqueId: card.uniqueId, template: fork, backingTemplate: null, backingTemplateId: null, data: card.data }, 'front');
    const picture = rendered?.elements.find(e => e.id === 'picture');
    expect(picture).toMatchObject({ id: 'picture', type: 'image', imageSource: '__cardforge_deleted_media_blank__', x: 10, y: 20 });
    expect(picture && resolveFreeformImageUrl(picture, card.data)).toBe('');
    expect(rendered?.elements.find(e => e.id === 'label')?.parentId).toBe('picture');
    // The sibling still materializes its original field contract and live art.
    const sibling = repaired.storedCards[1];
    const shared = repaired.userTemplates.find(t => t.id === sibling.templateId)!;
    const siblingCanvas = getCardFaceCanvas({ uniqueId: sibling.uniqueId, template: shared, backingTemplate: null, backingTemplateId: null, data: sibling.data }, 'front');
    const livePicture = siblingCanvas?.elements.find(e => e.id === 'picture');
    expect(livePicture && resolveFreeformImageUrl(livePicture, sibling.data)).toBe(live);
  });

  it('preserves a live card override when the shared default was deleted, on both faces', () => {
    const original = document();
    original.userTemplates[0].freeformCanvas!.elements[0].imageSource = dead;
    original.storedCards[0].data = {};
    original.storedCards[1].data = { image_picture_picture: live };
    original.storedCards[1].backingTemplateId = 'shared';
    original.storedCards[1].backingData = { image_picture_picture: live };
    const result = cleanCompletedDeletionReferences(original, new Set([dead]));
    const other = result.document.storedCards[1];
    for (const id of [other.templateId, other.backingTemplateId]) {
      expect(id).not.toBe('shared');
      expect(result.document.userTemplates.find((item) => item.id === id)!.freeformCanvas!.elements.some((item) => item.id === 'picture')).toBe(true);
    }
  });

  it('matches explicit image contracts and backing preview fallback used by the renderer', () => {
    const original = document();
    original.userTemplates[0].freeformCanvas!.elements[0].imageSource = live;
    original.userTemplates[0].templatePreviewData = { art: dead };
    original.storedCards[1].backingTemplateId = 'shared';
    const result = cleanCompletedDeletionReferences(original, new Set([dead]));
    const front = result.document.userTemplates.find((item) => item.id === result.document.storedCards[0].templateId)!;
    const back = result.document.userTemplates.find((item) => item.id === result.document.storedCards[1].backingTemplateId)!;
    expect(front.freeformCanvas!.elements.find((item) => item.id === 'picture')?.imageSource).toBe('__cardforge_deleted_media_blank__');
    expect(back.freeformCanvas!.elements.find((item) => item.id === 'picture')?.imageSource).toBe('__cardforge_deleted_media_blank__');
    expect(back.templatePreviewData).toEqual({ art: dead });
    expect(result.document.userTemplates.find((item) => item.id === 'shared')!.freeformCanvas!.elements).toHaveLength(2);
  });

  it('blanks deleted icon media without legacy Sparkles fallback or geometry changes', () => {
    const original = document();
    original.userTemplates[0].freeformCanvas!.elements.push({ id: 'icon', name: 'Icon', type: 'icon', iconImageSource: dead,
      x: 17, y: 28, width: 40, height: 35, zIndex: 3 });
    const result = cleanCompletedDeletionReferences(original, new Set([dead]));
    const icon = result.document.userTemplates[0].freeformCanvas!.elements.find(e => e.id === 'icon')!;
    expect(icon).toMatchObject({ id: 'icon', type: 'icon', x: 17, y: 28, width: 40, height: 35,
      zIndex: 3, iconName: '__cardforge_deleted_media_blank__', iconImageSource: '' });
    expect(cleanCompletedDeletionReferences(result.document, new Set([dead])).changed).toBe(false);
  });

  it('blanks the effective deleted card override while retaining independent embedded fallback and shared sibling', () => {
    const original = document();
    const local = 'cardforge-browser-asset://' + 'a'.repeat(64);
    original.userTemplates[0].freeformCanvas!.elements[0].imageSource = local;
    original.storedCards[0].data.art = dead;
    original.storedCards[1].data.art = local;
    const result = cleanCompletedDeletionReferences(original, new Set([dead]));
    const card = result.document.storedCards[0];
    const fork = result.document.userTemplates.find(t => t.id === card.templateId)!;
    const rendered = getCardFaceCanvas({ uniqueId: card.uniqueId, template: fork,
      backingTemplate: null, backingTemplateId: null, data: card.data }, 'front')!;
    expect(resolveFreeformImageUrl(rendered.elements.find(e => e.id === 'picture')!, card.data)).toBe('');
    expect(fork.fieldContracts).toEqual(template.fieldContracts);
    expect(card.data.art).toBe(dead);
    expect(result.document.userTemplates.find(t => t.id === 'shared')!.freeformCanvas!.elements[0].imageSource).toBe(local);
    const sibling = result.document.storedCards[1];
    const siblingCanvas = getCardFaceCanvas({ uniqueId: sibling.uniqueId,
      template: result.document.userTemplates.find(t => t.id === sibling.templateId)!,
      backingTemplate: null, backingTemplateId: null, data: sibling.data }, 'front')!;
    expect(resolveFreeformImageUrl(siblingCanvas.elements.find(e => e.id === 'picture')!, sibling.data)).toBe(local);
  });

  it('preserves an independently embedded local asset despite an unrelated completed public URL', () => {
    const original = document();
    const local = 'cardforge-browser-asset://' + 'a'.repeat(64);
    original.userTemplates[0].freeformCanvas!.elements[0].imageSource = local;
    original.storedCards[0].data.art = local;
    const repaired = cleanCompletedDeletionReferences(original, new Set([dead]));
    expect(repaired.document.userTemplates[0].freeformCanvas!.elements[0].imageSource).toBe(local);
    expect(repaired.document.storedCards[0].data.art).toBe(local);
  });

  it('leaves pending/private/unknown references alone and clears only confirmed appearance media', () => {
    const original = document();
    expect(cleanCompletedDeletionReferences(original, new Set()).document).toBe(original);
    original.userTemplates[0].appearance = { assetSource: dead, material: { baseColor: 'red', texture: { kind: 'uploaded', imageSource: live } } };
    const result = cleanCompletedDeletionReferences(original, new Set([dead]));
    expect(result.document.userTemplates[0].appearance).toMatchObject({ assetSource: undefined, material: { baseColor: 'red', texture: { imageSource: live } } });
  });

  it.each([new Response('', { status: 503 }), new Response('not json'), new Response(JSON.stringify({ deletedUrls: [live + '/unrequested'] }))])('does not clean on unavailable or malformed evidence', async (response) => {
    const original = document();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    expect(await prepareCompletedDeletionCleanup(original)).toEqual({ document: original, changed: false });
  });

  it('uses only explicit returned proof, without probing artwork URLs', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deletedUrls: [dead] })));
    vi.stubGlobal('fetch', fetch);
    expect((await prepareCompletedDeletionCleanup(document())).changed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/api/catalog/completed-deletions');
  });
});
