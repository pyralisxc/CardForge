"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError } from '@/infrastructure/http/clientResponses';

import type { GoogleDriveProjectSummary } from '../model/googleDriveProject';
import { useProjectStore } from '../store/workspaceStore';
import { repairConfirmedGoogleDriveLink } from './googleDriveLinkRepair';
import { hasProjectDocumentStateChanged } from './projectWorkspaceDocument';
import {
  GoogleDriveSaveLinkageError,
  GoogleDriveUnknownCommitError,
  getGoogleDriveSaveBarrier,
  isSameGoogleDriveTarget,
  waitForGoogleDriveTargetSave,
  getGoogleDriveWorkBinding,
  hasGoogleDriveWorkingChanges,
  probeGoogleDriveProject,
  refreshGoogleDriveProject,
  saveCardSetToGoogleDrive,
  type GoogleDriveProjectBinding,
} from './googleDriveProjectTransfer';

const DRIVE_AUTOSAVE_DELAY_MS = 4_000;
export const GOOGLE_DRIVE_SHARED_FILE_REFRESH_INTERVAL_MS = 30_000;

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
  // Resolve the binding before claiming this local work is a Drive document.
  message: 'Checking work location',
  receipt: null,
};

const canWriteProject = (project: GoogleDriveProjectSummary | null) => (
  !project?.capabilities || (project.capabilities.canEdit && project.capabilities.canModifyContent)
);

const isSameDriveCheckpoint = (left: GoogleDriveProjectBinding | null, right: GoogleDriveProjectBinding | null) => (
  isSameGoogleDriveTarget(left, right)
  && left?.providerRevision === right?.providerRevision
  && left?.projectRevision === right?.projectRevision
);

export const shouldApplyGoogleDriveRemoteProbe = (
  kind: GoogleDriveBindingCheck['kind'],
  currentWritable: boolean | null,
  nextWritable: boolean,
) => kind !== 'current' || currentWritable !== nextWritable;

export const shouldPauseGoogleDriveAutosaveAfterRevalidation = (
  kind: GoogleDriveBindingCheck['kind'],
  hasLocalChanges: boolean,
) => kind === 'missing' || (kind === 'changed' && hasLocalChanges);

export const shouldPauseGoogleDriveAutosaveForError = (error: unknown) => (
  error instanceof GoogleDriveSaveLinkageError
  || error instanceof GoogleDriveUnknownCommitError
  || (error instanceof ApiClientError && (
    error.kind === 'conflict'
    || error.kind === 'authorization'
    || error.kind === 'authentication'
    || error.kind === 'not_found'
    || error.kind === 'limit'
    || (error.kind === 'unavailable' && error.retryable)
  ))
);

export const shouldOfferGoogleDriveReconciliation = (phase: GoogleDriveWorkingSessionPhase) => (
  phase === 'remote-changed' || phase === 'read-only' || phase === 'error'
);

export const revalidateGoogleDriveWorkBinding = async (workId: string): Promise<GoogleDriveBindingCheck> => {
  const binding = await getGoogleDriveWorkBinding(workId);
  if (!binding) return { kind: 'unlinked', binding: null, project: null };
  let project: GoogleDriveProjectSummary;
  try {
    project = await probeGoogleDriveProject(binding);
  } catch (error) {
    if (error instanceof ApiClientError && error.kind === 'not_found') {
      return { kind: 'missing', binding, project: null };
    }
    throw error;
  }
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
  const reconcileRef = useRef<() => Promise<void>>(async () => undefined);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  /** Persisted per-Set location wins over a cached hook binding. */
  const readCurrentBinding = useCallback(async (generation: number) => {
    if (!setId) return { valid: false, binding: null as GoogleDriveProjectBinding | null };
    const binding = await getGoogleDriveWorkBinding(setId);
    if (generation !== generationRef.current) return { valid: false, binding: null as GoogleDriveProjectBinding | null };
    if (!isSameGoogleDriveTarget(bindingRef.current, binding)) {
      bindingRef.current = binding;
      writableRef.current = null;
    }
    return { valid: true, binding };
  }, [setId]);

  const holdUnresolvedDriveSave = useCallback((binding: GoogleDriveProjectBinding | null) => {
    const barrier = getGoogleDriveSaveBarrier(binding, undefined, setId ?? undefined);
    if (!barrier) return false;
    writableRef.current = false;
    queuedRef.current = false;
    clearTimer();
    setState(stateForError(barrier));
    return true;
  }, [clearTimer, setId]);

  /** Any asynchronous dirty/probe result must still belong to the current file and receipt. */
  const canPublishForBinding = useCallback(async (binding: GoogleDriveProjectBinding | null, generation: number) => {
    const first = await readCurrentBinding(generation);
    if (!first.valid || !isSameDriveCheckpoint(first.binding, binding)) return false;
    await waitForGoogleDriveTargetSave(first.binding, undefined, setId ?? undefined);
    const latest = await readCurrentBinding(generation);
    if (!latest.valid || !isSameDriveCheckpoint(latest.binding, binding)) return false;
    return !holdUnresolvedDriveSave(latest.binding);
  }, [holdUnresolvedDriveSave, readCurrentBinding, setId]);

  const saveNow = useCallback(async () => {
    if (!enabled || !setId) return;
    const generation = generationRef.current;
    try {
      const previousTarget = bindingRef.current;
      const resolved = await readCurrentBinding(generation);
      if (!resolved.valid) return;
      if (!isSameGoogleDriveTarget(previousTarget, resolved.binding)) {
        // Explicit Save as F2 replaced F: validate new source authority before autosaving.
        await reconcileRef.current();
        return;
      }
      if (writableRef.current === false) return;
      if (inFlightRef.current) {
        queuedRef.current = true;
        await inFlightRef.current;
        return;
      }
      const run = (async () => {
        const current = await readCurrentBinding(generation);
        if (!current.valid) return;
        const binding = current.binding;
        await waitForGoogleDriveTargetSave(binding, undefined, setId);
        if (!await canPublishForBinding(binding, generation)) return;
        if (!binding) {
          setState({ phase: 'unlinked', message: 'Browser work', receipt: null });
          return;
        }
        let dirty: boolean;
        try {
          dirty = await hasGoogleDriveWorkingChanges(binding);
        } catch (error) {
          if (await canPublishForBinding(binding, generation)) setState(stateForError(error));
          return;
        }
        if (!await canPublishForBinding(binding, generation)) return;
        if (!dirty) {
          if (generation === generationRef.current) setState({ phase: 'clean', message: 'Saved to Drive', receipt: binding });
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setState({ phase: 'offline', message: 'Offline · Drive save pending', receipt: binding });
          // The `online` listener resumes a dirty linked Set. Retrying every idle
          // interval while the browser remains offline only burns work and obscures
          // the actionable offline state.
          queuedRef.current = false;
          return;
        }
        if (generation === generationRef.current) setState({ phase: 'saving', message: 'Saving to Drive…', receipt: binding });
        try {
          const saved = await saveCardSetToGoogleDrive({ setId, name });
          if (await canPublishForBinding(saved, generation)) {
            bindingRef.current = saved;
            setState({ phase: 'clean', message: 'Saved to Drive', receipt: saved });
          }
        } catch (error) {
          if (shouldPauseGoogleDriveAutosaveForError(error)) {
            writableRef.current = false;
            queuedRef.current = false;
            clearTimer();
          }
          const latest = await readCurrentBinding(generation);
          if (latest.valid && isSameGoogleDriveTarget(latest.binding, binding)) {
            if (!holdUnresolvedDriveSave(latest.binding)) setState(stateForError(error));
          }
        }
      })();
      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
        if (queuedRef.current && generation === generationRef.current) {
          queuedRef.current = false;
          clearTimer();
          timerRef.current = setTimeout(() => { void saveNowRef.current(); }, DRIVE_AUTOSAVE_DELAY_MS);
        }
      }
    } catch (error) {
      // Includes scoped reads before the in-flight promise and reads in nested
      // recovery paths. Idle callbacks must never leak an unhandled rejection.
      if (generation !== generationRef.current) return;
      queuedRef.current = false;
      clearTimer();
      if (!holdUnresolvedDriveSave(bindingRef.current)) {
        setState(current => current.phase === 'recovery-required' ? current : stateForError(error));
      }
    }
  }, [canPublishForBinding, clearTimer, enabled, holdUnresolvedDriveSave, name, readCurrentBinding, setId]);
  saveNowRef.current = saveNow;

  const scheduleSave = useCallback(() => {
    // A local Set can change while its Drive binding is still being resolved.
    // Never turn that ordinary browser work into a false Drive-pending state;
    // reconcile() will schedule the save if it finds a real linked document.
    if (!enabled || !setId || writableRef.current === false || !bindingRef.current) return;
    clearTimer();
    // Store subscriptions include camera, selection, and other UI-only changes.
    // Keep the visible receipt authoritative until saveNow compares the canonical
    // project package and proves that the linked document is actually dirty.
    timerRef.current = setTimeout(() => { void saveNowRef.current(); }, DRIVE_AUTOSAVE_DELAY_MS);
  }, [clearTimer, enabled, setId]);

  const reconcile = useCallback(async (knownCheck?: GoogleDriveBindingCheck) => {
    if (!enabled || !setId) return;
    const generation = generationRef.current;
    let startedWith: GoogleDriveProjectBinding | null = null;
    try {
      if (inFlightRef.current) await inFlightRef.current;
      if (generation !== generationRef.current) return;
      let latest = await readCurrentBinding(generation);
      if (!latest.valid) return;
      startedWith = latest.binding;
      await waitForGoogleDriveTargetSave(latest.binding, undefined, setId ?? undefined);
      latest = await readCurrentBinding(generation);
      if (!latest.valid || holdUnresolvedDriveSave(latest.binding)) return;
      // A poll's checked F is stale if an explicit Save as F2 replaced its binding.
      let check = knownCheck && isSameDriveCheckpoint(knownCheck.binding, latest.binding)
        ? knownCheck : await revalidateGoogleDriveWorkBinding(setId);
      latest = await readCurrentBinding(generation);
      if (!latest.valid) return;
      if (!isSameDriveCheckpoint(check.binding, latest.binding)) {
        check = await revalidateGoogleDriveWorkBinding(setId);
        latest = await readCurrentBinding(generation);
        if (!latest.valid || !isSameDriveCheckpoint(check.binding, latest.binding)) return;
      }
      if (holdUnresolvedDriveSave(latest.binding)) return;
      bindingRef.current = latest.binding;
      if (check.kind === 'unlinked') {
        writableRef.current = null;
        setState({ phase: 'unlinked', message: 'Browser work', receipt: null });
        return;
      }
      if (check.kind === 'missing') {
        writableRef.current = false;
        queuedRef.current = false;
        clearTimer();
        setState({ phase: 'error', message: 'The linked Drive document is unavailable or moved. Check Drive before saving.', receipt: check.binding });
        return;
      }
      writableRef.current = canWriteProject(check.project);
      if (check.kind === 'changed' && check.binding) {
        const dirty = await hasGoogleDriveWorkingChanges(check.binding);
        if (!await canPublishForBinding(check.binding, generation)) return;
        if (shouldPauseGoogleDriveAutosaveAfterRevalidation(check.kind, dirty)) {
          writableRef.current = false;
          queuedRef.current = false;
          clearTimer();
          setState({ phase: 'remote-changed', message: 'Drive changed while this browser also has edits. Use Save & move for an independent copy or return to Library to compare before saving.', receipt: check.binding });
          return;
        }
        setState({ phase: 'checking', message: 'Refreshing newer Drive revision…', receipt: check.binding });
        const refreshed = await refreshGoogleDriveProject(check.binding);
        if (await canPublishForBinding(refreshed, generation)) {
          bindingRef.current = refreshed;
          setState(writableRef.current === false
            ? { phase: 'read-only', message: 'Updated from Drive · read-only', receipt: refreshed }
            : { phase: 'clean', message: 'Updated from Drive', receipt: refreshed });
        }
        return;
      }
      if (!writableRef.current) {
        clearTimer();
        queuedRef.current = false;
        setState({ phase: 'read-only', message: 'Drive is read-only for your current role. Shared saved changes will refresh automatically.', receipt: check.binding });
        return;
      }
      if (check.binding) {
        const dirty = await hasGoogleDriveWorkingChanges(check.binding);
        if (!await canPublishForBinding(check.binding, generation)) return;
        setState(dirty
          ? { phase: 'dirty', message: 'Drive save pending', receipt: check.binding }
          : { phase: 'clean', message: 'Saved to Drive', receipt: check.binding });
        if (dirty) scheduleSave();
      }
    } catch (error) {
      if (shouldPauseGoogleDriveAutosaveForError(error)) {
        writableRef.current = false;
        queuedRef.current = false;
        clearTimer();
      }
      const latest = await readCurrentBinding(generation).catch(() => ({ valid: false, binding: null as GoogleDriveProjectBinding | null }));
      if (!latest.valid) {
        if (generation === generationRef.current && !holdUnresolvedDriveSave(bindingRef.current)) setState(stateForError(error));
        return;
      }
      if (startedWith && !isSameGoogleDriveTarget(startedWith, latest.binding)) return;
      if (!holdUnresolvedDriveSave(latest.binding)) setState(stateForError(error));
    }
  }, [canPublishForBinding, clearTimer, enabled, holdUnresolvedDriveSave, readCurrentBinding, scheduleSave, setId]);
  reconcileRef.current = () => reconcile();

  const pollRemote = useCallback(async () => {
    if (!enabled || !setId || document.visibilityState !== 'visible') return;
    const generation = generationRef.current;
    try {
      if (inFlightRef.current) await inFlightRef.current;
      if (generation !== generationRef.current) return;
      let latest = await readCurrentBinding(generation);
      if (!latest.valid) return;
      await waitForGoogleDriveTargetSave(latest.binding, undefined, setId ?? undefined);
      latest = await readCurrentBinding(generation);
      if (!latest.valid || holdUnresolvedDriveSave(latest.binding)) return;
      const check = await revalidateGoogleDriveWorkBinding(setId);
      if (!await canPublishForBinding(check.binding, generation)) {
        const active = await readCurrentBinding(generation);
        if (active.valid && !isSameGoogleDriveTarget(active.binding, check.binding)) await reconcile();
        return;
      }
      const nextWritable = canWriteProject(check.project);
      if (shouldApplyGoogleDriveRemoteProbe(check.kind, writableRef.current, nextWritable)) {
        await reconcile(check);
      }
    } catch (error) {
      if (shouldPauseGoogleDriveAutosaveForError(error)) {
        writableRef.current = false;
        queuedRef.current = false;
        clearTimer();
      }
      const latest = await readCurrentBinding(generation).catch(() => ({ valid: false, binding: null as GoogleDriveProjectBinding | null }));
      if (!latest.valid) {
        if (generation === generationRef.current && !holdUnresolvedDriveSave(bindingRef.current)) setState(stateForError(error));
        return;
      }
      if (!holdUnresolvedDriveSave(latest.binding)) setState(stateForError(error));
    }
  }, [canPublishForBinding, clearTimer, enabled, holdUnresolvedDriveSave, readCurrentBinding, reconcile, setId]);

  const repairLink = useCallback(async () => {
    const receipt = state.receipt;
    if (!receipt || state.phase !== 'recovery-required' || !setId) return;
    const generation = generationRef.current;
    try {
      const current = await getGoogleDriveWorkBinding(setId);
      if (current && !isSameGoogleDriveTarget(current, receipt)) return;
      setState({ phase: 'checking', message: 'Repairing the confirmed Drive link…', receipt });
      const repaired = await repairConfirmedGoogleDriveLink(receipt);
      const latest = await getGoogleDriveWorkBinding(setId);
      if (generation !== generationRef.current) return;
      if (latest && !isSameGoogleDriveTarget(latest, repaired)) return;
      bindingRef.current = repaired;
      writableRef.current = true;
      queuedRef.current = false;
      setState({ phase: 'clean', message: 'Drive link repaired · revision already saved', receipt: repaired });
    } catch (error) {
      if (generation !== generationRef.current) return;
      writableRef.current = false;
      setState({
        phase: 'recovery-required',
        message: error instanceof Error ? error.message : 'The Drive link still needs repair. The provider receipt was kept.',
        receipt,
      });
    }
  }, [setId, state.phase, state.receipt]);

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
    const unsubscribe = useProjectStore.subscribe((current, previous) => {
      if (hasProjectDocumentStateChanged(previous, current)) scheduleSave();
    });
    const onFocus = () => { void reconcile(); };
    const onOnline = () => {
      queuedRef.current = false;
      // Reconciliation owns the dirty check and schedules exactly one save when
      // browser work actually differs. Scheduling unconditionally here briefly
      // presented a clean, refreshed Set as pending Drive work after reconnect.
      void reconcile();
    };
    const refreshInterval = window.setInterval(() => {
      void pollRemote();
    }, GOOGLE_DRIVE_SHARED_FILE_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      generationRef.current += 1;
      clearTimer();
      unsubscribe();
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [clearTimer, enabled, pollRemote, reconcile, scheduleSave, setId]);

  return { state, saveNow, reconcile, repairLink };
}
