export {
  createSiteContentMap,
  DEFAULT_SITE_CONTENT_BLOCKS,
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from './model/siteContent';
export { PUBLIC_NAVIGATION, STUDIO_NAVIGATION } from './model/publicNavigation';
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
  FounderProfileProvider,
  useFounderProfile,
} from './components/FounderProfileContext';
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
  FOUNDER_PORTRAIT_BUCKET,
  FOUNDER_PORTRAIT_PATH,
  FOUNDER_PROFILE_ID,
  normalizeFounderProfileInput,
  type FounderProfile,
  type FounderProfileInput,
} from './model/founderProfile';
export {
  DEFAULT_SITE_MEDIA,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  getSiteMediaStoragePath,
  SITE_MEDIA_SLOTS,
  type SiteMediaAsset,
  type SiteMediaSlot,
} from './model/siteMedia';
