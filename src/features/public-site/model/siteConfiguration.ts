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
  creatorPassOfferVisible: boolean;
  supportOfferVisible: boolean;
  homepageTitle: string;
  homepageDescription: string;
  homepageShareImageUrl: string;
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
  creatorPassOfferVisible: true,
  supportOfferVisible: true,
  homepageTitle: 'Build Complete Card Sets',
  homepageDescription: 'Create highly customized card sets from reusable layouts and structured data, then review and export the whole set in your browser.',
  homepageShareImageUrl: '',
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

const normalizeHttpsUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized === '' || /^https:\/\//.test(normalized) ? normalized : '';
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
  creatorPassOfferVisible: row?.creator_pass_offer_visible !== false,
  supportOfferVisible: row?.support_offer_visible !== false,
  homepageTitle: normalizeText(row?.homepage_title, DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageTitle, 80),
  homepageDescription: normalizeText(row?.homepage_description, DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageDescription, 200),
  homepageShareImageUrl: normalizeHttpsUrl(row?.homepage_share_image_url),
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
    creator_pass_offer_visible: input.creatorPassOfferVisible,
    support_offer_visible: input.supportOfferVisible,
    homepage_title: input.homepageTitle,
    homepage_description: input.homepageDescription,
    homepage_share_image_url: input.homepageShareImageUrl,
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
  if (typeof input.homepageShareImageUrl !== 'string' || (input.homepageShareImageUrl.trim() && !/^https:\/\//.test(input.homepageShareImageUrl.trim()))) {
    throw new Error('Share image must be blank or use an HTTPS URL.');
  }
  return configuration;
};

export const isHomepageSectionVisible = (
  configuration: PublicSiteConfiguration,
  id: HomepageSectionId,
): boolean => configuration.homepageSections.find((section) => section.id === id)?.visible !== false;
