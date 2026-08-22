import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CardSet, StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import { createCardSetTransfer } from '@/features/project/model/cardTransfer';
import { createStableAgentCardId } from '@/features/studio-documents/server/developerCardSetDrafts';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const set: CardSet = {
  id: 'set-1',
  name: 'Test Set',
  frontTemplateId: 'official-template',
  backingTemplateId: null,
};
const card: StoredDisplayCard = {
  uniqueId: 'card-1',
  templateId: 'official-template',
  backingTemplateId: null,
  setId: 'set-1',
  setName: 'Test Set',
  data: { name: 'Card One' },
};

const template = (id: string, source: 'official' | 'personal'): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  templateSource: 'user',
  templateLibrarySource: source,
  freeformCanvas: { width: 630, height: 880, elements: [] },
});

describe('MCP workflow hardening', () => {
  it('documents why data-derived ids must not be reused as implicit edit identity', () => {
    const first = createStableAgentCardId('set-1', { data: { name: 'Card One', rules: 'Flying' } });
    const revised = createStableAgentCardId('set-1', { data: { name: 'Card One', rules: 'Flying, haste' } });
    expect(first).not.toBe(revised);
  });

  it('does not export transient official catalog Templates as personal Set dependencies', () => {
    const transfer = createCardSetTransfer({
      set,
      storedCards: [card],
      templates: [
        template('official-template', 'official'),
        template('unrelated-personal', 'personal'),
      ],
    });
    expect(transfer.templates).toEqual([]);
    expect(transfer.cards).toHaveLength(1);
    expect(transfer.sets[0]?.frontTemplateId).toBe('official-template');
  });

  it('requires explicit revise identity and provides maintenance operations', () => {
    const schemas = readSource('src/features/studio-documents/server/mcpCardToolSchemas.ts');
    const cardTools = readSource('src/features/studio-documents/server/mcpAgentCardTools.ts');
    const drafts = readSource('src/features/studio-documents/server/developerCardSetDrafts.ts');

    expect(schemas).toContain("export type McpCardWriteMode = 'upsert' | 'create' | 'revise'");
    expect(drafts).toContain("writeMode === 'revise' && !input.cardId?.trim()");
    expect(drafts).toContain("writeMode === 'create' && existing");
    expect(cardTools).toContain("'delete_cards'");
    expect(cardTools).toContain("'move_cards'");
    expect(cardTools).toContain("'delete_card_set'");
  });

  it('binds cloud commits to both working-document and source-cloud revisions', () => {
    const bridge = readSource('src/features/studio-documents/server/mcpCloudSetBridge.ts');
    const cloudStore = readSource('src/features/project/server/cloudSetStore.ts');

    expect(bridge).toContain('sourceCloudSetId: set.id');
    expect(bridge).toContain('sourceCloudRevision: cloud.summary.revision');
    expect(bridge).toContain('document.sourceCloudSetId !== setId');
    expect(bridge).toContain('document.sourceCloudRevision !== expectedCloudRevision');
    expect(cloudStore).toContain("deletion = deletion.eq('revision', expectedRevision)");
  });

  it('tracks exact browser installation acknowledgements and resumable work', () => {
    const store = readSource('src/features/studio-documents/server/studioDocumentStore.ts');
    const handoff = readSource('src/features/studio-documents/hooks/useStudioDocumentHandoff.ts');
    const accountTools = readSource('src/features/studio-documents/server/mcpAccountWorkflowTools.ts');

    expect(store).toContain('last_installed_revision');
    expect(store).toContain('recordStudioDocumentInstallation');
    expect(handoff).toContain('handledRevisionKeyRef');
    expect(handoff).toContain('/installation');
    expect(accountTools).toContain("'list_agent_working_documents'");
    expect(accountTools).toContain("'get_agent_install_status'");
  });

  it('exposes account capabilities rather than asking the model to infer privilege', () => {
    const accountTools = readSource('src/features/studio-documents/server/mcpAccountWorkflowTools.ts');
    const access = readSource('src/features/developer-access/server/access.ts');

    expect(accountTools).toContain("'get_cardforge_capabilities'");
    expect(accountTools).toContain('isOwner: access.isOwner');
    expect(accountTools).toContain('isDeveloper: access.isDeveloper');
    expect(accountTools).toContain('scopes: access.scopes');
    expect(access).toContain("return createStudioOnlyAccess('studio.ai.create')");
  });

  it('documents and enforces the known artwork limits in the agent workflow', () => {
    const artwork = readSource('src/features/studio-documents/server/mcpArtworkSources.ts');
    const embedded = readSource('src/features/studio-documents/server/embeddedTemplateAssets.ts');
    const skill = readSource('plugins/cardforge-studio/skills/create-cards-and-sets/SKILL.md');

    expect(artwork).toContain('MAX_MCP_ARTWORK_ITEMS_PER_OPERATION = 64');
    expect(artwork).toContain('MAX_MCP_ARTWORK_BYTES_PER_OPERATION = 32 * 1024 * 1024');
    expect(embedded).toContain('MAX_EMBEDDED_TEMPLATE_ASSET_BYTES = 2_400_000');
    expect(skill).toContain('2.4 MB or smaller');
    expect(skill).toContain('64 artwork files and 32 MB aggregate');
  });
});
