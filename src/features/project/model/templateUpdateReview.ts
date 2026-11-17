import { authoredPlanInputSurvives, authoredPlanValuesEqual, type CardSet, type StoredDisplayCard } from '@/domain/cards';
import type { SetUpdateDecision, SetUpdateReview } from '@/domain/cards/setUpdateReview';
import { extractTemplateFieldDefinitions, getTemplateLineageId, reconstructMinimalTemplateObject, validateNativeTemplateStructure, type TCGCardTemplate } from '@/domain/templates';
import { getTemplateOwnerSetId, SetTemplateOwnershipError, type SetTemplateState } from './setTemplateOwnership';

type IdentitySegment = { by: 'id' | 'key'; value: string };
type OrderSegment = { order: 'id' | 'key' };
type Segment = string | IdentitySegment | OrderSegment;
export interface TemplateUpdateChange {
  key: string;
  path: Segment[];
  group: string;
  label: string;
  before: unknown;
  after: unknown;
}
export interface TemplateUpdateComparison {
  setId: string;
  current: TCGCardTemplate;
  incoming: TCGCardTemplate;
  bindings: string;
  changes: TemplateUpdateChange[];
}

const matchesReview = (comparison: TemplateUpdateComparison, review: SetUpdateReview, fingerprint: string): boolean => (
  review.templateId === comparison.current.id && review.sourceLineageId === comparison.incoming.templateLineageId
  && review.sourceRevisionId === comparison.incoming.templateRevisionId && review.sourceFingerprint === fingerprint
);

export const getTemplateUpdateReviewChoices = (
  comparison: TemplateUpdateComparison, review: SetUpdateReview | undefined, fingerprint: string,
): Record<string, SetUpdateDecision> => {
  const decisions = new Map(review && matchesReview(comparison, review, fingerprint)
    ? review.decisions.map(({ key, decision }) => [key, decision]) : []);
  return Object.fromEntries(comparison.changes.map(({ key }) => [key, decisions.get(key) === 'keep' ? 'keep' : 'defer']));
};

const identityFields = new Set([
  'id', 'templateSource', 'templateLibrarySource', 'templateAccessTier', 'templateRegistryStatus',
  'templateLineageId', 'templateRevision', 'templateRevisionId', 'templateParentRevisionId',
  'templateOriginLineageId', 'templateOriginRevisionId', 'templateOriginAncestors', 'templatePipelineContext',
  'templateContributorName',
]);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const templateUpdateContent = (template: TCGCardTemplate): Record<string, unknown> => Object.fromEntries(
  Object.entries(template).filter(([key, value]) => !identityFields.has(key) && value !== undefined),
);
export const templateUpdateContentText = (template: TCGCardTemplate): string => JSON.stringify(templateUpdateContent(template), (_key, value) => (
  isRecord(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value
));

function fail(message: string): never { throw new SetTemplateOwnershipError('conflict', `${message} Your existing work was kept.`); }
const canonical = (template: TCGCardTemplate): TCGCardTemplate => {
  const result = reconstructMinimalTemplateObject(structuredClone(template));
  if (!authoredPlanInputSurvives(templateUpdateContent(template), templateUpdateContent(result))) {
    fail('This design contains content that cannot be preserved by this CardForge version.');
  }
  return result;
};

export const isTemplateUpdateSource = (current: TCGCardTemplate, source: TCGCardTemplate): boolean => {
  if (!current.id || !source.id || source.id === current.id || !source.templateRevisionId || !source.templateLineageId
    || (current.templateUsage ?? 'standard') !== (source.templateUsage ?? 'standard')) return false;
  const pins = [
    { lineageId: getTemplateLineageId(current), revisionId: current.templateRevisionId },
    { lineageId: current.templateOriginLineageId, revisionId: current.templateOriginRevisionId },
    ...(current.templateOriginAncestors ?? []),
  ];
  return pins.some((pin) => pin.lineageId === source.templateLineageId && pin.revisionId !== source.templateRevisionId);
};

const bindings = (cards: StoredDisplayCard[], setId: string, templateId: string, firstSetId?: string): string => JSON.stringify(cards
  .filter((card) => (card.setId ?? firstSetId) === setId && (card.templateId === templateId || card.backingTemplateId === templateId))
  .map((card) => [card.uniqueId, card.templateId === templateId, card.backingTemplateId === templateId]).sort(([a], [b]) => String(a).localeCompare(String(b))));

const diff = (before: unknown, after: unknown, path: Segment[], changes: TemplateUpdateChange[]): void => {
  if (authoredPlanValuesEqual(before, after)) return;
  if (isRecord(before) && isRecord(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) diff(before[key], after[key], [...path, key], changes);
    return;
  }
  const field = path.at(-1);
  const by = field === 'elements' ? 'id' : field === 'fieldContracts' ? 'key' : null;
  if (by && Array.isArray(before) && Array.isArray(after)) {
    const index = (items: unknown[]) => {
      const result = new Map<string, unknown>();
      for (const item of items) {
        if (!isRecord(item) || typeof item[by] !== 'string' || !item[by] || result.has(item[by])) fail('This design has ambiguous element or field identities.');
        result.set(item[by] as string, item);
      }
      return result;
    };
    const left = index(before); const right = index(after);
    for (const id of new Set([...left.keys(), ...right.keys()])) diff(left.get(id), right.get(id), [...path, { by, value: id }], changes);
    diff([...left.keys()], [...right.keys()], [...path, { order: by }], changes);
    return;
  }
  const element = path.find((segment): segment is IdentitySegment => typeof segment !== 'string' && 'by' in segment);
  const labels = path.map((segment) => typeof segment === 'string' ? segment : 'by' in segment ? segment.value : 'order');
  changes.push({ key: JSON.stringify(path), path, group: element ? `${element.by === 'id' ? 'Element' : 'Field'} · ${element.value}` : 'Template',
    label: labels.join(' / '), before, after });
};

export const createTemplateUpdateComparison = (state: SetTemplateState, setId: string, templateId: string, source: TCGCardTemplate): TemplateUpdateComparison => {
  const current = state.userTemplates.find((template) => template.id === templateId);
  if (!current || getTemplateOwnerSetId(state, templateId) !== setId) fail('The destination design is not owned by this Set.');
  if (!isTemplateUpdateSource(current!, source)) fail('This source has no exact, related revision identity.');
  const left = canonical(current!); const right = canonical(source);
  const changes: TemplateUpdateChange[] = [];
  diff(templateUpdateContent(left), templateUpdateContent(right), [], changes);
  return { setId, current: left, incoming: right, bindings: bindings(state.storedCards, setId, templateId, state.cardSets[0]?.id), changes };
};

const apply = (target: unknown, path: Segment[], value: unknown): void => {
  const [part, ...tail] = path;
  if (typeof part === 'string') {
    if (!isRecord(target)) fail('The reviewed property is no longer available.');
    if (tail.length) apply(target[part], tail, value);
    else if (value === undefined) delete target[part];
    else Object.defineProperty(target, part, { value: structuredClone(value), enumerable: true, configurable: true, writable: true });
  } else if (part && 'by' in part) {
    if (!Array.isArray(target)) fail('The reviewed collection is no longer available.');
    const index = target.findIndex((item) => isRecord(item) && item[part.by] === part.value);
    if (tail.length) {
      if (index < 0) fail('The reviewed element is no longer available.');
      apply(target[index], tail, value);
    } else if (value === undefined) { if (index >= 0) target.splice(index, 1); }
    else if (index < 0) target.push(structuredClone(value));
    else target[index] = structuredClone(value);
  } else if (part && 'order' in part) {
    if (!Array.isArray(target) || !Array.isArray(value)) fail('The reviewed ordering is invalid.');
    const ids = new Map(value.map((id, index) => [id, index]));
    target.sort((a, b) => (ids.get(a[part.order]) ?? value.length) - (ids.get(b[part.order]) ?? value.length));
  }
};

export const resolveTemplateUpdateReview = (
  state: SetTemplateState,
  comparison: TemplateUpdateComparison,
  source: TCGCardTemplate,
  choices: Readonly<Record<string, SetUpdateDecision>>,
  sourceFingerprint: string,
): { template: TCGCardTemplate; review: SetUpdateReview; changesTemplate: boolean } => {
  const fresh = createTemplateUpdateComparison(state, comparison.setId, comparison.current.id!, source);
  if (!authoredPlanValuesEqual(fresh.current, comparison.current) || !authoredPlanValuesEqual(fresh.incoming, comparison.incoming)
    || fresh.bindings !== comparison.bindings) fail('The design, source revision or affected Artifacts changed while review was open. Reopen the review.');
  const allowed = new Set(fresh.changes.map((change) => change.key));
  if (Object.keys(choices).some((key) => !allowed.has(key)) || Object.values(choices).some((choice) => !['keep', 'use', 'defer'].includes(choice))) fail('The review contains an unknown decision.');
  const previous = state.cardSets.find((set) => set.id === comparison.setId)?.updateReviews
    ?.find((review) => matchesReview(fresh, review, sourceFingerprint));
  const decisions = [
    ...(previous?.decisions.filter(({ key, decision }) => !allowed.has(key) && decision !== 'defer') ?? []),
    ...fresh.changes.map((change) => ({ key: change.key, decision: choices[change.key] ?? 'defer' as SetUpdateDecision })),
  ];
  const proposed = structuredClone(fresh.current);
  for (const change of fresh.changes) if (choices[change.key] === 'use') apply(proposed, change.path, change.after);
  const template = canonical(proposed);
  const validation = validateNativeTemplateStructure(template);
  if (validation) fail('Those choices do not form a valid design. Defer the affected changes and review again.');
  const fields = new Set(extractTemplateFieldDefinitions(template).map((field) => field.key));
  const removed = extractTemplateFieldDefinitions(fresh.current).filter((field) => !fields.has(field.key));
  if (removed.length && JSON.parse(fresh.bindings).length) fail('Those choices remove fields used by this Set. Keep or defer the affected changes so authored Artifact data stays intact.');
  return { template, changesTemplate: !authoredPlanValuesEqual(templateUpdateContent(template), templateUpdateContent(fresh.current)), review: {
    version: 1, templateId: template.id!, sourceLineageId: source.templateLineageId!, sourceRevisionId: source.templateRevisionId!, sourceFingerprint,
    outcome: decisions.some((decision) => decision.decision === 'defer') ? 'deferred' : 'reviewed', decisions,
  } };
};

export const retainSetUpdateReview = (set: CardSet & { updateReviews?: SetUpdateReview[] }, review: SetUpdateReview): SetUpdateReview[] => [
  ...(set.updateReviews ?? []).filter((entry) => !(entry.templateId === review.templateId && entry.sourceLineageId === review.sourceLineageId && entry.sourceRevisionId === review.sourceRevisionId)),
  review,
];
