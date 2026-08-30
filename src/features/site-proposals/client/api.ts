"use client";

import type {
  SiteProposalWorkspace,
} from '@/features/site-proposals/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export const loadSiteProposalWorkspace = async (): Promise<SiteProposalWorkspace> => (
  await fetch('/api/site-proposals', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load site proposals.'));
    return (await response.json() as { site: SiteProposalWorkspace }).site;
  })
);

export const mutateSiteProposal = async (
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<SiteProposalWorkspace> => {
  const response = await fetch('/api/site-proposals', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update the site proposal.'));
  const body = await response.json() as { site: SiteProposalWorkspace };
  return body.site;
};

export type {
  SiteProposalWorkspace,
};
