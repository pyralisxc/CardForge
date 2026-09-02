import type { BusinessIdentity } from '@/features/business-identity/client';
import { getSiteMediaDisplaySrc, type SiteMediaAsset } from '../model/siteMedia';

type StructuredDataValue = Record<string, unknown>;

interface BreadcrumbItem {
  name: string;
  path: `/${string}` | '/';
}

const absoluteUrl = (identity: BusinessIdentity, path: string): string =>
  new URL(path, `${identity.websiteUrl}/`).toString();

const personId = (identity: BusinessIdentity): string =>
  `${identity.websiteUrl}/#cameron-locke`;

export const createCardForgeStructuredData = (
  identity: BusinessIdentity,
  brandMark?: SiteMediaAsset,
): StructuredDataValue => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': personId(identity),
      name: identity.legalOperatorName,
      url: absoluteUrl(identity, '/cameron'),
      address: {
        '@type': 'PostalAddress',
        addressRegion: identity.jurisdictionState,
        addressCountry: identity.jurisdictionCountry,
      },
    },
    {
      '@type': 'Brand',
      '@id': `${identity.websiteUrl}/#brand`,
      name: identity.brandName,
      url: identity.websiteUrl,
      founder: { '@id': personId(identity) },
      logo: absoluteUrl(identity, brandMark ? (getSiteMediaDisplaySrc(brandMark) ?? '/brand/cardforge-studio/brand-mark.svg') : '/brand/cardforge-studio/brand-mark.svg'),
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${identity.websiteUrl}/#software`,
      name: identity.brandName,
      url: absoluteUrl(identity, '/account'),
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Modern web browser',
      description: 'A local-first workspace for designing reusable card templates, generating complete sets from structured data, and exporting production-ready files.',
      brand: { '@id': `${identity.websiteUrl}/#brand` },
      creator: { '@id': personId(identity) },
    },
  ],
});

export const createFounderProfileStructuredData = (
  identity: BusinessIdentity,
): StructuredDataValue => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ProfilePage',
      '@id': `${identity.websiteUrl}/cameron#profile`,
      url: absoluteUrl(identity, '/cameron'),
      name: `About ${identity.legalOperatorName}`,
      mainEntity: { '@id': personId(identity) },
      isPartOf: { '@id': `${identity.websiteUrl}/#brand` },
    },
    {
      '@type': 'Person',
      '@id': personId(identity),
      name: identity.legalOperatorName,
      url: absoluteUrl(identity, '/cameron'),
      jobTitle: `Founder and independent contributor of ${identity.brandName}`,
      address: {
        '@type': 'PostalAddress',
        addressRegion: identity.jurisdictionState,
        addressCountry: identity.jurisdictionCountry,
      },
      worksFor: { '@id': `${identity.websiteUrl}/#brand` },
    },
  ],
});

export const createBreadcrumbStructuredData = (
  identity: BusinessIdentity,
  items: BreadcrumbItem[],
): StructuredDataValue => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(({ name, path }, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name,
    item: absoluteUrl(identity, path),
  })),
});

export const serializeStructuredData = (value: StructuredDataValue): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');

export function StructuredData({ value }: { value: StructuredDataValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(value) }}
    />
  );
}
