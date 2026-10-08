import { createMcpHandler } from 'mcp-handler';

import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { getOwnerActivity } from '@/features/owner/server/ownerActivityStore';
import { getOwnerIntegrationStatus } from '@/features/owner/server/ownerIntegrationStatus';
import { getOwnerSiteControlPayload } from '@/features/owner/lib/ownerOperationsStore';
import {
  publishOwnerSiteConfiguration,
  publishOwnerSiteContentBlock,
} from '@/features/owner/server/ownerSiteCommands';
import type { McpOwnerAccess } from './mcpOwnerAccess';
import {
  ownerActivityInputSchema,
  ownerActivityOutputSchema,
  ownerSiteConfigurationPublicationOutputSchema,
  ownerSiteConfigurationPublishInputSchema,
  ownerSiteCopyPublicationOutputSchema,
  ownerSiteCopyPublishInputSchema,
  ownerProviderReadinessOutputSchema,
  ownerSiteSnapshotOutputSchema,
} from './mcpOwnerSchemas';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
  _meta?: Record<string, unknown>;
};

const deploymentEnvironment = (): string => (
  process.env.VERCEL_ENV?.trim()
  || process.env.NODE_ENV?.trim()
  || 'unknown'
);

export const registerOwnerReadTools = ({
  server,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  getAccess: () => Promise<McpOwnerAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
  const runObserved = async <Result>({
    toolName,
    input,
    execute,
  }: {
    toolName: string;
    input: unknown;
    execute: (access: McpOwnerAccess) => Promise<Result>;
  }): Promise<Result | ToolErrorResult> => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({
        ownerUserId: access.user.id,
        toolName,
        input,
        execute: async () => execute(access),
      });
    } catch (error) {
      return toolError(error);
    }
  };

  server.registerTool(
    'get_owner_site_snapshot',
    {
      title: 'Read the current CardForge public-site Owner state',
      description: 'Read the canonical Owner-controlled public presentation state without changing it. Use before proposing live copy, navigation, media, founder, legal, or roadmap changes. This is runtime Owner state, not Git source and not a Preview-to-production content promotion record.',
      outputSchema: ownerSiteSnapshotOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async () => runObserved({
      toolName: 'get_owner_site_snapshot',
      input: {},
      execute: async () => {
        const site = await getOwnerSiteControlPayload();
        return {
          content: [{
            type: 'text',
            text: 'Loaded the canonical CardForge Owner site snapshot for ' + deploymentEnvironment() + '. No live state was changed.',
          }],
          structuredContent: {
            environment: deploymentEnvironment(),
            identity: {
              identityVersion: site.businessIdentity.identityVersion,
              brandName: site.businessIdentity.brandName,
              legalOperatorName: site.businessIdentity.legalOperatorName,
              websiteUrl: site.businessIdentity.websiteUrl,
              supportEmail: site.businessIdentity.supportEmail,
            },
            homepage: {
              title: site.siteConfiguration.homepageTitle,
              description: site.siteConfiguration.homepageDescription,
              announcementEnabled: site.siteConfiguration.announcementEnabled,
              announcementMessage: site.siteConfiguration.announcementMessage,
              primaryCtaLabel: site.siteConfiguration.primaryCtaLabel,
              primaryCtaHref: site.siteConfiguration.primaryCtaHref,
              visibleNavigation: site.siteConfiguration.primaryNavigation
                .filter((item) => item.visible)
                .map((item) => item.label + ' (' + item.href + ')'),
              visibleSections: site.siteConfiguration.homepageSections
                .filter((section) => section.visible)
                .map((section) => section.id),
            },
            siteConfiguration: site.siteConfiguration,
            siteConfigurationUpdatedAt: site.siteConfigurationUpdatedAt,
            contentBlocks: site.siteContentBlocks.map((block) => ({
              slug: block.slug,
              group: block.group,
              section: block.section,
              label: block.label,
              body: block.body,
              updatedAt: block.updatedAt,
            })),
            media: site.siteMedia.map((asset) => ({
              slot: asset.slot,
              group: asset.group,
              kind: asset.kind,
              label: asset.label,
              alt: asset.alt,
              width: asset.width,
              height: asset.height,
              updatedAt: asset.updatedAt,
              customized: Boolean(asset.storagePath),
            })),
            founder: {
              heroHeadline: site.founderProfile.heroHeadline,
              introduction: site.founderProfile.introduction,
              priorities: site.founderProfile.priorities,
              updatedAt: site.founderProfile.updatedAt,
            },
            legal: site.legalDocuments.map((document) => ({
              slug: document.slug,
              title: document.title,
              version: document.version,
              effectiveDate: document.effectiveDate,
              publishedAt: document.publishedAt,
              businessIdentityVersion: document.businessIdentityVersion,
            })),
            roadmap: site.roadmapItems.map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
              itemType: item.itemType,
              visibleMonth: item.visibleMonth,
            })),
            publicationGuidance: deploymentEnvironment() === 'production'
              ? 'This is live production Owner state. Any later mutation tool must describe its action as a live publication and preserve revision/conflict semantics.'
              : 'This is non-production Owner state. Changes in this environment must never be represented as live production publication.',
          },
        };
      },
    }),
  );

  server.registerTool(
    'publish_owner_site_copy',
    {
      title: 'Publish one CardForge Owner site-copy block',
      description: 'Publish one bounded Owner-controlled public copy block using the exact updatedAt revision returned by get_owner_site_snapshot. In production this changes the live CardForge site immediately; in Preview it changes staging only. If the block changed after it was read, CardForge rejects the write and the agent must reload current Owner state before trying again.',
      inputSchema: ownerSiteCopyPublishInputSchema,
      outputSchema: ownerSiteCopyPublicationOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ slug, body, expectedUpdatedAt }) => runObserved({
      toolName: 'publish_owner_site_copy',
      input: { slug, body, expectedUpdatedAt },
      execute: async (access) => {
        const publication = await publishOwnerSiteContentBlock({
          actor: {
            userId: access.user.id,
            email: access.email,
          },
          input: {
            slug,
            body,
            expectedUpdatedAt,
          },
        });
        const isProduction = deploymentEnvironment() === 'production';
        return {
          content: [{
            type: 'text',
            text: publication.receipt.refreshComplete
              ? (isProduction
                  ? publication.siteContentBlock.label + ' was published live to CardForge.'
                  : publication.siteContentBlock.label + ' was published to this non-production CardForge environment only.')
              : publication.receipt.message,
          }],
          structuredContent: {
            environment: deploymentEnvironment(),
            livePublication: isProduction,
            siteContentBlock: publication.siteContentBlock,
            receipt: publication.receipt,
          },
        };
      },
    }),
  );

  server.registerTool(
    'publish_owner_site_configuration',
    {
      title: 'Publish CardForge public-site configuration',
      description: 'Publish the complete bounded CardForge public-site configuration using the exact siteConfigurationUpdatedAt revision returned by get_owner_site_snapshot. This covers announcements, approved navigation labels/order/visibility, primary action, homepage section order/visibility, search metadata, support visibility, watermark presentation, and pinned showcase examples. In production it publishes live; in Preview it changes staging only. A newer Owner-settings write causes a conflict and must be re-read before retrying.',
      inputSchema: ownerSiteConfigurationPublishInputSchema,
      outputSchema: ownerSiteConfigurationPublicationOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ settings, expectedUpdatedAt }) => runObserved({
      toolName: 'publish_owner_site_configuration',
      input: { settings, expectedUpdatedAt },
      execute: async (access) => {
        const publication = await publishOwnerSiteConfiguration({
          actor: {
            userId: access.user.id,
            email: access.email,
          },
          input: settings,
          expectedUpdatedAt,
        });
        const isProduction = deploymentEnvironment() === 'production';
        return {
          content: [{
            type: 'text',
            text: publication.receipt.refreshComplete
              ? (isProduction
                  ? 'Public site configuration was published live to CardForge.'
                  : 'Public site configuration was published to this non-production CardForge environment only.')
              : publication.receipt.message,
          }],
          structuredContent: {
            environment: deploymentEnvironment(),
            livePublication: isProduction,
            settings: publication.settings,
            updatedAt: publication.updatedAt,
            receipt: publication.receipt,
          },
        };
      },
    }),
  );

  server.registerTool(
    'get_owner_provider_readiness',
    {
      title: 'Read CardForge provider and operational readiness',
      description: 'Inspect CardForge’s current provider configuration/readiness projection without exposing credentials or changing provider state. Use to distinguish CardForge-owned workflow issues from provider-owned configuration facts.',
      outputSchema: ownerProviderReadinessOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async () => runObserved({
      toolName: 'get_owner_provider_readiness',
      input: {},
      execute: async () => {
        const status = getOwnerIntegrationStatus();
        return {
          content: [{
            type: 'text',
            text: 'Loaded CardForge provider readiness. This is an operational projection; native providers remain authoritative for their own state.',
          }],
          structuredContent: {
            site: status.site,
            authConfigured: status.authConfigured,
            canonicalOwnerConfigured: status.canonicalOwnerConfigured,
            billing: status.billing,
            supabase: status.supabase,
            analytics: status.analytics,
            email: status.email,
            services: status.connectedServices.map((service) => ({
              id: service.id,
              name: service.name,
              category: service.category,
              status: service.status,
              statusLabel: service.statusLabel,
              purpose: service.purpose,
              ownership: service.ownership,
              removalImpact: service.removalImpact,
            })),
          },
        };
      },
    }),
  );

  server.registerTool(
    'get_owner_activity',
    {
      title: 'Read recent CardForge Owner activity',
      description: 'Read recent accountable Owner operations such as site publication, governance, or people/service changes. This never changes Owner state.',
      inputSchema: ownerActivityInputSchema,
      outputSchema: ownerActivityOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ limit }) => runObserved({
      toolName: 'get_owner_activity',
      input: { limit: limit ?? 10 },
      execute: async () => {
        const requestedLimit = limit ?? 10;
        const activity = await getOwnerActivity({ page: 1, pageSize: Math.min(20, Math.max(5, requestedLimit)) });
        const events = activity.items.slice(0, requestedLimit).map((event) => ({
          id: event.id,
          actorLabel: event.actorLabel,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          summary: event.summary,
          outcome: event.outcome,
          createdAt: event.createdAt,
        }));
        return {
          content: [{
            type: 'text',
            text: events.length
              ? 'Loaded ' + events.length + ' recent CardForge Owner activity event' + (events.length === 1 ? '' : 's') + '.'
              : 'No recent CardForge Owner activity events were found.',
          }],
          structuredContent: {
            count: events.length,
            events,
          },
        };
      },
    }),
  );
};