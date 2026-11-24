"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Activity = { name: string; phase: 'running' | 'requested' | 'failed'; done?: number; total?: number; detail?: string };
type Handle = { progress: (done: number, total: number) => void; finish: (phase: 'requested' | 'failed', detail?: string) => void };
type OutputActivity = { activity: Activity | null; begin: (name: string) => Handle | null; dismiss: () => void };
const Context = createContext<OutputActivity | null>(null);

/** Tab-local status only. The existing export action owns rendering and download. */
export function OutputActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const active = useRef(false);
  const begin = useCallback((name: string): Handle | null => {
    if (active.current) return null;
    active.current = true;
    setActivity({ name, phase: 'running' });
    return {
      progress: (done, total) => setActivity({ name, phase: 'running', done, total }),
      finish: (phase, detail) => { active.current = false; setActivity({ name, phase, detail }); },
    };
  }, []);
  const dismiss = useCallback(() => { if (!active.current) setActivity(null); }, []);
  const value = useMemo(() => ({ activity, begin, dismiss }), [activity, begin, dismiss]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useOutputActivity = () => useContext(Context);

export function OutputActivityStatus() {
  const output = useOutputActivity();
  const activity = output?.activity;
  if (!activity) return null;
  const message = activity.phase === 'running'
    ? `${activity.name}: ${activity.total ? activity.done === activity.total ? 'Finalizing download' : `Rendering ${activity.done ?? 0} of ${activity.total}` : 'Preparing download'}. Keep this page open.`
    : activity.phase === 'requested'
      ? `${activity.name}: download requested. Check your browser downloads.`
      : `${activity.name}: export failed. ${activity.detail ?? 'Retry from Output.'}`;
  return <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-2 text-xs">
    {message}{activity.phase !== 'running' ? <button type="button" onClick={output.dismiss} aria-label="Dismiss export status">Dismiss</button> : null}
  </span>;
}
