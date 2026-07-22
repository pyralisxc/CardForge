import {
  getFounderBetaCampaign,
  getFounderBetaClaims,
} from '@/features/account/server';
import { getBusinessIdentity } from '@/features/business-identity/server';
import { getContactRequests } from '@/features/contact/server';
import { getLegalDocuments } from '@/features/legal/server';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { getOwnerDatabaseMetrics } from '@/features/owner/server/ownerDatabaseMetrics';
import {
  getFounderProfile,
  getSiteMedia,
  getSiteContentBlocks,
} from '@/features/public-site/server';
import {
  getRoadmapAdminItems,
  getRoadmapSettings,
} from '@/features/roadmap/server';

export const getOwnerConsolePayload = async (): Promise<OwnerConsolePayload> => {
  const [
    businessIdentity,
    siteMechanics,
    siteContentBlocks,
    siteMedia,
    founderProfile,
    legalDocuments,
    founderBeta,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  ] = await Promise.all([
    getBusinessIdentity(),
    getRoadmapSettings(),
    getSiteContentBlocks(),
    getSiteMedia(),
    getFounderProfile(),
    getLegalDocuments(),
    getFounderBetaCampaign(),
    getFounderBetaClaims(),
    getRoadmapAdminItems(),
    getOwnerDatabaseMetrics(),
    getContactRequests(),
  ]);

  return {
    configured: founderBeta.configured,
    businessIdentity,
    siteMechanics,
    siteContentBlocks,
    siteMedia,
    founderProfile,
    legalDocuments,
    founderBetaCampaign: founderBeta.campaign,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  };
};
