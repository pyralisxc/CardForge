export type SetUpdateDecision = 'keep' | 'use' | 'defer';

/** Review metadata only: never store old property values, snapshots or assets here. */
export interface SetUpdateReview {
  version: 1;
  templateId: string;
  sourceLineageId: string;
  sourceRevisionId: string;
  sourceFingerprint: string;
  outcome: 'reviewed' | 'deferred';
  decisions: Array<{ key: string; decision: SetUpdateDecision }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));
const isIdentity = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());

export const normalizeSetUpdateReviews = (value: unknown): SetUpdateReview[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('The Set review ledger is invalid. Its original work was kept.');
  const seen = new Set<string>();
  return value.map((entry): SetUpdateReview => {
    if (!isRecord(entry) || !hasOnly(entry, ['version', 'templateId', 'sourceLineageId', 'sourceRevisionId', 'sourceFingerprint', 'outcome', 'decisions'])
      || entry.version !== 1 || !isIdentity(entry.templateId) || !isIdentity(entry.sourceLineageId) || !isIdentity(entry.sourceRevisionId)
      || typeof entry.sourceFingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.sourceFingerprint)
      || !['reviewed', 'deferred'].includes(String(entry.outcome)) || !Array.isArray(entry.decisions)) {
      throw new Error('This Set has unsupported review information. Open it with a compatible CardForge version; its original work was kept.');
    }
    const identity = JSON.stringify([entry.templateId, entry.sourceLineageId, entry.sourceRevisionId]);
    if (seen.has(identity)) throw new Error('The Set contains conflicting review records. Its original work was kept.');
    seen.add(identity);
    const keys = new Set<string>();
    const decisions = entry.decisions.map((choice) => {
      if (!isRecord(choice) || !hasOnly(choice, ['key', 'decision']) || !isIdentity(choice.key)
        || !['keep', 'use', 'defer'].includes(String(choice.decision)) || keys.has(choice.key)) {
        throw new Error('The Set contains invalid review decisions. Its original work was kept.');
      }
      keys.add(choice.key);
      return { key: choice.key, decision: choice.decision as SetUpdateDecision };
    });
    if (entry.outcome === 'reviewed' && decisions.some((choice) => choice.decision === 'defer')) {
      throw new Error('A deferred Update cannot be marked reviewed. Its original work was kept.');
    }
    return { version: 1, templateId: entry.templateId, sourceLineageId: entry.sourceLineageId,
      sourceRevisionId: entry.sourceRevisionId, sourceFingerprint: entry.sourceFingerprint,
      outcome: entry.outcome as SetUpdateReview['outcome'], decisions };
  });
};
