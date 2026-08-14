export {
  createSiteContentMap,
  DEFAULT_SITE_CONTENT_BLOCKS,
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
  type SiteContentMap,
} from './model/siteContent';
export { PUBLIC_NAVIGATION, STUDIO_NAVIGATION } from './model/publicNavigation';
export {
  DEFAULT_PUBLIC_SITE_CONFIGURATION,
  HOMEPAGE_SECTION_IDS,
  PRIMARY_NAVIGATION_IDS,
  type HomepageSectionId,
  type HomepageSectionSetting,
  type PrimaryNavigationItem,
  type PublicSiteConfiguration,
} from './model/siteConfiguration';
export { PublicSiteHeader } from './components/PublicSiteHeader';
export { PublicSiteFooter } from './components/PublicSiteFooter';
export { PublicSiteShell } from './components/PublicSiteShell';
export { LiveExampleGallery } from './components/LiveExampleGallery';
export { OutcomeHero } from './components/OutcomeHero';
export { StudioProductProof } from './components/StudioProductProof';
export { InteractiveStudioShowcase } from './components/InteractiveStudioShowcase';
export { WorkflowProof } from './components/WorkflowProof';
export { AccessComparison } from './components/AccessComparison';
export { FounderStrip } from './components/FounderStrip';
export {
  getSiteMediaFrameAspectRatio,
  getSiteMediaImageStyle,
  ResponsiveSiteMediaImage,
} from './components/ResponsiveSiteMediaImage';
export {
  FounderProfileProvider,
  useFounderProfile,
} from './components/FounderProfileContext';
export {
  SiteContentProvider,
  useSiteContent,
} from './components/PublicSitePresentationContext';
export {
  AUTO_ADVANCE_MS,
  getNextShowcaseStage,
  getShowcaseAdvanceDelay,
  INTERACTION_PAUSE_MS,
} from './model/showcaseTiming';
export {
  CARDFORGE_EXAMPLES,
  type CardForgeExample,
  type CardForgeExampleRow,
} from './model/examples';
export {
  DEFAULT_FOUNDER_PROFILE,
  FOUNDER_PROFILE_ID,
  normalizeFounderProfileInput,
  type FounderProfile,
  type FounderProfileInput,
} from './model/founderProfile';
export {
  DEFAULT_SITE_MEDIA,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  getSiteMediaContentType,
  getSiteMediaStoragePath,
  normalizeSiteMediaPresentation,
  SITE_MEDIA_SLOTS,
  type SiteMediaAsset,
  type SiteMediaFit,
  type SiteMediaFrame,
  type SiteMediaKind,
  type SiteMediaGroup,
  type SiteMediaPresentation,
  type SiteMediaSize,
  type SiteMediaSlot,
  type SiteMediaVersion,
} from './model/siteMedia';
