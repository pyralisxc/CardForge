import type {
  OwnerConnectedService,
  OwnerConsolePayload,
} from '@/features/owner/lib/ownerConsole';
import type { AnalyticsConfigurationStatus } from '@/features/analytics/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export interface OwnerConsoleResponse {
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
    ownerAllowlistConfigured: boolean;
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
  console: OwnerConsolePayload;
}

export type OwnerPersonIdentityState = 'connected' | 'history_only' | 'account_only';

export interface OwnerPerson {
  id: string;
  email: string | null;
  name: string;
  identityState: OwnerPersonIdentityState;
  access: 'free' | 'paid' | 'dev';
  isOwner: boolean;
  ownerSource: 'clerk_private_metadata' | 'environment' | 'none';
  createdAt: string | null;
  lastSignInAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  accountNote: string;
  profileStatus: 'invited' | 'active' | 'inactive' | 'suspended' | null;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
  monthlySubmissionLimitOverride: number | null;
  monthlyPublishedRequirementOverride: number | null;
  profitShareEligible: boolean;
  developerNote: string;
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
    activeDevelopers: number;
    historyOnly: number;
    needsAttention: number;
  };
}

export const updateOwnerConsole = async (
  body: Record<string, unknown>,
  fallback: string,
): Promise<OwnerConsolePayload> => {
  const response = await fetch('/api/owner/console', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, fallback));
  return ((await response.json()) as { console: OwnerConsolePayload }).console;
};
