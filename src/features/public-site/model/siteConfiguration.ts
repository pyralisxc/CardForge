export const PRIMARY_NAVIGATION_IDS = ['about', 'roadmap', 'account'] as const;
export const HOMEPAGE_SECTION_IDS = ['showcase', 'workflow', 'access', 'founder', 'final_cta'] as const;

export type PrimaryNavigationId = typeof PRIMARY_NAVIGATION_IDS[number];
export type HomepageSectionId = typeof HOMEPAGE_SECTION_IDS[number];

export interface PrimaryNavigationItem {
  id: PrimaryNavigationId;
  label: string;
  href: string;
  visible: boolean;
}

export interface HomepageSectionSetting {
  id: HomepageSectionId;
  visible: boolean;
}

export interface PublicSiteConfiguration {
  announcementEnabled: boolean;
  announcementMessage: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  supportOfferVisible: boolean;
  homepageTitle: string;
  homepageDescription: string;
  searchKeywords: string[];
  watermarkPreviewOpacity: number;
  watermarkShareOpacity: number;
  watermarkWidthPercent: number;
  primaryNavigation: PrimaryNavigationItem[];
  homepageSections: HomepageSectionSetting[];
}

const NAVIGATION_ROUTES: Record<PrimaryNavigationId, string> = {
  about: '/about',
  roadmap: '/roadmap',
  account: '/account',
};

const DEFAULT_NAVIGATION_LABELS: Record<PrimaryNavigationId, string> = {
  about: 'How it works',
  roadmap: 'Roadmap',
  account: 'Account',
};

export const DEFAULT_PUBLIC_SITE_CONFIGURATION: PublicSiteConfiguration = {
  announcementEnabled: false,
  announcementMessage: '',
  primaryCtaLabel: 'Try the Studio',
  primaryCtaHref: '/studio',
  supportOfferVisible: true,
  homepageTitle: 'Build Complete Card Sets',
  homepageDescription: 'Create highly customized card sets from reusable layouts and structured data, then review and export the whole set in your browser.',
  searchKeywords: [
    'card maker',
    'TCG card generator',
    'tabletop card creator',
    'printable card templates',
    'custom card set creator',
    'bulk card generator',
    'fantasy card template editor',
    'local-first card design studio',
  ],
  watermarkPreviewOpacity: 24,
  watermarkShareOpacity: 28,
  watermarkWidthPercent: 68,
  primaryNavigation: PRIMARY_NAVIGATION_IDS.map((id) => ({
    id,
    label: DEFAULT_NAVIGATION_LABELS[id],
    href: NAVIGATION_ROUTES[id],
    visible: true,
  })),
  homepageSections: HOMEPAGE_SECTION_IDS.map((id) => ({ id, visible: true })),
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeText = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/[ \t]+/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

const normalizeInteger = (value: unknown, fallback: number, minimum: number, maximum: number): number => (
  typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback
);

const normalizeKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [...DEFAULT_PUBLIC_SITE_CONFIGURATION.searchKeywords];
  const keywords = [...new Set(value.flatMap((item) => (
    typeof item === 'string' ? [item.trim().replace(/\s+/g, ' ')] : []
  )).filter(Boolean))];
  return keywords.length >= 1 && keywords.length <= 24 && keywords.every((keyword) => keyword.length <= 80)
    ? keywords
    : [...DEFAULT_PUBLIC_SITE_CONFIGURATION.searchKeywords];
};

const isSafeInternalPath = (value: string): boolean => /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(value);

const normalizeNavigation = (value: unknown): PrimaryNavigationItem[] => {
  const rows = Array.isArray(value) ? value : [];
  const used = new Set<PrimaryNavigationId>();
  const normalized = rows.flatMap((row) => {
    if (!isRecord(row) || !PRIMARY_NAVIGATION_IDS.includes(row.id as PrimaryNavigationId)) return [];
    const id = row.id as PrimaryNavigationId;
    if (used.has(id)) return [];
    used.add(id);
    return [{
      id,
      href: NAVIGATION_ROUTES[id],
      label: normalizeText(row.label, DEFAULT_NAVIGATION_LABELS[id], 40),
      visible: row.visible !== false,
    }];
  });
  return [
    ...normalized,
    ...PRIMARY_NAVIGATION_IDS.filter((id) => !used.has(id)).map((id) => ({
      id,
      href: NAVIGATION_ROUTES[id],
      label: DEFAULT_NAVIGATION_LABELS[id],
      visible: true,
    })),
  ];
};

const normalizeHomepageSections = (value: unknown): HomepageSectionSetting[] => {
  const rows = Array.isArray(value) ? value : [];
  const used = new Set<HomepageSectionId>();
  const normalized = rows.flatMap((row) => {
    if (!isRecord(row) || !HOMEPAGE_SECTION_IDS.includes(row.id as HomepageSectionId)) return [];
    const id = row.id as HomepageSectionId;
    if (used.has(id)) return [];
    used.add(id);
    return [{ id, visible: row.visible !== false }];
  });
  return [
    ...normalized,
    ...HOMEPAGE_SECTION_IDS.filter((id) => !used.has(id)).map((id) => ({ id, visible: true })),
  ];
};

export const hydratePublicSiteConfiguration = (
  row: Record<string, unknown> | null | undefined,
): PublicSiteConfiguration => ({
  announcementEnabled: row?.announcement_enabled === true,
  announcementMessage: normalizeText(row?.announcement_message, '', 240),
  primaryCtaLabel: normalizeText(row?.primary_cta_label, DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryCtaLabel, 80),
  primaryCtaHref: typeof row?.primary_cta_href === 'string' && isSafeInternalPath(row.primary_cta_href)
    ? row.primary_cta_href
    : DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryCtaHref,
  supportOfferVisible: row?.support_offer_visible !== false,
  homepageTitle: normalizeText(row?.homepage_title, DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageTitle, 80),
  homepageDescription: normalizeText(row?.homepage_description, DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageDescription, 200),
  searchKeywords: normalizeKeywords(row?.search_keywords),
  watermarkPreviewOpacity: normalizeInteger(row?.watermark_preview_opacity, DEFAULT_PUBLIC_SITE_CONFIGURATION.watermarkPreviewOpacity, 5, 80),
  watermarkShareOpacity: normalizeInteger(row?.watermark_share_opacity, DEFAULT_PUBLIC_SITE_CONFIGURATION.watermarkShareOpacity, 5, 80),
  watermarkWidthPercent: normalizeInteger(row?.watermark_width_percent, DEFAULT_PUBLIC_SITE_CONFIGURATION.watermarkWidthPercent, 20, 90),
  primaryNavigation: normalizeNavigation(row?.primary_navigation),
  homepageSections: normalizeHomepageSections(row?.homepage_sections),
});

export const normalizePublicSiteConfigurationInput = (
  input: Record<string, unknown>,
): PublicSiteConfiguration => {
  const configuration = hydratePublicSiteConfiguration({
    announcement_enabled: input.announcementEnabled,
    announcement_message: input.announcementMessage,
    primary_cta_label: input.primaryCtaLabel,
    primary_cta_href: input.primaryCtaHref,
    support_offer_visible: input.supportOfferVisible,
    homepage_title: input.homepageTitle,
    homepage_description: input.homepageDescription,
    search_keywords: input.searchKeywords,
    watermark_preview_opacity: input.watermarkPreviewOpacity,
    watermark_share_opacity: input.watermarkShareOpacity,
    watermark_width_percent: input.watermarkWidthPercent,
    primary_navigation: input.primaryNavigation,
    homepage_sections: input.homepageSections,
  });

  if (typeof input.announcementMessage !== 'string' || input.announcementMessage.trim().length > 240) {
    throw new Error('Announcement text must be 240 characters or fewer.');
  }
  if (input.announcementEnabled === true && !input.announcementMessage.trim()) {
    throw new Error('Add announcement text before showing the banner.');
  }
  if (typeof input.primaryCtaLabel !== 'string' || !input.primaryCtaLabel.trim() || input.primaryCtaLabel.trim().length > 80) {
    throw new Error('Primary action text must be between 1 and 80 characters.');
  }
  if (typeof input.primaryCtaHref !== 'string' || !isSafeInternalPath(input.primaryCtaHref)) {
    throw new Error('Primary action destination must be a safe CardForge path.');
  }
  if (typeof input.homepageTitle !== 'string' || !input.homepageTitle.trim() || input.homepageTitle.trim().length > 80) {
    throw new Error('Homepage title must be between 1 and 80 characters.');
  }
  if (typeof input.homepageDescription !== 'string' || input.homepageDescription.trim().length < 40 || input.homepageDescription.trim().length > 200) {
    throw new Error('Homepage description must be between 40 and 200 characters.');
  }
  if (!Array.isArray(input.searchKeywords) || input.searchKeywords.length < 1 || input.searchKeywords.length > 24
    || input.searchKeywords.some((keyword) => typeof keyword !== 'string' || !keyword.trim() || keyword.trim().length > 80)) {
    throw new Error('Add between 1 and 24 search phrases, each 80 characters or fewer.');
  }
  if (typeof input.watermarkPreviewOpacity !== 'number' || !Number.isInteger(input.watermarkPreviewOpacity) || input.watermarkPreviewOpacity < 5 || input.watermarkPreviewOpacity > 80) {
    throw new Error('Preview watermark opacity must be between 5 and 80 percent.');
  }
  if (typeof input.watermarkShareOpacity !== 'number' || !Number.isInteger(input.watermarkShareOpacity) || input.watermarkShareOpacity < 5 || input.watermarkShareOpacity > 80) {
    throw new Error('Social watermark opacity must be between 5 and 80 percent.');
  }
  if (typeof input.watermarkWidthPercent !== 'number' || !Number.isInteger(input.watermarkWidthPercent) || input.watermarkWidthPercent < 20 || input.watermarkWidthPercent > 90) {
    throw new Error('Watermark width must be between 20 and 90 percent.');
  }
  return configuration;
};

export const isHomepageSectionVisible = (
  configuration: PublicSiteConfiguration,
  id: HomepageSectionId,
): boolean => configuration.homepageSections.find((section) => section.id === id)?.visible !== false;
