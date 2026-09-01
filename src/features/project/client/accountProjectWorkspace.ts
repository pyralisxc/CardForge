import type { ReactNode } from 'react';

import {
  applyGuestWorkspaceAdoption,
  inspectGuestWorkspaceAdoption,
  type GuestWorkspaceAdoptionOffer,
} from '../persistence/guestWorkspaceAdoption';
import {
  BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT,
  type ProjectPersistenceScope,
} from '../persistence/projectPersistenceScope';
import { BROWSER_WORKSPACE_CONFLICT_EVENT } from '../persistence/indexedDbStorage';
import type { GuestWorkspaceAdoptionChoice } from '../persistence/workspaceRevision';
import { hydrateProjectWorkspaceForScope } from '../store/workspaceStore';

export type AccountProjectWorkspaceBootstrapResult =
  | { kind: 'ready' }
  | { kind: 'adoption-required'; offer: GuestWorkspaceAdoptionOffer };

interface AccountProjectWorkspaceBootstrapDependencies {
  inspectAdoption: typeof inspectGuestWorkspaceAdoption;
  hydrate: typeof hydrateProjectWorkspaceForScope;
}

interface AccountProjectWorkspaceResolutionDependencies {
  applyAdoption: typeof applyGuestWorkspaceAdoption;
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
}

export const prepareAccountProjectWorkspace = async (
  persistenceScope: ProjectPersistenceScope,
  dependencies: AccountProjectWorkspaceBootstrapDependencies = {
    inspectAdoption: inspectGuestWorkspaceAdoption,
    hydrate: hydrateProjectWorkspaceForScope,
  },
): Promise<AccountProjectWorkspaceBootstrapResult> => {
  const offer = await dependencies.inspectAdoption(persistenceScope);
  if (offer) return { kind: 'adoption-required', offer };
  await dependencies.hydrate(persistenceScope);
  return { kind: 'ready' };
};

export const resolveAccountProjectWorkspaceAdoption = async ({
  persistenceScope,
  choice,
  dependencies = {
    applyAdoption: applyGuestWorkspaceAdoption,
    hydrate: hydrateProjectWorkspaceForScope,
  },
}: {
  persistenceScope: ProjectPersistenceScope;
  choice: GuestWorkspaceAdoptionChoice;
  dependencies?: AccountProjectWorkspaceResolutionDependencies;
}): Promise<void> => {
  await dependencies.applyAdoption({ accountScope: persistenceScope, choice });
  await dependencies.hydrate(persistenceScope);
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
