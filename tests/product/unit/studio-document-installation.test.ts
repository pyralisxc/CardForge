import { describe, expect, it, vi } from 'vitest';

import {
  acknowledgeStudioDocumentInstallation,
  StudioDocumentInstallationAcknowledgementError,
} from '@/features/studio-documents/client/studioDocumentInstallation';
import type { StudioDocumentInstallSummary } from '@/features/studio-documents/model';

const summary: StudioDocumentInstallSummary = {
  templateCount: 1,
  templateAddedCount: 1,
  templateUpdatedCount: 0,
  setCount: 0,
  cardCount: 0,
  cardAddedCount: 0,
  cardUpdatedCount: 0,
  cardSkippedCount: 0,
  activeSetId: null,
  destination: 'template-maker',
};

describe('Studio document installation acknowledgement', () => {
  it('posts the exact locally applied revision and summary', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      lastInstalledRevision: 5,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await acknowledgeStudioDocumentInstallation({
      documentId: 'a7e209ae-ea44-43ae-a2cb-718a972beef4',
      revision: 5,
      summary,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/studio-documents/a7e209ae-ea44-43ae-a2cb-718a972beef4/installation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ revision: 5, summary }),
      }),
    );
  });

  it('rejects a server response that did not record the acknowledgement', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'The browser applied an outdated revision.' },
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(acknowledgeStudioDocumentInstallation({
      documentId: 'a7e209ae-ea44-43ae-a2cb-718a972beef4',
      revision: 4,
      summary,
      fetchImpl,
    })).rejects.toEqual(expect.objectContaining({
      name: StudioDocumentInstallationAcknowledgementError.name,
      message: 'The browser applied an outdated revision.',
    }));
  });

  it('rejects an incomplete success payload instead of reporting false confirmation', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(acknowledgeStudioDocumentInstallation({
      documentId: 'a7e209ae-ea44-43ae-a2cb-718a972beef4',
      revision: 5,
      summary,
      fetchImpl,
    })).rejects.toThrow('incomplete installation confirmation');
  });
});
