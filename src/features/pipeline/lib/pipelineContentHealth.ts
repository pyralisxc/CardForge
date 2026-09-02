import type { CardForgeCatalogManifest } from './catalogManifest';
import type { PipelineProgramView } from './pipelineProgram';

export type PipelineContentHealthSeverity = 'error' | 'warning';

export interface PipelineContentHealthIssue {
  code: 'missing-lineage' | 'missing-route' | 'missing-taxonomy' | 'missing-preview' | 'missing-source' | 'duplicate-name' | 'invalid-package';
  severity: PipelineContentHealthSeverity;
  objectId: string | null;
  objectName: string;
  message: string;
  repair: string;
}

export interface PipelineContentHealth {
  checkedCount: number;
  errors: number;
  warnings: number;
  issues: PipelineContentHealthIssue[];
}

export const buildPipelineContentHealth = ({
  catalog,
  program,
}: {
  catalog: CardForgeCatalogManifest | null;
  program: PipelineProgramView | null;
}): PipelineContentHealth => {
  const issues: PipelineContentHealthIssue[] = [];
  const published = catalog?.pipeline?.items ?? [];
  const names = new Map<string, typeof published>();
  published.forEach((item) => {
    const key = item.name.trim().toLocaleLowerCase();
    names.set(key, [...(names.get(key) ?? []), item]);
    if (!item.lineageId) issues.push({ code: 'missing-lineage', severity: 'error', objectId: item.id, objectName: item.name, message: 'Published object has no lineage identity.', repair: 'Create a revision-safe lineage link before the next publication.' });
    if (!item.previewUrl) issues.push({ code: 'missing-preview', severity: 'warning', objectId: item.lineageId ?? item.id, objectName: item.name, message: 'Published object has no visual preview.', repair: 'Add a validated preview on the next revision.' });
  });
  names.forEach((items) => {
    if (items.length < 2) return;
    items.forEach((item) => issues.push({ code: 'duplicate-name', severity: 'warning', objectId: item.lineageId ?? item.id, objectName: item.name, message: `${items.length} published objects use this display name.`, repair: 'Clarify the next revision name without changing historical revisions.' }));
  });
  (catalog?.sets.items ?? []).forEach((set) => {
    let validPackage = false;
    try { validPackage = new URL(set.packageUrl).protocol === 'https:'; } catch { validPackage = false; }
    if (!validPackage) issues.push({ code: 'invalid-package', severity: 'error', objectId: set.id, objectName: set.name, message: 'Published Set does not have a valid HTTPS package source.', repair: 'Publish a verified portable Set package revision.' });
    if (!set.specialtyTags.length || !set.useCaseTags.length) issues.push({ code: 'missing-taxonomy', severity: 'warning', objectId: set.id, objectName: set.name, message: 'Published Set classification is incomplete.', repair: 'Classify specialty and use case on the next revision.' });
  });
  (program?.submissions ?? []).filter((submission) => submission.status === 'published').forEach((submission) => {
    const objectId = submission.lineageId ?? submission.id;
    if (!submission.requestedStudioDestination) issues.push({ code: 'missing-route', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has no destination route.', repair: 'Choose its native Library/Design destination.' });
    if (!submission.specialtyTags.length || !submission.useCaseTags.length) issues.push({ code: 'missing-taxonomy', severity: 'warning', objectId, objectName: submission.name, message: 'Published revision is missing controlled taxonomy.', repair: 'Classify the next revision with specialty and use-case metadata.' });
    if (!submission.sourceUrl && !submission.sourcePayload) issues.push({ code: 'missing-source', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has no readable source.', repair: 'Archive it or publish a verified replacement revision.' });
  });
  return {
    checkedCount: published.length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    issues,
  };
};
