import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { useAccountLibraryActions } from '@/features/storage-management/hooks/useAccountLibraryActions';
const f = vi.hoisted(() => ({ install: vi.fn(() => 'independent-local-id'), open: vi.fn(), toast: vi.fn() }));
vi.mock('@/features/project/client/libraryWorkspace', () => ({ useProjectLibraryWorkspace: () => ({ actions: { installTemplate: f.install, openTemplateDesign: f.open } }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: f.toast }) }));
it('native Test exact revision handoff keeps local ownership and carries source only through Design session props', async () => {
  const source = { id: 'shared-template', name: 'Shared specimen', templateSource: 'default', templateRevision: 2, templateRevisionId: 'revision-two' };
  const setDesignSource = vi.fn(); const routerReplace = vi.fn(); const openTool = vi.fn();
  const input = {
    activeScope: 'pipeline', activeTool: null, activeLoading: false,
    currentItem: { scope: 'pipeline', id: 'pipeline-lineage', name: 'Shared specimen', pipeline: { submission: { id: '10000000-0000-4000-8000-000000000002' }, template: source, ownership: 'other' } },
    experience: { signedIn: true, owner: false, contributor: { canSubmit: false }, capabilities: { canUseProjectFiles: true } },
    projection: { router: { replace: routerReplace } }, setDesignSource, openTool,
    closeDetail: vi.fn(), setDesignReturnFocusId: vi.fn(),
  } as unknown as Parameters<typeof useAccountLibraryActions>[0];
  let controller: ReturnType<typeof useAccountLibraryActions>;
  function Probe() { controller = useAccountLibraryActions(input); return null; }
  renderToString(createElement(Probe));
  controller!.runAction(controller!.actions.find(action => action.id === 'library.test-pipeline')!);
  await vi.waitFor(() => expect(setDesignSource).toHaveBeenCalledWith({ localTemplateId: 'independent-local-id', submissionId: '10000000-0000-4000-8000-000000000002' }));
  expect(f.install).toHaveBeenCalledWith({ ...source, id: null }, 'user');
  expect(f.open).toHaveBeenCalledWith('independent-local-id'); expect(openTool).toHaveBeenCalledWith('design', ['independent-local-id']);
  expect(source).not.toHaveProperty('pipelineDesignSource');
  expect(routerReplace).toHaveBeenCalledWith('/account?section=library&scope=pipeline&tool=design&artifact=independent-local-id');
});
