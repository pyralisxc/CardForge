"use client";

import type {
  DeveloperSiteWorkspaceView,
} from '@/features/developer-cockpit/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export const loadDeveloperSiteWorkspace = async (): Promise<DeveloperSiteWorkspaceView> => (
  await fetch('/api/site-proposals', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load site proposals.'));
    return (await response.json() as { site: DeveloperSiteWorkspaceView }).site;
  })
);

export const mutateSiteProposal = async (
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<DeveloperSiteWorkspaceView> => {
  const response = await fetch('/api/site-proposals', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update the site proposal.'));
  const body = await response.json() as { site: DeveloperSiteWorkspaceView };
  return body.site;
};

export type {
  DeveloperSiteWorkspaceView,
};
