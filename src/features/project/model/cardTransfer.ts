import {
  reconcileCardSets,
  type CardSet,
  type StoredDisplayCard,
} from '@/domain/cards';
import {
  reconstructMinimalTemplateObject,
  type CardAssetOption,
  type TCGCardTemplate,
} from '@/domain/templates';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  type ProjectDocumentCustomAssets,
} from './projectDocument';

export const CARD_TRANSFER_VERSION = 1 as const;
export type CardTransferKind = 'set' | 'card';

export interface CardForgeTransferV1 {
  cardforgeTransfer: 1;
  kind: CardTransferKind;
  sets: CardSet[];
  cards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  customAssets: ProjectDocumentCustomAssets;
}

const EMPTY_ASSETS: ProjectDocumentCustomAssets = {
  [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_ICON_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeAssets = (value: unknown): ProjectDocumentCustomAssets => {
  const record = isRecord(value) ? value : {};
  const list = (key: string) => Array.isArray(record[key]) ? record[key] as CardAssetOption[] : [];
  return {
    [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: list(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
    [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: list(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
    [CUSTOM_ICON_ASSETS_STORAGE_KEY]: list(CUSTOM_ICON_ASSETS_STORAGE_KEY),
    [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: list(CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
  };
};

const collectTemplateIds = (sets: CardSet[], cards: StoredDisplayCard[]): Set<string> => {
  const ids = new Set<string>();
  sets.forEach((set) => {
    if (set.frontTemplateId) ids.add(set.frontTemplateId);
    if (set.backingTemplateId) ids.add(set.backingTemplateId);
  });
  cards.forEach((card) => {
    if (card.templateId) ids.add(card.templateId);
    if (card.backingTemplateId) ids.add(card.backingTemplateId);
  });
  return ids;
};

const selectTemplates = (
  templates: TCGCardTemplate[],
  sets: CardSet[],
  cards: StoredDisplayCard[],
): TCGCardTemplate[] => {
  const ids = collectTemplateIds(sets, cards);
  // Published CardForge Library Templates keep stable catalog ids and are resolved
  // from the current library. Only personal Templates travel with portable cards/Sets.
  // Agent cloud checkouts can temporarily materialize a published pipeline Template
  // into the working document, so preserve its pipeline provenance instead of
  // accidentally exporting that transient copy as a personal dependency.
  return templates.filter((template) => (
    template.id
    && ids.has(template.id)
    && template.templateSource !== 'default'
    && template.templateLibrarySource !== 'pipeline'
  ));
};

const filterAssetsForPayload = (
  assets: ProjectDocumentCustomAssets,
  templates: TCGCardTemplate[],
  cards: StoredDisplayCard[],
): ProjectDocumentCustomAssets => {
  const references = JSON.stringify({ templates, cards });
  const filter = (items: CardAssetOption[]) => items.filter((asset) => (
    references.includes(asset.url)
    || references.includes(asset.id)
  ));
  return {
    [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: filter(assets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
    [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: filter(assets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
    [CUSTOM_ICON_ASSETS_STORAGE_KEY]: filter(assets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
    [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: filter(assets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
  };
};

export const createCardSetTransfer = ({
  set,
  storedCards,
  templates,
  customAssets = EMPTY_ASSETS,
}: {
  set: CardSet;
  storedCards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  customAssets?: ProjectDocumentCustomAssets;
}): CardForgeTransferV1 => {
  const cards = storedCards.filter((card) => card.setId === set.id);
  const transferTemplates = selectTemplates(templates, [set], cards);
  return {
    cardforgeTransfer: CARD_TRANSFER_VERSION,
    kind: 'set',
    sets: [set],
    cards,
    templates: transferTemplates,
    customAssets: filterAssetsForPayload(customAssets, transferTemplates, cards),
  };
};

export const createCardTransfer = ({
  card,
  set,
  templates,
  customAssets = EMPTY_ASSETS,
}: {
  card: StoredDisplayCard;
  set: CardSet;
  templates: TCGCardTemplate[];
  customAssets?: ProjectDocumentCustomAssets;
}): CardForgeTransferV1 => {
  const transferTemplates = selectTemplates(templates, [set], [card]);
  return {
    cardforgeTransfer: CARD_TRANSFER_VERSION,
    kind: 'card',
    sets: [set],
    cards: [card],
    templates: transferTemplates,
    customAssets: filterAssetsForPayload(customAssets, transferTemplates, [card]),
  };
};

export const parseCardForgeTransferValue = (value: unknown): CardForgeTransferV1 | null => {
  if (!isRecord(value) || value.cardforgeTransfer !== CARD_TRANSFER_VERSION) return null;
  if (value.kind !== 'set' && value.kind !== 'card') return null;
  if (!Array.isArray(value.cards) || !Array.isArray(value.templates)) return null;
  const templates = value.templates.map((template) => (
    reconstructMinimalTemplateObject({ ...(isRecord(template) ? template : {}), templateSource: 'user' })
  ));
  const cards = value.cards.filter((candidate): candidate is StoredDisplayCard => (
    isRecord(candidate)
    && typeof candidate.templateId === 'string'
    && isRecord(candidate.data)
    && typeof candidate.uniqueId === 'string'
  ));
  if (cards.length !== value.cards.length) return null;
  const fallback: CardSet = {
    id: cards[0]?.setId || 'imported-set',
    name: cards[0]?.setName || 'Imported Set',
    frontTemplateId: cards[0]?.templateId ?? null,
    backingTemplateId: cards[0]?.backingTemplateId ?? null,
  };
  const sets = reconcileCardSets({
    cardSets: Array.isArray(value.sets) ? value.sets : [],
    storedCards: cards,
    fallback,
  });
  if (value.kind === 'card' && cards.length !== 1) return null;
  if (sets.length === 0) return null;
  return {
    cardforgeTransfer: CARD_TRANSFER_VERSION,
    kind: value.kind,
    sets,
    cards,
    templates,
    customAssets: normalizeAssets(value.customAssets),
  };
};

export const parseCardForgeTransferFile = (contents: string): CardForgeTransferV1 | null => {
  try {
    return parseCardForgeTransferValue(JSON.parse(contents));
  } catch {
    return null;
  }
};
