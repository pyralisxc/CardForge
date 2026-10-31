import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { reconstructMinimalTemplate } from '@/domain/templates';
import { selectAllTemplates, useProjectStore } from '@/features/project/client/workspace';
import { useTemplateLibraryActions } from '@/features/template-editor/hooks/useTemplateLibraryActions';

const sync = vi.hoisted(() => vi.fn());
vi.mock('@/features/studio-documents/client', () => ({
  syncAgentTemplateSave: sync,
  forgetAgentTemplateLink: vi.fn(),
}));

it('returns the committed same-ID snapshot captured before a delayed linked-document sync', async () => {
  const previous = useProjectStore.getState();
  const source = reconstructMinimalTemplate({
    id: 'shared-source', name: 'Shared source', aspectRatio: '63:88', templateSource: 'default',
    templateLibrarySource: 'pipeline', templateRegistryStatus: 'published',
    templateLineageId: 'shared-lineage', templateRevision: 3, templateRevisionId: 'published-3',
  });
  useProjectStore.setState({ defaultTemplates: [source], userTemplates: [], storedCards: [] });
  let acknowledge!: () => void;
  sync.mockImplementationOnce(() => new Promise(resolve => { acknowledge = () => resolve({ status: 'unlinked' }); }));
  let actions!: ReturnType<typeof useTemplateLibraryActions>;
  function Probe() {
    const store = useProjectStore.getState();
    actions = useTemplateLibraryActions({
      addOrUpdateAppearanceStyle: store.addOrUpdateAppearanceStyle, addOrUpdateTemplate: store.addOrUpdateTemplate,
      commitTemplateChange: store.commitTemplateChange, clearPersonalTemplateOverride: store.clearPersonalTemplateOverride,
      appearanceStyles: [], cloneTemplate: store.cloneTemplate, deleteAppearanceStyle: store.deleteAppearanceStyle,
      deleteTemplate: store.deleteTemplate, projectCapabilities: { canSubmitTemplateRevisions: true, canPublishSharedLibrary: false },
      setGeneratorSelectedTemplateId: vi.fn(), setTemplateEditorSelectedTemplateId: vi.fn(),
      storedCards: [], templates: [source], toast: vi.fn(),
    });
    return null;
  }
  try {
    renderToStaticMarkup(createElement(Probe));
    const pending = actions.handleSaveTemplate({ ...source, name: 'Authored snapshot' });
    const committed = selectAllTemplates(useProjectStore.getState()).find(row => row.id === source.id)!;
    expect(committed).toMatchObject({ id: source.id, name: 'Authored snapshot', templateSource: 'user', templateLibrarySource: 'personal', templateRegistryStatus: 'draft', templateParentRevisionId: 'published-3' });
    expect(committed.templateRevisionId).not.toBe(source.templateRevisionId);
    expect(sync).toHaveBeenCalledWith(committed);
    // A later project write cannot become the receipt for this earlier save.
    useProjectStore.getState().addOrUpdateTemplate({ ...committed, name: 'Later persisted change' });
    acknowledge();
    const receipt = await pending;
    expect(receipt).toEqual({ id: source.id, template: committed });
    expect(receipt.template?.name).toBe('Authored snapshot');
  } finally {
    useProjectStore.setState(previous, true);
  }
});
