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
  it('preserves the stable shared Template id only for revision contributors', () => {
    expect(prepareTemplateForLibrarySave(sharedTemplate, true, () => 'personal-copy')).toMatchObject({
      id: 'shared-template',
      templateSource: 'default',
      templateLibrarySource: 'pipeline',
    });
    expect(prepareTemplateForLibrarySave(sharedTemplate, false, () => 'personal-copy')).toMatchObject({
      id: 'personal-copy',
      templateSource: 'user',
      templateLibrarySource: 'personal',
    });
  });

  it('presents and locks the same revision action used by toolbar, mobile, and command palette', () => {
    const saveAction = createTemplateEditorActions({
      ...makeActionOptions(),
      saveDisabled: true,
      savePresentation: {
        label: 'Submit Template revision 4',
        shortLabel: 'Submitting…',
        description: 'Submit revision 4 to Forge Review.',
      },
    }).find((action) => action.id === 'save');

    expect(saveAction).toMatchObject({
      label: 'Submit Template revision 4',
      shortLabel: 'Submitting…',
      description: 'Submit revision 4 to Forge Review.',
      disabled: true,
    });
  });
});
