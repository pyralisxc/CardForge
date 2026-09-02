import type { DisplayCard } from '@/domain/rendering';

export type BulkRevisionMatch = { kind: 'unique-id' } | { kind: 'field'; key: string; label: string };

export interface BulkRevisionPlan {
  matchedCount: number;
  unmatchedRows: number[];
  ambiguousRows: number[];
  changedFields: string[];
  preservedFields: string[];
  finalArtifactCount: number;
  revisions: DisplayCard[];
}

const normalizedMatchValue = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();

const readMatchValue = (card: DisplayCard, match: BulkRevisionMatch) => (
  match.kind === 'unique-id' ? card.uniqueId : card.data[match.key]
);

export const buildBulkRevisionPlan = ({
  existing,
  incoming,
  match,
}: {
  existing: readonly DisplayCard[];
  incoming: readonly DisplayCard[];
  match: BulkRevisionMatch;
}): BulkRevisionPlan => {
  const targets = new Map<string, DisplayCard[]>();
  existing.forEach((card) => {
    const value = normalizedMatchValue(readMatchValue(card, match));
    if (!value) return;
    targets.set(value, [...(targets.get(value) ?? []), card]);
  });
  const consumed = new Set<string>();
  const unmatchedRows: number[] = [];
  const ambiguousRows: number[] = [];
  const changedFields = new Set<string>();
  const preservedFields = new Set<string>();
  const revisions: DisplayCard[] = [];

  incoming.forEach((candidate, index) => {
    const value = normalizedMatchValue(readMatchValue(candidate, match));
    const matches = value ? targets.get(value) ?? [] : [];
    if (matches.length === 0) { unmatchedRows.push(index + 2); return; }
    if (matches.length > 1 || consumed.has(matches[0].uniqueId)) { ambiguousRows.push(index + 2); return; }
    const current = matches[0];
    consumed.add(current.uniqueId);
    Object.keys(current.data).forEach((key) => {
      if (!(key in candidate.data)) preservedFields.add(key);
    });
    Object.keys(candidate.data).forEach((key) => {
      if (candidate.data[key] !== current.data[key]) changedFields.add(key);
    });
    revisions.push({
      ...current,
      template: candidate.template,
      backingTemplate: candidate.backingTemplate,
      backingTemplateId: candidate.backingTemplateId,
      data: { ...current.data, ...candidate.data },
      backingData: candidate.backingData ? { ...current.backingData, ...candidate.backingData } : current.backingData,
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    matchedCount: revisions.length,
    unmatchedRows,
    ambiguousRows,
    changedFields: [...changedFields].sort(),
    preservedFields: [...preservedFields].sort(),
    finalArtifactCount: existing.length,
    revisions,
  };
};
