export interface SiteOperatorSettings {
  businessName: string;
  ownerName: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
}

export const DEFAULT_SITE_OPERATOR_SETTINGS: SiteOperatorSettings = {
  businessName: 'Neon Black Interactive LLC',
  ownerName: 'CardForge Support',
  supportEmail: 'pyraliscameron@gmail.com',
  supportPhone: '',
  websiteUrl: 'https://cardforges.com',
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : '';

export const normalizeSiteOperatorSettingsInput = (
  value: Partial<Record<keyof SiteOperatorSettings, unknown>>,
): SiteOperatorSettings => ({
  businessName: normalizeText(value.businessName) || DEFAULT_SITE_OPERATOR_SETTINGS.businessName,
  ownerName: normalizeText(value.ownerName) || DEFAULT_SITE_OPERATOR_SETTINGS.ownerName,
  supportEmail: normalizeText(value.supportEmail) || DEFAULT_SITE_OPERATOR_SETTINGS.supportEmail,
  supportPhone: normalizeText(value.supportPhone) || DEFAULT_SITE_OPERATOR_SETTINGS.supportPhone,
  websiteUrl: normalizeText(value.websiteUrl) || DEFAULT_SITE_OPERATOR_SETTINGS.websiteUrl,
});
