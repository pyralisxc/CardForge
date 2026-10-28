"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { CatalogTrashCommand, CatalogTrashSnapshot } from '../lib/catalogTrashContract';

const reasonLabel = (reason: string) => ({
  legacy_destructive_history_unverified: 'Earlier deletion attempts need reconciliation before this catalog can enter Trash.',
  destructive_attempt_requires_reconciliation: 'A deletion attempt has committed or has an uncertain outcome. Reconcile it first.',
  revision_purge_committed: 'A revision deletion has committed. Reconcile its worker and Storage outcome first.',
  lineage_purge_committed: 'Whole-catalog deletion has committed. Recovery cannot be promised.',
  json_consumer_inventory_unverified: 'Catalog JSON cannot be fully inspected natively, including possible external fallback content. Entry is blocked.',
  installed_runtime_resolution_unverified: 'Installed-content compatibility has not been established for this catalog type.',
  studio_identity_consumer_requires_resolution: 'A private Studio document references this catalog identity or source. Resolve its installed-content dependency first.',
  pipeline_identity_consumer_requires_resolution: 'Another Pipeline asset references this identity or source. Resolve its installed-content dependency first.',
  upload_cleanup_commitment_unverified: 'An upload-owned source can still be affected by an earlier cleanup attempt. Entry is blocked until that boundary is reconciled.',
  newer_revision_requires_review: 'A newer revision exists. Review the current lineage before moving it to Trash.',
  catalog_registry_identity_unavailable: 'The current catalog identity is unavailable.',
  physical_expiry_unavailable_complete_reference_and_worker_proof_required: 'Physical expiry is blocked until complete managed-reference and worker-safety proof exists. The deadline does not guarantee deletion.',
}[reason] ?? reason);

const inventoryConditionLabel = (condition: string) => ({
  target_identity_or_source_reference: 'References this exact catalog identity or authoritative source.',
  set_package_not_natively_decoded: 'Set package has no supported complete native dependency inspection.',
  studio_wrapper_not_supported: 'Studio document wrapper has no supported complete native dependency inspection.',
  missing_native_payload_external_fallback_possible: 'Native payload is missing; external fallback content cannot be ruled out.',
  non_object_payload: 'Payload is not an object supported by native inspection.',
  invalid_native_style_payload: 'Payload does not meet native Style validation.',
  outside_supported_native_payload_subset: 'Payload fails the supported native field/type/content subset; further inspection is required.',
  unsupported_payload_kind: 'This payload kind has no supported complete native dependency inspection.',
}[condition] ?? condition);

export function CatalogTrashControls({ submissionId }: { submissionId: string }) {
  const [snapshot, setSnapshot] = useState<CatalogTrashSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endpoint = `/api/pipeline/${encodeURIComponent(submissionId)}/catalog-trash`;
  const load = async () => {
    setBusy(true); setError(''); setSnapshot(null);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Catalog recovery is unavailable.'));
      setSnapshot(await response.json());
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Catalog recovery is unavailable.'); }
    finally { setBusy(false); }
  };
  const change = async (command: CatalogTrashCommand) => {
    if (command.action === 'trash' && !window.confirm(`Move “${snapshot?.name}” to recoverable Trash? Discovery will be hidden; existing bytes remain. This is not permanent deletion.`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'The outcome is unconfirmed. Refresh recovery state before retrying.'));
      setSnapshot(await response.json());
    } catch (failure) {
      setSnapshot(null); // No automatic retry with a potentially stale state.
      setError(failure instanceof Error ? failure.message : 'Read recovery state before retrying.');
    } finally { setBusy(false); }
  };
  return <section aria-label="Catalog recovery" className="grid gap-3 border-t border-[var(--cf-border-subtle)] pt-3">
    <h4 className="text-sm font-semibold">Catalog Trash</h4>
    <p className="text-xs">Move hides new discovery while preserving bytes and compatible managed consumers. Downloaded copies remain independent. Retire is a separate publication decision.</p>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>Refresh recovery state</Button>
    {error ? <p role="alert" className="text-sm">{error}</p> : null}
    {snapshot ? <>
      <p role="status" className="text-sm">{snapshot.state.trashedAt ? `In Trash${snapshot.state.held ? ' · On hold' : ''}. Recovery deadline: ${new Date(snapshot.state.purgeAfter!).toLocaleString()}.` : `Not in Trash. Configured recovery period: ${snapshot.retentionDays} days.`}</p>
      <ul className="list-disc pl-5 text-xs">{[...(!snapshot.state.trashedAt ? snapshot.entryReasons : []), ...snapshot.reasons].map(reason => <li key={reason}>{reasonLabel(reason)}</li>)}</ul>
      {snapshot.inventoryDetails?.length ? <details className="text-xs">
        <summary>Consumer inventory blockers ({snapshot.inventoryDetails.length})</summary>
        <p>Read-only diagnostic identities. These observations do not authorize Trash or clear any safety hold.</p>
        <ul className="grid gap-2 break-words">{snapshot.inventoryDetails.map(detail => <li key={`${detail.origin}:${detail.recordId}`}>
          <span>{detail.origin} · {detail.payloadKind} · {detail.recordId}</span>
          <ul className="list-disc pl-5">{detail.conditions.map(condition => <li key={condition}>{inventoryConditionLabel(condition)}</li>)}</ul>
        </li>)}</ul>
      </details> : null}
      <div className="flex flex-wrap gap-2">
        {snapshot.state.trashedAt ? <>
          <Button size="sm" disabled={busy} onClick={() => void change({ action: 'restore', expected: snapshot.state })}>Restore</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void change({ action: 'hold', expected: snapshot.state, held: !snapshot.state.held })}>{snapshot.state.held ? 'Remove hold' : 'Hold'}</Button>
        </> : <Button size="sm" disabled={busy || snapshot.entryReasons.length > 0} onClick={() => void change({ action: 'trash', expected: snapshot.state })}>Move to Trash</Button>}
      </div>
    </> : null}
  </section>;
}
