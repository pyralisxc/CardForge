"use client";

import { mediaRevisionBaseOutput, mediaRevisionReceiptOutput, mediaRevisionCommandResult } from '../lib/mediaRevisionCommand';
import type { PipelineReviewTarget } from '../lib/pipelineReviewTarget';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppearanceSurface, appearanceToStyle } from '@/features/card-rendering/client';
import { ApiClientError, readApiError, readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import {
  pipelineMediaRevisionAppearance,
  type MediaRevisionSnapshot,
  type PipelineMediaPresentation,
} from '../lib/pipelineMediaPresentation';

export function MediaPresentationPreview({ sourceUrl, presentation }: {
  sourceUrl: string; presentation: PipelineMediaPresentation;
}) {
  const appearance = pipelineMediaRevisionAppearance(sourceUrl, presentation);
  return <div className="flex flex-wrap gap-3" aria-label="Exact media presentation preview">
    <p className="w-full text-xs">Full-strength source fit specimen, not an approval or print proof.</p>
    {[160, 240].map((width) => <div key={width} className="grid gap-1 text-xs">
      <span>{width}px · {presentation.proposed.tileMode} · {presentation.proposed.seamless ? 'seamless claim' : 'not seamless'}</span>
      {['#f5f0e8', '#15111d'].map((backgroundColor) => <AppearanceSurface key={backgroundColor} style={{ ...appearanceToStyle(appearance), width, height: width * 0.7, backgroundColor }} />)}
    </div>)}
  </div>;
}

export function MediaPresentationRevision({ assetId, onCreated, selectedTarget }: {
  selectedTarget?: PipelineReviewTarget | null;
  assetId: string; onCreated: () => Promise<void | boolean> | void | boolean;
}) {
  const [snapshot, setSnapshot] = useState<MediaRevisionSnapshot | null>(null);
  const [presentation, setPresentation] = useState<PipelineMediaPresentation | null>(null);
  const [submissionKey, setSubmissionKey] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [canReload, setCanReload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const load = async () => {
    setBusy(true); setError(''); setResult('');
    try {
      const response = await fetch(`/api/owner/pipeline/media-revisions?assetId=${encodeURIComponent(assetId)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Presentation could not be loaded.'));
      const value = mediaRevisionBaseOutput.parse(await response.json());
      if (value.assetId !== assetId) throw new Error('The exact media base could not be verified.');
      if (selectedTarget !== undefined && (!selectedTarget || selectedTarget.status !== 'published'
        || value.assetId !== selectedTarget.assetId || value.presentation.parentSubmissionId !== selectedTarget.submissionId
        || value.presentation.lineageId !== selectedTarget.lineageId
        || value.presentation.baseRevisionNumber !== (selectedTarget.revisionNumber ?? 0))) {
        throw new Error('The selected media revision is no longer the current published base. Close and explicitly select the current revision; no newer base was adopted.');
      }
      setSnapshot(value); setPresentation(value.presentation); setSubmissionKey(crypto.randomUUID()); setAttempted(false); setCanReload(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Presentation is unavailable.'); }
    finally { setBusy(false); }
  };
  const create = async () => {
    if (!presentation) return;
    const reconciling = attempted;
    setBusy(true); setAttempted(true); setError('');
    let confirmed = false;
    try {
      let saved;
      let warnings: string[] = [];
      if (reconciling) {
        const params = new URLSearchParams({ assetId, submissionKey, presentation: JSON.stringify(presentation) });
        const response = await fetch(`/api/owner/pipeline/media-revisions?${params}`, { cache: 'no-store' });
        if (!response.ok) throw await readApiError(response, 'Exact media receipt lookup is unavailable. Absence was not established.');
        const observed = mediaRevisionReceiptOutput.parse(await response.json());
        if (observed.assetId !== assetId || observed.submissionKey !== submissionKey) throw new Error('The exact media receipt could not be verified.');
        if (!observed.receipt) {
          setError('No receipt was observed for this saved attempt. Its outcome remains unconfirmed; retain its UUID key and presentation and read again before any further write.');
          return;
        }
        saved = { ...observed.receipt, reused: true };
      } else {
        const response = await fetch('/api/owner/pipeline/media-revisions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId, submissionKey, presentation }),
        });
        if (!response.ok) throw await readApiError(response, 'The revision outcome is unconfirmed. Read the exact retained receipt; do not copy or replay automatically.');
        const result = mediaRevisionCommandResult.parse(await response.json());
        if (result.assetId !== assetId || result.submissionKey !== submissionKey || result.outcome !== 'committed' || result.committed !== true || !result.receipt) throw new Error('The exact media receipt could not be confirmed.');
        saved = { ...result.receipt, reused: result.reused };
        warnings = [...result.warnings];
        if (result.activityRecorded !== true && !warnings.length) warnings.push('Owner activity recording is incomplete.');
        if (result.cleanupPending && !warnings.some(warning => warning.includes('copy'))) warnings.push('An unused copy from this invocation needs cleanup.');
      }
      if (saved.assetId !== assetId) throw new Error('The exact media receipt could not be verified.');
      confirmed = true;
      setResult(`Revision ${saved.revisionNumber}${saved.reused ? ` recovered: ${saved.status}, editorial ${saved.editorialReviewStatus}` : ` confirmed: ${saved.status}, editorial ${saved.editorialReviewStatus}`}. This attempt did not change published content. ${warnings.join(' ')}`);
      try { if (await onCreated() === false) setError('The revision is confirmed, but Library refresh is incomplete. Reopen the Library to refresh its view; do not repeat creation.'); }
      catch { setError('The revision is confirmed, but Library refresh is unavailable. Reopen the Library to refresh its view; do not repeat creation.'); }
    } catch (failure) {
      const rejected = failure instanceof ApiClientError && (failure.status === 409 || failure.status === 400);
      setError(rejected ? failure.message : confirmed ? 'The revision is confirmed; follow-up refresh is incomplete.' : 'The revision outcome is unconfirmed. Read the exact retained receipt; do not copy or replay automatically.');
      setCanReload(rejected);
    } finally { setBusy(false); }
  };
  const changed = presentation && (presentation.baseline.tileMode !== presentation.proposed.tileMode || presentation.baseline.seamless !== presentation.proposed.seamless);
  return <section className="grid gap-3 border border-[var(--cf-border)] p-3" aria-label="Media presentation revision">
    <h3>Presentation revision</h3>
    <p className="text-sm">Creates a pending same-lineage candidate with an independent, byte-identical source copy. Creator, source notes and classification are inherited. No approval or publication is included. Existing installed copies stay unchanged.</p>
    {!snapshot ? <Button type="button" disabled={busy} onClick={() => void load()}>Prepare presentation revision</Button> : null}
    {snapshot && presentation ? <>
      <p className="text-xs">Base revision {presentation.baseRevisionNumber} · {presentation.baseline.tileMode} · {presentation.baseline.seamless ? 'seamless' : 'not seamless'}. Changing fit does not make source art seamless or establish rights.</p>
      <fieldset disabled={busy || attempted} className="flex flex-wrap items-center gap-3">
        <label>Fit <select aria-label="Candidate tile mode" value={presentation.proposed.tileMode} onChange={(event) => setPresentation({ ...presentation, proposed: { ...presentation.proposed, tileMode: event.target.value as PipelineMediaPresentation['proposed']['tileMode'] } })}>
          <option value="repeat">Repeat</option><option value="contain">Contain</option><option value="stretch">Stretch</option>
        </select></label>
        <label><input type="checkbox" checked={presentation.proposed.seamless} onChange={(event) => setPresentation({ ...presentation, proposed: { ...presentation.proposed, seamless: event.target.checked } })} /> Seamless source</label>
      </fieldset>
      <MediaPresentationPreview sourceUrl={snapshot.sourceUrl} presentation={presentation} />
      {!result ? <Button type="button" disabled={busy || !changed || canReload} onClick={() => void create()}>{busy ? 'Working…' : attempted ? 'Read exact attempt receipt' : 'Create pending revision'}</Button> : null}
    </> : null}
    {error ? <p role="alert">{error} {result ? '' : !attempted ? 'Reload the source before preparing a candidate.' : canReload ? 'This attempt was rejected or its existing receipt was reconciled. Reload current values before preparing a new attempt.' : 'Read the exact retained receipt before any further write; do not copy or replay automatically.'}</p> : null}
    {canReload ? <Button type="button" disabled={busy} onClick={() => void load()}>Reload current values / new attempt</Button> : null}
    {result ? <p role="status">{result}</p> : null}
  </section>;
}
