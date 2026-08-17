"use client";

import type {
  CampaignMedia,
  MarketingContentWorkspaceView,
  MarketingContentPackage as SocialCampaign,
} from '@/features/marketing-content/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export const loadMarketingContentWorkspace = async (): Promise<MarketingContentWorkspaceView> => {
  const response = await fetch('/api/developer-cockpit', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Unable to load marketing content.'));
  }
  const body = await response.json() as { cockpit: MarketingContentWorkspaceView };
  return body.cockpit;
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
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Unable to upload campaign media.'));
  }
  const body = await response.json() as { media: CampaignMedia };
  return body.media;
};

export const mutateMarketingContent = async (
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<{ campaign: SocialCampaign; allowedNextActions: string[] }> => {
  const response = await fetch('/api/developer-cockpit/campaigns', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Unable to update the marketing content package.'));
  }
  return response.json() as Promise<{
    campaign: SocialCampaign;
    allowedNextActions: string[];
  }>;
};

export const validateMarketingContent = async (payload: unknown) => {
  const response = await fetch('/api/developer-cockpit/campaigns/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Unable to validate the marketing content package.'));
  }
  return response.json() as Promise<{
    normalized: unknown;
    blockingErrors: string[];
    readinessWarnings: string[];
    allowedNextActions: string[];
  }>;
};
