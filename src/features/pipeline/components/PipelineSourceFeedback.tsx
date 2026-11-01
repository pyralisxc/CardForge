"use client";

import { useEffect, useRef, useState } from 'react';
import { Heart, ThumbsDown, ThumbsUp } from 'lucide-react';
import { readApiError } from '@/infrastructure/http/clientResponses';
import { loadPipelineEngagement, notifyPipelineEngagementChanged, PIPELINE_ENGAGEMENT_CHANGED } from '../client/engagementRequests';
import { loadCardForgeStudioAssets, loadCardForgeStudioBootstrap } from '../client/catalog';
import { PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT } from '@/features/project/client/persistence-workspace';
import type { TCGCardTemplate, AppearanceStylePreset, CardAssetOption } from '@/domain/templates';
import type { PipelineEngagement } from '../lib/pipelineEngagement';

export function PipelineSourceFeedback({ submissionId }: { submissionId: string }) {
  const currentId = useRef(submissionId);
  currentId.current = submissionId;
  const readEpoch = useRef(0);
  const [read, setRead] = useState<{ id: string; value?: PipelineEngagement; error?: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mutationIssue, setMutationIssue] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const epoch = ++readEpoch.current;
    setRead(null);
    void loadPipelineEngagement(submissionId).then(value => { if (!cancelled && epoch === readEpoch.current) setRead({ id: submissionId, value }); })
      .catch(error => { if (!cancelled && epoch === readEpoch.current) setRead({ id: submissionId, error: error instanceof Error ? error.message : 'Pipeline source reactions are unavailable.' }); });
    return () => { cancelled = true; };
  }, [submissionId, refresh]);
  useEffect(() => {
    const reload = () => { ++readEpoch.current; setRead(null); setMutationIssue(null); setRefresh(value => value + 1); };
    window.addEventListener(PIPELINE_ENGAGEMENT_CHANGED, reload);
    window.addEventListener('focus', reload);
    window.addEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, reload);
    return () => { window.removeEventListener(PIPELINE_ENGAGEMENT_CHANGED, reload); window.removeEventListener('focus', reload); window.removeEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, reload); };
  }, []);
  const value = read?.id === submissionId ? read.value : undefined;
  const issue = read?.id === submissionId ? read.error : undefined;
  const mutate = async (voteValue?: 'positive' | 'negative') => {
    if (!value || busy) return;
    setBusy(true); setMutationIssue(null);
    try {
      const response = await fetch(voteValue ? `/api/pipeline/${encodeURIComponent(submissionId)}/vote` : '/api/pipeline/hearts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteValue ? { voteValue } : { lineageId: value.lineageId, hearted: !value.heart!.hearted }),
      });
      if (!response.ok) throw await readApiError(response, 'The reaction could not be confirmed. Refresh before trying again.');
      await response.json();
      notifyPipelineEngagementChanged();
    } catch (error) {
      if (currentId.current !== submissionId) return;
      setMutationIssue(error instanceof Error ? error.message : 'The reaction could not be confirmed. Refresh before trying again.');
      // Native rejection/uncertainty may reflect changed lifecycle or account access.
      setRefresh(current => current + 1);
    } finally { setBusy(false); }
  };
  return <section className="space-y-1 rounded border border-[var(--cf-border-subtle)] p-2 text-xs" aria-label="Pipeline source feedback">
    {value ? <>
      <p>Original Pipeline source: <strong>{value.name}</strong> · revision {value.revisionNumber ?? 'unassigned'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || Boolean(value.voteIssue)} title={value.voteIssue ?? 'Like this exact original revision'} aria-pressed={value.currentUserVote === 'positive'} onClick={() => void mutate('positive')} className="inline-flex min-h-9 items-center gap-1 rounded border px-2 aria-pressed:bg-[var(--cf-accent-soft)] aria-pressed:text-[var(--cf-accent-text)] disabled:cursor-not-allowed disabled:opacity-50"><ThumbsUp className="h-3 w-3" aria-hidden="true" />Like {value.positiveVotes}</button>
        <button type="button" disabled={busy || Boolean(value.voteIssue)} title={value.voteIssue ?? 'Dislike this exact original revision'} aria-pressed={value.currentUserVote === 'negative'} onClick={() => void mutate('negative')} className="inline-flex min-h-9 items-center gap-1 rounded border px-2 aria-pressed:bg-[var(--cf-accent-soft)] aria-pressed:text-[var(--cf-accent-text)] disabled:cursor-not-allowed disabled:opacity-50"><ThumbsDown className="h-3 w-3" aria-hidden="true" />Dislike {value.negativeVotes}</button>
        <button type="button" disabled={busy || Boolean(value.heartIssue)} title={value.heartIssue ?? 'Heart this source lineage'} aria-pressed={value.heart?.hearted ?? false} onClick={() => void mutate()} className="inline-flex min-h-9 items-center gap-1 rounded border px-2 aria-pressed:bg-[var(--cf-accent-soft)] aria-pressed:text-[var(--cf-accent-text)] disabled:cursor-not-allowed disabled:opacity-50"><Heart className="h-3 w-3" aria-hidden="true" />Heart {value.heart?.count ?? 'unavailable'}</button>
      </div>
      {value.voteIssue ? <p>{value.voteIssue}</p> : null}{value.heartIssue ? <p>{value.heartIssue}</p> : null}
    </> : <p role="status">{issue ?? 'Loading exact Pipeline source…'}</p>}
    {mutationIssue ? <p role="alert">{mutationIssue}</p> : null}
    {issue || mutationIssue ? <button type="button" className="underline" disabled={busy} onClick={() => setRefresh(current => current + 1)}>Refresh source reactions</button> : null}
  </section>;
}

/** Resolve only the pointer captured with the Studio bootstrap, never today's latest revision. */
export function PublishedSourceFeedback({ registryAssetId, fontValue, template, style }: { registryAssetId?: string; fontValue?: string; template?: TCGCardTemplate; style?: AppearanceStylePreset }) {
  const revisionId = template?.templateRevisionId;
  const revisionNumber = template?.templateRevision;
  const isTemplate = Boolean(template);
  const styleFingerprint = style ? JSON.stringify(style) : null;
  const sourceKey = JSON.stringify([registryAssetId, fontValue, isTemplate, revisionId, revisionNumber, styleFingerprint]);
  const [source, setSource] = useState<{ key: string; submissionId: string | null; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadCardForgeStudioBootstrap().then(bootstrap => {
      if (!Array.isArray(bootstrap.pipeline)) {
        if (!cancelled) setSource({ key: sourceKey, submissionId: null, error: 'Published source reactions are unavailable. The catalog source information is incomplete.' });
        return;
      }
      const exactTemplate = !isTemplate || bootstrap.templates.defaults.some(candidate => candidate.id === registryAssetId && candidate.templateRevisionId === revisionId && candidate.templateRevision === revisionNumber);
      const exactStyle = !styleFingerprint || bootstrap.styles.styles.some(candidate => candidate.id === registryAssetId && JSON.stringify(candidate) === styleFingerprint);
      // Runtime Font values are lossy; only the explicit observation may bind a raw asset.
      const matches = bootstrap.pipeline.filter(item => fontValue ? item.fontValue === fontValue : item.assetId === registryAssetId);
      if (!cancelled) setSource({ key: sourceKey, submissionId: exactTemplate && exactStyle && matches.length === 1 ? matches[0].submissionId : null });
    }).catch(() => { if (!cancelled) setSource({ key: sourceKey, submissionId: null, error: 'Published source reactions are unavailable.' }); });
    return () => { cancelled = true; };
  }, [registryAssetId, fontValue, sourceKey, isTemplate, revisionId, revisionNumber, styleFingerprint]);
  if (source?.key !== sourceKey) return <p className="text-xs">Loading Pipeline source…</p>;
  return source.submissionId ? <PipelineSourceFeedback key={source.submissionId} submissionId={source.submissionId} /> : <p className="text-xs">{source.error ?? 'No exact governed Pipeline source is available for this resource.'}</p>;
}

/** Only a resource object from the existing discovery observation may carry its source pin.
 * Authored/saved lookalikes keep ordinary picture behavior without gaining source authority. */
export function DiscoveredAssetSourceFeedback({ asset }: { asset: CardAssetOption }) {
  const [observation, setObservation] = useState<{ asset: CardAssetOption; submissionId: string | null; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadCardForgeStudioAssets().then(payload => {
      const discovered = Object.values(payload.assets).some(assets => assets.some(candidate => candidate === asset));
      if (!cancelled) setObservation({ asset, submissionId: discovered ? asset.publishedSubmissionId ?? null : null });
    }).catch(() => { if (!cancelled) setObservation({ asset, submissionId: null, error: 'Pipeline source observation is unavailable.' }); });
    return () => { cancelled = true; };
  }, [asset]);
  if (observation?.asset !== asset) return <p className="text-xs">Loading Pipeline source…</p>;
  return observation.submissionId ? <PipelineSourceFeedback key={observation.submissionId} submissionId={observation.submissionId} /> : <p className="text-xs">{observation.error ?? 'No exact governed Pipeline source is available for this resource.'}</p>;
}

export function PipelineSourceDisclosure({ registryAssetId, submissionId, template, style }: { registryAssetId?: string; submissionId?: string | null; template?: TCGCardTemplate; style?: AppearanceStylePreset }) {
  const [open, setOpen] = useState(false);
  if (!registryAssetId && !submissionId) return null;
  return <div className="text-xs">
    <button type="button" className="min-h-9 underline" aria-expanded={open} onClick={() => setOpen(value => !value)}>Pipeline source reactions</button>
    {open ? submissionId ? <PipelineSourceFeedback key={submissionId} submissionId={submissionId} /> : <PublishedSourceFeedback registryAssetId={registryAssetId} template={template} style={style} /> : null}
  </div>;
}
