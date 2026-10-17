import { describe, expect, it, vi } from 'vitest';

import { createPersonalTemplateFork, reconstructMinimalTemplate, type TCGCardTemplate } from '@/domain/templates';
import { templateReviewRequestText } from '@/features/pipeline/lib/templateReview';
import { buildCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';
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


describe('Template review working-copy context', () => {
  const context = { schemaVersion: 1 as const, expectedBase: {
    assetId: 'shared-template', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5',
    lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 4, revisionHighWater: 4,
    parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32),
  }, attempt: { key: 'review_key_1234567890', requestFingerprint: 'c'.repeat(64) } };
  it('persists the exact published lease and unknown-attempt identity through local Save, not local parent revision IDs', () => {
    const draft = prepareTemplateForLibrarySave({ ...sharedTemplate, templatePipelineContext: context }, true, () => 'one');
    const next = prepareTemplateForLibrarySave({ ...draft, name: 'Correction' }, true, () => 'two', draft);
    expect(reconstructMinimalTemplate(next).templatePipelineContext).toEqual(context);
    expect(next.templateParentRevisionId).toBe('template-draft-one');
    expect(next.templatePipelineContext!.expectedBase.parentSubmissionId).toBe(context.expectedBase.parentSubmissionId);
    expect(createPersonalTemplateFork(next).templatePipelineContext).toBeUndefined();
  });
  it('keeps retries out of the authored fingerprint and portable package without discarding browser recovery', async () => {
    const template = { ...sharedTemplate, templatePipelineContext: context };
    expect(templateReviewRequestText(template)).toBe(templateReviewRequestText({ ...template,
      templatePipelineContext: { ...context, attempt: undefined } }));
    const snapshot = await buildCardForgeProjectSnapshot({ name: 'Review draft', document: createProjectDocumentFromState({
      userTemplates: [template], storedCards: [], appearanceStyles: [],
    }) });
    expect(snapshot.manifest.project.userTemplates[0]).not.toHaveProperty('templatePipelineContext');
    expect(template.templatePipelineContext).toEqual(context);
  });
});
