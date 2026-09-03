import type { StudioDocumentInstallSummary } from '../model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export class StudioDocumentInstallationAcknowledgementError extends Error {
  readonly name = 'StudioDocumentInstallationAcknowledgementError';
}

export const acknowledgeStudioDocumentInstallation = async ({
  documentId,
  revision,
  summary,
  fetchImpl = fetch,
}: {
  documentId: string;
  revision: number;
  summary: StudioDocumentInstallSummary;
  fetchImpl?: typeof fetch;
}): Promise<void> => {
  let response: Response;
  try {
    response = await fetchImpl(`/api/studio-documents/${encodeURIComponent(documentId)}/installation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ revision, summary }),
    });
  } catch (error) {
    throw new StudioDocumentInstallationAcknowledgementError(
      'CardForge could not confirm this locally applied revision with the server.',
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new StudioDocumentInstallationAcknowledgementError(
      await readApiErrorMessage(response, 'CardForge could not confirm this locally applied revision with the server.'),
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const acknowledgement = payload && typeof payload === 'object'
    ? payload as { ok?: unknown; lastInstalledRevision?: unknown }
    : null;
  if (acknowledgement?.ok !== true || acknowledgement.lastInstalledRevision !== revision) {
    throw new StudioDocumentInstallationAcknowledgementError(
      'CardForge returned an incomplete installation confirmation for this locally applied revision.',
    );
  }
};
