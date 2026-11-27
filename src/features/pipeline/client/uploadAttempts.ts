import { z } from 'zod/v4';
import { readStructuredBrowserValue, removeStructuredBrowserValue, writeStructuredBrowserValue } from '@/features/project/client/persistence-preferences';

// Only the uploaded source identity and exact submission request are retained.
// Signed upload URLs and source bytes never enter this recovery record.
const payloadSchema = z.object({
  assetType: z.string(), studioDestination: z.string().nullable(), specialtyTags: z.array(z.string()),
  useCaseTags: z.array(z.string()), semanticRole: z.string(), visualFamily: z.string(), variantKind: z.string(),
  variantLabel: z.string(), compatibilityTags: z.array(z.string()), name: z.string(), description: z.string(),
  sourceNotes: z.string(), previewUrl: z.string(), uploadedFile: z.object({
    storagePath: z.string().regex(/^pipeline-owned-v1\/[0-9a-f-]{36}\/source\.[a-z0-9]+$/u),
    fileName: z.string().min(1), fileSizeBytes: z.number().int().positive(), mimeType: z.string().min(1),
  }).strict(),
}).strict();
const attemptSchema = z.object({ contributorId: z.string().min(1), payload: payloadSchema, fingerprint: z.string() }).strict();
export type PipelineUploadAttempt = z.infer<typeof attemptSchema>;
const keyFor = (actor: string) => `pipeline-upload-attempt-v1:${actor}`;

export function assertUploadRecoverySupport(): void {
  if (typeof indexedDB === 'undefined' || typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
    throw new Error('Safe submission recovery needs browser storage and cross-tab locking. Use an up-to-date supported browser.');
  }
}

export async function readUploadAttempt(actor: string): Promise<PipelineUploadAttempt | null> {
  if (typeof indexedDB === 'undefined') throw new Error('Safe submission recovery storage is unavailable in this browser. Your work is unchanged.');
  const value = await readStructuredBrowserValue<unknown>(keyFor(actor));
  if (value === null) return null;
  const parsed = attemptSchema.safeParse(value);
  if (!parsed.success || parsed.data.contributorId !== actor || parsed.data.fingerprint !== JSON.stringify(parsed.data.payload)) throw new Error('The saved submission attempt cannot be read safely. It has been preserved.');
  return parsed.data;
}

export function createUploadAttempt(contributorId: string, payload: PipelineUploadAttempt['payload']): PipelineUploadAttempt {
  const snapshot = payloadSchema.parse(payload);
  return { contributorId, payload: snapshot, fingerprint: JSON.stringify(snapshot) };
}

export async function saveUploadAttempt(attempt: PipelineUploadAttempt): Promise<void> {
  const parsed = attemptSchema.parse(attempt);
  if (parsed.fingerprint !== JSON.stringify(parsed.payload)) throw new Error('The submission snapshot changed before it could be saved.');
  await writeStructuredBrowserValue(keyFor(parsed.contributorId), parsed);
}

export async function removeUploadAttempt(actor: string): Promise<void> {
  await removeStructuredBrowserValue(keyFor(actor));
}

export async function withUploadAttemptLock<T>(actor: string, run: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('Safe submission recovery is unavailable in this browser. Your work is unchanged.');
  return navigator.locks.request(keyFor(actor), { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('Another tab is handling this submission. Return to it before continuing.');
    return run();
  });
}

export async function lookupUploadAttempt(attempt: PipelineUploadAttempt): Promise<{ state: 'pending' | 'owned' | 'discarded'; submissionId: string | null }> {
  const response = await fetch('/api/pipeline?lookup=1', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': attempt.contributorId }, body: JSON.stringify(attempt.payload) });
  if (!response.ok) throw new Error('The submission outcome is still unconfirmed. Keep the saved attempt and check again.');
  const value = await response.json();
  const receipt = z.object({ state: z.enum(['pending', 'owned', 'discarded']), submissionId: z.uuid().nullable() }).safeParse(value?.receipt);
  if (!receipt.success || (receipt.data.state === 'owned') !== Boolean(receipt.data.submissionId)) throw new Error('The exact submission receipt could not be verified. The saved attempt is preserved.');
  return receipt.data;
}
