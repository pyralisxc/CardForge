import { revalidatePath } from 'next/cache';

import {
  createDeveloperCockpitErrorResponse,
  createSiteContentProposal,
  DeveloperCockpitStoreError,
  getCurrentDeveloperCockpitAccess,
  getDeveloperSiteWorkspace,
  publishSiteContentProposal,
  requireContributionScope,
  saveSiteContentProposal,
  transitionSiteContentProposal,
} from '@/features/developer-cockpit/server';
import { revalidateSiteContentCache } from '@/features/public-site/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitExceededError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const consumeMutationLimit = async (userId: string) => {
  const rateLimit = await consumeRateLimit({ action: 'developer-site-proposal', identity: userId, limit: 60, windowSeconds: 3600 });
  if (!rateLimit.allowed) throw new RateLimitExceededError(
    'Too many site-copy changes.',
    rateLimit.retryAfterSeconds,
    { resource: 'site_copy_changes', maximum: 60, unit: 'attempts_per_hour' },
  );
};

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'site.propose');
    await consumeMutationLimit(access.user.id);
    const body = await request.json() as Parameters<typeof createSiteContentProposal>[1];
    await createSiteContentProposal(access, body);
    return createNoStoreJsonResponse({ site: await getDeveloperSiteWorkspace(access) }, { status: 201 });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to create the site-copy proposal.');
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    await consumeMutationLimit(access.user.id);
    const body = await request.json() as {
      action?: unknown;
      proposalId?: unknown;
      expectedVersion?: unknown;
      proposal?: Parameters<typeof createSiteContentProposal>[1];
      reviewNote?: unknown;
    };
    const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
    if (body.action === 'save') {
      requireContributionScope(access, 'site.propose');
      await saveSiteContentProposal({ access, proposalId, expectedVersion: body.expectedVersion, input: body.proposal ?? {} });
    } else if (body.action === 'submit' || body.action === 'cancel') {
      requireContributionScope(access, 'site.propose');
      await transitionSiteContentProposal({ access, proposalId, expectedVersion: body.expectedVersion, to: body.action === 'submit' ? 'submitted' : 'cancelled', reviewNote: body.reviewNote });
    } else if (body.action === 'request_changes' || body.action === 'reject') {
      requireContributionScope(access, 'site.publish');
      await transitionSiteContentProposal({ access, proposalId, expectedVersion: body.expectedVersion, to: body.action === 'request_changes' ? 'changes_requested' : 'rejected', reviewNote: body.reviewNote });
    } else if (body.action === 'publish') {
      requireContributionScope(access, 'site.publish');
      await publishSiteContentProposal(access, proposalId, body.expectedVersion, body.reviewNote);
      revalidateSiteContentCache();
      revalidatePath('/');
      revalidatePath('/about');
    } else {
      throw new DeveloperCockpitStoreError('Choose a supported site-proposal action.', 400);
    }
    return createNoStoreJsonResponse({ site: await getDeveloperSiteWorkspace(access) });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to update the site-copy proposal.');
  }
}
