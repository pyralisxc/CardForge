import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  prepareAccountProjectWorkspace,
  resolveAccountProjectWorkspaceAdoption,
  subscribeToAccountProjectWorkspaceIssues,
} from '@/features/project/client/accountProjectWorkspace';
import { BROWSER_WORKSPACE_CONFLICT_EVENT } from '@/features/project/persistence/indexedDbStorage';
import { BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT } from '@/features/project/persistence/projectPersistenceScope';
import { hydrateProjectWorkspaceForScope, useProjectStore } from '@/features/project/store/workspaceStore';

describe('account project workspace boundary', () => {
  it('inspects guest adoption before account hydration and blocks hydration when a choice is required', async () => {
    const calls: string[] = [];
    const result = await prepareAccountProjectWorkspace('account:user-a', {
      inspectAdoption: async () => {
        calls.push('inspect');
        return { guestRevision: 4, hasAccountWorkspace: true };
      },
      hydrate: async () => {
        calls.push('hydrate');
      },
    });

    expect(calls).toEqual(['inspect']);
    expect(result).toEqual({
      kind: 'adoption-required',
      offer: { guestRevision: 4, hasAccountWorkspace: true },
    });
  });

  it('hydrates only after inspection confirms there is no unresolved guest work', async () => {
    const calls: string[] = [];
    await expect(prepareAccountProjectWorkspace('account:user-b', {
      inspectAdoption: async () => {
        calls.push('inspect');
        return null;
      },
      hydrate: async () => {
        calls.push('hydrate');
      },
    })).resolves.toEqual({ kind: 'ready' });

    expect(calls).toEqual(['inspect', 'hydrate']);
  });

  it('records the explicit adoption choice before hydrating the selected account scope', async () => {
    const calls: string[] = [];
    await resolveAccountProjectWorkspaceAdoption({
      persistenceScope: 'account:user-c',
      choice: 'keep-account-workspace',
      dependencies: {
        applyAdoption: async (input) => {
          calls.push(`apply:${input.choice}:${input.accountScope}`);
        },
        hydrate: async (scope) => {
          calls.push(`hydrate:${scope}`);
        },
      },
    });

    expect(calls).toEqual([
      'apply:keep-account-workspace:account:user-c',
      'hydrate:account:user-c',
    ]);
  });

  it('coalesces repeated hydration requests after the account boundary has prepared the scope', async () => {
    const rehydrate = vi.spyOn(useProjectStore.persist, 'rehydrate').mockResolvedValue(undefined);

    await Promise.all([
      hydrateProjectWorkspaceForScope('account:user-coalesced'),
      hydrateProjectWorkspaceForScope('account:user-coalesced'),
    ]);
    await hydrateProjectWorkspaceForScope('account:user-coalesced');

    expect(rehydrate).toHaveBeenCalledTimes(1);
    rehydrate.mockRestore();
  });

  it('turns conflict and remote-revision events into recoverable account guidance until cleanup', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = subscribeToAccountProjectWorkspaceIssues(listener, target);

    target.dispatchEvent(new Event(BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT));
    target.dispatchEvent(new Event(BROWSER_WORKSPACE_CONFLICT_EVENT));

    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'remote-change' }));
    expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'conflict',
      message: expect.stringContaining('export or save'),
    }));

    unsubscribe();
    target.dispatchEvent(new Event(BROWSER_WORKSPACE_CONFLICT_EVENT));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('mounts the same bootstrap owner around both account Home and Library', () => {
    const accountPage = readFileSync(resolve(process.cwd(), 'src/app/account/page.tsx'), 'utf8');
    const boundary = readFileSync(resolve(process.cwd(), 'src/features/project/components/AccountProjectWorkspaceBoundary.tsx'), 'utf8');

    expect(accountPage.match(/<AccountProjectWorkspaceBoundary persistenceScope=\{persistenceScope\}>/g)).toHaveLength(2);
    expect(boundary).toContain('Keep account workspace');
    expect(boundary).toContain('Use guest work');
    expect(boundary).toContain('data-account-workspace-issue={issue.kind}');
    expect(boundary).toContain('CardForge will not reload automatically');
  });
});
