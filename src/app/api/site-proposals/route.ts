import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const retiredSiteProposalResponse = () => createApiErrorResponse(
  410,
  'site_proposal_retired',
  'Public-site proposals are no longer a Contributor capability.',
  {
    kind: 'not_found',
    retryable: false,
    nextAction: 'Use the active Pipeline and campaign contribution lanes from your Profile or Library.',
  },
);

export const GET = retiredSiteProposalResponse;
export const POST = retiredSiteProposalResponse;
export const PATCH = retiredSiteProposalResponse;
