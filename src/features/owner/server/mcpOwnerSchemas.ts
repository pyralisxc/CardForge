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
  required: ['environment', 'identity', 'homepage', 'siteConfiguration', 'siteConfigurationUpdatedAt', 'contentBlocks', 'media', 'founder', 'legal', 'roadmap', 'publicationGuidance'],
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
    siteConfiguration: {
      type: 'object',
      additionalProperties: true,
      description: 'Complete canonical PublicSiteConfiguration. Preserve fields not intentionally changing and submit this complete object to publish_owner_site_configuration.',
    },
    siteConfigurationUpdatedAt: {
      type: ['string', 'null'],
      description: 'Conservative Owner-settings row revision. A site-configuration publication must echo this exact value.',
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
    receipt: {
      type: 'object',
      additionalProperties: false,
      required: ['committed', 'refreshComplete', 'refreshFailures', 'activityRecorded', 'retryable', 'nextAction', 'message'],
      properties: {
        committed: { type: 'boolean' },
        refreshComplete: { type: 'boolean' },
        refreshFailures: { type: 'array', items: { type: 'string' } },
        activityRecorded: { type: 'boolean' },
        retryable: { type: 'boolean' },
        nextAction: { type: 'string', enum: ['none', 'reload'] },
        message: { type: 'string' },
      },
    },
  },
});

export interface OwnerSiteConfigurationPublishInput {
  settings: Record<string, unknown>;
  expectedUpdatedAt: string;
}

export const ownerSiteConfigurationPublishInputSchema = fromJsonSchema<OwnerSiteConfigurationPublishInput>({
  type: 'object',
  additionalProperties: false,
  required: ['settings', 'expectedUpdatedAt'],
  properties: {
    settings: {
      type: 'object',
      additionalProperties: true,
      description: 'Complete siteConfiguration object returned by get_owner_site_snapshot. CardForge applies its normal site-configuration validation and ignores no required fields.',
    },
    expectedUpdatedAt: {
      type: 'string',
      minLength: 1,
      description: 'Exact siteConfigurationUpdatedAt value returned by get_owner_site_snapshot.',
    },
  },
});

export const ownerSiteConfigurationPublicationOutputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['environment', 'livePublication', 'settings', 'updatedAt', 'receipt'],
  properties: {
    environment: { type: 'string' },
    livePublication: { type: 'boolean' },
    settings: {
      type: 'object',
      additionalProperties: true,
    },
    updatedAt: { type: ['string', 'null'] },
    receipt: {
      type: 'object',
      additionalProperties: false,
      required: ['committed', 'refreshComplete', 'refreshFailures', 'activityRecorded', 'retryable', 'nextAction', 'message'],
      properties: {
        committed: { type: 'boolean' },
        refreshComplete: { type: 'boolean' },
        refreshFailures: { type: 'array', items: { type: 'string' } },
        activityRecorded: { type: 'boolean' },
        retryable: { type: 'boolean' },
        nextAction: { type: 'string', enum: ['none', 'reload'] },
        message: { type: 'string' },
      },
    },
  },
});
