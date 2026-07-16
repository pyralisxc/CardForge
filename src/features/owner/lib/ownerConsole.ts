import type { ContactRequest } from '@/features/contact/client';
import type { LegalDocument } from '@/features/legal/client';
import type {
  SiteContentBlock,
  SiteOperatorSettings,
} from '@/features/public-site/client';
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
  settings: SiteOperatorSettings;
  siteMechanics: RoadmapSettings;
  siteContentBlocks: SiteContentBlock[];
  legalDocuments: LegalDocument[];
  founderBetaCampaign: FounderBetaCampaign;
  founderBetaClaims: FounderBetaClaim[];
  roadmapItems: RoadmapAdminItem[];
  databaseMetrics: OwnerDatabaseMetrics | null;
  contactRequests: ContactRequest[];
}
