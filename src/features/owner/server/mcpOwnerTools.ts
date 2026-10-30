import { getWebsiteReleaseRecords } from '@/features/roadmap/server';
import { createMcpHandler } from 'mcp-handler';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { WEBSITE_DRAFT_MEDIA_BUCKET } from '@/features/public-site/server/websiteEditionStore';
import { readLiveWebsiteRevision, listWebsiteEditions, listWebsiteRevisions, readWebsiteRevision, readWebsiteRevisionIdentity, createWebsiteEdition, saveWebsiteRevision, readSavedWebsiteOperation, activateWebsiteRevision } from '@/features/public-site/server/websiteEditionStore';
import { resolveOwnerAccess } from '@/domain/entitlements';

import { getOwnerAnalyticsSnapshot } from '@/features/analytics/server';
import { observeMcpToolExecution, getOwnerMcpUsageDashboard } from '@/features/mcp-usage/server';
import { getOwnerActivity } from '@/features/owner/server/ownerActivityStore';
import { getOwnerIntegrationStatus } from '@/features/owner/server/ownerIntegrationStatus';
import { getOwnerSiteControlPayload, getOwnerOperationsOverviewPayload } from '@/features/owner/lib/ownerOperationsStore';
import { publishOwnerSiteContentBlock, publishOwnerSiteConfigurationField, publishOwnerSiteConfigurationPatch, publishOwnerSitePage, publishOwnerBusinessIdentity, publishOwnerFounderProfile, publishOwnerExperienceSettings, publishOwnerLegalDocument, publishOwnerRoadmapSettings, publishOwnerRoadmapStatus, publishOwnerWebsiteRelease } from '@/features/owner/server/ownerSiteCommands';
import { getPublicSiteConfiguration, getFounderProfile, getSiteMedia, getSiteContentBlocks, createSiteContentMap, completeSiteMediaForSections, PublicSiteConfigurationStoreError, SiteMediaStoreError, type PublicSiteConfiguration } from '@/features/public-site/server';
import {
  createLegacyHomepageShowcaseStages,
  HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS,
  HOMEPAGE_COMPOSER_MEDIA_SLOTS,
  validateHomepageShowcaseStagesInput,
  parseHomepageCustomSection,
  isHomepageCustomSection,
  type HomepageLayoutSection,
  getSiteCompositionSections,
} from '@/features/public-site/server';
import { publishOwnerSiteMedia, restoreOwnerSiteMedia, stageOwnerWebsiteEditionMedia } from './ownerMediaCommands';
import { getLegalDocuments } from '@/features/legal/server';
import { getRoadmapSettings, getRoadmapAdminItems } from '@/features/roadmap/server';
import { getBusinessIdentity } from '@/features/business-identity/server';
import { getExperienceSettings } from '@/features/experience-settings/server';
import type { McpOwnerAccess } from './mcpOwnerAccess';
import {
  ownerEditionOperationInputSchema, ownerEditionListInputSchema, ownerEditionCreateInputSchema, ownerEditionSaveInputSchema, ownerEditionPreviewInputSchema, ownerEditionActivateInputSchema, ownerEditionStageMediaInputSchema, ownerEditionResultOutputSchema,
  ownerOperationalReadOutputSchema,
  ownerActivityInputSchema,
  ownerActivityOutputSchema,
  ownerSiteCopyPublicationOutputSchema,
  ownerSiteCopyPublishInputSchema,
  ownerProviderReadinessOutputSchema,
  ownerSiteSnapshotOutputSchema,
  ownerSiteFieldsOutputSchema,
  ownerSiteFieldPublishInputSchema,
  ownerSiteFieldPublicationOutputSchema,
  ownerSiteConfigurationOutputSchema,
  ownerHomepageShowcaseReadOutputSchema,
  ownerHomepageShowcasePublishInputSchema,
  ownerHomepageShowcasePublicationOutputSchema,
  ownerHomepageDesignReadOutputSchema,
  ownerHomepageSectionPublishInputSchema,
  ownerHomepageBlockPublishInputSchema,
  ownerHomepageDesignPublicationOutputSchema,
  ownerSiteConfigurationPublishInputSchema,
  ownerSiteConfigurationPublicationOutputSchema,
  ownerSitePagePublishInputSchema,
  ownerPresentationReadInputSchema,
  ownerPresentationReadOutputSchema,
  ownerPresentationPublishInputSchema,
  ownerPresentationPublicationOutputSchema,
  ownerSiteMediaReadOutputSchema,
  ownerSiteMediaPublishInputSchema,
  ownerSiteMediaRestoreInputSchema,
  ownerSiteMediaPublicationOutputSchema,
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

const projectOwnerSiteFields = (settings: PublicSiteConfiguration) => ({
  updatedAt: settings.updatedAt ?? null,
  primaryCtaLabel: settings.primaryCtaLabel,
  primaryCtaHref: settings.primaryCtaHref,
  announcementEnabled: settings.announcementEnabled,
  announcementMessage: settings.announcementMessage,
  navigation: settings.primaryNavigation.map(({ id, label, href, visible }) => ({ id, label, href, visible })),
});

const legacyWebsiteReads = new Set([
  'get_owner_site_snapshot', 'get_owner_site_fields', 'get_owner_site_configuration',
  'get_owner_homepage_showcase', 'get_owner_homepage_design', 'get_owner_site_media',
]);
const legacyWebsiteWrites = new Set([
  'publish_owner_site_copy', 'publish_owner_site_field', 'publish_owner_site_configuration',
  'publish_owner_site_page', 'publish_owner_homepage_showcase',
  'publish_owner_homepage_section', 'publish_owner_homepage_block',
  'publish_owner_site_media', 'restore_owner_site_media',
]);

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
      // The flat store is no longer writable once a live edition is adopted.
      // Gate before legacy handlers perform image uploads or any other side effect.
      if (legacyWebsiteWrites.has(toolName) || legacyWebsiteReads.has(toolName)) {
        const live = await readLiveWebsiteRevision();
        if (live.revisionId) {
          throw new SiteMediaStoreError(legacyWebsiteReads.has(toolName)
            ? 'Website Editions is authoritative. This legacy flat-site read cannot report current published content after adoption. Use owner_website_editions for live revision/generation and owner_website_revision for its exact manifest.'
            : 'Website Editions is authoritative. This legacy publisher cannot mutate the adopted site. Read owner_website_editions, then use owner_website_save_revision for a draft; only owner_website_activate_revision publishes explicitly.', 409);
        }
      }
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
      execute: async (access) => {
        const site = await getOwnerSiteControlPayload();
        const ownerAuthority = resolveOwnerAccess({
          authConfigured: true,
          isSignedIn: true,
          emailAddresses: access.user.emailAddresses,
          privateMetadata: access.user.privateMetadata,
        }).source;
        return {
          content: [{
            type: 'text',
            text: 'Loaded the canonical CardForge Owner site snapshot for ' + deploymentEnvironment()
              + '. Authenticated CardForge account: ' + (access.email ?? 'no primary email')
              + ' (' + access.user.id + '). Owner authority: ' + ownerAuthority
              + '. No live state was changed.',
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
            siteContentBlock: {
              slug: publication.siteContentBlock.slug,
              group: publication.siteContentBlock.group,
              section: publication.siteContentBlock.section,
              label: publication.siteContentBlock.label,
              body: publication.siteContentBlock.body,
              updatedAt: publication.siteContentBlock.updatedAt,
            },
            receipt: publication.receipt,
          },
        };
      },
    }),
  );

  server.registerTool(
    'get_owner_site_fields',
    {
      title: 'Read current Owner-editable site labels and announcement',
      description: 'Read the canonical CTA label, navigation labels and announcement text with their exact shared settings revision. Link destinations, visibility and announcement enabled state are included as context; publish_owner_site_field changes text only. A null revision cannot be published: configure the existing site settings first.',
      outputSchema: ownerSiteFieldsOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async () => runObserved({
      toolName: 'get_owner_site_fields', input: {},
      execute: async () => ({
        content: [{ type: 'text', text: 'Loaded current Owner site fields for ' + deploymentEnvironment() + '. Read the exact updatedAt before publishing one field.' }],
        structuredContent: { environment: deploymentEnvironment(), settings: projectOwnerSiteFields(await getPublicSiteConfiguration()) },
      }),
    }),
  );

  server.registerTool(
    'publish_owner_site_field',
    {
      title: 'Publish one Owner site label or announcement',
      description: 'Publish one CTA label, exact navigation-item label or announcement text through the same command as on-page Owner editing. Requires settings.updatedAt from get_owner_site_fields. Preserves destinations, visibility and all other settings. In Production this publishes live immediately; Preview changes staging only. Never repeat a committed receipt, even when cache refresh is incomplete. On conflict, reload and review newer settings before another publication.',
      inputSchema: ownerSiteFieldPublishInputSchema,
      outputSchema: ownerSiteFieldPublicationOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async (input) => runObserved({
      toolName: 'publish_owner_site_field', input,
      execute: async (access) => {
        const publication = await publishOwnerSiteConfigurationField({ actor: { userId: access.user.id, email: access.email }, input });
        const isProduction = deploymentEnvironment() === 'production';
        return {
          content: [{ type: 'text', text: publication.receipt.refreshComplete
            ? input.field + (isProduction ? ' was published live to CardForge.' : ' was published to this non-production CardForge environment only.')
            : publication.receipt.message }],
          structuredContent: { environment: deploymentEnvironment(), livePublication: isProduction,
            settings: projectOwnerSiteFields(publication.settings), receipt: publication.receipt },
        };
      },
    }),
  );

  server.registerTool('get_owner_site_configuration', {
    title: 'Read complete Owner public-site settings',
    description: 'Read the same navigation, destinations, visibility, SEO, homepage sections, exact-revision demonstrations and watermark presentation used by browser Site settings. Preserve the exact updatedAt before publishing. Provider prices and code capabilities are not editable settings.',
    outputSchema: ownerSiteConfigurationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async () => runObserved({ toolName: 'get_owner_site_configuration', input: {}, execute: async () => ({
    content: [{ type: 'text', text: 'Loaded complete canonical public-site settings. No presentation changed.' }],
    structuredContent: { environment: deploymentEnvironment(), settings: await getPublicSiteConfiguration() },
  }) }));

  server.registerTool('publish_owner_site_configuration', {
    title: 'Publish Owner public-site settings',
    description: 'Publish only the requested presentation changes through the browser Site settings command. Read get_owner_site_configuration first and supply its exact updatedAt. Arrays replace their complete collection. Preview changes staging only. Conflict rejects the entire change; read and review newer state. A committed receipt must never be replayed, even if refresh is incomplete.',
    inputSchema: ownerSiteConfigurationPublishInputSchema,
    outputSchema: ownerSiteConfigurationPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ patch, expectedUpdatedAt }) => runObserved({
    toolName: 'publish_owner_site_configuration', input: { patch, expectedUpdatedAt },
    execute: async (access) => {
      const publication = await publishOwnerSiteConfigurationPatch({ actor: { userId: access.user.id, email: access.email }, patch, expectedUpdatedAt });
      const isProduction = deploymentEnvironment() === 'production';
      return { content: [{ type: 'text', text: publication.receipt.refreshComplete
        ? 'Public site settings published to ' + (isProduction ? 'live Production.' : 'this non-production environment only.') : publication.receipt.message }],
        structuredContent: { environment: deploymentEnvironment(), livePublication: isProduction, ...publication } };
    },
  }));

  server.registerTool('publish_owner_site_page', {
    title: 'Save or remove one first-party website page',
    description: 'Read get_owner_site_configuration first. Save one page with stable pageId, safe unreserved path, SEO and trusted sections, or remove that page and its navigation entry. Preserves all other pages, homepage and provider-owned facts. Unpublished pages remain Owner-only; public media requires its own explicit publication. Uses the same canonical revision and receipt as browser Site settings. Never replay a committed result.',
    inputSchema: ownerSitePagePublishInputSchema,
    outputSchema: ownerSiteConfigurationPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ pageId, page, operation, expectedUpdatedAt }) => runObserved({
    toolName: 'publish_owner_site_page', input: { pageId, page, operation, expectedUpdatedAt },
    execute: async (access) => {
      if (operation === 'save' && !page) throw new PublicSiteConfigurationStoreError('Supply the complete selected page to save it.', 400);
      const publication = await publishOwnerSitePage({ actor: { userId: access.user.id, email: access.email },
        pageId, page: operation === 'remove' ? null : page!, expectedUpdatedAt });
      return { content: [{ type: 'text', text: publication.receipt.message + (deploymentEnvironment() === 'production' ? ' Live Production.' : ' Non-production staging only.') }],
        structuredContent: { environment: deploymentEnvironment(), livePublication: deploymentEnvironment() === 'production', ...publication } };
    },
  }));

  server.registerTool('get_owner_homepage_showcase', {
    title: 'Read the Owner homepage walkthrough and managed screenshot availability',
    description: 'Read the exact Owner settings revision and ordered walkthrough stages. legacyCopy means the existing stage labels still come from published site-copy blocks. Use the focused publish tool to avoid resending unrelated demonstration Sets.',
    outputSchema: ownerHomepageShowcaseReadOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => runObserved({ toolName: 'get_owner_homepage_showcase', input: {}, execute: async () => {
    const settings = await getPublicSiteConfiguration();
    const showcase = settings.homepageSections.find((section) => section.id === 'showcase');
    const ownedStages = showcase && 'showcaseStages' in showcase ? showcase.showcaseStages : undefined;
    const media = await getSiteMedia();
    return { content: [{ type: 'text', text: 'Read Owner homepage walkthrough and screenshot slot availability.' }],
      structuredContent: {
        environment: deploymentEnvironment(), settingsRevision: settings.updatedAt ?? null,
        legacyCopy: !ownedStages,
        stages: ownedStages ?? createLegacyHomepageShowcaseStages(createSiteContentMap(await getSiteContentBlocks())),
        media: HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS.map((slot) => {
          const asset = media.find((candidate) => candidate.slot === slot);
          return { slot, label: asset?.label ?? slot, alt: asset?.alt ?? '',
            source: asset?.storagePath ? 'owner-upload' : asset?.defaultSrc ? 'bundled-fallback' : 'unavailable' };
        }),
      } };
  } }));

  server.registerTool('publish_owner_homepage_showcase', {
    title: 'Save only the Owner homepage walkthrough stages',
    description: 'Reorder, rename, describe or select existing screenshot/finished-Set stages. Preserves demonstration data, section order and all other site settings. Uses the same canonical revision-safe browser command. Preview changes staging only. Never replay a committed receipt.',
    inputSchema: ownerHomepageShowcasePublishInputSchema,
    outputSchema: ownerHomepageShowcasePublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ stages, expectedUpdatedAt }) => runObserved({
    toolName: 'publish_owner_homepage_showcase', input: { stages, expectedUpdatedAt },
    execute: async (access) => {
      let validatedStages;
      try {
        validatedStages = validateHomepageShowcaseStagesInput(stages);
      } catch (error) {
        throw new PublicSiteConfigurationStoreError(error instanceof Error ? error.message : 'Homepage walkthrough stages are invalid.', 400);
      }
      const current = await getPublicSiteConfiguration();
      const homepageSections = current.homepageSections.map((section) => (
        section.id === 'showcase' ? { ...section, showcaseStages: validatedStages } : section
      ));
      const publication = await publishOwnerSiteConfigurationPatch({
        actor: { userId: access.user.id, email: access.email },
        patch: { homepageSections }, expectedUpdatedAt,
      });
      const savedSection = publication.settings.homepageSections.find((section) => section.id === 'showcase');
      const saved = savedSection && 'showcaseStages' in savedSection ? savedSection.showcaseStages : undefined;
      const isProduction = deploymentEnvironment() === 'production';
      return { content: [{ type: 'text', text: publication.receipt.message + (isProduction ? ' Live Production.' : ' Staging only.') }],
        structuredContent: {
          environment: deploymentEnvironment(), livePublication: isProduction,
          updatedAt: publication.settings.updatedAt ?? null,
          stages: saved ?? validatedStages, receipt: publication.receipt,
        } };
    },
  }));

  server.registerTool('get_owner_homepage_design', {
    title: 'Read the page-first, editable homepage design and its canonical revision',
    description: 'Read current ordered homepage sections, reusable blocks, layout tokens and allowed media slots. All values are the same as browser Owner editing. No private artwork or storage paths. This is not an independent CMS.',
    outputSchema: ownerHomepageDesignReadOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => runObserved({ toolName: 'get_owner_homepage_design', input: {}, execute: async () => {
    const settings = await getPublicSiteConfiguration();
    return {
      content: [{ type: 'text', text: 'Loaded the current Owner-editable homepage structure.' }],
      structuredContent: {
        environment: deploymentEnvironment(), settingsRevision: settings.updatedAt ?? null,
        sections: settings.homepageSections,
        imageSlots: HOMEPAGE_COMPOSER_MEDIA_SLOTS,
      },
    };
  } }));

  const publishDesign = async (access: McpOwnerAccess, sections: HomepageLayoutSection[], expectedUpdatedAt: string) => {
    const publication = await publishOwnerSiteConfigurationPatch({
      actor: { userId: access.user.id, email: access.email }, patch: { homepageSections: sections }, expectedUpdatedAt,
    });
    return { content: [{ type: 'text' as const, text: publication.receipt.message + ' This is '
      + (deploymentEnvironment() === 'production' ? 'live Production.' : 'non-production staging only.') }],
      structuredContent: {
        environment: deploymentEnvironment(), livePublication: deploymentEnvironment() === 'production',
        updatedAt: publication.settings.updatedAt ?? null,
        sections: publication.settings.homepageSections, receipt: publication.receipt,
      } };
  };

  server.registerTool('publish_owner_homepage_section', {
    title: 'Add, replace, remove or move one editable homepage section',
    description: 'Publish a focused Owner section edit. Use insert for a new validated custom section, replace to edit its responsive layout or blocks, remove to delete only a custom section, or move to reorder any existing section. Current homepage data, pinned demonstration Sets, unaffected sections and all other site settings are preserved. Exact revision required; on conflict read again. Preview changes staging only.',
    inputSchema: ownerHomepageSectionPublishInputSchema,
    outputSchema: ownerHomepageDesignPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ operation, sectionId, section, direction, expectedUpdatedAt }) => runObserved({
    toolName: 'publish_owner_homepage_section', input: { operation, sectionId, section, direction, expectedUpdatedAt },
    execute: async (access) => {
      const current = await getPublicSiteConfiguration();
      const before = current.homepageSections;
      const index = before.findIndex((candidate) => candidate.id === sectionId);
      const next = [...before];
      if (operation === 'insert') {
        const valid = parseHomepageCustomSection(section);
        if (!valid || valid.id !== sectionId) throw new PublicSiteConfigurationStoreError('Choose a fully validated custom section with the requested identity.', 400);
        if (index !== -1) throw new PublicSiteConfigurationStoreError('This homepage section already exists. Reload the current design before inserting it.', 409);
        const finalIndex = next.findIndex((candidate) => candidate.id === 'final_cta');
        next.splice(finalIndex < 0 ? next.length : finalIndex, 0, valid);
      } else if (operation === 'replace') {
        const valid = parseHomepageCustomSection(section);
        if (index < 0) throw new PublicSiteConfigurationStoreError('The selected homepage section no longer exists.', 404);
        if (!isHomepageCustomSection(next[index]!) || !valid || valid.id !== sectionId) {
          throw new PublicSiteConfigurationStoreError('Only an existing custom section can be replaced by a validated design.', 400);
        }
        next[index] = valid;
      } else if (operation === 'remove') {
        if (index < 0) throw new PublicSiteConfigurationStoreError('The selected homepage section no longer exists.', 404);
        if (!isHomepageCustomSection(next[index]!)) {
          throw new PublicSiteConfigurationStoreError('Only a custom homepage section may be removed.', 400);
        }
        next.splice(index, 1);
      } else if (operation === 'move') {
        const target = index + (direction === 'up' ? -1 : direction === 'down' ? 1 : Number.NaN);
        if (index < 0) throw new PublicSiteConfigurationStoreError('The selected homepage section no longer exists.', 404);
        if (!Number.isInteger(target) || target < 0 || target >= next.length) {
          throw new PublicSiteConfigurationStoreError('Choose a valid movement direction within the homepage.', 400);
        }
        [next[index], next[target]] = [next[target]!, next[index]!];
      }
      return publishDesign(access, next, expectedUpdatedAt);
    },
  }));

  server.registerTool('publish_owner_homepage_block', {
    title: 'Edit one selected homepage design block directly',
    description: 'Replace one existing heading, paragraph, feature, image reference or button within one custom homepage section. Validates the entire section and preserves every sibling block and other Owner settings. Carries the exact settings revision from get_owner_homepage_design. No arbitrary HTML, JavaScript, remote images or external URLs.',
    inputSchema: ownerHomepageBlockPublishInputSchema,
    outputSchema: ownerHomepageDesignPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ sectionId, blockId, block, expectedUpdatedAt }) => runObserved({
    toolName: 'publish_owner_homepage_block', input: { sectionId, blockId, block, expectedUpdatedAt },
    execute: async (access) => {
      const current = await getPublicSiteConfiguration();
      const sections = [...current.homepageSections];
      const index = sections.findIndex((section) => section.id === sectionId);
      const selected = sections[index];
      if (index < 0 || !selected) throw new PublicSiteConfigurationStoreError('The selected homepage section no longer exists.', 404);
      if (!isHomepageCustomSection(selected)) throw new PublicSiteConfigurationStoreError('Choose an editable custom homepage section.', 400);
      const blockIndex = selected.blocks.findIndex((candidate) => candidate.id === blockId);
      if (blockIndex < 0) throw new PublicSiteConfigurationStoreError('The selected homepage block no longer exists.', 404);
      if (block.id !== blockId) throw new PublicSiteConfigurationStoreError('Choose one existing block without changing its identity.', 400);
      const edited = parseHomepageCustomSection({
        ...selected,
        blocks: selected.blocks.map((candidate) => candidate.id === blockId ? block : candidate),
      });
      if (!edited) throw new PublicSiteConfigurationStoreError('Unsupported website block. Use validated content, managed media and internal links.', 400);
      sections[index] = edited;
      return publishDesign(access, sections, expectedUpdatedAt);
    },
  }));

  server.registerTool('get_owner_presentation_editor', {
    title: 'Read Owner presentation, roadmap or legal editor',
    description: 'Read complete canonical editor values and their current revision. Identity uses identityVersion. Founder, Experience and roadmap use updatedAt. Legal publication requires both current identityVersion and the selected document version; zero represents a never-published default. Roadmap and websiteReleases collections return items; legal collections return documents. Website release metadata is read-only: use values version, typed notes, sourceSha, candidateSha, operationId and publish, with expectedUpdatedAt separately. Use a fresh stable operation UUID for a new edit and retain it on uncertain retry; do not copy id/shippedAt/mutationKind as editable values. Omit revision properties from editable values when publishing. These are the same feature owners as the website; unavailable state is an error, not an empty/default editor.',
    inputSchema: ownerPresentationReadInputSchema, outputSchema: ownerPresentationReadOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ area }) => runObserved({ toolName: 'get_owner_presentation_editor', input: { area }, execute: async () => {
    const value = area === 'identity' ? await getBusinessIdentity() : area === 'founder' ? await getFounderProfile()
      : area === 'experience' ? await getExperienceSettings() : area === 'roadmapSettings' ? await getRoadmapSettings()
        : area === 'websiteReleases' ? { items: await getWebsiteReleaseRecords(), currentDeploymentSha:process.env.VERCEL_GIT_COMMIT_SHA??null } : area === 'roadmapItems' ? { items: await getRoadmapAdminItems() } : { documents: await getLegalDocuments() };
    return { content: [{ type: 'text', text: 'Loaded current ' + area + ' editor; no publication performed.' }],
      structuredContent: { environment: deploymentEnvironment(), area, value } };
  } }));

  server.registerTool('publish_owner_presentation', {
    title: 'Publish Owner presentation, roadmap or legal changes',
    description: 'Publish complete edited values through the same command as the website. Read get_owner_presentation_editor first; preserve its exact identityVersion or updatedAt. Legal publications append immutable history and require expectedDocumentVersion plus expectedIdentityVersion. Roadmap status values require itemId and status; preserve the exact item revision. websiteRelease working saves use sourceSha:null and publish:false. First Production publication requires publish:true with the current deployment SHA and exact previously saved notes/candidate packet. Narrative corrections preserve published facts. Preview advance uses advanceFrom for the exact preceding release and a greater version; native Production readback and notes/CAS checks apply. Changing legal identity can affect legal-document consistency. Review proposed changes before publication. Preview affects staging only. Conflicts require reload/review; committed receipts must never be replayed even when refresh/history is incomplete.',
    inputSchema: ownerPresentationPublishInputSchema, outputSchema: ownerPresentationPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async ({ area, values, expectedIdentityVersion, expectedUpdatedAt, expectedDocumentVersion }) => runObserved({
    toolName: 'publish_owner_presentation', input: { area, values, expectedIdentityVersion, expectedUpdatedAt, expectedDocumentVersion },
    execute: async (access) => {
      const actor = { userId: access.user.id, email: access.email };
      const publication = area === 'identity'
        ? await publishOwnerBusinessIdentity({ actor, input: values, expectedIdentityVersion: expectedIdentityVersion! })
        : area === 'founder'
          ? await publishOwnerFounderProfile({ actor, input: values, expectedUpdatedAt: expectedUpdatedAt! })
          : area === 'experience' ? await publishOwnerExperienceSettings({ actor, input: { ...values, updatedAt: expectedUpdatedAt } })
            : area === 'roadmapSettings' ? await publishOwnerRoadmapSettings({ actor, input: { ...values, updatedAt: expectedUpdatedAt } })
              : area === 'websiteRelease' ? await publishOwnerWebsiteRelease({actor,input:{...values,expectedUpdatedAt}}) : area === 'roadmapStatus' ? await publishOwnerRoadmapStatus({ actor, input: { ...values, expectedUpdatedAt } })
                : await publishOwnerLegalDocument({ actor, input: { ...values, expectedBusinessIdentityVersion: expectedIdentityVersion, expectedVersion: expectedDocumentVersion } });
      return { content: [{ type: 'text', text: publication.receipt.message + ' Environment: ' + deploymentEnvironment() + '.' }],
        structuredContent: { environment: deploymentEnvironment(), livePublication: deploymentEnvironment() === 'production' && (area!=='websiteRelease'||['release-published','narrative-corrected'].includes((publication.value as {mutationKind?:string}).mutationKind??'')), area, ...publication } };
    },
  }));

  const operationalReads = [
    { name: 'get_owner_workspace_health', area: 'overview', title: 'Read Owner workspace health',
      description: 'Read the same configured-state, identity, official roadmap and database metrics as the Owner overview. A null databaseMetrics means unavailable or unconfigured; it never means zero usage.', read: getOwnerOperationsOverviewPayload },
    { name: 'get_owner_analytics', area: 'analytics', title: 'Read Owner analytics',
      description: 'Read the browser Owner analytics summary from native reporting providers, including configuration and warnings. Respect warnings and missing measurements; they are not proof of zero traffic.', read: getOwnerAnalyticsSnapshot },
    { name: 'get_owner_mcp_usage', area: 'mcpUsage', title: 'Read Owner MCP usage and current beta targets',
      description: 'Read the same aggregate usage and allowance targets as browser Owner controls. observationOnly means beta capacity observation, not enforced quotas or overage billing. This operation does not change limits or Stripe prices.', read: getOwnerMcpUsageDashboard },
  ] as const;
  for (const tool of operationalReads) server.registerTool(tool.name, {
    title: tool.title, description: tool.description, outputSchema: ownerOperationalReadOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async () => runObserved({ toolName: tool.name, input: {}, execute: async () => ({
    content: [{ type: 'text', text: `Loaded Owner ${tool.area} for ${deploymentEnvironment()}. Provider configuration and warnings remain authoritative.` }],
    structuredContent: { environment: deploymentEnvironment(), area: tool.area, value: await tool.read() },
  }) }));

  server.registerTool('get_owner_site_media', {
    title: 'Read Owner public images and presentation',
    description: 'Read canonical media slots, accessibility text, responsive framing/focal/zoom settings, current revision and previous-version availability. The browser and MCP share this state. Do not pass storage paths to publication.',
    outputSchema: ownerSiteMediaReadOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async () => runObserved({ toolName: 'get_owner_site_media', input: {}, execute: async () => ({
    content: [{ type: 'text', text: 'Loaded current public images and their revisions.' }],
    structuredContent: { environment: deploymentEnvironment(),
      media: completeSiteMediaForSections(await getSiteMedia(), getSiteCompositionSections(await getPublicSiteConfiguration())) },
  }) }));
  server.registerTool('publish_owner_site_media', {
    title: 'Publish an Owner public image or its presentation',
    description: 'Read get_owner_site_media, review the proposed image/alt/presentation changes, and supply the exact current revision. Omit image to change only presentation/accessibility text. Original image bytes use the browser image validation/transcoding/storage command and native hourly rate limit. Preview changes staging only. Conflict rejects the write and removes any uncommitted upload. Committed receipts must never be replayed.',
    inputSchema: ownerSiteMediaPublishInputSchema, outputSchema: ownerSiteMediaPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async (input) => runObserved({ toolName: 'publish_owner_site_media', input, execute: async (access) => {
    let image: File | undefined;
    if (input.image) {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.image.base64)) {
        throw new SiteMediaStoreError('Image bytes must be valid raw base64.', 400);
      }
      image = new File([new Uint8Array(Buffer.from(input.image.base64, 'base64'))], input.image.name, { type: input.image.mimeType });
    }
    const publication = await publishOwnerSiteMedia({ actor: { userId: access.user.id, email: access.email },
      slot: input.slot, alt: input.alt, presentation: input.presentation, expectedUpdatedAt: input.expectedUpdatedAt, image });
    return { content: [{ type: 'text', text: publication.receipt.message + ' Environment: ' + deploymentEnvironment() + '.' }],
      structuredContent: { environment: deploymentEnvironment(), livePublication: deploymentEnvironment() === 'production', media: publication.value, receipt: publication.receipt } };
  } }));
  server.registerTool('restore_owner_site_media', {
    title: 'Restore the previous Owner public image version',
    description: 'Restore swaps the current and previous media versions through the browser command. Read get_owner_site_media first, verify a previousVersion exists, and supply the exact current updatedAt. This is a publication. Never repeat a committed restore, even if refresh/history is unavailable; read back current state. A stale retry cannot toggle the image again.',
    inputSchema: ownerSiteMediaRestoreInputSchema, outputSchema: ownerSiteMediaPublicationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, async (input) => runObserved({ toolName: 'restore_owner_site_media', input, execute: async (access) => {
    const publication = await restoreOwnerSiteMedia({ actor: { userId: access.user.id, email: access.email }, ...input });
    return { content: [{ type: 'text', text: publication.receipt.message + ' Do not repeat Restore; verify current state.' }],
      structuredContent: { environment: deploymentEnvironment(), livePublication: deploymentEnvironment() === 'production', media: publication.value, receipt: publication.receipt } };
  } }));


  // All commands reuse the browser's revision store and the existing MCP Owner access.
  // SAVE never changes the activation pointer. ACTIVATE is a separate explicit operation.
  server.registerTool('owner_website_editions', {
    title: 'Read authoritative website editions',
    description: 'Read current live revision/generation and named editions; optionally include revision history for an exact edition. No flat-store publication state is authoritative after adoption.',
    inputSchema: ownerEditionListInputSchema, outputSchema: ownerEditionResultOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ editionId }) => runObserved({ toolName: 'owner_website_editions', input: {editionId},
    execute: async () => {
      const [live, editions, revisions] = await Promise.all([
        readLiveWebsiteRevision(), listWebsiteEditions(),
        editionId ? listWebsiteRevisions(editionId) : Promise.resolve([]),
      ]);
      return { content:[{type:'text' as const,text:'Read authoritative website edition state; no mutation.'}],
        structuredContent:{ environment:deploymentEnvironment(),action:'read',live,editions,revisions } };
    },
  }));
  server.registerTool('owner_website_create_edition', {
    title:'Create an unpublished named website edition',
    description:'Create only an edition identity. No revision is saved and no live activation occurs. On uncertain response read owner_website_editions before retrying.',
    inputSchema:ownerEditionCreateInputSchema,outputSchema:ownerEditionResultOutputSchema,
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},
  }, async ({name}) => runObserved({toolName:'owner_website_create_edition',input:{name},
    execute:async () => {
      const editionId=await createWebsiteEdition(name);
      return {content:[{type:'text' as const,text:'Unpublished edition created; website remains unchanged.'}],
        structuredContent:{environment:deploymentEnvironment(),action:'create',editionId,name} };
    },
  }));
  server.registerTool('owner_website_revision', {
    title:'Read a saved edition revision for private review',
    description:'Read exact immutable manifest and edition identity, without changing the active website. This does not issue a browser preview cookie.',
    inputSchema:ownerEditionPreviewInputSchema,outputSchema:ownerEditionResultOutputSchema,
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  }, async ({revisionId}) => runObserved({toolName:'owner_website_revision',input:{revisionId},
    execute:async () => {
      const [manifest,identity]=await Promise.all([readWebsiteRevision(revisionId),readWebsiteRevisionIdentity(revisionId)]);
      return {content:[{type:'text' as const,text:'Read immutable edition revision; not activated.'}],
        structuredContent:{environment:deploymentEnvironment(),action:'preview-read',revisionId,identity,manifest} };
    },
  }));
  server.registerTool('owner_website_save_operation_status', {
    title: 'Read exact saved website operation outcome',
    description: 'Read the existing immutable Save operation ID ledger through the authoritative revision store. A null revisionId means no retained committed result was observed; it does not authorize blind replay of an uncertain write.',
    inputSchema: ownerEditionOperationInputSchema, outputSchema: ownerEditionResultOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ operationId }) => runObserved({ toolName: 'owner_website_save_operation_status', input: { operationId },
    execute: async () => {
      const revisionId = await readSavedWebsiteOperation(operationId);
      const identity = revisionId ? await readWebsiteRevisionIdentity(revisionId) : null;
      return {
        content: [{ type: 'text' as const, text: revisionId
          ? 'Saved operation found; exact immutable revision returned.'
          : 'No saved operation found. An uncertain write must be reconciled before any retry.' }],
        structuredContent: { environment: deploymentEnvironment(), action: 'save-operation-readback',
          operationId, revisionId, identity },
      };
    },
  }));
  server.registerTool('owner_website_save_revision', {
    title:'Save a draft website revision (does not publish)',
    description:'Save an entire validated manifest under selected editionId, exact expectedRevisionId (null only for the first revision), and unique stable operationId. Never infer activation from Save. On uncertain outcome read the operation ID before retrying.',
    inputSchema:ownerEditionSaveInputSchema,outputSchema:ownerEditionResultOutputSchema,
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},
  }, async ({editionId,expectedRevisionId,operationId,manifest}) => runObserved({
    toolName:'owner_website_save_revision',input:{editionId,expectedRevisionId,operationId,manifest},
    execute:async (access) => {
      const revisionId=await saveWebsiteRevision({editionId,expectedRevisionId,operationId,manifest,actor:access.user.id});
      return {content:[{type:'text' as const,text:'Draft revision saved. No website activation occurred.'}],
        structuredContent:{environment:deploymentEnvironment(),action:'save-draft',editionId,revisionId,operationId,published:false} };
    },
  }));

  server.registerTool('owner_website_stage_media', {
    title:'Stage private image bytes for a selected unpublished website edition',
    description:'Owner-only private PNG/WebP stage. Requires selected editionId and exact expectedRevisionId; returns an uncommitted media reference and SHA256 for the manifest. Stage does NOT Save or Activate. On uncertain upload outcome do not replay or delete unknown bytes; read back and reconcile the identity first.',
    inputSchema:ownerEditionStageMediaInputSchema,outputSchema:ownerEditionResultOutputSchema,
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},
  }, async (input)=>runObserved({toolName:'owner_website_stage_media',input:{...input,image:input.image?{name:input.image.name,mimeType:input.image.mimeType,bytes:'provided'}:undefined},
    execute:async(access)=>{
      const editions=await listWebsiteEditions();
      if(!editions.some(edition=>edition.id===input.editionId&&!edition.archivedAt)) {
        throw new SiteMediaStoreError('Selected website edition is unavailable.',404);
      }
      const revisions=await listWebsiteRevisions(input.editionId);
      if((revisions[0]?.id??null)!==input.expectedRevisionId) {
        throw new SiteMediaStoreError('Edition revision changed. Reload before uploading bytes.',409);
      }
      const db=getSupabaseServerClient();
      const bucket=await db?.storage.getBucket(WEBSITE_DRAFT_MEDIA_BUCKET);
      if(!bucket||bucket.error||bucket.data?.public!==false) {
        throw new SiteMediaStoreError('Protected website draft media bucket is unavailable.',503);
      }
      let image:File|null=null;
      if(input.image) {
        if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.image.base64)) {
          throw new SiteMediaStoreError('Image bytes must be valid raw base64.',400);
        }
        image=new File([new Uint8Array(Buffer.from(input.image.base64,'base64'))],
          input.image.name,{type:input.image.mimeType});
      }
      const staged=await stageOwnerWebsiteEditionMedia({
        actor:{userId:access.user.id,email:access.email},slot:input.slot,
        alt:input.alt,presentation:input.presentation,
        currentStoragePath:input.currentStoragePath,image,
      });
      return {content:[{type:'text' as const,text:'Private edition media staged; Save a revision explicitly to retain the reference. No publication occurred.'}],
       structuredContent:{environment:deploymentEnvironment(),action:'stage-private-media',editionId:input.editionId,expectedRevisionId:input.expectedRevisionId,
         media:staged.media,sha256:staged.sha256,published:false}};
    },
  }));
  server.registerTool('owner_website_activate_revision', {
    title:'Explicitly activate one saved website revision',
    description:'PUBLICATION operation. Only after explicit Owner request; requires selected revisionId, exact live expectedGeneration, stable operationId, and reviewed URL disposition. Never invoked by Save or a legacy publish name. Unknown outcome requires authoritative generation/history readback, not replay.',
    inputSchema:ownerEditionActivateInputSchema,outputSchema:ownerEditionResultOutputSchema,
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false},
  }, async ({revisionId,expectedGeneration,operationId,urlDisposition}) => runObserved({
    toolName:'owner_website_activate_revision',input:{revisionId,expectedGeneration,operationId,urlDisposition},
    execute:async(access)=>{
      const generation=await activateWebsiteRevision({revisionId,expectedGeneration,operationId,urlDisposition,actor:access.user.id});
      return {content:[{type:'text' as const,text:'Website activation committed at generation '+generation+'.'}],
        structuredContent:{environment:deploymentEnvironment(),action:'activate',revisionId,operationId,generation} };
    },
  }));

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
            billing: {
              productAccessConfigured: status.billing.productAccessConfigured,
              supportConfigured: status.billing.supportConfigured,
              webhookConfigured: status.billing.webhookConfigured,
              missing: [...new Set([
                ...status.billing.missingProductAccess,
                ...status.billing.missingDesignerPass,
                ...status.billing.missingSupport,
              ])],
            },
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
