import { nanoid } from 'nanoid';
import type { TCGCardTemplate } from '@/domain/templates';
import { templateReviewRequestText, type ManagedRasterSelection } from '@/features/pipeline/client';
import { readStructuredBrowserValue, writeStructuredBrowserValue } from '@/features/project/client/persistence-preferences';
import { requireOkResponse } from '@/infrastructure/http/clientResponses';

/** Browser recovery bookkeeping, deliberately outside authored/exported Template data. */
export interface TemplatePipelineAttempt {
  key: string;
  contributorId: string;
  fingerprint: string;
  template: TCGCardTemplate;
  selection: ManagedRasterSelection;
}
export const TEMPLATE_PIPELINE_ATTEMPTS_CHANGED = 'cardforge-template-pipeline-attempts-changed';
const endpoint = '/api/templates/submissions';
const storageKey = (actor: string) => `template-pipeline-attempts-v1:${actor}`;
export const templatePipelineAttemptFingerprint = (template: TCGCardTemplate, selection: ManagedRasterSelection) =>
  JSON.stringify([templateReviewRequestText(template), selection.registryAssetId, selection.publishedSubmissionId, selection.elementId]);

async function currentContributor(): Promise<string> {
  const response = await fetch(endpoint, { cache: 'no-store' });
  await requireOkResponse(response, 'Your submission account is unavailable. Saved attempts remain unchanged.');
  const result = await response.json();
  if (typeof result.contributorId !== 'string' || !result.contributorId) throw new Error('The submission account could not be verified.');
  return result.contributorId;
}
async function readAttempts(actor: string): Promise<TemplatePipelineAttempt[]> {
  const value = await readStructuredBrowserValue<TemplatePipelineAttempt[]>(storageKey(actor));
  if (value === null) return [];
  if (!Array.isArray(value) || value.some(item => !item || item.contributorId !== actor || !item.key
    || !item.template?.id || !item.selection || item.fingerprint !== templatePipelineAttemptFingerprint(item.template, item.selection))) {
    throw new Error('Saved Pipeline attempts could not be read safely. They have been preserved.');
  }
  return value;
}
export async function listTemplatePipelineAttempts(templateId: string): Promise<TemplatePipelineAttempt[]> {
  return (await readAttempts(await currentContributor())).filter(item => item.template.id === templateId);
}
export async function retainTemplatePipelineAttempt(template: TCGCardTemplate, selection: ManagedRasterSelection): Promise<TemplatePipelineAttempt> {
  // Snapshot before any asynchronous work; later local edits cannot change this request.
  const snapshot = JSON.parse(JSON.stringify({ template, selection })) as {template: TCGCardTemplate; selection: ManagedRasterSelection};
  const fingerprint = templatePipelineAttemptFingerprint(snapshot.template, snapshot.selection);
  const actor = await currentContributor();
  if (!navigator.locks) throw new Error('Safe Pipeline attempt persistence is unavailable in this browser. Local work is unchanged.');
  return navigator.locks.request(storageKey(actor), async () => {
    const attempts = await readAttempts(actor);
    const existing = attempts.find(item => item.fingerprint === fingerprint);
    if (existing) return existing;
    const attempt = { key: nanoid(32), contributorId: actor, fingerprint, ...snapshot };
    // This storage owner rejects failed writes. Never POST before durable local persistence.
    await writeStructuredBrowserValue(storageKey(actor), [...attempts, attempt]);
    window.dispatchEvent(new Event(TEMPLATE_PIPELINE_ATTEMPTS_CHANGED));
    return attempt;
  });
}
export async function resolveTemplatePipelineAttempt(attempt: TemplatePipelineAttempt, retry: boolean): Promise<string | null> {
  if (templatePipelineAttemptFingerprint(attempt.template, attempt.selection) !== attempt.fingerprint) throw new Error('The saved attempt changed. No request was sent.');
  const request = async (lookup: boolean): Promise<string | null> => {
    const response = await fetch(`${endpoint}${lookup ? '?lookup=1' : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key, 'X-Pipeline-Contributor': attempt.contributorId },
      body: JSON.stringify({ ...attempt.template, managedRasterSelection: attempt.selection }),
    });
    await requireOkResponse(response, 'The outcome is still uncertain. Keep this saved attempt and your local work.');
    const result = await response.json();
    if (lookup && result.openInPipelineUrl === null) return null;
    if (typeof result.openInPipelineUrl !== 'string' || !result.openInPipelineUrl.startsWith('/account?section=library&scope=pipeline&tool=contribute&submission=')) {
      throw new Error('The exact Pipeline destination could not be verified. The saved attempt is preserved.');
    }
    return result.openInPipelineUrl;
  };
  const destination = await request(true);
  return destination ?? (retry ? await request(false) : null);
}
