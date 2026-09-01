"use client";

import { useState } from 'react';
import { Boxes, Cloud, FolderOpen, ImageIcon, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';

import type { DisplayCard } from '@/domain/rendering';
import type { ActionDescriptor, EnvironmentDetailRecord, EnvironmentStatusTone } from '@/features/app-shell/client/environment';
import { appearanceToStyle, AuthoredObjectPreview } from '@/features/card-rendering/client';
import { getPipelineDecisionReasonLabel, getPipelineStatusLabel } from '@/features/pipeline/client';
import type { selectAllTemplates } from '@/features/project/client';

import type { PipelineLibraryObject, PublishedLibraryObject } from '../hooks/useLibrarySharedProjection';
import { getAccountLibraryActionSources } from '../model/accountLibraryEnvironment';
import { getAccountLibraryMcpWorkflow, type AccountLibraryItem } from '../model/accountLibrary';
import { formatAccountLibraryBytes, formatAccountLibraryDate } from './AccountLibraryItemRow';
import styles from './UnifiedAccountLibrary.module.css';

export type LibraryViewItem =
  | { id: string; scope: 'personal'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: null; fontFamily: null; personal: AccountLibraryItem }
  | { id: string; scope: 'published'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: null; sizeBytes: number | null; previewUrl: string | null; fontFamily: string | null; published: PublishedLibraryObject }
  | { id: string; scope: 'pipeline'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: string | null; fontFamily: string | null; pipeline: PipelineLibraryObject };

export const pipelineLineageFor = (item: LibraryViewItem): string | null => item.scope === 'pipeline'
  ? item.pipeline.submission.lineageId ?? null
  : item.scope === 'published'
    ? item.published.lineageId
    : null;

export const getPersonalLibraryStatus = (item: AccountLibraryItem): { label: string; tone: EnvironmentStatusTone } => (
  item.locations.some((location) => location.status === 'needs-permission')
    ? { label: 'Permission required', tone: 'warning' }
    : item.kind === 'working-draft' ? { label: 'Temporary work', tone: 'warning' } : { label: 'Available', tone: 'success' }
);

const agentLabel = (item: AccountLibraryItem): string => {
  const workflow = getAccountLibraryMcpWorkflow(item).availability;
  if (workflow === 'revision-safe') return 'Agent editable';
  if (workflow === 'working-document') return 'Agent workspace';
  if (workflow === 'read-only') return 'Agent can search';
  return 'Device only';
};

const safePreviewUrl = (url: string | null): string | null => (
  url && !url.startsWith('/api/templates') && !url.startsWith('/api/styles') ? url : null
);
const formatDate = (value: string | null) => formatAccountLibraryDate(value) ?? 'No timestamp';

function SourceIcon({ item }: { item: LibraryViewItem }) {
  if (item.scope === 'personal') {
    const source = item.personal.locations[0]?.source;
    if (source === 'google-drive') return <Cloud aria-hidden="true" />;
    if (source === 'local-folder') return <FolderOpen aria-hidden="true" />;
    if (source === 'assistant-draft') return <Sparkles aria-hidden="true" />;
    return item.personal.kind === 'asset' ? <ImageIcon aria-hidden="true" /> : <Boxes aria-hidden="true" />;
  }
  if (item.kindLabel === 'Image' || item.kindLabel === 'Texture' || item.kindLabel === 'Font') return <ImageIcon aria-hidden="true" />;
  if (item.kindLabel === 'Divider' || item.kindLabel === 'Icon' || item.kindLabel === 'Style') return <Sparkles aria-hidden="true" />;
  return <Boxes aria-hidden="true" />;
}

function SharedLibraryVisual({ item, previewUrl }: { item: LibraryViewItem; previewUrl: string | null }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const template = item.scope === 'published' ? item.published.template : item.scope === 'pipeline' ? item.pipeline.template : null;
  const style = item.scope === 'published' ? item.published.style : item.scope === 'pipeline' ? item.pipeline.style : null;
  if (template) return <AuthoredObjectPreview template={template} label={item.name} size="standard" />;
  if (style) return <span className={styles.stylePreview} style={appearanceToStyle(style.appearance)} aria-label={`${item.name} style preview`} />;
  if (previewUrl && !previewFailed) return <img src={previewUrl} alt="" className={styles.objectImage} onError={() => setPreviewFailed(true)} />;
  if (item.fontFamily || (item.scope === 'pipeline' && item.pipeline.submission.assetType === 'fonts')) return <span className={styles.fontSample} style={{ fontFamily: item.fontFamily ?? undefined }}>Aa</span>;
  return <span className={styles.objectFallback}><SourceIcon item={item} /></span>;
}

export function LibraryVisual({ item, cards, template, large = false }: { item: LibraryViewItem; cards: DisplayCard[]; template?: ReturnType<typeof selectAllTemplates>[number] | null; large?: boolean }) {
  if (item.scope === 'personal' && (item.personal.references.localSetId || item.personal.references.localTemplateId)) {
    return <AuthoredObjectPreview cards={cards} template={template} label={item.name} size={large ? 'large' : 'standard'} emptyLabel={item.personal.references.localSetId && cards.length === 0 ? 'Empty Set' : undefined} />;
  }
  return <SharedLibraryVisual key={safePreviewUrl(item.previewUrl) ?? item.id} item={item} previewUrl={safePreviewUrl(item.previewUrl)} />;
}

export const createLibraryDetailRecord = (item: LibraryViewItem): EnvironmentDetailRecord => {
  if (item.scope === 'personal') {
    const status = getPersonalLibraryStatus(item.personal);
    return {
      id: item.id, kind: item.personal.kind, eyebrow: `${item.kindLabel} · Personal`, title: item.name,
      summary: item.summary, status: status.label, tone: status.tone,
      actionSources: getAccountLibraryActionSources(item.personal),
      meta: [
        ['Location', item.personal.locations.map((location) => location.label).join(' + ')],
        ['Agent access', agentLabel(item.personal)],
        ...(item.personal.revision ? [['Revision', item.personal.revision] as const] : []),
        ...(formatAccountLibraryBytes(item.sizeBytes) ? [['Size', formatAccountLibraryBytes(item.sizeBytes)!] as const] : []),
        ['Updated', formatDate(item.updatedAt)],
        ...(item.personal.expiresAt ? [['Expires', formatDate(item.personal.expiresAt)] as const] : []),
      ],
    };
  }
  if (item.scope === 'published') return {
    id: item.id, kind: 'published-asset', eyebrow: `${item.kindLabel} · Published`, title: item.name,
    summary: item.summary, status: item.statusLabel, tone: 'success',
    actionSources: [{ id: `${item.id}:catalog`, label: 'CardForge catalog', source: 'provider-native', currentRevisionAvailable: true }],
    meta: [
      ['Collection', item.published.accessLabel], ['Authorship', item.sourceLabel],
      ...(item.published.revision ? [['Published revision', String(item.published.revision)] as const] : []),
      ...(formatAccountLibraryBytes(item.sizeBytes) ? [['Size', formatAccountLibraryBytes(item.sizeBytes)!] as const] : []),
      ['Design access', 'Ready to use'],
    ],
  };
  return {
    id: item.id, kind: 'pipeline-asset', eyebrow: `${item.kindLabel} · Pipeline`, title: item.name,
    summary: item.summary, status: item.statusLabel,
    tone: item.pipeline.submission.status === 'rejected' ? 'danger' : item.pipeline.submission.status === 'published' ? 'success' : 'warning',
    actionSources: [{ id: `${item.id}:pipeline`, label: 'Forge Review', source: 'provider-native', currentRevisionAvailable: true }],
    meta: [
      ['Contributor', item.pipeline.submission.contributorDisplayName ?? item.pipeline.submission.contributorEmail ?? 'CardForge contributor'],
      ['Ownership', item.pipeline.ownership === 'mine' ? 'Your contribution' : 'Shared Pipeline'],
      ['Lifecycle', item.statusLabel],
      ['Review', item.pipeline.reviewState === 'available' ? 'Vote available' : item.pipeline.reviewState === 'already-voted' ? 'Your vote is recorded' : item.pipeline.reviewState === 'self' ? 'Self-voting disabled' : 'Review closed'],
      ['Current revision', String(item.pipeline.submission.revisionNumber ?? 1)],
      ...(item.pipeline.currentPublishedSubmission ? [['Published revision', String(item.pipeline.currentPublishedSubmission.revisionNumber ?? 1)] as const] : []),
      ['Votes', `${item.pipeline.submission.positiveVotes} up · ${item.pipeline.submission.negativeVotes} down`],
      ['Tier', item.pipeline.submission.calculatedAccessTier === 'paid' ? 'Creator Pass' : item.pipeline.submission.calculatedAccessTier === 'free' ? 'Starter Library' : item.pipeline.submission.calculatedAccessTier === 'hidden' ? 'Hidden' : 'Contributor review'],
      ['Quality', `${item.pipeline.submission.qualityScore}/100`],
      ['Revisions', String(item.pipeline.revisions.length)],
      ['Updated', formatDate(item.updatedAt)],
    ],
  };
};

export function PipelineDetailContent({ item, onVoteRevision, canReview, votingId, isSelfVoteBlocked }: {
  item: Extract<LibraryViewItem, { scope: 'pipeline' }>;
  onVoteRevision: (submissionId: string, name: string, value: 'positive' | 'negative') => void;
  canReview: boolean;
  votingId: string | null;
  isSelfVoteBlocked: (contributorId: string) => boolean;
}) {
  const submission = item.pipeline.submission;
  return <section className={styles.pipelineDetail} aria-label="Pipeline review details">
    <div><h3>Classification &amp; rights</h3><p>{submission.sourceNotes || 'No source or rights notes were supplied.'}</p><p>{[...submission.specialtyTags, ...submission.useCaseTags].join(' · ') || 'No classification tags supplied.'}</p></div>
    {submission.tierDecisionReason || submission.decisionReason ? <div><h3>Placement</h3><p>{getPipelineDecisionReasonLabel(submission.tierDecisionReason ?? submission.decisionReason)}</p></div> : null}
    <div><h3>Revision history</h3><ol>{item.pipeline.revisions.map((revision) => {
      const selfVoteBlocked = isSelfVoteBlocked(revision.contributorId);
      return <li key={revision.id}>
        <div className={styles.revisionOpen}><span>Revision {revision.revisionNumber ?? 1}</span><span>{getPipelineStatusLabel(revision.status)}</span></div>
        {canReview ? <div className={styles.revisionVotes} aria-label={`Votes for ${item.name} revision ${revision.revisionNumber ?? 1}`}>
          <button type="button" disabled={votingId === revision.id || selfVoteBlocked} data-active={revision.currentUserVote === 'positive'} onClick={() => onVoteRevision(revision.id, revision.name, 'positive')} aria-label={`Vote up on ${revision.name} revision ${revision.revisionNumber ?? 1}`} title={selfVoteBlocked ? 'Contributor self-voting is disabled by the owner.' : 'Vote up on this exact revision'}><ThumbsUp aria-hidden="true" />{revision.positiveVotes}</button>
          <button type="button" disabled={votingId === revision.id || selfVoteBlocked} data-active={revision.currentUserVote === 'negative'} onClick={() => onVoteRevision(revision.id, revision.name, 'negative')} aria-label={`Vote down on ${revision.name} revision ${revision.revisionNumber ?? 1}`} title={selfVoteBlocked ? 'Contributor self-voting is disabled by the owner.' : 'Vote down on this exact revision'}><ThumbsDown aria-hidden="true" />{revision.negativeVotes}</button>
        </div> : null}
      </li>;
    })}</ol></div>
  </section>;
}

export const createLibraryZoneAction = (id: 'library.refresh' | 'library.close-locations' | 'library.close-tool', label: string, loading = false): ActionDescriptor => ({
  id, label, ownerFeature: 'storage-management', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none',
  requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary',
  availability: loading ? { kind: 'disabled', reason: 'Library sources are already refreshing.' } : { kind: 'available' },
  commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: id === 'library.refresh' ? 'mutation' : 'navigation',
});

export const getSharedLibraryActions = (item: Extract<LibraryViewItem, { scope: 'published' | 'pipeline' }>): ActionDescriptor[] => {
  if (item.scope === 'pipeline') return [
    ...(item.pipeline.ownership === 'mine' && item.pipeline.submission.status !== 'published' && item.pipeline.submission.status !== 'rejected' ? [{
      id: 'library.edit-pipeline' as const, label: 'Edit submission details', ownerFeature: 'pipeline' as const, supportedObjectKinds: ['pipeline-asset'],
      supportedSources: ['provider-native'] as const, revisionPolicy: 'current-required' as const, requiredPermission: 'contributor' as const, scope: 'object' as const, hierarchy: 'primary' as const,
      availability: { kind: 'available' as const }, commitment: 'none' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
    }] : []),
    ...(item.pipeline.template ? [{
      id: 'library.test-pipeline' as const, label: 'Test exact revision in Design', ownerFeature: 'pipeline' as const, supportedObjectKinds: ['pipeline-asset'],
      supportedSources: ['provider-native'] as const, revisionPolicy: 'current-required' as const, requiredPermission: 'contributor' as const, scope: 'object' as const, hierarchy: 'primary' as const,
      availability: { kind: 'available' as const }, commitment: 'none' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'navigation' as const,
    }] : []),
  ];
  const actions: ActionDescriptor[] = [{
    id: 'library.use-published', label: item.published.kind === 'set' ? 'Create from this Set' : item.published.template ? 'Use in Design' : 'Open object', ownerFeature: 'pipeline', supportedObjectKinds: ['published-asset'],
    supportedSources: ['provider-native'], revisionPolicy: 'none', requiredPermission: 'guest', scope: 'object', hierarchy: 'primary',
    availability: item.published.kind === 'set' || item.published.template
      ? { kind: 'available' }
      : { kind: 'disabled', reason: 'This published object has no contextual editor.' },
    commitment: 'none', automation: { kind: 'planned-mcp', capability: 'select a published catalog asset for Design' }, result: 'navigation',
  }];
  if (item.published.template) actions.push({
    id: 'library.copy-published-template', label: 'Make editable copy', ownerFeature: 'template-editor', supportedObjectKinds: ['published-asset'],
    supportedSources: ['provider-native'], revisionPolicy: 'none', requiredPermission: 'guest', scope: 'object', hierarchy: 'supporting',
    availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'planned-mcp', capability: 'copy a published Template into personal work' }, result: 'mutation',
  });
  return actions;
};
