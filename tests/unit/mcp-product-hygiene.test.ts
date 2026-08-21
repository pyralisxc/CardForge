import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStableAgentCardId } from '@/features/studio-documents/server/developerCardSetDrafts';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const toolNames = (source: string) => Array.from(
  source.matchAll(/registerTool\(\s*['"]([^'"]+)['"]/g),
  (match) => match[1],
);

const toolRegistration = (source: string, name: string) => {
  const marker = new RegExp(`registerTool\\(\\s*['\"]${name}['\"]`);
  const start = source.search(marker);
  if (start < 0) throw new Error(`Missing MCP tool registration for ${name}`);
  const next = source.indexOf('registerTool(', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
};

describe('CardForge MCP and plugin product hygiene', () => {
  const route = readSource('src/app/mcp/route.ts');
  const templateTools = readSource('src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts');
  const cardTools = readSource('src/features/studio-documents/server/mcpAgentCardTools.ts');
  const cloudTools = readSource('src/features/studio-documents/server/mcpCloudSetTools.ts');
  const pluginSkills = readSource('src/features/studio-documents/server/mcpPluginSkills.ts');
  const cardSchemas = readSource('src/features/studio-documents/server/mcpCardToolSchemas.ts');
  const cardDrafts = readSource('src/features/studio-documents/server/developerCardSetDrafts.ts');
  const studioStore = readSource('src/features/studio-documents/server/studioDocumentStore.ts');
  const assetStore = readSource('src/features/studio-documents/server/studioDocumentAssetStore.ts');
  const artworkSources = readSource('src/features/studio-documents/server/mcpArtworkSources.ts');
  const developerAccess = readSource('src/features/developer-access/server/access.ts');
  const designSkill = readSource('plugins/cardforge-studio/skills/create-editable-template/SKILL.md');
  const setSkill = readSource('plugins/cardforge-studio/skills/create-cards-and-sets/SKILL.md');
  const plugin = JSON.parse(readSource('plugins/cardforge-studio/.codex-plugin/plugin.json')) as {
    version: string;
    description: string;
    interface: { shortDescription: string; longDescription: string; defaultPrompt: string[] };
  };

  it('keeps the published MCP action names explicit as cloud discovery is added', () => {
    const names = [
      ...toolNames(route),
      ...toolNames(templateTools),
      ...toolNames(cardTools),
      ...toolNames(cloudTools),
    ].sort();

    expect(names).toEqual([
      'attach_template_artwork',
      'continue_template_in_pipeline',
      'create_editable_template',
      'get_card_generation_contract',
      'get_cloud_set',
      'get_editable_template',
      'get_studio_creation_guide',
      'list_cloud_sets',
      'list_editable_templates',
      'preview_card_set',
      'preview_template_draft',
      'search_studio_library',
      'update_editable_template',
      'upsert_card',
      'upsert_card_set',
      'upsert_cards',
    ]);
  });

  it('pins artwork downloads and cleans failed storage writes without unbounded fan-out', () => {
    expect(artworkSources).toContain('request as httpsRequest');
    expect(artworkSources).toContain('autoSelectFamily: false');
    expect(artworkSources).toContain('const signal = AbortSignal.timeout(10_000)');
    expect(artworkSources).toContain('signal,');
    expect(artworkSources).not.toContain('response.resume()');
    expect(artworkSources).toContain('lookup: (_hostname, _options, callback) =>');
    expect(assetStore).toContain('cleanupUploadedStudioDocumentAssets');
    expect(assetStore).not.toContain('Promise.all(value.map(visit))');
    expect(studioStore).toContain('cleanupUploadedStudioDocumentAssets');
  });

  it('publishes an explicit output schema for every structured MCP tool', () => {
    const sources = [route, templateTools, cardTools, cloudTools].join('\n');
    expect(sources.match(/outputSchema:/g)).toHaveLength(toolNames(sources).length);
  });

  it('labels private overwrites and external artwork retrieval accurately', () => {
    const sources = [route, templateTools, cardTools, cloudTools].join('\n');
    const destructiveTools = new Set([
      'attach_template_artwork',
      'update_editable_template',
      'upsert_card',
      'upsert_card_set',
      'upsert_cards',
    ]);
    const openWorldTools = new Set(['upsert_card', 'upsert_cards']);

    for (const name of toolNames(sources)) {
      const registration = toolRegistration(sources, name);
      expect(registration, name).toContain(`destructiveHint: ${destructiveTools.has(name)}`);
      expect(registration, name).toContain(`openWorldHint: ${openWorldTools.has(name)}`);
    }
  });

  it('advertises and serves the two CardForge skills through the MCP skills extension', () => {
    expect(route).toContain("'io.modelcontextprotocol/skills': {}");
    expect(route).toContain('registerCardForgePluginSkills(server)');
    expect(pluginSkills).toContain("'skills/list'");
    expect(pluginSkills).toContain("'skills/get'");
    expect(pluginSkills).toContain('server.registerResource(');
    expect(pluginSkills).toContain("createHash('sha256')");
  });

  it('uses mainstream card/set language so targeted MCP discovery can find the right tools', () => {
    expect(cardTools).toContain('Prepare a Template for making cards or a bulk card set');
    expect(cardTools).toContain('Create or update a CardForge card set');
    expect(cardTools).toContain('Make or update one CardForge card');
    expect(cardTools).toContain('Generate cards in bulk for a CardForge set');
    expect(cardTools).toContain('artwork accepts a generated/uploaded public HTTPS sourceUrl');
    expect(cardTools).toContain('Review a CardForge card set before opening it in Studio');
    expect(cardTools).toContain('deck or set');
    expect(cardTools).toContain('list/CSV/JSON');
    expect(cloudTools).toContain('List cloud-saved CardForge sets');
    expect(cloudTools).toContain('Read a cloud-saved CardForge set');
  });

  it('keeps account AI work separate from developer publication permissions', () => {
    expect(developerAccess).toContain("scopes: ['studio.ai.create']");
    expect(developerAccess).toContain('{ allowStudioAiOnly: true }');
    expect(developerAccess).toContain("requireContributionScope");
    expect(route).toContain('continueDeveloperTemplateDraftInPipeline');
  });

  it('reuses the authenticated account entitlement for cloud reads and observes those calls once', () => {
    expect(cloudTools).toContain('access.entitlement');
    expect(cloudTools).toContain('observeMcpToolExecution');
    expect(cloudTools).not.toContain('getCardforgeEntitlementForUserId');
  });

  it('makes successful card/set calls self-guiding and retry-aware', () => {
    expect(cardTools).toContain('capabilityVersion');
    expect(cardTools).toContain('workflowStage');
    expect(cardTools).toContain('nextActions');
    expect(cardTools).toContain('retrySafety');
    expect(cardTools).toContain('stableCardIds');
    expect(cardTools).toContain('idempotentHint: true');
    expect(cardSchemas).toContain('Reuse the same id for revisions and retries');
    expect(cardSchemas).toContain('CardForge derives a deterministic id');
    expect(cardDrafts).toContain('findSameNameSet');
    expect(cardDrafts).toContain('id: existing?.id');
    expect(studioStore).toContain('retry with the new expectedRevision while reusing the same stable set and card ids');
  });

  it('derives stable fallback card ids independent of object key order', () => {
    const left = createStableAgentCardId('set-1', {
      data: { card_name: 'ROCK', rules_text: 'Crushes scissors.' },
    }, 0);
    const right = createStableAgentCardId('set-1', {
      data: { rules_text: 'Crushes scissors.', card_name: 'ROCK' },
    }, 0);
    const secondCopy = createStableAgentCardId('set-1', {
      data: { card_name: 'ROCK', rules_text: 'Crushes scissors.' },
    }, 1);

    expect(left).toBe(right);
    expect(secondCopy).not.toBe(left);
  });

  it('keeps the plugin version aligned with the live MCP server contract', () => {
    const serverVersion = route.match(/serverInfo:\s*\{\s*name:\s*'cardforge-studio',\s*version:\s*'([^']+)'/)?.[1];
    expect(serverVersion).toBeTruthy();
    expect(plugin.version).toBe(serverVersion);
  });

  it('presents CardForge as a card-making product rather than a developer Template utility', () => {
    expect(plugin.description).toContain('generate complete card sets');
    expect(plugin.interface.shortDescription).toBe('Design cards and generate complete card sets');
    expect(plugin.interface.longDescription).toContain('bulk-generate');
    expect(plugin.interface.defaultPrompt).toContain('Turn this list into a complete CardForge card set.');
    expect(plugin.interface.defaultPrompt.join(' ')).not.toContain('Forge Review');
  });

  it('splits design guidance from card/set generation guidance without duplicating implementation contracts', () => {
    expect(designSkill).toContain('# Design editable CardForge Templates');
    expect(designSkill).toContain('do **not** add another decorative border');
    expect(designSkill).toContain('`binding: element.image`');
    expect(designSkill).toContain('call `preview_template_draft`');
    expect(designSkill).toContain('native exported PNG shown directly in chat');
    expect(designSkill).toContain('separate revision-bound Studio URL');
    expect(designSkill).toContain('same normal personal local Template');

    expect(setSkill).toContain('# Create CardForge cards and sets');
    expect(setSkill).toContain('call `get_card_generation_contract`');
    expect(setSkill).toContain('same set id and card ids');
    expect(setSkill).toContain('`upsert_cards`');
    expect(setSkill).toContain('Image generation creates standalone artwork assets only');
    expect(setSkill).not.toContain('`attach_card_artwork`');
    expect(setSkill).toContain('`preview_card_set`');
    expect(setSkill).toContain('export/import an editable individual card or set as CardForge JSON');
  });
});
