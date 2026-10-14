import { fromJsonSchema } from '@modelcontextprotocol/server';

export interface OwnerActivityInput {
  limit?: number;
}

export const ownerActivityInputSchema = fromJsonSchema<OwnerActivityInput>({
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 20,
      description: 'Maximum number of recent Owner activity events to return.',
    },
  },
});

const nullableString = { type: ['string', 'null'] } as const;

export const ownerSiteSnapshotOutputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['environment', 'identity', 'homepage', 'contentBlocks', 'media', 'founder', 'legal', 'roadmap', 'publicationGuidance'],
  properties: {
    environment: { type: 'string' },
    identity: {
      type: 'object',
      additionalProperties: false,
      required: ['identityVersion', 'brandName', 'legalOperatorName', 'websiteUrl', 'supportEmail'],
      properties: {
        identityVersion: { type: 'integer' },
        brandName: { type: 'string' },
        legalOperatorName: { type: 'string' },
        websiteUrl: { type: 'string' },
        supportEmail: { type: 'string' },
      },
    },
    homepage: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'description', 'announcementEnabled', 'announcementMessage', 'primaryCtaLabel', 'primaryCtaHref', 'visibleNavigation', 'visibleSections'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        announcementEnabled: { type: 'boolean' },
        announcementMessage: { type: 'string' },
        primaryCtaLabel: { type: 'string' },
        primaryCtaHref: { type: 'string' },
        visibleNavigation: { type: 'array', items: { type: 'string' } },
        visibleSections: { type: 'array', items: { type: 'string' } },
      },
    },
    contentBlocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'group', 'section', 'label', 'body', 'updatedAt'],
        properties: {
          slug: { type: 'string' },
          group: { type: 'string' },
          section: { type: 'string' },
          label: { type: 'string' },
          body: { type: 'string' },
          updatedAt: nullableString,
        },
      },
    },
    media: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot', 'group', 'kind', 'label', 'alt', 'width', 'height', 'updatedAt', 'customized'],
        properties: {
          slot: { type: 'string' },
          group: { type: 'string' },
          kind: { type: 'string' },
          label: { type: 'string' },
          alt: { type: 'string' },
          width: { type: ['integer', 'null'] },
          height: { type: ['integer', 'null'] },
          updatedAt: nullableString,
          customized: { type: 'boolean' },
        },
      },
    },
    founder: {
      type: 'object',
      additionalProperties: false,
      required: ['heroHeadline', 'introduction', 'priorities', 'updatedAt'],
      properties: {
        heroHeadline: { type: 'string' },
        introduction: { type: 'string' },
        priorities: { type: 'array', items: { type: 'string' } },
        updatedAt: nullableString,
      },
    },
    legal: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'title', 'version', 'effectiveDate', 'publishedAt', 'businessIdentityVersion'],
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          version: { type: 'integer' },
          effectiveDate: { type: 'string' },
          publishedAt: { type: 'string' },
          businessIdentityVersion: { type: 'integer' },
        },
      },
    },
    roadmap: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'status', 'itemType', 'visibleMonth'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string' },
          itemType: { type: 'string' },
          visibleMonth: { type: 'string' },
        },
      },
    },
    publicationGuidance: { type: 'string' },
  },
});

export const ownerProviderReadinessOutputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['site', 'authConfigured', 'canonicalOwnerConfigured', 'billing', 'supabase', 'analytics', 'email', 'services'],
  properties: {
    site: {
      type: 'object',
      additionalProperties: false,
      required: ['publicAppUrl', 'configuredPublicAppUrl', 'usingLocalFallback', 'sitemapUrl', 'robotsUrl'],
      properties: {
        publicAppUrl: { type: 'string' },
        configuredPublicAppUrl: nullableString,
        usingLocalFallback: { type: 'boolean' },
        sitemapUrl: { type: 'string' },
        robotsUrl: { type: 'string' },
      },
    },
    authConfigured: { type: 'boolean' },
    canonicalOwnerConfigured: { type: 'boolean' },
    billing: {
      type: 'object',
      additionalProperties: false,
      required: ['productAccessConfigured', 'supportConfigured', 'webhookConfigured', 'missing'],
      properties: {
        productAccessConfigured: { type: 'boolean' },
        supportConfigured: { type: 'boolean' },
        webhookConfigured: { type: 'boolean' },
        missing: { type: 'array', items: { type: 'string' } },
      },
    },
    supabase: {
      type: 'object',
      additionalProperties: false,
      required: ['configured', 'missing'],
      properties: {
        configured: { type: 'boolean' },
        missing: { type: 'array', items: { type: 'string' } },
      },
    },
    analytics: {
      type: 'object',
      additionalProperties: true,
    },
    email: {
      type: 'object',
      additionalProperties: false,
      required: ['contactMode', 'resendConfigured', 'fromConfigured', 'replyToConfigured', 'missing'],
      properties: {
        contactMode: { type: 'string' },
        resendConfigured: { type: 'boolean' },
        fromConfigured: { type: 'boolean' },
        replyToConfigured: { type: 'boolean' },
        missing: { type: 'array', items: { type: 'string' } },
      },
    },
    services: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'category', 'status', 'statusLabel', 'purpose', 'ownership', 'removalImpact'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          status: { type: 'string' },
          statusLabel: { type: 'string' },
          purpose: { type: 'string' },
          ownership: { type: 'string' },
          removalImpact: { type: 'string' },
        },
      },
    },
  },
});

export const ownerActivityOutputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['count', 'events'],
  properties: {
    count: { type: 'integer' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'actorLabel', 'action', 'targetType', 'targetId', 'summary', 'outcome', 'createdAt'],
        properties: {
          id: { type: 'string' },
          actorLabel: { type: 'string' },
          action: { type: 'string' },
          targetType: { type: 'string' },
          targetId: nullableString,
          summary: { type: 'string' },
          outcome: { type: 'string' },
          createdAt: { type: 'string' },
        },
      },
    },
  },
});

export interface OwnerSiteCopyPublishInput {
  slug: string;
  body: string;
  expectedUpdatedAt: string | null;
}

export const ownerSiteCopyPublishInputSchema = fromJsonSchema<OwnerSiteCopyPublishInput>({
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'body', 'expectedUpdatedAt'],
  properties: {
    slug: {
      type: 'string',
      minLength: 1,
      description: 'Exact CardForge site-content slug returned by get_owner_site_snapshot.',
    },
    body: {
      type: 'string',
      minLength: 1,
      description: 'Complete replacement text for this one bounded site-content block.',
    },
    expectedUpdatedAt: {
      type: ['string', 'null'],
      description: 'Exact updatedAt value returned for this block by get_owner_site_snapshot. Use null only when that snapshot reported null for a bundled default that has never been published to shared state.',
    },
  },
});

const ownerCommittedReceiptSchema = {
  type: 'object', additionalProperties: false,
  required: ['committed', 'refreshComplete', 'refreshFailures', 'activityRecorded', 'retryable', 'nextAction', 'message'],
  properties: {
    committed: { type: 'boolean' }, refreshComplete: { type: 'boolean' },
    refreshFailures: { type: 'array', items: { type: 'string' } }, activityRecorded: { type: 'boolean' },
    retryable: { type: 'boolean' }, nextAction: { type: 'string', enum: ['none', 'reload'] }, message: { type: 'string' },
  },
};

const ownerSiteConfigurationProperties = {
  announcementEnabled: { type: 'boolean' }, announcementMessage: { type: 'string', maxLength: 240 },
  primaryCtaLabel: { type: 'string', minLength: 1, maxLength: 80 }, primaryCtaHref: { type: 'string', maxLength: 500 },
  supportOfferVisible: { type: 'boolean' }, homepageTitle: { type: 'string', minLength: 1, maxLength: 80 },
  homepageDescription: { type: 'string', minLength: 40, maxLength: 200 },
  searchKeywords: { type: 'array', minItems: 1, maxItems: 24, items: { type: 'string', minLength: 1, maxLength: 80 } },
  watermarkPreviewOpacity: { type: 'integer', minimum: 5, maximum: 80 },
  watermarkShareOpacity: { type: 'integer', minimum: 5, maximum: 80 },
  watermarkWidthPercent: { type: 'integer', minimum: 20, maximum: 90 },
  primaryNavigation: { type: 'array', minItems: 4, maxItems: 4, items: {
    type: 'object', additionalProperties: false, required: ['id', 'label', 'href', 'visible'],
    properties: { id: { type: 'string', enum: ['about', 'plans', 'roadmap', 'account'] },
      label: { type: 'string', minLength: 1, maxLength: 40 }, href: { type: 'string', maxLength: 500 }, visible: { type: 'boolean' } },
  } },
  homepageSections: { type: 'array', minItems: 5, maxItems: 5, items: {
    type: 'object', additionalProperties: false, required: ['id', 'visible'],
    properties: { id: { type: 'string', enum: ['showcase', 'workflow', 'access', 'founder', 'final_cta'] },
      visible: { type: 'boolean' }, showcaseExamples: { type: 'array', maxItems: 6, items: { type: 'object' } } },
  } },
};
const ownerSiteConfigurationSchema = {
  type: 'object', additionalProperties: false,
  required: ['updatedAt', ...Object.keys(ownerSiteConfigurationProperties)],
  properties: { ...ownerSiteConfigurationProperties, updatedAt: nullableString },
};

export const ownerSiteConfigurationOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'settings'],
  properties: { environment: { type: 'string' }, settings: ownerSiteConfigurationSchema },
});
export const ownerSiteConfigurationPublishInputSchema = fromJsonSchema<{
  patch: Record<string, unknown>; expectedUpdatedAt: string;
}>({
  type: 'object', additionalProperties: false, required: ['patch', 'expectedUpdatedAt'],
  properties: {
    patch: { type: 'object', additionalProperties: false, minProperties: 1,
      description: 'Only changed presentation fields. Arrays replace their complete collection; preserve entries and exact Template revision pins from the read.',
      properties: ownerSiteConfigurationProperties },
    expectedUpdatedAt: { type: 'string', minLength: 1, description: 'Exact revision from get_owner_site_configuration. Read and review again after conflicts.' },
  },
});
export const ownerSiteConfigurationPublicationOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'livePublication', 'settings', 'receipt'],
  properties: { environment: { type: 'string' }, livePublication: { type: 'boolean' },
    settings: ownerSiteConfigurationSchema, receipt: ownerCommittedReceiptSchema },
});

export const ownerPresentationReadInputSchema = fromJsonSchema<{ area: 'identity' | 'founder' | 'experience' | 'roadmapSettings' | 'roadmapItems' | 'legal' }>({
  type: 'object', additionalProperties: false, required: ['area'],
  properties: { area: { type: 'string', enum: ['identity', 'founder', 'experience', 'roadmapSettings', 'roadmapItems', 'legal'] } },
});
export const ownerPresentationReadOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'area', 'value'],
  properties: { environment: { type: 'string' }, area: { type: 'string' }, value: { type: 'object' } },
});
export const ownerPresentationPublishInputSchema = fromJsonSchema<{
  area: 'identity' | 'founder' | 'experience' | 'roadmapSettings' | 'roadmapStatus' | 'legal'; values: Record<string, unknown>;
  expectedIdentityVersion?: number; expectedUpdatedAt?: string | null; expectedDocumentVersion?: number;
}>({
  type: 'object', additionalProperties: false, required: ['area', 'values'],
  properties: {
    area: { type: 'string', enum: ['identity', 'founder', 'experience', 'roadmapSettings', 'roadmapStatus', 'legal'] },
    values: { type: 'object', minProperties: 1,
      description: 'Complete editable values from get_owner_presentation_editor; omit identityVersion/updatedAt and supply them through the expected revision fields. Native feature validation applies.' },
    expectedIdentityVersion: { type: 'integer', minimum: 1, maximum: 2147483647 },
    expectedUpdatedAt: nullableString,
    expectedDocumentVersion: { type: 'integer', minimum: 0, maximum: 2147483647 },
  },
  oneOf: [
    { properties: { area: { const: 'identity' } }, required: ['expectedIdentityVersion'], not: { required: ['expectedUpdatedAt'] } },
    { properties: { area: { const: 'founder' } }, required: ['expectedUpdatedAt'], not: { required: ['expectedIdentityVersion'] } },
    { properties: { area: { enum: ['experience', 'roadmapSettings', 'roadmapStatus'] }, expectedUpdatedAt: { type: 'string', minLength: 1 } }, required: ['expectedUpdatedAt'], not: { required: ['expectedIdentityVersion'] } },
    { properties: { area: { const: 'legal' } }, required: ['expectedIdentityVersion', 'expectedDocumentVersion'], not: { required: ['expectedUpdatedAt'] } },
  ],
});
export const ownerPresentationPublicationOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'livePublication', 'area', 'value', 'receipt'],
  properties: { environment: { type: 'string' }, livePublication: { type: 'boolean' }, area: { type: 'string' },
    value: { type: 'object' }, receipt: ownerCommittedReceiptSchema },
});

export const ownerSiteMediaReadOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'media'],
  properties: { environment: { type: 'string' }, media: { type: 'array', items: { type: 'object' } } },
});
export const ownerSiteMediaPublishInputSchema = fromJsonSchema<{
  slot: string; alt: string; presentation: Record<string, unknown>; expectedUpdatedAt: string | null;
  image?: { name: string; mimeType: string; base64: string };
}>({
  type: 'object', additionalProperties: false, required: ['slot', 'alt', 'presentation', 'expectedUpdatedAt'],
  properties: { slot: { type: 'string', maxLength: 80 }, alt: { type: 'string', minLength: 1, maxLength: 300 },
    expectedUpdatedAt: nullableString,
    presentation: { type: 'object', description: 'Complete presentation values from get_owner_site_media; native slot-specific validation applies.' },
    image: { type: 'object', additionalProperties: false, required: ['name', 'mimeType', 'base64'],
      properties: { name: { type: 'string', maxLength: 120 }, mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
        base64: { type: 'string', minLength: 4, maxLength: 16777216, description: 'Original image bytes encoded as raw base64. Native 12 MB image validation applies; transport/provider request limits may be smaller. No remote URL or storage path is accepted.' } } },
  },
});
export const ownerSiteMediaRestoreInputSchema = fromJsonSchema<{ slot: string; expectedUpdatedAt: string }>({
  type: 'object', additionalProperties: false, required: ['slot', 'expectedUpdatedAt'],
  properties: { slot: { type: 'string', maxLength: 80 }, expectedUpdatedAt: { type: 'string', minLength: 1 } },
});
export const ownerSiteMediaPublicationOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'livePublication', 'media', 'receipt'],
  properties: { environment: { type: 'string' }, livePublication: { type: 'boolean' }, media: { type: 'object' }, receipt: ownerCommittedReceiptSchema },
});

const ownerSiteFieldsSchema = {
  type: 'object', additionalProperties: false,
  required: ['updatedAt', 'primaryCtaLabel', 'primaryCtaHref', 'announcementEnabled', 'announcementMessage', 'navigation'],
  properties: {
    updatedAt: nullableString, primaryCtaLabel: { type: 'string' }, primaryCtaHref: { type: 'string' },
    announcementEnabled: { type: 'boolean' }, announcementMessage: { type: 'string' },
    navigation: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'label', 'href', 'visible'],
      properties: { id: { type: 'string' }, label: { type: 'string' }, href: { type: 'string' }, visible: { type: 'boolean' } },
    } },
  },
};

export const ownerSiteFieldsOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'settings'],
  properties: { environment: { type: 'string' }, settings: ownerSiteFieldsSchema },
});

export interface OwnerSiteFieldPublishInput {
  field: 'primaryCtaLabel' | 'navigationLabel' | 'announcementMessage';
  value: string;
  navigationId?: 'about' | 'plans' | 'roadmap' | 'account';
  expectedUpdatedAt: string;
}

export const ownerSiteFieldPublishInputSchema = fromJsonSchema<OwnerSiteFieldPublishInput>({
  type: 'object', additionalProperties: false, required: ['field', 'value', 'expectedUpdatedAt'],
  properties: {
    field: { type: 'string', enum: ['primaryCtaLabel', 'navigationLabel', 'announcementMessage'] },
    value: { type: 'string', maxLength: 240 },
    navigationId: { type: 'string', enum: ['about', 'plans', 'roadmap', 'account'] },
    expectedUpdatedAt: { type: 'string', minLength: 1, description: 'Exact settings.updatedAt returned by get_owner_site_fields. Reload after a conflict; never replace it with a guessed timestamp.' },
  },
  allOf: [
    { if: { properties: { field: { const: 'navigationLabel' } } }, then: { required: ['navigationId'] }, else: { not: { required: ['navigationId'] } } },
    { if: { properties: { field: { enum: ['primaryCtaLabel', 'navigationLabel'] } } }, then: { properties: { value: { minLength: 1 } } } },
  ],
});

export const ownerSiteFieldPublicationOutputSchema = fromJsonSchema({
  type: 'object', additionalProperties: false, required: ['environment', 'livePublication', 'settings', 'receipt'],
  properties: {
    environment: { type: 'string' }, livePublication: { type: 'boolean' },
    settings: ownerSiteFieldsSchema, receipt: ownerCommittedReceiptSchema,
  },
});

export const ownerSiteCopyPublicationOutputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['environment', 'livePublication', 'siteContentBlock', 'receipt'],
  properties: {
    environment: { type: 'string' },
    livePublication: { type: 'boolean' },
    siteContentBlock: {
      type: 'object',
      additionalProperties: false,
      required: ['slug', 'group', 'section', 'label', 'body', 'updatedAt'],
      properties: {
        slug: { type: 'string' },
        group: { type: 'string' },
        section: { type: 'string' },
        label: { type: 'string' },
        body: { type: 'string' },
        updatedAt: nullableString,
      },
    },
    receipt: ownerCommittedReceiptSchema,
  },
});
