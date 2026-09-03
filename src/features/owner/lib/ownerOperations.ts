import type { BusinessIdentity } from '@/features/business-identity/client';
import type { LegalDocument } from '@/features/legal/client';
import type { ExperienceSettings } from '@/features/experience-settings/client';
import type { FounderProfile, PublicSiteConfiguration, SiteContentBlock, SiteMediaAsset } from '@/features/public-site/client';
import type {
  RoadmapAdminItem,
  RoadmapSettings,
} from '@/features/roadmap/client';

export interface OwnerDatabaseMetrics {
  databaseSizeBytes: number;
  cardforgeTableSizeBytes: number;
  storageSizeBytes: number;
  assetRegistryCount: number;
  contributorSubmissionCount: number;
}

export type OwnerConnectedServiceStatus = 'ready' | 'attention' | 'disabled' | 'reference';

export interface OwnerConnectedService {
  id: string;
  name: string;
  category: string;
  identifier: string;
  status: OwnerConnectedServiceStatus;
  statusLabel: string;
  purpose: string;
  ownership: string;
  removalImpact: string;
  dashboardUrl: string;
}

export interface OwnerOperationsOverviewPayload {
  configured: boolean;
  businessIdentity: BusinessIdentity;
  roadmapItems: RoadmapAdminItem[];
  databaseMetrics: OwnerDatabaseMetrics | null;
}

export interface OwnerSiteControlPayload {
  businessIdentity: BusinessIdentity;
  experienceSettings: ExperienceSettings;
  siteConfiguration: PublicSiteConfiguration;
  siteMechanics: RoadmapSettings;
  siteContentBlocks: SiteContentBlock[];
  siteMedia: SiteMediaAsset[];
  founderProfile: FounderProfile;
  legalDocuments: LegalDocument[];
  roadmapItems: RoadmapAdminItem[];
}

export interface OwnerOperationsPayload extends OwnerSiteControlPayload {
  configured: boolean;
  databaseMetrics: OwnerDatabaseMetrics | null;
}

export const combineOwnerOperationsPayload = (
  overview: OwnerOperationsOverviewPayload,
  site: OwnerSiteControlPayload,
): OwnerOperationsPayload => ({
  ...site,
  configured: overview.configured,
  databaseMetrics: overview.databaseMetrics,
});
