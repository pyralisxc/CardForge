"use client";

import type {
  DeveloperCampaignWorkspaceView,
  DeveloperCockpitBootstrap,
  DeveloperSiteWorkspaceView,
} from '@/features/developer-cockpit/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

const loadScope = async <T>(scope: 'bootstrap' | 'campaigns' | 'site', fallback: string): Promise<T> => {
  const suffix = scope === 'bootstrap' ? '' : `?scope=${scope}`;
  const response = await fetch(`/api/developer-cockpit${suffix}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, fallback));
  return (await response.json()) as T;
};

export const loadDeveloperCockpit = async (): Promise<DeveloperCockpitBootstrap> => (
  (await loadScope<{ cockpit: DeveloperCockpitBootstrap }>('bootstrap', 'Unable to load the developer cockpit.')).cockpit
);

export const loadDeveloperCampaignWorkspace = async (): Promise<DeveloperCampaignWorkspaceView> => (
  (await loadScope<{ campaigns: DeveloperCampaignWorkspaceView }>('campaigns', 'Unable to load campaigns.')).campaigns
);

export const loadDeveloperSiteWorkspace = async (): Promise<DeveloperSiteWorkspaceView> => (
  (await loadScope<{ site: DeveloperSiteWorkspaceView }>('site', 'Unable to load site proposals.')).site
);

export const mutateDeveloperCockpit = async (
  path: 'site-proposals' | 'scopes',
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<DeveloperSiteWorkspaceView> => {
  const response = await fetch(`/api/developer-cockpit/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update the developer cockpit.'));
  const body = await response.json() as { site: DeveloperSiteWorkspaceView };
  return body.site;
};

export type {
  DeveloperCampaignWorkspaceView,
  DeveloperCockpitBootstrap,
  DeveloperSiteWorkspaceView,
};
