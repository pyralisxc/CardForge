"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError } from '@/infrastructure/http/clientResponses';

import type { GoogleDriveProjectSummary } from '../model/googleDriveProject';
import { useProjectStore } from '../store/workspaceStore';
import { repairConfirmedGoogleDriveLink } from './googleDriveLinkRepair';
import {
  GoogleDriveSaveLinkageError,
  getGoogleDriveWorkBinding,
  hasGoogleDriveWorkingChanges,
  loadGoogleDriveProjectLibrary,
  refreshGoogleDriveProject,
  saveCardSetToGoogleDrive,
  type GoogleDriveProjectBinding,
} from './googleDriveProjectTransfer';

const DRIVE_AUTOSAVE_DELAY_MS = 4_000;

export type GoogleDriveWorkingSessionPhase =
  | 'unlinked'
  | 'checking'
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'offline'
  | 'read-only'
  | 'remote-changed'
  | 'recovery-required'
  | 'error';

export interface GoogleDriveWorkingSessionState {
  phase: GoogleDriveWorkingSessionPhase;
  message: string;
  receipt: GoogleDriveProjectBinding | null;
}

export interface GoogleDriveBindingCheck {
  kind: 'unlinked' | 'current' | 'changed' | 'missing';
  binding: GoogleDriveProjectBinding | null;
  project: GoogleDriveProjectSummary | null;
}

const initialState: GoogleDriveWorkingSessionState = {
  phase: 'checking',
  message: 'Checking Drive document',
  receipt: null,
};

const canWriteProject = (project: GoogleDriveProjectSummary | null) => (
  !project?.capabilities || (project.capabilities.canEdit && project.capabilities.canModifyContent)
);

export const revalidateGoogleDriveWorkBinding = async (workId: string): Promise<GoogleDriveBindingCheck> => {
  const binding = await getGoogleDriveWorkBinding(workId);
  if (!binding) return { kind: 'unlinked', binding: null, project: null };
  const library = await loadGoogleDriveProjectLibrary();
  const project = library.projects.find((candidate) => candidate.fileId === binding.fileId
    && (!binding.accountId || candidate.accountId === binding.accountId)) ?? null;
  if (!project) return { kind: 'missing', binding, project: null };
  return {
    kind: project.providerRevision === binding.providerRevision
      && project.projectRevision === binding.projectRevision
      ? 'current'
      : 'changed',
    binding,
    project,
  };
};

const stateForError = (error: unknown): GoogleDriveWorkingSessionState => {
  if (error instanceof GoogleDriveSaveLinkageError) {
    return {
      phase: 'recovery-required',
      message: 'Drive saved this revision, but the browser link needs repair before another save.',
      receipt: structuredClone(error.sourceReceipt),
    };
  }
  if (error instanceof ApiClientError) {
    if (error.kind === 'conflict') return { phase: 'remote-changed', message: error.message, receipt: null };
    if (error.kind === 'authorization') return { phase: 'read-only', message: `${error.message}${error.nextAction ? ` ${error.nextAction}` : ''}`, receipt: null };
    if (error.kind === 'authentication') {
      return { phase: 'error', message: `${error.message}${error.nextAction ? ` ${error.nextAction}` : ''}`, receipt: null };
    }
  }
  return {
    phase: 'error',
    message: error instanceof Error ? error.message : 'Drive could not save this revision.',
    receipt: null,
  };
};

/**
 * A focused Drive Set behaves like one provider-backed document. Browser state
 * remains the fast working/cache layer, while acknowledged Drive revisions are
 * the durable source receipt. Writes are serialized and coalesced: authored
 * mutations during an upload schedule one later checkpoint instead of racing
 * or uploading on every keystroke.
 */
export function useGoogleDriveWorkingSession({
  setId,
  name,
  enabled = true,
}: {
  setId: string | null;
  name: string;
  enabled?: boolean;
}) {
  const [state, setState] = useState<GoogleDriveWorkingSessionState>(initialState);
  const bindingRef = useRef<GoogleDriveProjectBinding | null>(null);
  const writableRef = useRef<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);
  const generationRef = useRef(0);
  const saveNowRef = useRef<() => Promise<void>>(async () => undefined);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const saveNow = useCallback(async () => {
    if (!enabled || !setId || writableRef.current === false) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      await inFlightRef.current;
      return;
    }
    const generation = generationRef.current;
    const run = (async () => {
      const binding = bindingRef.current ?? await getGoogleDriveWorkBinding(setId);
      bindingRef.current = binding;
      if (!binding) {
        setState({ phase: 'unlinked', message: 'Browser work', receipt: null });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setState({ phase: 'offline', message: 'Offline · Drive save pending', receipt: binding });
        queuedRef.current = true;
        return;
      }
      let dirty: boolean;
      try {
        dirty = await hasGoogleDriveWorkingChanges(binding);
      } catch (error) {
        if (generation === generationRef.current) setState(stateForError(error));
        return;
      }
      if (!dirty) {
        if (generation === generationRef.current) setState({ phase: 'clean', message: 'Saved to Drive', receipt: binding });
        return;
      }
      if (generation === generationRef.current) setState({ phase: 'saving', message: 'Saving to Drive…', receipt: binding });
      try {
        const saved = await saveCardSetToGoogleDrive({ setId, name });
        bindingRef.current = saved;
        if (generation === generationRef.current) setState({ phase: 'clean', message: 'Saved to Drive', receipt: saved });
      } catch (error) {
        if (error instanceof GoogleDriveSaveLinkageError) {
          writableRef.current = false;
          queuedRef.current = false;
          clearTimer();
        }
        if (generation === generationRef.current) setState(stateForError(error));
      }
    })();
    inFlightRef.current = run;
    try {
      await run;
    } finally {
      if (inFlightRef.current === run) inFlightRef.current = null;
      if (queuedRef.current && generation === generationRef.current && writableRef.current !== false) {
        queuedRef.current = false;
        clearTimer();
        timerRef.current = setTimeout(() => { void saveNowRef.current(); }, DRIVE_AUTOSAVE_DELAY_MS);
      }
    }
  }, [clearTimer, enabled, name, setId]);
  saveNowRef.current = saveNow;

  const scheduleSave = useCallback(() => {
    if (!enabled || !setId || writableRef.current === false) return;
    clearTimer();
    setState((current) => current.phase === 'saving'
      ? current
      : { phase: 'dirty', message: 'Changes waiting for Drive', receipt: current.receipt });
    timerRef.current = setTimeout(() => { void saveNowRef.current(); }, DRIVE_AUTOSAVE_DELAY_MS);
  }, [clearTimer, enabled, setId]);

  const reconcile = useCallback(async () => {
    if (!enabled || !setId) return;
    const generation = generationRef.current;
    try {
      const check = await revalidateGoogleDriveWorkBinding(setId);
      if (generation !== generationRef.current) return;
      bindingRef.current = check.binding;
      if (check.kind === 'unlinked') {
        writableRef.current = null;
        setState({ phase: 'unlinked', message: 'Browser work', receipt: null });
        return;
      }
      if (check.kind === 'missing') {
        writableRef.current = false;
        setState({ phase: 'error', message: 'The linked Drive document is unavailable or moved. Check Drive before saving.', receipt: check.binding });
        return;
      }
      writableRef.current = canWriteProject(check.project);
      if (!writableRef.current) {
        clearTimer();
        queuedRef.current = false;
        setState({ phase: 'read-only', message: 'Drive is read-only for your current role. You can inspect this Set or save an independent copy to a writable location.', receipt: check.binding });
        return;
      }
      if (check.kind === 'changed' && check.binding) {
        const dirty = await hasGoogleDriveWorkingChanges(check.binding);
        if (generation !== generationRef.current) return;
        if (dirty) {
          setState({ phase: 'remote-changed', message: 'Drive changed while this browser also has edits. Compare or refresh before saving.', receipt: check.binding });
          return;
        }
        setState({ phase: 'checking', message: 'Refreshing newer Drive revision…', receipt: check.binding });
        const refreshed = await refreshGoogleDriveProject(check.binding);
        if (generation === generationRef.current) {
          bindingRef.current = refreshed;
          setState({ phase: 'clean', message: 'Drive revision refreshed', receipt: refreshed });
        }
        return;
      }
      if (check.binding) {
        const dirty = await hasGoogleDriveWorkingChanges(check.binding);
        if (generation !== generationRef.current) return;
        setState(dirty
          ? { phase: 'dirty', message: 'Changes waiting for Drive', receipt: check.binding }
          : { phase: 'clean', message: 'Saved to Drive', receipt: check.binding });
        if (dirty) scheduleSave();
      }
    } catch (error) {
      if (generation === generationRef.current) setState(stateForError(error));
    }
  }, [clearTimer, enabled, scheduleSave, setId]);

  const repairLink = useCallback(async () => {
    const receipt = state.receipt;
    if (!receipt || state.phase !== 'recovery-required') return;
    setState({ phase: 'checking', message: 'Repairing the confirmed Drive link…', receipt });
    try {
      const repaired = await repairConfirmedGoogleDriveLink(receipt);
      bindingRef.current = repaired;
      writableRef.current = true;
      queuedRef.current = false;
      setState({ phase: 'clean', message: 'Drive link repaired · revision already saved', receipt: repaired });
    } catch (error) {
      writableRef.current = false;
      setState({
        phase: 'recovery-required',
        message: error instanceof Error ? error.message : 'The Drive link still needs repair. The provider receipt was kept.',
        receipt,
      });
    }
  }, [state.phase, state.receipt]);

  useEffect(() => {
    generationRef.current += 1;
    bindingRef.current = null;
    writableRef.current = null;
    queuedRef.current = false;
    clearTimer();
    if (!enabled || !setId) {
      setState({ phase: 'unlinked', message: 'Browser work', receipt: null });
      return;
    }
    setState(initialState);
    void reconcile();
    const unsubscribe = useProjectStore.subscribe(() => scheduleSave());
    const onFocus = () => { void reconcile(); };
    const onOnline = () => {
      queuedRef.current = false;
      void reconcile().then(() => scheduleSave());
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      generationRef.current += 1;
      clearTimer();
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [clearTimer, enabled, reconcile, scheduleSave, setId]);

  return { state, saveNow, reconcile, repairLink };
}
