import { getBusinessIdentity } from '@/features/business-identity/server';
import { getContactRequests } from '@/features/contact/server';
import { getLegalDocuments } from '@/features/legal/server';
import { getExperienceSettings } from '@/features/experience-settings/server';
import type {
  OwnerConsoleOverviewPayload,
  OwnerConsolePayload,
  OwnerSiteControlPayload,
} from '@/features/owner/lib/ownerConsole';
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

export const getOwnerConsoleOverviewPayload = async (): Promise<OwnerConsoleOverviewPayload> => {
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

export const getOwnerSiteConsolePayload = async (): Promise<OwnerConsolePayload> => ({
  ...(await getOwnerSiteControlPayload()),
  configured: getSupabaseServerConfigStatus().configured,
  databaseMetrics: null,
  contactRequests: [],
});

/** Full fan-in retained only for explicit compatibility callers; Owner Console startup no longer uses it. */
export const getOwnerConsolePayload = async (): Promise<OwnerConsolePayload> => {
  const [overview, site, contactRequests] = await Promise.all([
    getOwnerConsoleOverviewPayload(),
    getOwnerSiteControlPayload(),
    getContactRequests(),
  ]);
  return {
    ...site,
    configured: overview.configured,
    databaseMetrics: overview.databaseMetrics,
    contactRequests,
  };
};
