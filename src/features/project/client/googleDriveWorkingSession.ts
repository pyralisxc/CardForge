"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError } from '@/infrastructure/http/clientResponses';
import type { StudioAutosaveDelaySeconds } from '@/features/experience-settings/client';

import type { GoogleDriveProjectSummary } from '../model/googleDriveProject';
import type { ProjectDocumentV1 } from '../model/projectDocument';
import { useProjectStore } from '../store/workspaceStore';
import { getProjectPersistenceScope, getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import { repairConfirmedGoogleDriveLink } from './googleDriveLinkRepair';
import { hasProjectDocumentStateChanged } from './projectWorkspaceDocument';
import {
  GOOGLE_DRIVE_WORKING_COPY_REFRESHED_EVENT,
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
const unverifiedBaselineMessage = 'Cannot compare this browser copy with Drive · Use Save & move for a copy or compare first';
const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const workspaceChangeMessage = (scheduled: boolean) => scheduled
  ? 'Workspace changed · Autosave check scheduled'
  : 'Workspace changed · Save to check this Set';

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
  autosave,
  renderThumbnail,
}: {
  setId: string | null;
  name: string;
  enabled?: boolean;
  autosave?: { enabled: boolean; delaySeconds: StudioAutosaveDelaySeconds; isEnabled: () => boolean };
  renderThumbnail?: (document: ProjectDocumentV1) => Promise<string | null>;
}) {
  const scope = getProjectPersistenceScope();
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;
  const thumbnailRef = useRef(renderThumbnail);
  thumbnailRef.current = renderThumbnail;
  const [state, setState] = useState<GoogleDriveWorkingSessionState>(initialState);
  const bindingRef = useRef<GoogleDriveProjectBinding | null>(null);
  const writableRef = useRef<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const automaticSaveRef = useRef<AbortController | null>(null);
  const queuedRef = useRef<false | 'manual' | 'automatic'>(false);
  const generationRef = useRef(0);
  const saveNowRef = useRef<(options?: { automatic?: boolean }) => Promise<void>>(async () => undefined);
  const scheduleSaveRef = useRef<() => boolean>(() => false);
  const localCheckRef = useRef(0);
  const reconcileRef = useRef<() => Promise<void>>(async () => undefined);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const drainSaveQueue = useCallback((generation: number) => {
    if (generation !== generationRef.current || inFlightRef.current) return;
    const queued = queuedRef.current;
    queuedRef.current = false;
    if (queued === 'manual') {
      clearTimer();
      void saveNowRef.current();
    } else if (queued === 'automatic') scheduleSaveRef.current();
  }, [clearTimer]);

  /** Persisted per-Set location wins over a cached hook binding. */
  const readCurrentBinding = useCallback(async (generation: number) => {
    if (!setId) return { valid: false, binding: null as GoogleDriveProjectBinding | null };
    const binding = await getGoogleDriveWorkBinding(setId);
    if (generation !== generationRef.current || scope !== getProjectPersistenceScope()) return { valid: false, binding: null as GoogleDriveProjectBinding | null };
    if (!isSameGoogleDriveTarget(bindingRef.current, binding)) {
      bindingRef.current = binding;
      writableRef.current = null;
    }
    return { valid: true, binding };
  }, [scope, setId]);

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

  const saveNow = useCallback(async ({ automatic = false }: { automatic?: boolean } = {}) => {
    if (!enabled || !setId) return;
    const isAuthorized = () => scope === getProjectPersistenceScope()
      && (!automatic || autosaveRef.current?.isEnabled() === true);
    if (!isAuthorized()) return;
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
        if (!automatic) queuedRef.current = 'manual';
        else if (!queuedRef.current) queuedRef.current = 'automatic';
        await inFlightRef.current;
        drainSaveQueue(generation);
        return;
      }
      const run = (async () => {
        const current = await readCurrentBinding(generation);
        if (!current.valid) return;
        const binding = current.binding;
        await waitForGoogleDriveTargetSave(binding, undefined, setId);
        if (!await canPublishForBinding(binding, generation)) return;
        if (!isAuthorized()) return;
        if (!binding) {
          setState({ phase: 'unlinked', message: 'Browser work', receipt: null });
          return;
        }
        if (!binding.localProjectRevision) {
          clearTimer();
          setState({ phase: 'dirty', message: unverifiedBaselineMessage, receipt: binding });
          return;
        }
        let dirty: boolean;
        const checkedEdit = localCheckRef.current;
        try {
          dirty = await hasGoogleDriveWorkingChanges(binding);
        } catch (error) {
          if (await canPublishForBinding(binding, generation)) setState(stateForError(error));
          return;
        }
        if (!await canPublishForBinding(binding, generation)) return;
        if (!dirty) {
          if (generation === generationRef.current && checkedEdit === localCheckRef.current) setState({ phase: 'clean', message: 'Saved to Drive', receipt: binding });
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
        if (!isAuthorized()) return;
        if (automatic) {
          const latest = await readCurrentBinding(generation);
          if (!latest.valid || !isAuthorized()) return;
          if (!latest.binding?.localProjectRevision) {
            if (latest.binding && isSameGoogleDriveTarget(latest.binding, binding) && !holdUnresolvedDriveSave(latest.binding)) {
              setState({ phase: 'dirty', message: unverifiedBaselineMessage, receipt: latest.binding });
            }
            return;
          }
          if (latest.binding.localProjectRevision !== binding.localProjectRevision) return;
        }
        if (generation === generationRef.current) setState({ phase: 'saving', message: 'Saving to Drive…', receipt: binding });
        try {
          const controller = automatic ? new AbortController() : null;
          automaticSaveRef.current = controller;
          const saved = await saveCardSetToGoogleDrive({ setId, name, expectedBinding: binding,
            ...(thumbnailRef.current ? { renderThumbnail: thumbnailRef.current } : {}),
            expectedLocalProjectRevision: binding.localProjectRevision,
            ...(controller ? { signal: controller.signal } : {}) });
          if (await canPublishForBinding(saved, generation)) {
            bindingRef.current = saved;
            const checkedSavedEdit = localCheckRef.current;
            const changedSinceSave = await hasGoogleDriveWorkingChanges(saved);
            if (!await canPublishForBinding(saved, generation)) return;
            const stillDirty = changedSinceSave || checkedSavedEdit !== localCheckRef.current;
            const offline = stillDirty && browserOffline();
            const scheduled = stillDirty && !offline && scheduleSaveRef.current();
            setState(stillDirty
              ? offline ? { phase: 'offline', message: changedSinceSave ? 'Offline · Drive save pending' : 'Offline · Set changes not checked', receipt: saved }
                : { phase: 'dirty', message: changedSinceSave ? (scheduled ? 'Local changes · Autosave scheduled' : 'Unsaved changes · Save to Drive') : workspaceChangeMessage(scheduled), receipt: saved }
              : { phase: 'clean', message: 'Saved to Drive', receipt: saved });
          }
        } catch (error) {
          if (automatic && error instanceof DOMException && error.name === 'AbortError') {
            const latest = await readCurrentBinding(generation);
            if (latest.valid) setState({ phase: 'dirty', message: 'Unsaved changes · Save to Drive', receipt: latest.binding });
            return;
          }
          if (shouldPauseGoogleDriveAutosaveForError(error)) {
            writableRef.current = false;
            queuedRef.current = false;
            clearTimer();
          }
          const latest = await readCurrentBinding(generation);
          if (latest.valid && isSameGoogleDriveTarget(latest.binding, binding)) {
            if (!holdUnresolvedDriveSave(latest.binding)) setState(stateForError(error));
          }
        } finally {
          automaticSaveRef.current = null;
        }
      })();
      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
        drainSaveQueue(generation);
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
  }, [canPublishForBinding, clearTimer, drainSaveQueue, enabled, holdUnresolvedDriveSave, name, readCurrentBinding, scope, setId]);
  saveNowRef.current = saveNow;

  const scheduleSave = useCallback(() => {
    // A local Set can change while its Drive binding is still being resolved.
    // Never turn that ordinary browser work into a false Drive-pending state;
    // reconcile() will schedule the save if it finds a real linked document.
    if (!enabled || !setId || writableRef.current === false || !bindingRef.current?.localProjectRevision) return false;
    clearTimer();
    if (browserOffline()) return false;
    const current = autosaveRef.current;
    if (!current?.enabled || !current.isEnabled()) return false;
    // Store subscriptions include camera, selection, and other UI-only changes.
    // Keep the visible receipt authoritative until saveNow compares the canonical
    // project package and proves that the linked document is actually dirty.
    timerRef.current = setTimeout(() => { void saveNowRef.current({ automatic: true }); }, current.delaySeconds * 1_000);
    return true;
  }, [clearTimer, enabled, setId]);
  scheduleSaveRef.current = scheduleSave;

  const checkLocalChanges = useCallback(() => {
    const binding = bindingRef.current;
    if (!enabled || !setId || !binding || writableRef.current === false || scope !== getProjectPersistenceScope()) return;
    localCheckRef.current += 1;
    if (holdUnresolvedDriveSave(binding)) return;
    if (inFlightRef.current) {
      if (!queuedRef.current && autosaveRef.current?.isEnabled()) queuedRef.current = 'automatic';
      setState(current => current.phase === 'saving'
        ? { ...current, message: 'Saving earlier edits · workspace changed' }
        : { phase: 'dirty', message: workspaceChangeMessage(false), receipt: binding });
      return;
    }
    if (!binding.localProjectRevision && !inFlightRef.current) {
      clearTimer();
      setState({ phase: 'dirty', message: unverifiedBaselineMessage, receipt: binding });
      return;
    }
    if (browserOffline()) {
      queuedRef.current = false;
      clearTimer();
      setState((current) => ({ phase: 'offline', message: (current.phase === 'dirty' && !current.message.startsWith('Workspace changed ·')) || (current.phase === 'offline' && current.message === 'Offline · Drive save pending') ? 'Offline · Drive save pending' : 'Offline · Set changes not checked', receipt: binding }));
      return;
    }
    const scheduled = scheduleSave();
    setState({ phase: 'dirty', message: workspaceChangeMessage(scheduled), receipt: binding });
  }, [clearTimer, enabled, holdUnresolvedDriveSave, scheduleSave, scope, setId]);

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
        if (!check.binding.localProjectRevision) {
          clearTimer();
          setState({ phase: 'dirty', message: unverifiedBaselineMessage, receipt: check.binding });
          return;
        }
        const checkedEdit = localCheckRef.current;
        const dirty = await hasGoogleDriveWorkingChanges(check.binding);
        if (!await canPublishForBinding(check.binding, generation) || checkedEdit !== localCheckRef.current) return;
        const offline = dirty && browserOffline();
        const scheduled = dirty && !offline && scheduleSave();
        setState(dirty
          ? offline ? { phase: 'offline', message: 'Offline · Drive save pending', receipt: check.binding }
            : { phase: 'dirty', message: scheduled ? 'Local changes · Autosave scheduled' : 'Unsaved changes · Save to Drive', receipt: check.binding }
          : { phase: 'clean', message: 'Saved to Drive', receipt: check.binding });
        if (!dirty) clearTimer();
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
      if (hasProjectDocumentStateChanged(previous, current)) void checkLocalChanges();
    });
    const onWorkingCopyRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ workId: string; namespace: string }>).detail;
      if (detail?.workId === setId && detail.namespace === getScopedProjectStorageNamespace('project-assets')) void reconcile();
    };
    const onFocus = () => { void reconcile(); };
    const onOnline = () => {
      queuedRef.current = false;
      // Reconciliation owns the dirty check and schedules exactly one save when
      // browser work actually differs. Scheduling unconditionally here briefly
      // presented a clean, refreshed Set as pending Drive work after reconnect.
      void reconcile();
    };
    const onOffline = () => {
      clearTimer();
      if (!inFlightRef.current) queuedRef.current = false;
      setState((current) => current.phase === 'dirty' && current.message !== unverifiedBaselineMessage
        ? { phase: 'offline', message: current.message.startsWith('Workspace changed ·') ? 'Offline · Set changes not checked' : 'Offline · Drive save pending', receipt: current.receipt }
        : current);
    };
    const refreshInterval = window.setInterval(() => {
      void pollRemote();
    }, GOOGLE_DRIVE_SHARED_FILE_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(GOOGLE_DRIVE_WORKING_COPY_REFRESHED_EVENT, onWorkingCopyRefreshed);
    return () => {
      generationRef.current += 1;
      automaticSaveRef.current?.abort();
      clearTimer();
      unsubscribe();
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(GOOGLE_DRIVE_WORKING_COPY_REFRESHED_EVENT, onWorkingCopyRefreshed);
    };
  }, [checkLocalChanges, clearTimer, enabled, pollRemote, reconcile, setId]);

  useEffect(() => {
    clearTimer();
    if (!autosave?.enabled) automaticSaveRef.current?.abort();
    const scheduled = autosave?.enabled ? scheduleSave() : false;
    setState((current) => current.phase === 'dirty' && current.message !== unverifiedBaselineMessage ? { ...current, message: current.message.startsWith('Workspace changed ·')
      ? workspaceChangeMessage(scheduled) : scheduled ? 'Local changes · Autosave scheduled' : 'Unsaved changes · Save to Drive' } : current);
  }, [autosave?.delaySeconds, autosave?.enabled, clearTimer, scheduleSave]);

  return { state, saveNow, reconcile, repairLink };
}
