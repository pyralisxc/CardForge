import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getCampaignPackageReadiness,
  getCampaignStatusLabel,
  isCampaignActionable,
  matchesCampaignQueueFilter,
} from '@/features/marketing-content/client/campaignWorkflow';
import { normalizeCampaignInput } from '@/features/marketing-content/model';

const root = process.cwd();
const sourcePath = (...segments: string[]) => resolve(root, 'src', ...segments);

const collectSourceFiles = (directory: string): string[] => readdirSync(directory)
  .flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? collectSourceFiles(path) : [path];
  })
  .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'));

describe('developer cockpit polish contract', () => {
  it('rejects oversized campaign copy instead of silently truncating it', () => {
    const result = normalizeCampaignInput({
      title: 'x'.repeat(121),
      objective: 'A clear objective.',
      variants: [{ service: 'facebook', text: 'Channel copy.' }],
    });

    expect(result).toEqual({
      ok: false,
      message: 'Campaign name must be 120 characters or fewer.',
    });
  });

  it('gives the developer profile table one source owner', () => {
    const owners = collectSourceFiles(sourcePath())
      .filter((path) => readFileSync(path, 'utf8').includes(".from('cardforge_developer_profiles')"))
      .map((path) => relative(root, path).replaceAll('\\', '/'));

    expect(owners).toEqual([
      'src/features/developer-access/server/profileStore.ts',
    ]);
  });

  it('exposes deliberate campaign lifecycle controls', () => {
    const queue = readFileSync(
      sourcePath('features', 'marketing-content', 'components', 'DeveloperCampaignQueue.tsx'),
      'utf8',
    );

    expect(queue).toContain('Withdraw submission');
    expect(queue).toContain('Cancel draft');
    expect(queue).toContain('CockpitConfirmationDialog');
  });

  it('keeps canonical campaign and media responsibilities in focused owners', () => {
    const focusedFiles = [
      'components/DeveloperCampaignComposer.tsx',
      'components/CampaignVariantEditor.tsx',
      'server/campaignStore.ts',
      'server/media.ts',
      'server/mediaApproval.ts',
      'server/mediaIngest.ts',
      'server/storeShared.ts',
      'server/storeRows.ts',
    ];
    const contentRoot = sourcePath('features', 'marketing-content');

    for (const path of focusedFiles) {
      expect(() => readFileSync(resolve(contentRoot, path), 'utf8'), path).not.toThrow();
    }

    const composer = readFileSync(
      resolve(contentRoot, 'components', 'DeveloperCampaignComposer.tsx'),
      'utf8',
    );
    expect(composer).toContain('CampaignAssociationEditor');
    expect(composer).toContain('CampaignMediaIngestFields');
    expect(composer).toContain('CampaignVariantEditor');
  });

  it('promotes reviewed campaign art into a provider-ready JPEG', () => {
    const approval = readFileSync(
      sourcePath('features', 'marketing-content', 'server', 'mediaApproval.ts'),
      'utf8',
    );

    expect(approval).toContain("purpose: 'provider_image'");
    expect(approval).toContain("mime_type: 'image/jpeg'");
    expect(approval).toContain('PROVIDER_IMAGE_WIDTH = 1080');
    expect(approval).toContain('PROVIDER_IMAGE_HEIGHT = 1350');
    expect(approval).toContain('.jpeg({ quality: 92, mozjpeg: true })');
  });

  it('keeps owner work visible from review through publishing setup', () => {
    const campaign = {
      contributorId: 'developer-1',
      status: 'submitted' as const,
    };

    expect(isCampaignActionable(campaign, {
      currentUserId: 'owner-1',
      isOwner: true,
    })).toBe(true);
    expect(isCampaignActionable({
      ...campaign,
      status: 'approved',
    }, {
      currentUserId: 'owner-1',
      isOwner: true,
    })).toBe(true);
    expect(matchesCampaignQueueFilter({
      ...campaign,
      status: 'published',
    }, 'needs_action', {
      currentUserId: 'owner-1',
      isOwner: true,
    })).toBe(false);
  });

  it('makes package readiness visible without making optional package sections persistence requirements', () => {
    expect(getCampaignPackageReadiness({
      title: '',
      objective: '',
      productionNote: '',
      variants: [{ service: 'facebook', text: '', attachments: [] }],
    })).toMatchObject({
      completed: 0,
      total: 5,
      readyToSave: false,
    });

    expect(getCampaignPackageReadiness({
      title: 'Release proof',
      objective: 'Show what changed.',
      productionNote: 'PR #88',
      variants: [{
        service: 'facebook',
        text: 'The cockpit is ready.',
        attachments: [{
          id: 'attachment-1',
          mediaId: '11111111-1111-4111-8111-111111111111',
          derivativeId: null,
          displayOrder: 0,
          captionOverride: '',
          cropIntent: {},
          altText: 'The CardForge Developer Cockpit campaign queue.',
          media: { rightsBasis: 'CardForge-owned capture.' } as never,
        }],
      }],
    })).toMatchObject({
      completed: 5,
      total: 5,
      readyToSave: true,
    });
  });

  it('shows reviewers campaign proof instead of approving an image count', () => {
    const details = readFileSync(
      sourcePath('features', 'marketing-content', 'components', 'DeveloperCampaignPackageDetails.tsx'),
      'utf8',
    );

    expect(details).toContain('Release context');
    expect(details).toContain('Release and review context');
    expect(details).toContain('Development associations');
    expect(details).toContain('<Image');
    expect(details).toContain('attachment.altText');
  });

  it('presents workflow states with provider-aware human labels', () => {
    expect(getCampaignStatusLabel('provider_draft')).toBe('Provider draft');
    expect(getCampaignStatusLabel('changes_requested')).toBe('Changes requested');
    expect(getCampaignStatusLabel('scheduled')).toBe('Scheduled');
  });

  it('confirms live site publication and supports proposal withdrawal', () => {
    const proposalPanel = readFileSync(
      sourcePath('features', 'developer-cockpit', 'components', 'DeveloperSiteProposalPanel.tsx'),
      'utf8',
    );

    expect(proposalPanel).toContain('CockpitConfirmationDialog');
    expect(proposalPanel).toContain('Publish to live site');
    expect(proposalPanel).toContain('Withdraw proposal');
  });

  it('uses a compact mobile cockpit navigator', () => {
    const cockpitPage = readFileSync(
      sourcePath('features', 'developer-cockpit', 'components', 'DeveloperCockpitPage.tsx'),
      'utf8',
    );

    expect(cockpitPage).toContain('aria-label="Cockpit section"');
    expect(cockpitPage).toContain('hidden sm:flex');
    expect(cockpitPage).toContain("label: 'Asset Contributions'");
  });

  it('gives owners reversible campaign-media retirement and guarded permanent deletion', () => {
    const mediaLibrary = readFileSync(
      sourcePath('features', 'marketing-content', 'components', 'DeveloperCampaignMediaLibrary.tsx'),
      'utf8',
    );
    const mediaRoute = readFileSync(
      sourcePath('app', 'api', 'developer-cockpit', 'media', '[mediaId]', 'route.ts'),
      'utf8',
    );

    expect(mediaLibrary).toContain('Retire media');
    expect(mediaLibrary).toContain('Restore media');
    expect(mediaLibrary).toContain('Delete permanently');
    expect(mediaRoute).toContain('export async function PATCH');
    expect(mediaRoute).toContain('export async function DELETE');
  });
});
