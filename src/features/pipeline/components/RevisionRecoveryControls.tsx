"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { revisionRecoverySnapshotSchema, type RevisionRecoveryCommand, type RevisionRecoverySnapshot } from '../lib/revisionRecoveryContract';

const explain = (reason: string) => ({
  revision_already_trashed: 'This revision is already in Trash.',
  revision_not_trashed: 'This revision is outside Trash.',
  owner_recovery_required: 'Owner recovery is required for moderation or earlier Trash with unverified origin.',
  catalog_recovery_active: 'This lineage has separate catalog recovery in progress.',
  destructive_attempt_requires_reconciliation: 'A deletion has committed or its outcome is uncertain. Recovery requires reconciliation.',
  retention_hold: 'The Owner retention hold must be removed before restoring this revision.',
  installed_runtime_resolution_unverified: 'Existing installed content needs a verified retained source before this live revision can leave discovery.',
  legacy_destructive_history_unverified: 'Earlier deletion activity requires reconciliation before removing this live revision.',
  pipeline_identity_consumer_requires_resolution: 'Another retained Pipeline object depends on this live identity.',
  studio_identity_consumer_requires_resolution: 'A retained Studio document depends on this live identity.',
  json_consumer_inventory_unverified: 'Retained consumers cannot yet be completely inspected.',
  newer_revision_requires_review: 'Review newer work before removing the current live revision.',
}[reason] ?? reason.replaceAll('_', ' '));

/** Exact revision control; lineage projections never provide mutation authority. */
export function RevisionRecoveryControls({ submissionId, actorScope, onChanged }: { submissionId: string; actorScope: string; onChanged?: () => Promise<void> | void }) {
  // A target/account switch replaces the complete request/state owner before
  // rendering; an old in-flight completion cannot populate the next revision.
  return <RevisionRecoverySession key={JSON.stringify([actorScope, submissionId])} submissionId={submissionId} onChanged={onChanged} />;
}

function RevisionRecoverySession({ submissionId, onChanged }: { submissionId: string; onChanged?: () => Promise<void> | void }) {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [snapshot, setSnapshot] = useState<RevisionRecoverySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endpoint = `/api/pipeline/${encodeURIComponent(submissionId)}/lifecycle`;
  const accept = (value: unknown) => {
    const parsed = revisionRecoverySnapshotSchema.safeParse(value);
    if (!parsed.success || parsed.data.state.submissionId !== submissionId) throw new Error('Revision state is unconfirmed. Refresh before another action.');
    setSnapshot(parsed.data);
  };
  const load = async () => {
    setBusy(true); setError(''); setSnapshot(null);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Revision recovery is unavailable.'));
      const value = await response.json();
      if (active.current) accept(value);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Revision recovery is unavailable.'); }
    finally { setBusy(false); }
  };
  const change = async (command: RevisionRecoveryCommand) => {
    if (command.action === 'trash' && !window.confirm(`Move only “${snapshot?.name}” revision ${snapshot?.state.revisionNumber ?? submissionId} to recoverable Trash? Its source and history will be retained.`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Read revision state before another action.'));
      const value = await response.json();
      if (!active.current) return;
      accept(value);
      // A refresh failure cannot undo an already confirmed recovery command.
      try { await onChanged?.(); } catch { setError('Recovery committed. Refresh the Library to update its projection.'); }
    } catch (failure) {
      setSnapshot(null);
      setError(failure instanceof Error ? failure.message : 'Read revision state before another action.');
    } finally { setBusy(false); }
  };
  return <section aria-label="Revision recovery" className="grid gap-3 border-t border-[var(--cf-border-subtle)] pt-3">
    <h4 className="text-sm font-semibold">Revision Trash</h4>
    <p className="text-xs">Recover one revision without changing newer work. Restore retains history; publication remains a separate review decision. Independent copies remain usable.</p>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>Inspect revision recovery</Button>
    {error ? <p role="alert">{error}</p> : null}
    {snapshot ? <>
      <p role="status" className="text-sm">{snapshot.state.trashedAt
        ? `In Trash${snapshot.state.held ? ' · On hold' : ''}. Recovery deadline: ${snapshot.state.purgeAfter ? new Date(snapshot.state.purgeAfter).toLocaleString() : 'unavailable'}.`
        : 'Retained outside Trash.'}</p>
      <p className="text-xs">{snapshot.publicationRetained ? 'Publication history is retained; this deadline does not authorize physical deletion.' : `Configured recovery period: ${snapshot.retentionDays} days. Permanent deletion requires a separate eligible Owner action or normal retention.`}</p>
      {(snapshot.state.trashedAt ? snapshot.restoreReasons : snapshot.trashReasons).length ? <ul className="list-disc pl-5 text-xs">
        {(snapshot.state.trashedAt ? snapshot.restoreReasons : snapshot.trashReasons).map(reason => <li key={reason}>{explain(reason)}</li>)}
      </ul> : null}
      <div className="flex flex-wrap gap-2">
        {snapshot.state.trashedAt
          ? <Button size="sm" disabled={busy || snapshot.restoreReasons.length > 0} onClick={() => void change({ action: 'restore', expected: snapshot.state })}>Restore revision to history</Button>
          : <Button size="sm" disabled={busy || snapshot.trashReasons.length > 0} onClick={() => void change({ action: 'trash', expected: snapshot.state })}>Move revision to Trash</Button>}
        {snapshot.canHold ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void change({ action: 'hold', expected: snapshot.state, held: !snapshot.state.held })}>{snapshot.state.held ? 'Remove revision hold' : 'Hold revision'}</Button> : null}
      </div>
    </> : null}
  </section>;
}
