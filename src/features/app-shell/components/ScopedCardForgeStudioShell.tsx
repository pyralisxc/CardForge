"use client";

import { useEffect, useState } from 'react';

import { CardForgeWorkspaceState } from '@/components/ui/cardforge-presentation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  applyGuestWorkspaceAdoption,
  hydrateProjectWorkspaceForScope,
  inspectGuestWorkspaceAdoption,
  type GuestWorkspaceAdoptionChoice,
  type GuestWorkspaceAdoptionOffer,
  type ProjectPersistenceScope,
} from '@/features/project/client';
import { CardForgeStudioShell, type StudioBusinessIdentity } from './CardForgeStudioShell';
import { StudioFontFaces } from './StudioFontFaces';
import type { ContributorAccessSessionState } from '@/features/contributor-access/client';

export function ScopedCardForgeStudioShell({
  businessIdentity,
  initialContributorAccess,
  persistenceScope,
}: {
  businessIdentity: StudioBusinessIdentity;
  initialContributorAccess: ContributorAccessSessionState;
  persistenceScope: ProjectPersistenceScope;
}) {
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [adoptionOffer, setAdoptionOffer] = useState<GuestWorkspaceAdoptionOffer | null>(null);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);
  const [isResolvingAdoption, setIsResolvingAdoption] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsWorkspaceReady(false);
    setAdoptionOffer(null);
    setAdoptionError(null);

    void inspectGuestWorkspaceAdoption(persistenceScope)
      .then(async (offer) => {
        if (cancelled) return;
        if (offer) {
          setAdoptionOffer(offer);
          return;
        }
        await hydrateProjectWorkspaceForScope(persistenceScope);
        if (!cancelled) setIsWorkspaceReady(true);
      })
      .catch((error) => {
        console.error('Unable to hydrate the scoped CardForge workspace.', error);
        if (!cancelled) setAdoptionError(error instanceof Error ? error.message : 'The browser workspace could not be restored.');
      });

    return () => {
      cancelled = true;
    };
  }, [persistenceScope]);

  const resolveAdoption = async (choice: GuestWorkspaceAdoptionChoice) => {
    setIsResolvingAdoption(true);
    setAdoptionError(null);
    try {
      await applyGuestWorkspaceAdoption({ accountScope: persistenceScope, choice });
      await hydrateProjectWorkspaceForScope(persistenceScope);
      setAdoptionOffer(null);
      setIsWorkspaceReady(true);
    } catch (error) {
      setAdoptionError(error instanceof Error ? error.message : 'CardForge could not adopt the guest workspace safely.');
    } finally {
      setIsResolvingAdoption(false);
    }
  };

  if (!isWorkspaceReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--cf-canvas)] px-5 py-12 text-[var(--cf-text)]">
        <CardForgeWorkspaceState
          state="loading"
          message="Restoring your Studio workspace. CardForge is loading the workspace saved for this account before starting the editor."
          className="grid min-h-0 w-full max-w-md place-items-center text-center"
        />
        {adoptionOffer ? (
          <AlertDialog open>
            <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
              <AlertDialogHeader>
                <AlertDialogTitle>Keep your guest work?</AlertDialogTitle>
                <AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">
                  This browser has work created before you signed in. Choose whether to use it for this account or keep {adoptionOffer.hasAccountWorkspace ? 'the account workspace already saved here' : 'this account workspace empty'}. CardForge will not combine or replace either workspace without this choice.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {adoptionError ? <p role="alert" className="text-sm text-destructive">{adoptionError}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isResolvingAdoption} onClick={() => void resolveAdoption('keep-account-workspace')}>
                  Keep account workspace
                </AlertDialogCancel>
                <AlertDialogAction disabled={isResolvingAdoption} onClick={() => void resolveAdoption('replace-with-guest-workspace')}>
                  Use guest work
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {!adoptionOffer && adoptionError ? <p role="alert" className="max-w-md text-center text-sm text-destructive">{adoptionError}</p> : null}
      </main>
    );
  }

  return (
    <div className="cardforge-application-viewport cardforge-studio-workspace">
      <StudioFontFaces />
      <CardForgeStudioShell
        businessIdentity={businessIdentity}
        initialContributorAccess={initialContributorAccess}
      />
    </div>
  );
}
