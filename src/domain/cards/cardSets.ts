import type { CardSet, StoredDisplayCard } from './types';

const cleanId = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const cleanName = (value: unknown): string => (
  typeof value === 'string' && value.trim() ? value.trim() : 'Untitled Set'
);

export const normalizeCardSet = (value: unknown): CardSet | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = cleanId(record.id);
  if (!id) return null;
  return {
    id,
    name: cleanName(record.name),
    frontTemplateId: cleanId(record.frontTemplateId),
    backingTemplateId: cleanId(record.backingTemplateId),
  };
};

export const reconcileCardSets = ({
  cardSets = [],
  activeCardSet,
  storedCards = [],
  fallback,
}: {
  cardSets?: unknown[];
  activeCardSet?: CardSet | null;
  storedCards?: StoredDisplayCard[];
  fallback: CardSet;
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
        frontTemplateId: cleanId(card.templateId),
        backingTemplateId: cleanId(card.backingTemplateId),
      });
    });
  }
  if (byId.size === 0) byId.set(fallback.id, fallback);
  return Array.from(byId.values());
};

export const resolveActiveCardSet = ({
  cardSets,
  preferredId,
  fallback,
}: {
  cardSets: CardSet[];
  preferredId?: string | null;
  fallback: CardSet;
}): CardSet => (
  (preferredId ? cardSets.find((set) => set.id === preferredId) : null)
  ?? cardSets[0]
  ?? fallback
);
