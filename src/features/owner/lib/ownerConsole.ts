import type { ContactRequest } from '@/features/contact/client';
import type { BusinessIdentity } from '@/features/business-identity/client';
import type { LegalDocument } from '@/features/legal/client';
import type { FounderProfile, SiteContentBlock } from '@/features/public-site/client';
import type {
  RoadmapAdminItem,
  RoadmapSettings,
} from '@/features/roadmap/client';
import type { FounderBetaCampaign, FounderBetaClaim } from '@/features/account/client';

export interface OwnerDatabaseMetrics {
  databaseSizeBytes: number;
  cardforgeTableSizeBytes: number;
  storageSizeBytes: number;
  assetRegistryCount: number;
  developerSubmissionCount: number;
  founderBetaClaimCount: number;
}

export interface OwnerConsolePayload {
  configured: boolean;
  businessIdentity: BusinessIdentity;
  siteMechanics: RoadmapSettings;
  siteContentBlocks: SiteContentBlock[];
  founderProfile: FounderProfile;
  founderPortraitUrl: string | null;
  legalDocuments: LegalDocument[];
  founderBetaCampaign: FounderBetaCampaign;
  founderBetaClaims: FounderBetaClaim[];
  roadmapItems: RoadmapAdminItem[];
  databaseMetrics: OwnerDatabaseMetrics | null;
  contactRequests: ContactRequest[];
}
