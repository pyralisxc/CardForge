import { getProjectFontValue, remapProjectTemplateFonts } from './projectFont';
import type { ProjectDocumentV1 } from './projectDocument';

export type ProjectEntityKind = 'set' | 'card' | 'template' | 'style' | 'asset' | 'font';
/** Portable identity -> browser identity, owned by one exact provider document. */
export type ProjectDocumentIdentityMap = Partial<Record<ProjectEntityKind, Record<string, string>>>;

export const mapProjectDocumentIdentity = (
  document: ProjectDocumentV1,
  identities: ProjectDocumentIdentityMap,
  direction: 'open' | 'save',
): ProjectDocumentV1 => {
  const reverse = new Map(Object.entries(identities).map(([kind, entries]) => [
    kind, new Map(Object.entries(entries).map(([source, runtime]) => [runtime, source])),
  ]));
  const map = (kind: ProjectEntityKind, id: string): string => {
    const entries = identities[kind] ??= Object.create(null) as Record<string, string>;
    if (direction === 'save') {
      const portable = reverse.get(kind)?.get(id);
      if (portable) return portable;
      Object.defineProperty(entries, id, { value: id, enumerable: true, writable: true, configurable: true });
      return id;
    }
    if (Object.hasOwn(entries, id)) return entries[id]!;
    const runtimeId = `${kind}-${globalThis.crypto.randomUUID()}`;
    Object.defineProperty(entries, id, { value: runtimeId, enumerable: true, writable: true, configurable: true });
    return runtimeId;
  };
  // Only owned entities are remapped. External Library references and authored
  // field values are not identities and must survive byte-for-byte.
  const reference = (kind: ProjectEntityKind, id: string | null | undefined) => {
    if (!id) return id;
    if (direction === 'save') return reverse.get(kind)?.get(id) ?? id;
    return identities[kind] && Object.hasOwn(identities[kind], id) ? identities[kind]![id] : id;
  };
  const fontValues = new Map<string, string>();
  const customFonts = document.customFonts?.map((font) => {
    const id = map('font', font.id);
    const value = getProjectFontValue(id);
    fontValues.set(font.value, value);
    return { ...font, id, value };
  });
  const userTemplates = document.userTemplates.map((template) => ({ ...remapProjectTemplateFonts(template, fontValues), id: template.id ? map('template', template.id) : template.id }));
  const cardIds = new Map(document.storedCards.map((card) => [card.uniqueId, map('card', card.uniqueId)]));
  const cardSets = document.cardSets.map((set) => ({
    ...set, id: map('set', set.id),
    ...(set.organization ? { organization: {
      ...set.organization,
      positions: Object.fromEntries(Object.entries(set.organization.positions).map(([id, position]) => [cardIds.get(id) ?? id, position])),
    } } : {}),
  }));
  const customAssets = { ...document.customAssets };
  for (const key of Object.keys(customAssets) as Array<keyof typeof customAssets>) {
    customAssets[key] = customAssets[key].map((asset) => ({ ...asset, id: map('asset', asset.id) }));
  }
  return {
    ...document, userTemplates, cardSets,
    ...(customFonts ? { customFonts } : {}),
    activeCardSetId: reference('set', document.activeCardSetId) ?? undefined,
    storedCards: document.storedCards.map((card) => ({
      ...card, uniqueId: cardIds.get(card.uniqueId)!,
      setId: reference('set', card.setId) ?? undefined,
      templateId: reference('template', card.templateId) ?? card.templateId,
      backingTemplateId: reference('template', card.backingTemplateId),
    })),
    appearanceStyles: document.appearanceStyles.map((style) => ({ ...style, id: map('style', style.id) })),
    customAssets,
    ...(document.productionPlan ? { productionPlan: {
      ...document.productionPlan,
      assets: document.productionPlan.assets.map((asset) => ({ ...asset, assetId: reference('asset', asset.assetId) ?? undefined })),
    } } : {}),
  };
};
