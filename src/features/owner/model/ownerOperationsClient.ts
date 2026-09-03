import type {
  OwnerConnectedService,
  OwnerOperationsOverviewPayload,
  OwnerOperationsPayload,
  OwnerSiteControlPayload,
} from '@/features/owner/lib/ownerOperations';
import type { AnalyticsConfigurationStatus } from '@/features/analytics/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export interface OwnerOperationsResponse {
  ownerAccess: {
    isOwner: boolean;
    source: string;
    email: string | null;
    userId: string | null;
  };
  integrationStatus: {
    site: {
      publicAppUrl: string;
      configuredPublicAppUrl: string | null;
      usingLocalFallback: boolean;
      sitemapUrl: string;
      robotsUrl: string;
    };
    authConfigured: boolean;
    billing: {
      productAccessConfigured: boolean;
      supportConfigured: boolean;
      webhookConfigured: boolean;
      missing: string[];
    };
    supabase: {
      configured: boolean;
      missing: string[];
    };
    canonicalOwnerConfigured: boolean;
    analytics: AnalyticsConfigurationStatus;
    email: {
      contactMode: 'mailto' | 'ready_for_server_delivery';
      resendConfigured: boolean;
      fromConfigured: boolean;
      replyToConfigured: boolean;
      missing: string[];
    };
    connectedServices: OwnerConnectedService[];
  };
  overview: OwnerOperationsOverviewPayload;
}

export type OwnerPersonIdentityState = 'connected' | 'history_only' | 'account_only';

export interface OwnerPerson {
  id: string;
  email: string | null;
  name: string;
  identityState: OwnerPersonIdentityState;
  access: 'free' | 'paid' | 'contributor';
  commercialPlan: 'free' | 'creator' | 'designer';
  contributorAuthority: boolean;
  isOwner: boolean;
  ownerSource: 'clerk_private_metadata' | 'environment' | 'none';
  createdAt: string | null;
  lastSignInAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  accountNote: string;
  profileStatus: 'invited' | 'active' | 'inactive' | 'suspended' | null;
  canDraftCampaigns: boolean;
  monthlySubmissionLimitOverride: number | null;
  monthlyPublishedRequirementOverride: number | null;
  contributorNote: string;
  submissions: {
    total: number;
    published: number;
    inReview: number;
  };
}

export interface OwnerPeoplePage {
  items: OwnerPerson[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    accounts: number;
    activeContributors: number;
    historyOnly: number;
    needsAttention: number;
  };
}

export const loadOwnerSiteControls = async (): Promise<OwnerSiteControlPayload> => {
  const response = await fetch('/api/owner/operations?scope=site', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load site controls.'));
  return ((await response.json()) as { siteControls: OwnerSiteControlPayload }).siteControls;
};

export const updateOwnerOperations = async (
  body: Record<string, unknown>,
  fallback: string,
): Promise<OwnerOperationsPayload> => {
  const response = await fetch('/api/owner/operations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, fallback));
  return ((await response.json()) as { operations: OwnerOperationsPayload }).operations;
};
