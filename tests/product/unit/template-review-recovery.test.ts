import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
const workspace = vi.hoisted(() => ({ userTemplates: [] as TCGCardTemplate[], defaultTemplates: [] as TCGCardTemplate[] }));
vi.mock('@/features/project/client/workspace', async () => ({
  useProjectStore: { getState: () => workspace },
  selectAllTemplates: (await import('@/features/project/store/selectors')).selectAllTemplates,
}));
vi.mock('@/features/studio-documents/client', () => ({ forgetAgentTemplateLink: vi.fn(), syncAgentTemplateSave: vi.fn() }));
import { useTemplateLibraryActions } from '@/features/template-editor/hooks/useTemplateLibraryActions';
const expectedBase = {
  assetId: 'native-template', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5',
  lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 1, revisionHighWater: 1,
  parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32),
};
const draft = (): TCGCardTemplate => ({ id: expectedBase.assetId, name: 'Saved baseline', aspectRatio: '63:88',
  templateSource: 'user', templateRegistryStatus: 'draft', templatePipelineContext: { schemaVersion: 1, expectedBase } });
function actions() {
  let result!: ReturnType<typeof useTemplateLibraryActions>;
  function Probe() {
    result = useTemplateLibraryActions({
      addOrUpdateTemplate: (template) => { workspace.userTemplates = [template]; return template.id!; },
      addOrUpdateAppearanceStyle: vi.fn(() => 'style'), commitTemplateChange: vi.fn(() => 'template'),
      clearPersonalTemplateOverride: vi.fn(), cloneTemplate: vi.fn(() => null), deleteAppearanceStyle: vi.fn(), deleteTemplate: vi.fn(),
      setGeneratorSelectedTemplateId: vi.fn(), setTemplateEditorSelectedTemplateId: vi.fn(),
      projectCapabilities: { canSubmitTemplateRevisions: true, canPublishSharedLibrary: true },
      templates: [...workspace.defaultTemplates, ...workspace.userTemplates], storedCards: [], appearanceStyles: [], toast: vi.fn(),
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result;
}
beforeEach(() => { workspace.userTemplates = []; workspace.defaultTemplates = []; });
afterEach(() => vi.unstubAllGlobals());

describe('Template review asynchronous browser recovery', () => {
  it.each(['fingerprint', 'receipt'] as const)('preserves newer saved work during an awaited %s instead of persisting stale content', async (phase) => {
    const template = draft();
    if (phase === 'receipt') template.templatePipelineContext!.attempt = { key: 'previous_key_12345678', requestFingerprint: 'f'.repeat(64) };
    workspace.userTemplates = [template];
    let release!: () => void;
    const pause = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => { started = resolve; });
    vi.stubGlobal('crypto', { subtle: { digest: async () => { if (phase === 'fingerprint') { started(); await pause; } return new ArrayBuffer(32); } } });
    const fetch = vi.fn(async () => { started(); await pause; return new Response(JSON.stringify({ receipt: null })); });
    vi.stubGlobal('fetch', fetch);
    const submission = actions().handleSubmitTemplateReview(template);
    await waiting;
    workspace.userTemplates = [{ ...template, name: 'Newer saved edit' }];
    release();
    await expect(submission).rejects.toThrow('newer work is preserved');
    expect(workspace.userTemplates[0].name).toBe('Newer saved edit');
    expect(fetch.mock.calls.length).toBe(phase === 'receipt' ? 1 : 0);
  });

  it.each(['saved draft', 'unsaved editor'] as const)('preserves a newer %s while preparing a published source', async (change) => {
    const published = { ...draft(), templateSource: 'default' as const, templatePipelineContext: undefined };
    workspace.defaultTemplates = [published];
    let release!: () => void;
    const pause = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async () => { await pause; return new Response(JSON.stringify({ expectedBase, template: published })); }));
    let editorUnchanged = true;
    const preparation = actions().handlePrepareTemplateReview(published, () => editorUnchanged);
    if (change === 'saved draft') workspace.userTemplates = [{ ...published, templateSource: 'user', name: 'Newer saved edit' }];
    else editorUnchanged = false;
    release();
    await expect(preparation).rejects.toThrow('changes are preserved');
    expect(workspace.userTemplates).toEqual(change === 'saved draft' ? [expect.objectContaining({ name: 'Newer saved edit' })] : []);
  });
});
