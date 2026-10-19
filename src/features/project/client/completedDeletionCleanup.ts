import type { ProjectDocumentV1 } from '../model/projectDocument';
import { cleanCompletedDeletionReferences, collectProjectMediaUrls } from '../model/completedDeletionCleanup';

export const COMPLETED_DELETION_CLEANUP_EVENT = 'cardforge:completed-deletion-cleanup';

/** An unavailable or malformed evidence service is unknown, never deletion proof. */
export async function prepareCompletedDeletionCleanup(document: ProjectDocumentV1, signal?: AbortSignal) {
  const urls = collectProjectMediaUrls(document);
  const confirmed = new Set<string>();
  try {
    for (let offset = 0; offset < urls.length; offset += 256) {
      const batch = urls.slice(offset, offset + 256);
      const response = await fetch('/api/catalog/completed-deletions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: batch }),
        signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]),
      });
      if (!response.ok) return { document, changed: false };
      const result: unknown = await response.json();
      const deleted = (result as { deletedUrls?: unknown } | null)?.deletedUrls;
      if (!Array.isArray(deleted) || deleted.some((url) => typeof url !== 'string' || !batch.includes(url))) return { document, changed: false };
      deleted.forEach((url: string) => confirmed.add(url));
    }
  } catch {
    signal?.throwIfAborted();
    return { document, changed: false };
  }
  signal?.throwIfAborted();
  return cleanCompletedDeletionReferences(document, confirmed);
}

export function notifyCompletedDeletionCleanup() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMPLETED_DELETION_CLEANUP_EVENT));
}
