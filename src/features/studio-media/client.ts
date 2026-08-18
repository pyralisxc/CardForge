'use client';

import type { CardAssetOption } from '@/domain/templates';
import type { StudioMedia, StudioMediaKind } from './model';

export * from './model';

interface StudioMediaLibraryResponse {
  media: StudioMedia[];
  assets: CardAssetOption[];
}

interface StudioMediaUploadResponse {
  media: StudioMedia;
  asset: CardAssetOption;
}

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json() as { error?: { message?: unknown } };
    return typeof body.error?.message === 'string' && body.error.message.trim()
      ? body.error.message
      : fallback;
  } catch {
    return fallback;
  }
};

export const loadPersonalStudioMedia = async (): Promise<StudioMediaLibraryResponse> => {
  const response = await fetch('/api/studio-media', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to load personal Studio media.'));
  }
  return response.json() as Promise<StudioMediaLibraryResponse>;
};

export const uploadPersonalStudioMedia = async ({
  file,
  kind,
  name,
}: {
  file: File;
  kind: StudioMediaKind;
  name?: string;
}): Promise<StudioMediaUploadResponse> => {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('kind', kind);
  if (name?.trim()) formData.set('name', name.trim());
  const response = await fetch('/api/studio-media', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to upload personal Studio media.'));
  }
  return response.json() as Promise<StudioMediaUploadResponse>;
};
