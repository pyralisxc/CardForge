import { getBusinessIdentity } from '@/features/business-identity/server';
import { getLegalDocuments } from '@/features/legal/server';
import { getExperienceSettings } from '@/features/experience-settings/server';
import type {
  OwnerOperationsOverviewPayload,
  OwnerOperationsPayload,
  OwnerSiteControlPayload,
} from '@/features/owner/lib/ownerOperations';
import { getOwnerDatabaseMetrics } from '@/features/owner/server/ownerDatabaseMetrics';
import {
  getFounderProfile,
  getPublicSiteConfiguration,
  getSiteMedia,
  getSiteContentBlocks,
} from '@/features/public-site/server';
import {
  getRoadmapAdminItems,
  getRoadmapSettings,
} from '@/features/roadmap/server';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

export const getOwnerOperationsOverviewPayload = async (): Promise<OwnerOperationsOverviewPayload> => {
  const [businessIdentity, roadmapItems, databaseMetrics] = await Promise.all([
    getBusinessIdentity(),
    getRoadmapAdminItems(),
    getOwnerDatabaseMetrics(),
  ]);
  return {
    configured: getSupabaseServerConfigStatus().configured,
    businessIdentity,
    roadmapItems,
    databaseMetrics,
  };
};

export const getOwnerSiteControlPayload = async (): Promise<OwnerSiteControlPayload> => {
  const [
    businessIdentity,
    experienceSettings,
    siteConfiguration,
    siteMechanics,
    siteContentBlocks,
    siteMedia,
    founderProfile,
    legalDocuments,
    roadmapItems,
  ] = await Promise.all([
    getBusinessIdentity(),
    getExperienceSettings(),
    getPublicSiteConfiguration(),
    getRoadmapSettings(),
    getSiteContentBlocks(),
    getSiteMedia(),
    getFounderProfile(),
    getLegalDocuments(),
    getRoadmapAdminItems(),
  ]);
  return {
    businessIdentity,
    experienceSettings,
    siteConfiguration,
    siteMechanics,
    siteContentBlocks,
    siteMedia,
    founderProfile,
    legalDocuments,
    roadmapItems,
  };
};

export const getOwnerSiteOperationsPayload = async (): Promise<OwnerOperationsPayload> => ({
  ...(await getOwnerSiteControlPayload()),
  configured: getSupabaseServerConfigStatus().configured,
  databaseMetrics: null,
});
