"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getProjectPersistenceScope, PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT } from '@/features/project/client/persistence-workspace';
import { createReadyHandoffGuard, prepareReadyOutputHandoff } from '../lib/outputReadyHandoff';
import { readReadyOutput, removeReadyOutput, ReadyOutputUnavailableError, type ReadyOutput } from '../lib/outputReadyStorage';

type Activity = { name: string; phase: 'running' | 'checking' | 'removing' | 'ready' | 'requested' | 'failed'; done?: number; total?: number; detail?: string; persistence?: 'device' | 'session'; canSaveAgain?: boolean; unavailable?: boolean };
type Handle = { isCurrent: () => boolean; progress: (done: number, total: number) => void; hold: (output: ReadyOutput, detail: string) => void; finish: (phase: 'requested' | 'failed', detail?: string) => void; complete: (output: ReadyOutput, validate?: () => Promise<void>) => boolean };
type OutputActivity = { activity: Activity | null; begin: (name: string, options?: { retained: boolean }) => Handle | null; dismiss: () => void; saveAgain: () => Promise<void>; remove: () => Promise<void>; saving: boolean };
const Context = createContext<OutputActivity | null>(null);

/** Requests a browser download; browsers do not confirm the resulting disk save. */
export const requestOutputDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
};

/** One Output-owned prepared artifact per workspace; no authored Project data. */
export function OutputActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const active = useRef(false);
  const handoff = useRef(createReadyHandoffGuard());
  const restoring = useRef(true);
  const lifetime = useRef(true);
  const scope = useRef(getProjectPersistenceScope());
  const version = useRef(0);
  const ready = useRef<{ scope: string; output: ReadyOutput; validate?: () => Promise<void> } | null>(null);
  useEffect(() => {
    const live = lifetime;
    const gate = handoff.current;
    live.current = true;
    let mounted = true;
    const load = () => {
      const next = getProjectPersistenceScope();
      scope.current = next; const epoch = ++version.current;
      active.current = false; handoff.current.invalidate(); restoring.current = true; ready.current = null;
      setActivity({ name: 'Prepared output', phase: 'running', detail: 'Checking browser storage' }); setSaving(false);
      void readReadyOutput(next).then(output => {
        if (!mounted || epoch !== version.current || next !== getProjectPersistenceScope()) return;
        if (output) {
          ready.current = { scope: next, output };
          setActivity({ name: output.name, phase: 'ready', persistence: output.persistence, canSaveAgain: output.canSaveAgain, unavailable: output.unavailable });
        } else setActivity(null);
      }).catch(() => {
        if (mounted && epoch === version.current) setActivity({ name: 'Prepared output', phase: 'failed', detail: 'Could not check browser storage. Try again before preparing another copy.' });
      }).finally(() => { if (mounted && epoch === version.current) restoring.current = false; });
    };
    load(); window.addEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, load);
    return () => { mounted = false; live.current = false; gate.invalidate(); ready.current = null; window.removeEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, load); };
  }, []);
  const begin = useCallback((name: string, options?: { retained: boolean }): Handle | null => {
    if (active.current || restoring.current || handoff.current.busy()) return null;
    if (ready.current && options?.retained) { setActivity({ name: ready.current.output.name, phase: 'ready', persistence: ready.current.output.persistence, canSaveAgain: ready.current.output.canSaveAgain, unavailable: ready.current.output.unavailable, detail: 'Remove this prepared copy before preparing another.' }); return null; }
    const capturedScope = scope.current; const epoch = ++version.current;
    if (capturedScope === 'unscoped-disabled' || capturedScope !== getProjectPersistenceScope()) return null;
    active.current = true; setActivity({ name, phase: 'running' });
    const current = () => lifetime.current && epoch === version.current && capturedScope === getProjectPersistenceScope();
    return {
      isCurrent: current,
      progress: (done, total) => { if (current()) setActivity({ name, phase: 'running', done, total }); },
      finish: (phase, detail) => { if (current()) {
        active.current = false;
        const previous = ready.current;
        if (previous) setActivity({ name: previous.output.name, phase: 'ready', persistence: previous.output.persistence, canSaveAgain: previous.output.canSaveAgain, unavailable: previous.output.unavailable, detail: phase === 'requested' ? `${name}: download requested. Check your browser downloads.` : `${name}: export failed. ${detail ?? 'Retry from Output.'}` });
        else setActivity({ name, phase, detail });
      } },
      hold: (output, detail) => {
        if (!current()) return;
        active.current = false;
        const held = { ...output, canSaveAgain: false };
        ready.current = { scope: capturedScope, output: held };
        setActivity({ name, phase: 'ready', persistence: output.persistence, canSaveAgain: false, detail });
      },
      complete: (output, validate) => {
        if (!current()) return false;
        active.current = false;
        ready.current = { scope: capturedScope, output, validate };
        try { requestOutputDownload(output.blob, output.fileName); setActivity({ name, phase: 'ready', persistence: output.persistence, canSaveAgain: true, detail: 'Download requested. Check your browser downloads.' }); return true; }
        catch { setActivity({ name, phase: 'ready', persistence: output.persistence, detail: 'Download could not be requested. Try Save again.' }); return false; }
      },
    };
  }, []);
  const dismiss = useCallback(() => { if (!active.current) { ready.current = null; setActivity(null); } }, []);
  const saveAgain = useCallback(async () => {
    const selected = ready.current;
    if (!selected || selected.output.canSaveAgain === false || active.current || saving || selected.scope !== getProjectPersistenceScope()) return;
    const token = handoff.current.begin();
    if (!token) return;
    setSaving(true);
    setActivity({ name: selected.output.name, phase: 'checking', persistence: selected.output.persistence });
    try {
      const refreshed = await prepareReadyOutputHandoff(selected.scope, selected.output, () => lifetime.current && ready.current === selected && selected.scope === getProjectPersistenceScope(), selected.validate);
      if (!refreshed) return;
      requestOutputDownload(refreshed.blob, refreshed.fileName);
      setActivity({ name: selected.output.name, phase: 'ready', persistence: selected.output.persistence, detail: 'Download requested. Check your browser downloads.' });
    } catch (error) {
      if (ready.current === selected) {
        if (error instanceof ReadyOutputUnavailableError && selected.output.blob instanceof File) {
          const unavailable = { ...selected.output, canSaveAgain: false, unavailable: true, storageFile: selected.output.blob.name, storageSize: selected.output.blob.size };
          ready.current = { ...selected, output: unavailable };
          setActivity({ name: unavailable.name, phase: 'ready', persistence: unavailable.persistence, canSaveAgain: false, unavailable: true, detail: error.message });
        }
        else setActivity({ name: selected.output.name, phase: 'ready', persistence: selected.output.persistence, detail: error instanceof Error ? error.message : 'The download could not be requested.' });
      }
    } finally { if (handoff.current.finish(token)) setSaving(false); }
  }, [saving]);
  const remove = useCallback(async () => {
    const selected = ready.current;
    if (!selected || active.current || saving || selected.scope !== getProjectPersistenceScope()) return;
    if (!window.confirm(`Remove the prepared copy “${selected.output.name}” (${selected.output.fileName}) from this device? Finish any active downloads first. Files already saved are unchanged.`)) return;
    if (ready.current !== selected || selected.scope !== getProjectPersistenceScope() || active.current) return;
    const token = handoff.current.begin();
    if (!token) return;
    setSaving(true);
    setActivity({ name: selected.output.name, phase: 'removing', persistence: selected.output.persistence });
    try {
      await removeReadyOutput(selected.scope, selected.output, () => lifetime.current && ready.current === selected);
      if (ready.current === selected) { ready.current = null; setActivity(null); }
    } catch (error) {
      if (ready.current === selected) setActivity({ name: selected.output.name, phase: 'ready', persistence: selected.output.persistence, canSaveAgain: selected.output.canSaveAgain, unavailable: selected.output.unavailable, detail: error instanceof Error ? error.message : 'Could not remove the prepared copy.' });
    } finally { if (handoff.current.finish(token)) setSaving(false); }
  }, [saving]);
  const value = useMemo(() => ({ activity, begin, dismiss, saveAgain, remove, saving }), [activity, begin, dismiss, saveAgain, remove, saving]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useOutputActivity = () => useContext(Context);

export function OutputActivityStatus() {
  const output = useOutputActivity(); const activity = output?.activity;
  if (!activity) return null;
  const message = activity.phase === 'removing'
    ? `${activity.name}: removing the prepared copy from this device.`
    : activity.phase === 'checking'
    ? `${activity.name}: checking the prepared file. Keep this page open.`
    : activity.phase === 'running'
    ? `${activity.name}: ${activity.detail ?? (activity.total ? activity.done === activity.total ? 'Finishing output' : `Rendering ${activity.done ?? 0} of ${activity.total}` : 'Building output')}. Keep this page open.`
    : activity.phase === 'ready'
      ? activity.unavailable ? `${activity.name}: the previously prepared output is unavailable on this device. You can remove its stored copy and record. ${activity.detail ?? ''}` : `${activity.name}: previously prepared output ready on this device${activity.persistence === 'session' ? ' for this tab session' : ' while browser storage remains available'}. Changes made since preparation are not included. ${activity.detail ?? (activity.canSaveAgain === false ? 'This copy needs its original source to be prepared again; you can remove it.' : 'Save again when needed.')}`
      : activity.phase === 'requested' ? `${activity.name}: download requested. ${activity.detail ?? 'Check your browser downloads.'}`
        : `${activity.name}: export failed. ${activity.detail ?? 'Retry from Output.'}`;
  return <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-2 text-xs">
    {message}{(activity.phase === 'ready' || activity.phase === 'checking') && activity.canSaveAgain !== false ? <button type="button" disabled={output.saving} onClick={() => void output.saveAgain()}>{activity.phase === 'checking' ? 'Checking…' : 'Save again'}</button> : null}
    {activity.phase === 'ready' || activity.phase === 'checking' || activity.phase === 'removing' ? <button type="button" disabled={output.saving} onClick={() => void output.remove()}>{activity.phase === 'removing' ? 'Removing…' : 'Remove prepared copy'}</button> : null}
    {activity.phase !== 'running' && activity.phase !== 'checking' && activity.phase !== 'removing' && activity.phase !== 'ready' ? <button type="button" onClick={output.dismiss} aria-label="Dismiss export status">Dismiss</button> : null}
  </span>;
}
