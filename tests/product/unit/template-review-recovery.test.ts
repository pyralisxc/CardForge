import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
const feedback = vi.hoisted(() => vi.fn());
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
      addOrUpdateTemplate: (template) => { workspace.userTemplates = [...workspace.userTemplates.filter((existing) => existing.id !== template.id), template]; return template.id!; },
      addOrUpdateAppearanceStyle: vi.fn(() => 'style'), commitTemplateChange: vi.fn(() => 'template'),
      clearPersonalTemplateOverride: vi.fn(), cloneTemplate: vi.fn(() => null), deleteAppearanceStyle: vi.fn(), deleteTemplate: vi.fn(),
      setGeneratorSelectedTemplateId: vi.fn(), setTemplateEditorSelectedTemplateId: vi.fn(),
      projectCapabilities: { canSubmitTemplateRevisions: true, canPublishSharedLibrary: true },
      templates: [...workspace.defaultTemplates, ...workspace.userTemplates], storedCards: [], appearanceStyles: [], toast: feedback,
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result;
}
beforeEach(() => { feedback.mockReset(); workspace.userTemplates = []; workspace.defaultTemplates = []; });
afterEach(() => vi.unstubAllGlobals());

describe('Template review asynchronous browser recovery', () => {
  it('prepares an isolated review working copy without replacing a saved override or changing its provider base', async () => {
    const published = { ...draft(), name: 'Published source', templateSource: 'default' as const, templatePipelineContext: undefined };
    const existing = { ...published, templateSource: 'user' as const, name: 'My existing local work' };
    workspace.defaultTemplates = [published];
    workspace.userTemplates = [existing];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ expectedBase, template: published }))));
    const result = await actions().handlePrepareTemplateReview(existing, () => true);
    expect(result.id).not.toBe(expectedBase.assetId);
    expect(result.id).toMatch(/^template-review-/u);
    expect(result.name).toBe('Published source');
    expect(result.templatePipelineContext?.expectedBase).toEqual(expectedBase);
    expect(workspace.userTemplates).toEqual([existing, result]);
    expect(workspace.defaultTemplates).toEqual([published]);
  });

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

describe('Template review committed browser receipts', () => {
  const receipt = { id: 'bc615bd7-07b1-460c-9e25-9d3b13b65ed1', assetId: expectedBase.assetId, revisionNumber: 2, status: 'submitted', editorialReviewStatus: 'pending', requestFingerprint: 'f'.repeat(64) };
  it('keeps the confirmed native receipt and reports incomplete activity without another write', async () => {
    const template = draft(); workspace.userTemplates = [template];
    vi.stubGlobal('crypto', { subtle: { digest: async () => new ArrayBuffer(32) } });
    const fetch = vi.fn(async () => Response.json({ ...receipt, requestFingerprint: '00'.repeat(32), outcome: 'committed', committed: true, activityRecorded: false })); vi.stubGlobal('fetch', fetch);
    await actions().handleSubmitTemplateReview(template);
    expect(feedback).toHaveBeenCalledWith(expect.objectContaining({ title: 'Template review receipt', description: expect.stringContaining('Audit activity is incomplete') }));
    expect(fetch).toHaveBeenCalledOnce(); expect(workspace.userTemplates[0].templatePipelineContext?.attempt?.key).toBeTruthy();
  });
  it('reconciles a retained identical attempt through exact GET receipt, without posting again or changing its key', async () => {
    const template = draft(); template.templatePipelineContext!.attempt = { key: 'saved_review_key_123456789', requestFingerprint: '00'.repeat(32) }; workspace.userTemplates = [template];
    vi.stubGlobal('crypto', { subtle: { digest: async () => new ArrayBuffer(32) } });
    const fetch = vi.fn(async () => Response.json({ receipt: { ...receipt, requestFingerprint: '00'.repeat(32) } })); vi.stubGlobal('fetch', fetch);
    await actions().handleSubmitTemplateReview(template);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('submissionKey=saved_review_key_123456789'));
    expect(feedback).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('no new revision was created') }));
    expect(workspace.userTemplates[0].templatePipelineContext?.attempt?.key).toBe('saved_review_key_123456789');
  });
  it('preserves saved attempt after a lost POST response and gives exact readback guidance without replay', async () => {
    const template = draft(); workspace.userTemplates = [template];
    vi.stubGlobal('crypto', { subtle: { digest: async () => new ArrayBuffer(32) } });
    const fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); }); vi.stubGlobal('fetch', fetch);
    await expect(actions().handleSubmitTemplateReview(template)).rejects.toThrow('Do not replay automatically');
    expect(fetch).toHaveBeenCalledOnce(); expect(workspace.userTemplates[0].templatePipelineContext?.attempt).toMatchObject({ key: expect.any(String), requestFingerprint: '00'.repeat(32) }); expect(feedback).not.toHaveBeenCalled();
  });
  it('keeps an uncertain attempt and key when receipt read is unavailable, without POST or new attempt', async () => {
    const template = draft(); template.templatePipelineContext!.attempt = { key: 'saved_review_key_123456789', requestFingerprint: '00'.repeat(32) }; workspace.userTemplates = [template];
    vi.stubGlobal('crypto', { subtle: { digest: async () => new ArrayBuffer(32) } });
    const fetch = vi.fn(async () => new Response('unavailable', { status: 503 })); vi.stubGlobal('fetch', fetch);
    await expect(actions().handleSubmitTemplateReview(template)).rejects.toThrow('Read its exact saved receipt');
    expect(fetch).toHaveBeenCalledOnce(); expect(workspace.userTemplates[0]).toEqual(template); expect(feedback).not.toHaveBeenCalled();
  });
});
