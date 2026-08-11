"use client";

import type {
  DeveloperCockpitView,
  ProviderChannelBinding,
  CampaignMedia,
  SocialCampaign,
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
  path: 'site-proposals' | 'scopes' | 'provider',
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
  metadata: {
    idempotencyKey: string;
    rightsBasis?: string;
    creatorCredit?: string;
    rightsRestriction?: string;
    rightsExpiresAt?: string;
    reusableCaption?: string;
    reusableDescription?: string;
    focalPoint?: { x: number; y: number };
  } = { idempotencyKey: crypto.randomUUID() },
): Promise<CampaignMedia> => {
  const formData = new FormData();
  formData.set('image', file);
  formData.set('idempotencyKey', metadata.idempotencyKey);
  if (metadata.rightsBasis) formData.set('rightsBasis', metadata.rightsBasis);
  if (metadata.creatorCredit) formData.set('creatorCredit', metadata.creatorCredit);
  if (metadata.rightsRestriction) formData.set('rightsRestriction', metadata.rightsRestriction);
  if (metadata.rightsExpiresAt) formData.set('rightsExpiresAt', metadata.rightsExpiresAt);
  if (metadata.reusableCaption) formData.set('reusableCaption', metadata.reusableCaption);
  if (metadata.reusableDescription) formData.set('reusableDescription', metadata.reusableDescription);
  if (metadata.focalPoint) formData.set('focalPoint', JSON.stringify(metadata.focalPoint));
  const response = await fetch('/api/developer-cockpit/media', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to upload campaign media.'));
  const body = await response.json() as { media: CampaignMedia };
  return body.media;
};

export const mutateCampaign = async (
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const response = await fetch('/api/developer-cockpit/campaigns', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to update the campaign package.'));
  return response.json() as Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }>;
};

export const validateCampaign = async (payload: unknown) => {
  const response = await fetch('/api/developer-cockpit/campaigns/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(await readApiError(response, 'Unable to validate the campaign package.'));
  return response.json() as Promise<{ normalized: unknown; blockingErrors: string[]; readinessWarnings: string[]; allowedNextActions: string[] }>;
};

export type { DeveloperCockpitView, ProviderChannelBinding };
