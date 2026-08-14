import type { ContactRequest } from '@/features/contact/client';
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
  developerSubmissionCount: number;
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

export interface OwnerConsolePayload {
  configured: boolean;
  businessIdentity: BusinessIdentity;
  experienceSettings: ExperienceSettings;
  siteConfiguration: PublicSiteConfiguration;
  siteMechanics: RoadmapSettings;
  siteContentBlocks: SiteContentBlock[];
  siteMedia: SiteMediaAsset[];
  founderProfile: FounderProfile;
  legalDocuments: LegalDocument[];
  roadmapItems: RoadmapAdminItem[];
  databaseMetrics: OwnerDatabaseMetrics | null;
  contactRequests: ContactRequest[];
}
