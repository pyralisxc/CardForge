"use client";

import { useSession, useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getGoogleDriveWorkBinding,
  repairConfirmedGoogleDriveLink,
  type GoogleDriveProjectBinding,
  type GoogleDriveProjectSummary,
} from '@/features/project/client/provider-google-drive';

import type { DriveCollaborationClientSession } from './realtimeSession';
import { startDriveCollaborationClientSession } from './realtimeSession';

export type DriveCollaborationPhase =
  | 'unavailable'
  | 'idle'
  | 'joining'
  | 'active'
  | 'viewing'
  | 'leaving'
  | 'error';

export interface DriveCollaborationState {
  phase: DriveCollaborationPhase;
  message: string;
  participantCount: number;
  available: boolean;
  isActive: boolean;
  canEdit: boolean;
  binding: GoogleDriveProjectBinding | null;
}

const idleState = (binding: GoogleDriveProjectBinding | null): DriveCollaborationState => ({
  phase: binding ? 'idle' : 'unavailable',
  message: binding ? 'Live co-editing available' : 'Save this Set to Drive before starting live co-editing.',
  participantCount: 0,
  available: Boolean(binding),
  isActive: false,
  canEdit: false,
  binding,
});

const participantCount = (presence: Record<string, unknown[]>) => (
  Object.values(presence).reduce((total, entries) => total + entries.length, 0)
);

export function useDriveCollaborationSession({
  setId,
  enabled = true,
}: {
  setId: string | null;
  enabled?: boolean;
}) {
  const { session: clerkSession, isLoaded: sessionLoaded } = useSession();
  const { user, isLoaded: userLoaded } = useUser();
  const [state, setState] = useState<DriveCollaborationState>(idleState(null));
  const liveRef = useRef<DriveCollaborationClientSession | null>(null);
  const bindingRef = useRef<GoogleDriveProjectBinding | null>(null);
  const generationRef = useRef(0);

  const refreshAvailability = useCallback(async () => {
    if (!enabled || !setId) {
      bindingRef.current = null;
      setState(idleState(null));
      return null;
    }
    const generation = generationRef.current;
    const binding = await getGoogleDriveWorkBinding(setId);
    if (generation !== generationRef.current || liveRef.current) return binding;
    const collaborative = binding
      && binding.workId === setId
      && binding.packageScope === 'set'
      && binding.fileId
      ? binding
      : null;
    bindingRef.current = collaborative;
    setState(idleState(collaborative));
    return collaborative;
  }, [enabled, setId]);

  const stop = useCallback(async () => {
    const live = liveRef.current;
    if (!live) {
      await refreshAvailability();
      return;
    }
    liveRef.current = null;
    setState((current) => ({
      ...current,
      phase: 'leaving',
      message: 'Finishing collaborative Drive checkpoint…',
      isActive: true,
    }));
    await live.destroy();
    await refreshAvailability();
  }, [refreshAvailability]);

  const start = useCallback(async () => {
    if (!enabled || !setId) return;
    if (liveRef.current) return;
    if (!sessionLoaded || !userLoaded || !clerkSession || !user) {
      setState((current) => ({
        ...current,
        phase: 'error',
        message: 'Sign in before starting live co-editing.',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      phase: 'joining',
      message: 'Joining live Drive session…',
    }));
    try {
      const binding = await getGoogleDriveWorkBinding(setId);
      if (!binding
        || binding.workId !== setId
        || binding.packageScope !== 'set'
        || !binding.fileId) {
        throw new Error('Save this focused Set to Google Drive before starting live co-editing.');
      }
      bindingRef.current = binding;

      const live = await startDriveCollaborationClientSession({
        fileId: binding.fileId,
        localSetId: setId,
        identities: structuredClone(binding.identities ?? {}),
        participant: {
          userId: user.id,
          label: user.fullName ?? user.firstName ?? 'Collaborator',
        },
        getClerkToken: () => clerkSession.getToken(),
        onPresenceChange: (presence) => {
          const count = participantCount(presence);
          setState((current) => {
            if (!current.isActive) return current;
            return {
              ...current,
              participantCount: count,
              message: current.canEdit
                ? `Live co-editing · ${Math.max(1, count)} here`
                : `Viewing live · ${Math.max(1, count)} here · Drive is read-only`,
            };
          });
        },
        onCheckpoint: async (source: GoogleDriveProjectSummary) => {
          const current = await getGoogleDriveWorkBinding(setId);
          const projectRevision = source.projectRevision;
          if (!current || current.fileId !== source.fileId || !projectRevision) return;
          const receipt: GoogleDriveProjectBinding = {
            ...current,
            name: source.name,
            providerRevision: source.providerRevision,
            projectRevision,
            lastSavedAt: source.modifiedAt,
            webViewLink: source.webViewLink,
          };
          bindingRef.current = await repairConfirmedGoogleDriveLink(receipt);
        },
        onError: (error) => {
          setState((current) => ({
            ...current,
            phase: 'error',
            message: error.message,
            isActive: Boolean(liveRef.current),
          }));
        },
      });

      liveRef.current = live;
      const canEdit = live.session.role === 'editor';
      const count = Math.max(1, participantCount(live.getPresence()));
      setState({
        phase: canEdit ? 'active' : 'viewing',
        message: canEdit
          ? `Live co-editing · ${count} here`
          : `Viewing live · ${count} here · Drive is read-only`,
        participantCount: count,
        available: true,
        isActive: true,
        canEdit,
        binding: bindingRef.current,
      });
    } catch (error) {
      liveRef.current = null;
      setState((current) => ({
        ...current,
        phase: 'error',
        message: error instanceof Error ? error.message : 'Unable to start live co-editing.',
        isActive: false,
      }));
    }
  }, [clerkSession, enabled, sessionLoaded, setId, user, userLoaded]);

  const checkpointNow = useCallback(async () => {
    const live = liveRef.current;
    if (!live || live.session.role !== 'editor') return;
    await live.checkpointNow();
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    if (!enabled || !setId) {
      const live = liveRef.current;
      liveRef.current = null;
      if (live) void live.destroy();
      bindingRef.current = null;
      setState(idleState(null));
      return;
    }
    if (!liveRef.current) void refreshAvailability();
    return () => {
      if (generation !== generationRef.current) return;
      const live = liveRef.current;
      liveRef.current = null;
      if (live) void live.destroy();
    };
  }, [enabled, refreshAvailability, setId]);

  return {
    state,
    start,
    stop,
    checkpointNow,
    refreshAvailability,
  };
}
