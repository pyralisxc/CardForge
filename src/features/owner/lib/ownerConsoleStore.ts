import {
  getFounderBetaCampaign,
  getFounderBetaClaims,
} from '@/features/account/server';
import { getContactRequests } from '@/features/contact/server';
import { getLegalDocuments } from '@/features/legal/server';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { getOwnerDatabaseMetrics } from '@/features/owner/server/ownerDatabaseMetrics';
import {
  getSiteContentBlocks,
  getSiteOperatorSettings,
} from '@/features/public-site/server';
import {
  getRoadmapAdminItems,
  getRoadmapSettings,
} from '@/features/roadmap/server';

export const getOwnerConsolePayload = async (): Promise<OwnerConsolePayload> => {
  const [
    settings,
    siteMechanics,
    siteContentBlocks,
    legalDocuments,
    founderBeta,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  ] = await Promise.all([
    getSiteOperatorSettings(),
    getRoadmapSettings(),
    getSiteContentBlocks(),
    getLegalDocuments(),
    getFounderBetaCampaign(),
    getFounderBetaClaims(),
    getRoadmapAdminItems(),
    getOwnerDatabaseMetrics(),
    getContactRequests(),
  ]);

  return {
    configured: founderBeta.configured,
    settings,
    siteMechanics,
    siteContentBlocks,
    legalDocuments,
    founderBetaCampaign: founderBeta.campaign,
    founderBetaClaims,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  };
};
