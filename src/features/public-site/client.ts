export {
  createSiteContentMap,
  DEFAULT_SITE_CONTENT_BLOCKS,
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
  type SiteContentMap,
} from './model/siteContent';
export { PUBLIC_NAVIGATION } from './model/publicNavigation';
export {
  DEFAULT_HOMEPAGE_SHOWCASE_STAGES,
  createLegacyHomepageShowcaseStages,
  HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS,
  MAX_HOMEPAGE_SHOWCASE_STAGES,
  MAX_HOMEPAGE_STAGE_VIEWS,
  type HomepageShowcaseStage,
  type HomepageShowcaseView,
} from './model/homepageShowcaseStages';
export {
  DEFAULT_HOMEPAGE_SECTION_DESIGN,
  HOMEPAGE_COMPOSER_MEDIA_SLOTS,
  MAX_HOMEPAGE_CUSTOM_SECTIONS,
  MAX_HOMEPAGE_SECTION_BLOCKS,
  isHomepageCustomSection,
  type HomepageCustomSection,
  type HomepageContentBlock,
  type HomepageSectionDesign,
} from './model/homepageComposition';
export {
  DEFAULT_PUBLIC_SITE_CONFIGURATION,
  HOMEPAGE_SECTION_IDS,
  PRIMARY_NAVIGATION_IDS,
  type HomepageSectionId,
  type HomepageSectionSetting,
  type HomepageLayoutSection,
  type PrimaryNavigationItem,
  type PublicSiteConfiguration,
} from './model/siteConfiguration';
export { PublicSiteHeader } from './components/PublicSiteHeader';
export { PublicSiteFooter } from './components/PublicSiteFooter';
export { PublicSiteShell } from './components/PublicSiteShell';
export { PublicSiteOwnerLiveControls, OwnerPageEditorStateContext } from './components/PublicSiteOwnerLiveControls';
export { LiveExampleGallery } from './components/LiveExampleGallery';
export { OutcomeHero } from './components/OutcomeHero';
export { StudioProductProof } from './components/StudioProductProof';
export { InteractiveStudioShowcase } from './components/InteractiveStudioShowcase';
export { WorkflowProof } from './components/WorkflowProof';
export { AccessComparison } from './components/AccessComparison';
export { PlansPageContent } from './components/PlansPageContent';
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
  createDefaultHomepageShowcaseExamples,
  type CardForgeExample,
  type CardForgeExampleRow,
  type HomepageShowcaseExample,
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

export {
  getOwnerPublicationPresentation,
  type OwnerPublicationEnvironment,
} from './model/ownerPublicationEnvironment';
