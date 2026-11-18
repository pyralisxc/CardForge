import type { CardSet, CardSetCardPosition, CardSetMetadata, CardSetOrganization, StoredDisplayCard } from './types';
import { normalizeSetPlan } from './setPlan';
import { normalizeSetUpdateReviews } from './setUpdateReview';

const cleanId = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const cleanName = (value: unknown): string => (
  typeof value === 'string' && value.trim() ? value.trim() : 'Untitled Set'
);

const cleanStringArray = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim()] : []))]
  : [];

const cleanMetadataText = (value: unknown, limit: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/gu, ' ').slice(0, limit);
  return normalized || null;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const normalizeTemplatePositions = (value: unknown): Record<string, CardSetCardPosition> => {
  if (!isPlainRecord(value)) {
    throw new Error('The Set contains invalid Template placement metadata. Its source was left unchanged.');
  }
  const entries: Array<[string, CardSetCardPosition]> = [];
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = typeof key === 'string' ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    const position = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (typeof key !== 'string' || !key.trim() || !descriptor?.enumerable || !isPlainRecord(position)) {
      throw new Error('The Set contains invalid Template placement metadata. Its source was left unchanged.');
    }
    const coordinateKeys = Reflect.ownKeys(position);
    const x = Object.getOwnPropertyDescriptor(position, 'x');
    const y = Object.getOwnPropertyDescriptor(position, 'y');
    if (coordinateKeys.length !== 2
      || !coordinateKeys.includes('x')
      || !coordinateKeys.includes('y')
      || !x?.enumerable
      || !y?.enumerable
      || !('value' in x)
      || !('value' in y)
      || typeof x.value !== 'number'
      || typeof y.value !== 'number'
      || !Number.isFinite(x.value)
      || !Number.isFinite(y.value)) {
      throw new Error('The Set contains invalid Template placement metadata. Its source was left unchanged.');
    }
    entries.push([key, { x: x.value, y: y.value }]);
  }
  return Object.fromEntries(entries);
};

const normalizeMetadata = (value: unknown): CardSetMetadata | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const type = cleanMetadataText(record.type, 80);
  const tags = cleanStringArray(record.tags)
    .map((tag) => cleanMetadataText(tag, 60))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 40);
  // “card-set” is intentionally the only workflow currently shipped in a
  // portable CardForge project. Unknown workflow labels never become a
  // capability, and normalize to the supported authoring model.
  return {
    workflow: 'card-set',
    ...(type ? { type } : {}),
    tags,
  };
};

const normalizeOrganization = (value: unknown): CardSetOrganization | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const templatePositions = Object.hasOwn(record, 'templatePositions')
    ? normalizeTemplatePositions(record.templatePositions)
    : undefined;
  const arrangements = new Set(['manual', 'grid', 'stack']);
  const groupings = new Set(['none', 'tag', 'field', 'template', 'content-type', 'batch']);
  const sorts = new Set(['manual', 'name', 'field-value', 'recently-changed']);
  const positions = record.positions && typeof record.positions === 'object' && !Array.isArray(record.positions)
    ? Object.fromEntries(Object.entries(record.positions as Record<string, unknown>).flatMap(([id, position]) => {
        if (!position || typeof position !== 'object' || Array.isArray(position)) return [];
        const candidate = position as Record<string, unknown>;
        return Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
          ? [[id, { x: Number(candidate.x), y: Number(candidate.y) }] as const]
          : [];
      }))
    : {};
  const tags = Array.isArray(record.tags) ? record.tags.flatMap((tag) => {
    if (!tag || typeof tag !== 'object' || Array.isArray(tag)) return [];
    const candidate = tag as Record<string, unknown>;
    const id = cleanId(candidate.id);
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
    return id && label ? [{ id, label }] : [];
  }) : [];
  const spatialVersion = record.spatialVersion === 2 ? 2 as const : undefined;
  const gridSizeMm = Number(record.gridSizeMm);
  return {
    ...(spatialVersion ? { spatialVersion } : {}),
    ...(Number.isFinite(gridSizeMm) && gridSizeMm > 0 ? { gridSizeMm: Math.min(1000, gridSizeMm) } : {}),
    arrangement: arrangements.has(record.arrangement as string) ? record.arrangement as CardSetOrganization['arrangement'] : 'grid',
    groupBy: groupings.has(record.groupBy as string) ? record.groupBy as CardSetOrganization['groupBy'] : 'none',
    ...(cleanId(record.groupField) ? { groupField: cleanId(record.groupField)! } : {}),
    ...(cleanId(record.groupTagId) ? { groupTagId: cleanId(record.groupTagId)! } : {}),
    sort: sorts.has(record.sort as string) ? record.sort as CardSetOrganization['sort'] : 'manual',
    ...(cleanId(record.sortField) ? { sortField: cleanId(record.sortField)! } : {}),
    tags: tags.filter((tag, index) => tags.findIndex((candidate) => candidate.id === tag.id) === index),
    positions,
    ...(templatePositions !== undefined ? { templatePositions } : {}),
  };
};

export const normalizeCardSet = (value: unknown): CardSet | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = cleanId(record.id);
  if (!id) return null;
  const organization = normalizeOrganization(record.organization);
  const metadata = normalizeMetadata(record.metadata);
  const templateIds = cleanStringArray(record.templateIds);
  const updateReviews = normalizeSetUpdateReviews(record.updateReviews);
  return {
    id,
    name: cleanName(record.name),
    ...(record.plan !== undefined ? { plan: normalizeSetPlan(record.plan) } : {}),
    ...(updateReviews !== undefined ? { updateReviews } : {}),
    ...(templateIds.length ? { templateIds } : {}),
    ...(organization ? { organization } : {}),
    ...(metadata ? { metadata } : {}),
  };
};

export const normalizeCardTagIds = cleanStringArray;

/**
 * Preserve explicit Set → Template references while guaranteeing that every
 * generated Artifact's required front/back Templates are also referenced by
 * its Set. Removing or moving an Artifact therefore never silently erases an
 * intentionally prepared Template from the Set.
 *
 * This is a workspace mutation helper. Low-level parsing of a modern document
 * preserves the Set registry exactly as authored; only legacy documents with
 * no real Set registry derive relationships from stored cards.
 */
export const ensureCardSetTemplateReferences = ({
  cardSets,
  storedCards,
}: {
  cardSets: CardSet[];
  storedCards: StoredDisplayCard[];
}): CardSet[] => {
  if (!cardSets.length) return cardSets;
  const firstSetId = cardSets[0]?.id ?? null;
  const references = new Map(cardSets.map((set) => [set.id, new Set(set.templateIds ?? [])] as const));
  storedCards.forEach((card) => {
    const setId = cleanId(card.setId) ?? firstSetId;
    if (!setId) return;
    const setReferences = references.get(setId);
    if (!setReferences) return;
    if (cleanId(card.templateId)) setReferences.add(card.templateId.trim());
    if (cleanId(card.backingTemplateId)) setReferences.add(card.backingTemplateId!.trim());
  });
  return cardSets.map((set) => {
    const templateIds = [...(references.get(set.id) ?? new Set<string>())];
    return templateIds.length ? { ...set, templateIds } : { ...set, templateIds: undefined };
  });
};

export const reconcileCardSets = ({
  cardSets = [],
  activeCardSet,
  storedCards = [],
}: {
  cardSets?: unknown[];
  activeCardSet?: CardSet | null;
  storedCards?: StoredDisplayCard[];
}): CardSet[] => {
  const byId = new Map<string, CardSet>();
  let hasExplicitSets = false;
  cardSets.forEach((candidate) => {
    const normalized = normalizeCardSet(candidate);
    if (!normalized) return;
    hasExplicitSets = true;
    byId.set(normalized.id, normalized);
  });
  if (activeCardSet) {
    const normalized = normalizeCardSet(activeCardSet);
    if (normalized) byId.set(normalized.id, normalized);
  }
  // Stored-card snapshots are a legacy recovery source only. Once a real Set
  // registry exists it is authoritative; workspace mutation owners later
  // guarantee Artifact dependencies are represented there.
  if (!hasExplicitSets) {
    storedCards.forEach((card) => {
      const setId = cleanId(card.setId);
      if (!setId || byId.has(setId)) return;
      byId.set(setId, {
        id: setId,
        name: cleanName(card.setName),
        templateIds: cleanStringArray([card.templateId, card.backingTemplateId]),
      });
    });
    return ensureCardSetTemplateReferences({
      cardSets: Array.from(byId.values()),
      storedCards,
    });
  }
  return Array.from(byId.values());
};

export const resolveActiveCardSet = ({
  cardSets,
  preferredId,
}: {
  cardSets: CardSet[];
  preferredId?: string | null;
}): CardSet | null => (
  (preferredId ? cardSets.find((set) => set.id === preferredId) : null)
  ?? cardSets[0]
  ?? null
);