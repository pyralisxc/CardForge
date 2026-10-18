"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { appearanceToStyle } from '@/features/card-rendering/client';
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
      {['#f5f0e8', '#15111d'].map((backgroundColor) => <div key={backgroundColor} style={{ ...appearanceToStyle(appearance), width, height: width * 0.7, backgroundColor }} />)}
    </div>)}
  </div>;
}

export function MediaPresentationRevision({ assetId, onCreated }: {
  assetId: string; onCreated: () => Promise<void> | void;
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
      const value = await response.json() as MediaRevisionSnapshot;
      setSnapshot(value); setPresentation(value.presentation); setSubmissionKey(crypto.randomUUID()); setAttempted(false); setCanReload(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Presentation is unavailable.'); }
    finally { setBusy(false); }
  };
  const create = async () => {
    if (!presentation) return;
    setBusy(true); setAttempted(true); setError('');
    try {
      const response = await fetch('/api/owner/pipeline/media-revisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, submissionKey, presentation }),
      });
      if (!response.ok) throw await readApiError(response, 'The revision outcome could not be confirmed. Retry this same attempt.');
      const saved = await response.json() as { revisionNumber: number; status: string; editorialReviewStatus: string; reused: boolean; cleanupPending: boolean; activityRecorded: boolean };
      setResult(`Revision ${saved.revisionNumber}${saved.reused ? ` recovered: ${saved.status}, editorial ${saved.editorialReviewStatus}` : ' is pending review'}. This attempt did not change published content.${saved.cleanupPending ? ' An unused copy still needs cleanup.' : ''}${!saved.activityRecorded ? ' Owner activity recording is unavailable.' : ''}`);
      try { await onCreated(); } catch { setError('The revision is confirmed, but Library refresh is unavailable. Reopen the Library to refresh its view.'); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The revision outcome is unavailable. Retry this same attempt.');
      setCanReload(failure instanceof ApiClientError && (failure.status === 409 || failure.status === 400));
    }
    finally { setBusy(false); }
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
      {!result ? <Button type="button" disabled={busy || !changed || canReload} onClick={() => void create()}>{busy ? 'Working…' : attempted ? 'Confirm same attempt' : 'Create pending revision'}</Button> : null}
    </> : null}
    {error ? <p role="alert">{error} {result ? '' : !attempted ? 'Reload the source before preparing a candidate.' : canReload ? 'This attempt was rejected or its existing receipt was reconciled. Reload current values before preparing a new attempt.' : 'Retry the same attempt to reconcile an uncertain result before preparing another.'}</p> : null}
    {canReload ? <Button type="button" disabled={busy} onClick={() => void load()}>Reload current values / new attempt</Button> : null}
    {result ? <p role="status">{result}</p> : null}
  </section>;
}
