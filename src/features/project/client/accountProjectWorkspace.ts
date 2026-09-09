import type { ReactNode } from 'react';

import { adoptGuestWorkspaceForAccount } from '../persistence/guestWorkspaceAdoption';
import {
  BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT,
  type ProjectPersistenceScope,
} from '../persistence/projectPersistenceScope';
import { BROWSER_WORKSPACE_CONFLICT_EVENT } from '../persistence/indexedDbStorage';
import { hydrateProjectWorkspaceForScope } from '../store/workspaceStore';

interface AccountProjectWorkspaceBootstrapDependencies {
  adopt: typeof adoptGuestWorkspaceForAccount;
  hydrate: typeof hydrateProjectWorkspaceForScope;
}

export interface AccountProjectWorkspaceIssue {
  kind: 'conflict' | 'remote-change';
  title: string;
  message: string;
}

export interface AccountProjectWorkspaceBoundaryProps {
  children: ReactNode;
  persistenceScope: ProjectPersistenceScope;
  canUseProjectFiles: boolean;
}

export const prepareAccountProjectWorkspace = async (
  persistenceScope: ProjectPersistenceScope,
  dependencies: AccountProjectWorkspaceBootstrapDependencies = {
    adopt: adoptGuestWorkspaceForAccount,
    hydrate: hydrateProjectWorkspaceForScope,
  },
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  await dependencies.adopt(persistenceScope, signal);
  signal?.throwIfAborted();
  await dependencies.hydrate(persistenceScope, signal);
  signal?.throwIfAborted();
};

const getWorkspaceIssue = (eventName: string): AccountProjectWorkspaceIssue => eventName === BROWSER_WORKSPACE_CONFLICT_EVENT
  ? {
      kind: 'conflict',
      title: 'This workspace was not saved',
      message: 'Another tab saved a newer copy first. Keep this tab open if it contains work you need, then export or save that work somewhere else before loading the newer browser copy.',
    }
  : {
      kind: 'remote-change',
      title: 'A newer workspace is available',
      message: 'Another tab saved this account workspace. Reload to use that copy, or keep this tab open and export any work you need before reloading.',
    };

export const subscribeToAccountProjectWorkspaceIssues = (
  listener: (issue: AccountProjectWorkspaceIssue) => void,
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null = typeof window === 'undefined' ? null : window,
): (() => void) => {
  if (!target) return () => undefined;
  const onConflict = () => listener(getWorkspaceIssue(BROWSER_WORKSPACE_CONFLICT_EVENT));
  const onRemoteChange = () => listener(getWorkspaceIssue(BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT));
  target.addEventListener(BROWSER_WORKSPACE_CONFLICT_EVENT, onConflict);
  target.addEventListener(BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT, onRemoteChange);
  return () => {
    target.removeEventListener(BROWSER_WORKSPACE_CONFLICT_EVENT, onConflict);
    target.removeEventListener(BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT, onRemoteChange);
  };
};
