import { describe, expect, it, vi } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { prepareTemplateForLibrarySave } from '@/features/template-editor/hooks/useTemplateLibraryActions';
import { createTemplateEditorActions } from '@/features/template-editor/lib/templateEditorActions';

const sharedTemplate = {
  id: 'shared-template',
  name: 'Shared Template',
  aspectRatio: '2.5:3.5',
  templateSource: 'default',
  templateLibrarySource: 'pipeline',
  templateRevision: 4,
  templateRevisionId: 'shared-revision-4',
} as TCGCardTemplate;

const makeActionOptions = () => ({
  canUndo: false,
  canRedo: false,
  showGrid: false,
  snapToGrid: false,
  previewMode: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomIn: vi.fn(),
  onFitToScreen: vi.fn(),
  onActualSize: vi.fn(),
  onCenterCanvas: vi.fn(),
  onToggleGrid: vi.fn(),
  onToggleSnapToGrid: vi.fn(),
  onTogglePreviewMode: vi.fn(),
  onOpenCommandPalette: vi.fn(),
  onSave: vi.fn(),
});

describe('Template revision workflow', () => {
  it('keeps shared lineage provenance while local Save remains a personal draft until explicit Pipeline submission', () => {
    expect(prepareTemplateForLibrarySave(sharedTemplate, true, () => 'draft-id')).toMatchObject({
      id: 'shared-template',
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateRegistryStatus: 'draft',
      templateLineageId: 'shared-template',
      templateRevision: 4,
      templateRevisionId: 'template-draft-draft-id',
      templateParentRevisionId: 'shared-revision-4',
      templateOriginLineageId: 'shared-template',
      templateOriginRevisionId: 'shared-revision-4',
    });
    expect(prepareTemplateForLibrarySave(sharedTemplate, false, () => 'personal-copy')).toMatchObject({
      id: 'template-personal-copy',
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateRegistryStatus: 'localOnly',
      templateLineageId: 'template-personal-copy',
      templateOriginLineageId: 'shared-template',
      templateOriginRevisionId: 'shared-revision-4',
    });
  });

  it('presents and locks the same Save action used by toolbar, mobile, and command palette', () => {
    const saveAction = createTemplateEditorActions({
      ...makeActionOptions(),
      saveDisabled: true,
      savePresentation: {
        label: 'Save Template draft',
        shortLabel: 'Saving…',
        description: 'Commit this design draft to browser work. Pipeline submission is separate.',
      },
    }).find((action) => action.id === 'save');

    expect(saveAction).toMatchObject({
      label: 'Save Template draft',
      shortLabel: 'Saving…',
      description: 'Commit this design draft to browser work. Pipeline submission is separate.',
      disabled: true,
    });
  });
});
