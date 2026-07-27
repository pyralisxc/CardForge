"use client";

import type {
  DeveloperCockpitView,
  ProviderChannelBinding,
  SocialCampaignMedia,
  SocialService,
} from '@/features/developer-cockpit/model';

export interface BufferChannelView {
  id: string;
  name: string;
  displayName: string;
  service: SocialService;
  avatar: string | null;
  isQueuePaused: boolean;
}

const readApiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const loadDeveloperCockpit = async (): Promise<DeveloperCockpitView> => {
  const response = await fetch('/api/developer-cockpit', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to load the developer cockpit.'));
  const body = await response.json() as { cockpit: DeveloperCockpitView };
  return body.cockpit;
};

export const mutateDeveloperCockpit = async (
  path: 'campaigns' | 'site-proposals' | 'scopes' | 'provider',
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<DeveloperCockpitView> => {
  const response = await fetch(`/api/developer-cockpit/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to update the developer cockpit.'));
  const body = await response.json() as { cockpit: DeveloperCockpitView };
  return body.cockpit;
};

export const loadBufferChannels = async (): Promise<BufferChannelView[]> => {
  const response = await fetch('/api/developer-cockpit/provider', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to load Buffer channels.'));
  const body = await response.json() as { channels: BufferChannelView[] };
  return body.channels;
};

export const uploadCampaignMedia = async (
  file: File,
): Promise<SocialCampaignMedia & { previewUrl: string; width: number; height: number }> => {
  const formData = new FormData();
  formData.set('image', file);
  const response = await fetch('/api/developer-cockpit/media', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to upload campaign media.'));
  const body = await response.json() as {
    media: SocialCampaignMedia & { previewUrl: string; width: number; height: number };
  };
  return body.media;
};

export type { DeveloperCockpitView, ProviderChannelBinding };
