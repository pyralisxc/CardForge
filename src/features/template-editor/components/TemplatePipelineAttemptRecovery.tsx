'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { listTemplatePipelineAttempts, resolveTemplatePipelineAttempt, TEMPLATE_PIPELINE_ATTEMPTS_CHANGED, type TemplatePipelineAttempt } from '../lib/templatePipelineAttempts';

/** Resolves historical submitted snapshots without touching the active editor. */
export function TemplatePipelineAttemptRecovery({ templateId, busy, onAttemptsChange, onReadyChange, onOpenDestination }: { templateId: string; busy: boolean; onAttemptsChange: (present: boolean) => void; onReadyChange: (ready: boolean) => void; onOpenDestination: (url: string) => void }) {
  const [attempts, setAttempts] = useState<TemplatePipelineAttempt[]>([]);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [absent, setAbsent] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => { void listTemplatePipelineAttempts(templateId).then(items => {
      if (alive) { setAttempts(items); onAttemptsChange(items.length > 0); onReadyChange(true); setMessage(''); }
    }).catch(error => { if (alive) setMessage(error instanceof Error ? error.message : 'Saved attempts are unavailable.'); }); };
    setAttempts([]); onReadyChange(false); onAttemptsChange(false); setAbsent(null); refresh();
    window.addEventListener(TEMPLATE_PIPELINE_ATTEMPTS_CHANGED, refresh);
    return () => { alive = false; window.removeEventListener(TEMPLATE_PIPELINE_ATTEMPTS_CHANGED, refresh); };
  }, [templateId, onAttemptsChange, onReadyChange]);
  const resolve = async (attempt: TemplatePipelineAttempt, retry: boolean) => {
    setChecking(true); setAbsent(null);
    try {
      const destination = await resolveTemplatePipelineAttempt(attempt, retry);
      if (destination) onOpenDestination(destination);
      else { setAbsent(attempt.key); setMessage('No committed draft was found. You may retry the original saved snapshot. Newer local edits will not be submitted or replaced.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The outcome remains uncertain.'); }
    finally { setChecking(false); }
  };
  if (!attempts.length && !message) return null;
  return <section aria-label="Saved Pipeline attempts" className="rounded border border-[var(--cf-border)] p-3 text-sm">
    <p>Initiated submissions retain their original snapshot. Checking or retrying does not replace your current local Template.</p>
    {attempts.map(attempt => <div key={attempt.key} className="mt-2 flex flex-wrap items-center gap-2">
      <span>{attempt.template.name} · {attempt.selection.registryAssetId} · attempt {attempt.key.slice(0, 8)}</span>
      <Button type="button" variant="outline" size="sm" disabled={busy || checking} onClick={() => void resolve(attempt, false)}>Check submission outcome</Button>
      {absent === attempt.key && <Button type="button" variant="outline" size="sm" disabled={busy || checking} onClick={() => void resolve(attempt, true)}>Retry original snapshot</Button>}
    </div>)}
    {message && <p role="status">{message}</p>}
  </section>;
}
