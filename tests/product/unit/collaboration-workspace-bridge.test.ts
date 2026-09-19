import { describe, expect, it } from 'vitest';

import type { ProjectState } from '@/features/project/client/workspace';
import {
  buildCollaborationWorkspacePatch,
  captureCollaborationAuthoredDocumentFromState,
} from '@/features/collaboration/client';

const baseState = (): ProjectState => ({
  defaultTemplates: [{
    id: 'shared-template',
    name: 'Shared',
    aspectRatio: '2.5/3.5',
    templateSource: 'default',
  }],
  userTemplates: [{
    id: 'other-template',
    name: 'Other',
    aspectRatio: '2.5/3.5',
    templateSource: 'user',
  }],
  appearanceStyles: [],
  storedCards: [
    { uniqueId: 'shared-card', templateId: 'shared-template', setId: 'shared-set', setName: 'Shared Set', data: { title: 'Shared' } },
    { uniqueId: 'other-card', templateId: 'other-template', setId: 'other-set', setName: 'Other Set', data: { title: 'Other' } },
  ],
  bulkRevisionUndo: null,
  editingCardUniqueId: null,
  isEditDialogOpen: false,
  selectedPaperSize: 'letter',
  studioView: 'design',
  richTextHighlightColor: '#ffff00',
  cardSets: [
    { id: 'shared-set', name: 'Shared Set', templateIds: ['shared-template'] },
    { id: 'other-set', name: 'Other Set', templateIds: ['other-template'] },
  ],
  activeCardSet: { id: 'shared-set', name: 'Shared Set', templateIds: ['shared-template'] },
  generatorSelectedTemplateId: 'shared-template',
  generatorSelectedBackingTemplateId: null,
  templateEditorSelectedTemplateId: 'shared-template',
  pdfMarginMm: 0,
  pdfCardSpacingMm: 0,
  pdfIncludeCutLines: false,
  pdfDuplexLayout: 'flip-long-edge',
  exportMode: 'png',
  exportDpi: 300,
} as ProjectState);

describe('collaboration workspace bridge', () => {
  it('captures only the target Set authored core', () => {
    const authored = captureCollaborationAuthoredDocumentFromState(baseState(), 'shared-set');
    expect(authored.set.id).toBe('shared-set');
    expect(authored.cards.map((card) => card.uniqueId)).toEqual(['shared-card']);
    expect(authored.templates.map((template) => template.id)).toEqual(['shared-template']);
  });

  it('applies shared changes without replacing unrelated work or personal settings', () => {
    const state = baseState();
    const authored = captureCollaborationAuthoredDocumentFromState(state, 'shared-set');
    authored.set.name = 'Renamed Shared Set';
    authored.cards[0]!.data.title = 'Remote title';
    const patch = buildCollaborationWorkspacePatch(state, authored);

    expect(patch.cardSets.find((set) => set.id === 'shared-set')?.name).toBe('Renamed Shared Set');
    expect(patch.cardSets.find((set) => set.id === 'other-set')?.name).toBe('Other Set');
    expect(patch.storedCards.find((card) => card.uniqueId === 'shared-card')?.data.title).toBe('Remote title');
    expect(patch.storedCards.find((card) => card.uniqueId === 'other-card')?.data.title).toBe('Other');
    expect(patch.userTemplates.map((template) => template.id)).toEqual(['other-template']);
  });

  it('creates a personal Template override only when collaborative content differs from the shared/default source', () => {
    const state = baseState();
    const authored = captureCollaborationAuthoredDocumentFromState(state, 'shared-set');
    authored.templates[0]!.name = 'Collaboratively revised';
    const patch = buildCollaborationWorkspacePatch(state, authored);

    const override = patch.userTemplates.find((template) => template.id === 'shared-template');
    expect(override?.name).toBe('Collaboratively revised');
    expect(override?.templateSource).toBe('user');
    expect(patch.userTemplates.find((template) => template.id === 'other-template')?.name).toBe('Other');
  });
});
