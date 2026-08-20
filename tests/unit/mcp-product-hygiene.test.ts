import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStableAgentCardId } from '@/features/studio-documents/server/developerCardSetDrafts';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const toolNames = (source: string) => Array.from(
  source.matchAll(/registerTool\(\s*['"]([^'"]+)['"]/g),
  (match) => match[1],
);

describe('CardForge MCP and plugin product hygiene', () => {
  const route = readSource('src/app/mcp/route.ts');
  const templateTools = readSource('src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts');
  const cardTools = readSource('src/features/studio-documents/server/mcpAgentCardTools.ts');
  const cardSchemas = readSource('src/features/studio-documents/server/mcpCardToolSchemas.ts');
  const cardDrafts = readSource('src/features/studio-documents/server/developerCardSetDrafts.ts');
  const studioStore = readSource('src/features/studio-documents/server/studioDocumentStore.ts');
  const designSkill = readSource('plugins/cardforge-studio/skills/create-editable-template/SKILL.md');
  const setSkill = readSource('plugins/cardforge-studio/skills/create-cards-and-sets/SKILL.md');
  const plugin = JSON.parse(readSource('plugins/cardforge-studio/.codex-plugin/plugin.json')) as {
    version: string;
    description: string;
    interface: { shortDescription: string; longDescription: string; defaultPrompt: string[] };
  };

  it('keeps the published MCP action names stable while improving metadata around them', () => {
    const names = [
      ...toolNames(route),
      ...toolNames(templateTools),
      ...toolNames(cardTools),
    ].sort();

    expect(names).toEqual([
      'attach_card_artwork',
      'attach_template_artwork',
      'continue_template_in_pipeline',
      'create_editable_template',
      'get_card_generation_contract',
      'get_editable_template',
      'get_studio_creation_guide',
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

  it('uses mainstream card/set language so targeted MCP discovery can find the right tools', () => {
    expect(cardTools).toContain('Prepare a Template for making cards or a bulk card set');
    expect(cardTools).toContain('Create or update a CardForge card set');
    expect(cardTools).toContain('Make or update one CardForge card');
    expect(cardTools).toContain('Generate cards in bulk for a CardForge set');
    expect(cardTools).toContain('Add artwork to one CardForge card');
    expect(cardTools).toContain('Review a CardForge card set before opening it in Studio');
    expect(cardTools).toContain('deck or set');
    expect(cardTools).toContain('list/CSV/JSON');
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
    expect(designSkill).toContain('same normal personal local Template');

    expect(setSkill).toContain('# Create CardForge cards and sets');
    expect(setSkill).toContain('call `get_card_generation_contract`');
    expect(setSkill).toContain('same set id and card ids');
    expect(setSkill).toContain('`upsert_cards`');
    expect(setSkill).toContain('`preview_card_set`');
    expect(setSkill).toContain('export/import an editable individual card or set as CardForge JSON');
  });
});
