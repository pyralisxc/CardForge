import { getBusinessIdentity } from '@/features/business-identity/server';
import { getContactRequests } from '@/features/contact/server';
import { getLegalDocuments } from '@/features/legal/server';
import { getExperienceSettings } from '@/features/experience-settings/server';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
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

export const getOwnerConsolePayload = async (): Promise<OwnerConsolePayload> => {
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
    databaseMetrics,
    contactRequests,
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
    getOwnerDatabaseMetrics(),
    getContactRequests(),
  ]);

  return {
    configured: getSupabaseServerConfigStatus().configured,
    businessIdentity,
    experienceSettings,
    siteConfiguration,
    siteMechanics,
    siteContentBlocks,
    siteMedia,
    founderProfile,
    legalDocuments,
    roadmapItems,
    databaseMetrics,
    contactRequests,
  };
};
