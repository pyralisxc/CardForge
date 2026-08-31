import type { CardSet, CardSetOrganization, StoredDisplayCard } from './types';

const cleanId = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const cleanName = (value: unknown): string => (
  typeof value === 'string' && value.trim() ? value.trim() : 'Untitled Set'
);

const cleanStringArray = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim()] : []))]
  : [];

const normalizeOrganization = (value: unknown): CardSetOrganization | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
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
  return {
    arrangement: arrangements.has(record.arrangement as string) ? record.arrangement as CardSetOrganization['arrangement'] : 'grid',
    groupBy: groupings.has(record.groupBy as string) ? record.groupBy as CardSetOrganization['groupBy'] : 'none',
    ...(cleanId(record.groupField) ? { groupField: cleanId(record.groupField)! } : {}),
    ...(cleanId(record.groupTagId) ? { groupTagId: cleanId(record.groupTagId)! } : {}),
    sort: sorts.has(record.sort as string) ? record.sort as CardSetOrganization['sort'] : 'manual',
    ...(cleanId(record.sortField) ? { sortField: cleanId(record.sortField)! } : {}),
    tags: tags.filter((tag, index) => tags.findIndex((candidate) => candidate.id === tag.id) === index),
    positions,
  };
};

export const normalizeCardSet = (value: unknown): CardSet | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = cleanId(record.id);
  if (!id) return null;
  const organization = normalizeOrganization(record.organization);
  return {
    id,
    name: cleanName(record.name),
    ...(organization ? { organization } : {}),
  };
};

export const normalizeCardTagIds = cleanStringArray;

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
  // Stored-card snapshots are a legacy recovery source only. Once a real set
  // registry is present it is authoritative, so stale cards from another local
  // workspace cannot leak extra sets into a replace/import operation.
  if (!hasExplicitSets) {
    storedCards.forEach((card) => {
      const setId = cleanId(card.setId);
      if (!setId || byId.has(setId)) return;
      byId.set(setId, {
        id: setId,
        name: cleanName(card.setName),
      });
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
