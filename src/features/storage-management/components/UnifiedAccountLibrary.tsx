"use client";

import dynamic from 'next/dynamic';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Boxes, Cloud, FolderOpen, Grid2X2, HardDrive, ImageIcon,
  Copy, ExternalLink, Heart, LayoutList, Loader2, MoreHorizontal, PanelRightOpen, Search, Sparkles, ThumbsDown,
  ThumbsUp, Trash2, UploadCloud, type LucideIcon,
} from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { PublicAuthControls } from '@/features/account/client/auth';
import {
  ENVIRONMENT_ZONES, EnvironmentBoundaryNotice, EnvironmentShell, EnvironmentStatus, EnvironmentToolLayer,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type ActionDescriptor, type EnvironmentDetailRecord, type EnvironmentStatusTone,
  type EnvironmentViewer, type SelectionSession, type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { createDeskReturnHref, createLibraryReturnHref, createStudioHref, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';
import { appearanceToStyle, AuthoredObjectPreview } from '@/features/card-rendering/client';
import { getPipelineDecisionReasonLabel, getPipelineStatusLabel, type PipelineSubmission } from '@/features/pipeline/client';
import { createPublishedSetCopy, deleteGoogleDriveProjectCopy, selectAllGeneratedDisplayCards, selectAllTemplates, useProjectStore, type ProjectPersistenceScope } from '@/features/project/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import {
  useLibrarySharedProjection,
  type PipelineLibraryObject,
  type PublishedLibraryObject,
} from '../hooks/useLibrarySharedProjection';
import {
  ACCOUNT_LIBRARY_KINDS, getAccountLibraryMcpWorkflow, getAccountLibrarySourceLabel,
  type AccountLibraryItem, type AccountLibraryKind, type AccountLibrarySource,
} from '../model/accountLibrary';
import { getAccountLibraryActionSources, getAccountLibraryEnvironmentActions } from '../model/accountLibraryEnvironment';
import {
  getLibraryScopeDefinitions, getLibraryScopeStatus, resolveLibraryScopeForViewer,
  type LibraryDensity, type LibraryScope,
} from '../model/libraryScopes';
import { accountLibraryKindLabels, formatAccountLibraryBytes, formatAccountLibraryDate } from './AccountLibraryItemRow';
import { DefaultWorkLocationControl, WorkLocationDialog } from './WorkLocationDialog';
import styles from './UnifiedAccountLibrary.module.css';

const CampaignLibraryWorkspace = dynamic(() => import(
  '@/features/marketing-content/client'
).then((module) => module.CampaignLibraryWorkspace));
const PipelineContributionPanel = dynamic(() => import(
  '@/features/pipeline/client'
).then((module) => module.PipelineContributionPanel));
const PipelineSubmissionEditPanel = dynamic(() => import(
  '@/features/pipeline/client'
).then((module) => module.PipelineSubmissionEditPanel));

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  initialReturnContextKey?: string | null;
  initialTool?: 'locations' | null;
  storageConnections?: ReactNode;
}

type LibraryViewItem =
  | { id: string; scope: 'personal'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: null; fontFamily: null; personal: AccountLibraryItem }
  | { id: string; scope: 'published'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: null; sizeBytes: number | null; previewUrl: string | null; fontFamily: string | null; published: PublishedLibraryObject }
  | { id: string; scope: 'pipeline'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: string | null; fontFamily: string | null; pipeline: PipelineLibraryObject };

const pipelineLineageFor = (item: LibraryViewItem): string | null => item.scope === 'pipeline'
  ? item.pipeline.submission.lineageId ?? null
  : item.scope === 'published'
    ? item.published.lineageId
    : null;

const LIBRARY_SOURCES: AccountLibrarySource[] = ['device', 'google-drive', 'local-folder', 'assistant-draft'];
const kindIcons: Record<AccountLibraryKind, LucideIcon> = { set: Boxes, template: Boxes, asset: ImageIcon, 'working-draft': Sparkles };
const sharedKindIcons: Record<string, LucideIcon> = { Set: Boxes, Template: Boxes, Image: ImageIcon, Texture: ImageIcon, Divider: ImageIcon, Icon: Sparkles, Style: Sparkles, Font: ImageIcon };

const personalStatus = (item: AccountLibraryItem): { label: string; tone: EnvironmentStatusTone } => (
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
    const Icon = kindIcons[item.personal.kind];
    return <Icon aria-hidden="true" />;
  }
  const Icon = sharedKindIcons[item.kindLabel] ?? ImageIcon;
  return <Icon aria-hidden="true" />;
}

function SharedLibraryVisual({ item, previewUrl }: { item: LibraryViewItem; previewUrl: string | null }) {
  const [previewFailed, setPreviewFailed] = useState(false);

  const template = item.scope === 'published'
    ? item.published.template
    : item.scope === 'pipeline'
      ? item.pipeline.template
      : null;
  const style = item.scope === 'published'
    ? item.published.style
    : item.scope === 'pipeline'
      ? item.pipeline.style
      : null;
  if (template) {
    return <AuthoredObjectPreview template={template} label={item.name} size="standard" />;
  }
  if (style) {
    return <span className={styles.stylePreview} style={appearanceToStyle(style.appearance)} aria-label={`${item.name} style preview`} />;
  }
  if (previewUrl && !previewFailed) {
    return <img src={previewUrl} alt="" className={styles.objectImage} onError={() => setPreviewFailed(true)} />;
  }
  if (item.fontFamily || (item.scope === 'pipeline' && item.pipeline.submission.assetType === 'fonts')) return <span className={styles.fontSample} style={{ fontFamily: item.fontFamily ?? undefined }}>Aa</span>;
  return <span className={styles.objectFallback}><SourceIcon item={item} /></span>;
}

function LibraryVisual({ item, cards, template, large = false }: { item: LibraryViewItem; cards: DisplayCard[]; template?: ReturnType<typeof selectAllTemplates>[number] | null; large?: boolean }) {
  if (item.scope === 'personal' && (item.personal.references.localSetId || item.personal.references.localTemplateId)) {
    return <AuthoredObjectPreview cards={cards} template={template} label={item.name} size={large ? 'large' : 'standard'} />;
  }
  const previewUrl = safePreviewUrl(item.previewUrl);
  return <SharedLibraryVisual key={previewUrl ?? item.id} item={item} previewUrl={previewUrl} />;
}

const detailRecord = (item: LibraryViewItem): EnvironmentDetailRecord => {
  if (item.scope === 'personal') {
    const status = personalStatus(item.personal);
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
      ['Studio access', 'Ready to use'],
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

function PipelineDetailContent({
  item,
  onVoteRevision,
  canReview,
  votingId,
  isSelfVoteBlocked,
}: {
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

const zoneAction = (id: 'library.refresh' | 'library.close-locations' | 'library.close-tool', label: string, loading = false): ActionDescriptor => ({
  id, label, ownerFeature: 'storage-management', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none',
  requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary',
  availability: loading ? { kind: 'disabled', reason: 'Library sources are already refreshing.' } : { kind: 'available' },
  commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: id === 'library.refresh' ? 'mutation' : 'navigation',
});

const sharedActions = (item: Extract<LibraryViewItem, { scope: 'published' | 'pipeline' }>): ActionDescriptor[] => {
  if (item.scope === 'pipeline') return [
    ...(item.pipeline.ownership === 'mine' && item.pipeline.submission.status !== 'published' && item.pipeline.submission.status !== 'rejected' ? [{
      id: 'library.edit-pipeline' as const, label: 'Edit submission details', ownerFeature: 'pipeline' as const, supportedObjectKinds: ['pipeline-asset'],
      supportedSources: ['provider-native'] as const, revisionPolicy: 'current-required' as const, requiredPermission: 'contributor' as const, scope: 'object' as const, hierarchy: 'primary' as const,
      availability: { kind: 'available' as const }, commitment: 'none' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'mutation' as const,
    }] : []),
    ...(item.pipeline.template ? [{
      id: 'library.test-pipeline' as const, label: 'Test exact revision in Studio', ownerFeature: 'pipeline' as const, supportedObjectKinds: ['pipeline-asset'],
      supportedSources: ['provider-native'] as const, revisionPolicy: 'current-required' as const, requiredPermission: 'contributor' as const, scope: 'object' as const, hierarchy: 'primary' as const,
      availability: { kind: 'available' as const }, commitment: 'none' as const, automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'navigation' as const,
    }] : []),
  ];
  const actions: ActionDescriptor[] = [{
    id: 'library.use-published', label: item.published.kind === 'set' ? 'Create from this Set' : item.published.template ? 'Use in Studio' : 'Open Studio', ownerFeature: 'pipeline', supportedObjectKinds: ['published-asset'],
    supportedSources: ['provider-native'], revisionPolicy: 'none', requiredPermission: 'guest', scope: 'object', hierarchy: 'primary',
    availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'planned-mcp', capability: 'select a published catalog asset for Studio' }, result: 'navigation',
  }];
  if (item.published.template) actions.push({
    id: 'library.copy-published-template', label: 'Make editable copy', ownerFeature: 'template-editor', supportedObjectKinds: ['published-asset'],
    supportedSources: ['provider-native'], revisionPolicy: 'none', requiredPermission: 'guest', scope: 'object', hierarchy: 'supporting',
    availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'planned-mcp', capability: 'copy a published Template into personal work' }, result: 'mutation',
  });
  return actions;
};

export function UnifiedAccountLibrary({ persistenceScope, experience, initialReturnContextKey = null, initialTool = null, storageConnections }: UnifiedAccountLibraryProps) {
  const isSignedIn = experience.signedIn;
  const pipelineAccess = experience.contributor.canSubmit || experience.contributor.canReview || experience.contributor.canPublish;
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const {
    setKind: setLibraryKind,
    setQuery: setLibraryQuery,
    setSort: setLibrarySort,
    setSource: setLibrarySource,
  } = projection;
  const { toast } = useToast();
  const [scope, setScope] = useState<LibraryScope>('personal');
  const campaignAccess = experience.contributor.canDraftCampaigns || experience.owner;
  const activeScope = resolveLibraryScopeForViewer(scope, { contributor: pipelineAccess, campaigns: campaignAccess, owner: experience.owner });
  const shared = useLibrarySharedProjection({ pipelineEnabled: pipelineAccess, activeScope });
  const [density, setDensity] = useState<LibraryDensity>('gallery');
  const [sharedType, setSharedType] = useState('all');
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const [activeTool, setActiveTool] = useState<'locations' | 'contribute' | 'edit-contribution' | null>(() => initialTool);
  const [contributionTargetSetId, setContributionTargetSetId] = useState<string | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<PipelineSubmission | null>(null);
  const [campaignTargetId, setCampaignTargetId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [heartingId, setHeartingId] = useState<string | null>(null);
  const [heartMetrics, setHeartMetrics] = useState<Record<string, { count: number; hearted: boolean }>>({});
  const [storageCallback, setStorageCallback] = useState<{ title: string; message: string } | null>(null);
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<AccountLibraryItem | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const returnContextRestoredRef = useRef(false);
  const displayCards = useProjectStore(selectAllGeneratedDisplayCards);
  const templates = useProjectStore(selectAllTemplates);
  const cardSets = useProjectStore((state) => state.cardSets);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: experience.contributor.active, owner: experience.owner };
  const scopeDefinitions = getLibraryScopeDefinitions({ contributor: pipelineAccess, campaigns: campaignAccess, owner: experience.owner });
  const visibleZones = getVisibleEnvironmentZones(viewer);
  const libraryDefinition = ENVIRONMENT_ZONES.find((zone) => zone.id === 'library')!;
  const zones = visibleZones.some((zone) => zone.id === 'library') ? visibleZones : [{ ...libraryDefinition, minimumAccess: 'guest' as const }, ...visibleZones];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedScope = params.get('scope');
    if (requestedScope === 'published' || requestedScope === 'pipeline' || requestedScope === 'campaigns') setScope(requestedScope);
    const tool = params.get('tool');
    if (tool === 'contribute' && experience.contributor.canSubmit) {
      setActiveTool('contribute');
      setContributionTargetSetId(params.get('submitSet'));
    }
    setCampaignTargetId(params.get('campaign'));
    const status = params.get('storage');
    if (status === 'google-drive-connected') setStorageCallback({ title: 'Google Drive connected', message: 'Google Drive is now available as a durable project and asset location.' });
    else if (status === 'google-drive-error') setStorageCallback({ title: 'Google Drive could not be connected', message: params.get('message') || 'Review Locations & connections and try again. Existing work remains unchanged.' });
    else setStorageCallback(null);
  }, [experience.contributor.canSubmit]);
  useEffect(() => {
    if (scope === activeScope) return;
    setScope(activeScope);
    setSharedType('all');
    setSelection(closeEnvironmentDetail);
    projection.router.replace(`/account?section=library&scope=${activeScope}`);
  }, [activeScope, projection.router, scope]);
  useEffect(() => { if (initialTool) setActiveTool(initialTool); }, [initialTool]);

  const personalItems = useMemo<LibraryViewItem[]>(() => projection.visibleItems.map((item) => {
    const status = personalStatus(item);
    return {
      id: item.id, scope: 'personal', name: item.name, kindLabel: accountLibraryKindLabels[item.kind].replace(/s$/u, ''),
      sourceLabel: item.locations.map((location) => location.label).join(' + '), statusLabel: status.label,
      summary: item.details.join(' · ') || 'Ready to inspect.', updatedAt: item.updatedAt ?? item.expiresAt,
      sizeBytes: item.sizeBytes, previewUrl: null, fontFamily: null, personal: item,
    };
  }), [projection.visibleItems]);
  const publishedItems = useMemo<LibraryViewItem[]>(() => shared.publishedItems.map((item) => ({
    id: item.id, scope: 'published', name: item.name, kindLabel: item.kindLabel, sourceLabel: item.sourceLabel,
    statusLabel: item.accessLabel, summary: `${item.kindLabel} from the current ${item.accessLabel}.`, updatedAt: null,
    sizeBytes: item.sizeBytes, previewUrl: item.previewUrl, fontFamily: item.fontFamily, published: item,
  })), [shared.publishedItems]);
  const pipelineItems = useMemo<LibraryViewItem[]>(() => shared.pipelineItems.map((item) => ({
    id: `pipeline:${item.submission.targetRegistryAssetId ?? item.submission.registryAssetId ?? item.submission.id}`, scope: 'pipeline', name: item.submission.name, kindLabel: item.kindLabel,
    sourceLabel: item.ownership === 'mine' ? 'Your contribution' : item.submission.contributorDisplayName ?? 'Shared Pipeline', statusLabel: item.statusLabel,
    summary: item.submission.description || `${item.kindLabel} in Forge Review.`, updatedAt: item.submission.updatedAt ?? item.submission.submittedAt,
    sizeBytes: item.submission.sourceFileSizeBytes, previewUrl: item.previewUrl,
    fontFamily: item.fontFamily, pipeline: item,
  })), [shared.pipelineItems]);

  const contributorPublishedItems = useMemo(() => pipelineItems.filter((item) => (
    item.scope === 'pipeline'
    && item.pipeline.ownership === 'mine'
    && item.pipeline.submission.status === 'published'
  )), [pipelineItems]);
  const contributorPipelineItems = useMemo(() => {
    const programLineages = new Set(pipelineItems.flatMap((item) => item.scope === 'pipeline' && item.pipeline.submission.lineageId
      ? [item.pipeline.submission.lineageId]
      : []));
    return [
      ...pipelineItems,
      ...publishedItems.filter((item) => item.scope === 'published' && (!item.published.lineageId || !programLineages.has(item.published.lineageId))),
    ];
  }, [pipelineItems, publishedItems]);
  const scopeItems = useMemo(() => activeScope === 'personal'
    ? personalItems
    : activeScope === 'published'
      ? contributorPublishedItems
      : activeScope === 'campaigns'
        ? []
        : pipelineAccess
        ? contributorPipelineItems
        : publishedItems, [activeScope, contributorPipelineItems, contributorPublishedItems, personalItems, pipelineAccess, publishedItems]);
  const normalizedQuery = projection.query.trim().toLocaleLowerCase();
  const viewItems = useMemo(() => scopeItems.filter((item) => {
    if (activeScope !== 'personal' && sharedType !== 'all' && item.kindLabel !== sharedType && item.statusLabel !== sharedType) return false;
    return !normalizedQuery || [item.name, item.kindLabel, item.sourceLabel, item.statusLabel, item.summary].join(' ').toLocaleLowerCase().includes(normalizedQuery);
  }).toSorted((left, right) => projection.sort === 'name'
    ? left.name.localeCompare(right.name)
    : projection.sort === 'kind'
      ? left.kindLabel.localeCompare(right.kindLabel) || left.name.localeCompare(right.name)
      : (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0) || left.name.localeCompare(right.name)), [activeScope, normalizedQuery, projection.sort, scopeItems, sharedType]);
  const sharedTypes = useMemo(() => [...new Set(scopeItems.flatMap((item) => activeScope === 'pipeline' ? [item.kindLabel, item.statusLabel] : [item.kindLabel]))].toSorted(), [activeScope, scopeItems]);
  const itemMap = useMemo(() => new Map([...personalItems, ...publishedItems, ...pipelineItems].map((item) => [item.id, item])), [personalItems, pipelineItems, publishedItems]);
  const currentItem = selection.objectId ? itemMap.get(selection.objectId) ?? null : null;
  const currentRecord = currentItem ? detailRecord(currentItem) : null;
  const cardsBySetId = useMemo(() => {
    const bySet = new Map<string, DisplayCard[]>();
    displayCards.forEach((card) => {
      const setId = card.setId ?? cardSets[0]?.id;
      if (!setId) return;
      const setCards = bySet.get(setId) ?? [];
      if (setCards.length < 3) setCards.push(card);
      bySet.set(setId, setCards);
    });
    return bySet;
  }, [cardSets, displayCards]);
  const templateById = useMemo(() => new Map(templates.flatMap((template) => template.id ? [[template.id, template] as const] : [])), [templates]);
  const cardsFor = (item: LibraryViewItem): DisplayCard[] => item.scope === 'personal' && item.personal.references.localSetId
    ? cardsBySetId.get(item.personal.references.localSetId) ?? [] : [];
  const templateFor = (item: LibraryViewItem) => {
    if (item.scope !== 'personal') return null;
    if (item.personal.references.localTemplateId) return templateById.get(item.personal.references.localTemplateId) ?? null;
    if (!item.personal.references.localSetId) return null;
    return cardsFor(item)[0]?.template ?? null;
  };
  const activeFailure = activeScope === 'campaigns'
    ? null
    : activeScope === 'personal'
    ? projection.failures[0] ?? null
    : activeScope === 'pipeline' && pipelineAccess
      ? shared.pipelineFailure ?? shared.catalogFailure
      : shared.catalogFailure;
  const activeLoading = activeScope === 'campaigns'
    ? false
    : activeScope === 'personal'
    ? projection.isLoading
    : activeScope === 'pipeline' && pipelineAccess
      ? shared.pipelineLoading || shared.catalogLoading
      : shared.catalogLoading;
  const activeStatus = activeScope === 'campaigns'
    ? { kind: 'ready' as const, label: 'Workspace' }
    : getLibraryScopeStatus({ loading: activeLoading, itemCount: scopeItems.length, failure: activeFailure?.message ?? null });

  const createLibraryStudioReturnTo = () => {
    const returnContext = storeSurfaceReturnContext({
      kind: 'library',
      scope: activeScope,
      objectId: selection.objectId,
      query: projection.query,
      source: projection.source,
      itemKind: projection.kind,
      sort: projection.sort,
      density,
      sharedType,
      scrollTop: surfaceRef.current?.scrollTop ?? 0,
    });
    return createLibraryReturnHref(activeScope, returnContext);
  };

  useEffect(() => {
    if (!initialReturnContextKey || returnContextRestoredRef.current || activeLoading) return;
    const context = readSurfaceReturnContext(initialReturnContextKey);
    if (!context || context.kind !== 'library') {
      returnContextRestoredRef.current = true;
      return;
    }
    returnContextRestoredRef.current = true;
    const restoredScope = resolveLibraryScopeForViewer(context.scope, { contributor: pipelineAccess, campaigns: campaignAccess, owner: experience.owner });
    setScope(restoredScope);
    setDensity(context.density);
    setSharedType(context.sharedType);
    setLibraryQuery(context.query);
    setLibrarySource(context.source);
    setLibraryKind(context.itemKind);
    setLibrarySort(context.sort);
    if (context.objectId && itemMap.has(context.objectId)) {
      setSelection((current) => openEnvironmentDetail({ ...current, listOffset: context.scrollTop }, {
        objectId: context.objectId,
        listOffset: context.scrollTop,
        focusReturnId: `library-object-${context.objectId}`,
      }));
    }
    requestAnimationFrame(() => surfaceRef.current?.scrollTo({ top: context.scrollTop }));
  }, [
    activeLoading,
    campaignAccess,
    experience.owner,
    initialReturnContextKey,
    itemMap,
    pipelineAccess,
    setLibraryKind,
    setLibraryQuery,
    setLibrarySort,
    setLibrarySource,
  ]);

  const chooseScope = (nextScope: LibraryScope) => {
    setScope(nextScope); setSharedType('all'); setSelection(closeEnvironmentDetail); setActiveTool(null);
    projection.router.replace(`/account?section=library&scope=${nextScope}`);
  };
  const openContributionTool = ({ setId = null }: { setId?: string | null } = {}) => {
    setContributionTargetSetId(setId);
    setActiveTool('contribute');
    closeDetail();
    const params = new URLSearchParams({ section: 'library', scope: activeScope, tool: 'contribute' });
    if (setId) params.set('submitSet', setId);
    projection.router.replace(`/account?${params.toString()}`);
  };
  const openDetail = (item: LibraryViewItem) => {
    const listOffset = surfaceRef.current?.scrollTop ?? 0;
    setSelection((current) => openEnvironmentDetail({ ...current, listOffset }, { objectId: item.id, listOffset, focusReturnId: `library-object-${item.id}` }));
  };
  const closeDetail = () => {
    const restore = selection.detailRestore;
    const focusId = selection.focusReturnId;
    setSelection(closeEnvironmentDetail);
    requestAnimationFrame(() => {
      if (restore) surfaceRef.current?.scrollTo({ top: restore.listOffset });
      if (focusId) document.getElementById(focusId)?.focus();
    });
  };
  const refresh = () => { projection.refresh(); void shared.refresh(); };

  useEffect(() => {
    const lineageIds = [...new Set(scopeItems.flatMap((item) => pipelineLineageFor(item) ? [pipelineLineageFor(item)!] : []))];
    if (!lineageIds.length) { setHeartMetrics({}); return; }
    const query = new URLSearchParams();
    lineageIds.forEach((lineageId) => query.append('lineageId', lineageId));
    let cancelled = false;
    void fetch(`/api/pipeline/hearts?${query.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Pipeline reactions are unavailable.'));
        return response.json() as Promise<{ metrics: Array<{ lineageId: string; count: number; hearted: boolean }> }>;
      })
      .then(({ metrics }) => {
        if (!cancelled) setHeartMetrics(Object.fromEntries(metrics.map((metric) => [metric.lineageId, { count: metric.count, hearted: metric.hearted }])));
      })
      .catch(() => { if (!cancelled) setHeartMetrics({}); });
    return () => { cancelled = true; };
  }, [scopeItems]);

  const toggleHeart = async (item: LibraryViewItem) => {
    const lineageId = pipelineLineageFor(item);
    if (!lineageId) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to heart Pipeline work', description: 'Your heart follows this work across future revisions.' });
      return;
    }
    const current = heartMetrics[lineageId] ?? { count: 0, hearted: false };
    setHeartingId(lineageId);
    try {
      const response = await fetch('/api/pipeline/hearts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineageId, hearted: !current.hearted }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Pipeline reaction could not be saved.'));
      const { metric } = await response.json() as { metric: { lineageId: string; count: number; hearted: boolean } };
      setHeartMetrics((metrics) => ({ ...metrics, [lineageId]: { count: metric.count, hearted: metric.hearted } }));
    } catch (error) {
      toast({ title: 'Heart was not saved', description: error instanceof Error ? error.message : 'Pipeline reactions are unavailable.', variant: 'destructive' });
    } finally { setHeartingId(null); }
  };
  const vote = async (submissionId: string, name: string, value: 'positive' | 'negative') => {
    setVotingId(submissionId);
    try {
      const response = await fetch(`/api/pipeline/${submissionId}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voteValue: value }) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to record this vote.'));
      toast({ title: 'Vote recorded', description: `${name} has been updated in Forge Review.` });
      await shared.refresh();
    } catch (error) {
      toast({ title: 'Vote was not recorded', description: error instanceof Error ? error.message : 'Forge Review is unavailable.', variant: 'destructive' });
    } finally { setVotingId(null); }
  };

  const personalActions = (item: AccountLibraryItem): ActionDescriptor[] => [
    ...getAccountLibraryEnvironmentActions(item, {
      disabledReason: projection.busyItemId !== null ? 'Finish the current Library action first.' : undefined,
      canUseProjectFiles: experience.capabilities.canUseProjectFiles,
    }),
    ...(experience.contributor.canSubmit && item.references.localSetId ? [{
      id: 'library.send-pipeline' as const, label: 'Send to Pipeline', ownerFeature: 'pipeline' as const,
      supportedObjectKinds: [item.kind], supportedSources: ['browser-local' as const], revisionPolicy: 'none' as const,
      requiredPermission: 'contributor' as const, scope: 'object' as const, hierarchy: 'supporting' as const,
      availability: { kind: 'available' as const }, commitment: 'none' as const,
      automation: { kind: 'human-only' as const, owner: 'cardforge' as const }, result: 'navigation' as const,
    }] : []),
  ];

  const actions: ActionDescriptor[] = activeTool
    ? [zoneAction(activeTool === 'locations' ? 'library.close-locations' : 'library.close-tool', activeTool === 'locations' ? 'Close locations' : activeTool === 'edit-contribution' ? 'Close submission editor' : 'Close contribution tool')]
    : currentItem?.scope === 'personal'
      ? personalActions(currentItem.personal)
      : currentItem?.scope === 'published' || currentItem?.scope === 'pipeline' ? sharedActions(currentItem)
        : [zoneAction('library.refresh', activeLoading ? 'Refreshing' : 'Refresh Library', activeLoading)];

  const runPersonalAction = (actionId: string, item: AccountLibraryItem) => {
    if (actionId === 'library.open' || actionId === 'library.continue') void projection.openItem(item, createLibraryStudioReturnTo());
    else if (actionId === 'library.send-pipeline' && item.references.localSetId) openContributionTool({ setId: item.references.localSetId });
    else if (actionId === 'library.save-move') setLocationItem(item);
    else if (actionId === 'library.duplicate' && (item.references.localSetId || item.references.localTemplateId)) {
      const duplicateId = item.references.localSetId
        ? useProjectStore.getState().duplicateCardSet(item.references.localSetId)
        : useProjectStore.getState().cloneTemplate(item.references.localTemplateId!);
      if (duplicateId) {
        toast({ title: `${item.kind === 'template' ? 'Template' : 'Set'} duplicated`, description: `${item.name} now has an independent device copy.` });
        projection.refresh();
      }
    } else if (actionId === 'library.delete-copy') setPendingDeleteItem(item);
    else if (actionId === 'library.view-source' && item.webViewLink) window.open(item.webViewLink, '_blank', 'noopener,noreferrer');
    else if (actionId === 'library.manage-location') { closeDetail(); setActiveTool('locations'); projection.router.replace('/account?section=storage'); }
  };

  const runPublishedAction = async (actionId: string, item: Extract<LibraryViewItem, { scope: 'published' }>) => {
    if (item.published.kind === 'set' && item.published.packageUrl) {
      try {
        const result = await createPublishedSetCopy({ packageUrl: item.published.packageUrl, expectedName: item.name });
        toast({ title: 'Set created', description: `${result.setName} is now independent browser work with ${result.cardCount} card${result.cardCount === 1 ? '' : 's'}.` });
        projection.refresh();
        projection.router.push(createDeskReturnHref(`set:${result.setId}`));
      } catch (error) {
        toast({ title: 'Set was not created', description: error instanceof Error ? error.message : 'The published Set package is unavailable.', variant: 'destructive' });
      }
      return;
    }
    const template = item.published.template;
    if (!template) {
      projection.router.push(createStudioHref({ returnTo: createLibraryStudioReturnTo() }));
      return;
    }
    const store = useProjectStore.getState();
    const publishedTemplateId = store.addOrUpdateTemplate(template, 'default');
    const selectedTemplateId = actionId === 'library.copy-published-template'
      ? store.cloneTemplate(publishedTemplateId)
      : publishedTemplateId;
    if (!selectedTemplateId) {
      toast({ title: 'Template was not opened', description: 'CardForge could not prepare this Template for Studio.', variant: 'destructive' });
      return;
    }
    store.setTemplateEditorSelectedTemplateId(selectedTemplateId);
    store.setStudioView('template');
    if (actionId === 'library.copy-published-template') {
      toast({ title: 'Editable copy created', description: `${item.name} is now in your personal Templates.` });
    }
    projection.router.push(createStudioHref({ returnTo: createLibraryStudioReturnTo() }));
  };

  const runAction = (action: ActionDescriptor) => {
    if (action.id === 'library.close-locations' || action.id === 'library.close-tool') {
      const focusId = action.id === 'library.close-locations'
        ? 'library-locations-trigger'
        : activeTool === 'edit-contribution' && editingSubmission
          ? `library-object-pipeline:${editingSubmission.targetRegistryAssetId ?? editingSubmission.registryAssetId ?? editingSubmission.id}`
          : 'library-contribute-trigger';
      setActiveTool(null); setEditingSubmission(null); projection.router.replace(`/account?section=library&scope=${activeScope}`);
      requestAnimationFrame(() => document.getElementById(focusId)?.focus());
    } else if (currentItem?.scope === 'personal' && action.id.startsWith('library.')) runPersonalAction(action.id, currentItem.personal);
    else if ((action.id === 'library.use-published' || action.id === 'library.copy-published-template') && currentItem?.scope === 'published') void runPublishedAction(action.id, currentItem);
    else if (action.id === 'library.edit-pipeline' && currentItem?.scope === 'pipeline') {
      setEditingSubmission(currentItem.pipeline.submission);
      setActiveTool('edit-contribution');
      closeDetail();
    }
    else if (action.id === 'library.test-pipeline' && currentItem?.scope === 'pipeline' && currentItem.pipeline.template) {
      const store = useProjectStore.getState();
      const templateId = store.addOrUpdateTemplate(currentItem.pipeline.template, 'user');
      store.setTemplateEditorSelectedTemplateId(templateId);
      store.setStudioView('template');
      toast({ title: 'Exact Pipeline revision prepared', description: `${currentItem.name} is open as a local test copy. The shared revision is unchanged.` });
      projection.router.push(createStudioHref({ returnTo: createLibraryStudioReturnTo() }));
    }
    else if (action.id === 'library.refresh') refresh();
  };

  const confirmDeleteCopy = async () => {
    const item = pendingDeleteItem;
    if (!item) return;
    try {
      if (item.references.localSetId) {
        const store = useProjectStore.getState();
        if (store.cardSets.length <= 1) store.createCardSet();
        if (!useProjectStore.getState().deleteCardSet(item.references.localSetId)) throw new Error('The device copy could not be removed.');
      } else if (item.references.driveFileId && item.references.driveProviderRevision && item.references.driveProjectRevision) {
        await deleteGoogleDriveProjectCopy({
          fileId: item.references.driveFileId,
          providerRevision: item.references.driveProviderRevision,
          projectRevision: item.references.driveProjectRevision,
        });
      } else {
        throw new Error('Reload this location before deleting it so CardForge has its exact revision.');
      }
      toast({ title: 'Copy removed', description: `Only the named ${item.locations[0]?.label ?? 'location'} copy of ${item.name} was removed.` });
      closeDetail();
      projection.refresh();
    } catch (error) {
      toast({ title: 'Copy was not removed', description: error instanceof Error ? error.message : 'The source location rejected this deletion.', variant: 'destructive' });
    } finally {
      setPendingDeleteItem(null);
    }
  };

  const scopeDefinition = scopeDefinitions.find((definition) => definition.id === activeScope)!;
  return <>
  <EnvironmentShell
    ariaLabel="CardForge Library" brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }} viewer={viewer}
    zones={zones} activeZone="library" viewportPolicy="desk" detail={activeTool ? null : currentRecord}
    detailVisual={currentItem ? <LibraryVisual item={currentItem} cards={cardsFor(currentItem)} template={templateFor(currentItem)} large /> : undefined}
    detailContent={currentItem?.scope === 'pipeline' ? <PipelineDetailContent
      item={currentItem}
      onVoteRevision={(submissionId, name, value) => void vote(submissionId, name, value)}
      canReview={experience.contributor.canReview}
      votingId={votingId}
      isSelfVoteBlocked={(contributorId) => Boolean(
        shared.program
        && !shared.program.settings.allowContributorSelfVoting
        && shared.program.currentContributorIds.includes(contributorId)
      )}
    /> : undefined}
    actions={actions} accountControl={<PublicAuthControls />} focusReturnId={selection.focusReturnId ?? undefined} surfaceRef={surfaceRef}
    statusContent={<><EnvironmentStatus label={`${scopeDefinition.label} · ${activeStatus.label}`} tone={activeStatus.kind === 'unavailable' ? 'warning' : activeStatus.kind === 'ready' ? 'success' : 'neutral'} /><EnvironmentStatus label={activeScope === 'campaigns' ? 'Access-gated marketing work' : `${scopeItems.length} ${activeScope} object${scopeItems.length === 1 ? '' : 's'}`} tone="neutral" /></>}
    footerContent={activeTool ? <span>{activeTool === 'locations' ? 'Nothing moves between locations automatically' : activeTool === 'edit-contribution' ? 'Only your current Pipeline submission details will change' : 'Submission preserves the selected source until you confirm'}</span> : currentRecord ? <span>{currentRecord.title} selected</span> : <span>Work stays in its named location until you move it.</span>}
    onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)} onCommand={() => searchRef.current?.focus()}
    onAction={runAction} onCloseDetail={closeDetail}
  >
    <div className={styles.library} data-density={density} data-tool-open={Boolean(activeTool)}>
      <header className={styles.libraryHeader}>
        <div><p>Library</p><h1>Your materials and work</h1><span>Browse what you own, what CardForge publishes, and what is moving through review.</span></div>
        <button id="library-locations-trigger" type="button" className={styles.locationsButton} onClick={() => { setActiveTool('locations'); closeDetail(); projection.router.replace('/account?section=storage'); }}><HardDrive size={16} aria-hidden="true" />Locations</button>
      </header>
      <nav className={styles.scopeTabs} aria-label="Library scopes">
        {scopeDefinitions.map((definition) => <button key={definition.id} type="button" aria-current={activeScope === definition.id ? 'page' : undefined} onClick={() => chooseScope(definition.id)}><span>{definition.label}</span><small>{definition.owner}</small></button>)}
      </nav>
      {storageCallback ? <EnvironmentBoundaryNotice title={storageCallback.title} message={storageCallback.message} /> : null}
      <section className={styles.collection} aria-labelledby="library-collection-heading">
        <div className={styles.collectionHeading}><div><h2 id="library-collection-heading">{scopeDefinition.label}</h2><p>{scopeDefinition.description}</p></div>{activeScope === 'campaigns' ? null : <span>{viewItems.length} shown</span>}</div>
        {activeScope === 'campaigns' ? <CampaignLibraryWorkspace initialCampaignId={campaignTargetId} /> : <>
        <div className={styles.toolbar} aria-label="Library toolbar">
          <label className={styles.searchField}><span className="sr-only">Search Library</span><Search aria-hidden="true" /><Input ref={searchRef} id="library-search" value={projection.query} onChange={(event) => projection.setQuery(event.target.value)} placeholder={`Search ${activeScope}`} /></label>
          {activeScope === 'personal' ? <>
            <SelectionFilterMenu allLabel="All sources" ariaLabel="Filter by source" compactLabel="Source" className={styles.filterSelect} value={projection.source} onChange={projection.setSource} options={LIBRARY_SOURCES.map((source) => ({ value: source, label: `${getAccountLibrarySourceLabel(source)} · ${projection.sourceCounts.get(source) ?? 0}` }))} />
            <SelectionFilterMenu allLabel="All types" ariaLabel="Filter by type" compactLabel="Type" className={styles.filterSelect} value={projection.kind} onChange={projection.setKind} options={ACCOUNT_LIBRARY_KINDS.map((kind) => ({ value: kind, label: accountLibraryKindLabels[kind] }))} />
          </> : <SelectionFilterMenu allLabel={activeScope === 'pipeline' ? 'All work' : 'All types'} ariaLabel={activeScope === 'pipeline' ? 'Filter Pipeline' : 'Filter by type'} className={styles.filterSelect} value={sharedType} onChange={setSharedType} options={sharedTypes.map((value) => ({ value, label: value }))} />}
          <Select value={projection.sort} onValueChange={(value) => projection.setSort(value as 'recent' | 'name' | 'kind')}><SelectTrigger aria-label="Sort library" className={styles.sortSelect}><span>{projection.sort === 'name' ? 'Name' : projection.sort === 'kind' ? 'Type' : 'Recent'}</span></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="kind">Type</SelectItem></SelectContent></Select>
          <div className={styles.densityControls} aria-label="Collection view"><button type="button" aria-label="Gallery view" aria-pressed={density === 'gallery'} onClick={() => setDensity('gallery')}><Grid2X2 aria-hidden="true" /></button><button type="button" aria-label="Compact list view" aria-pressed={density === 'list'} onClick={() => setDensity('list')}><LayoutList aria-hidden="true" /></button><button type="button" aria-label="Expanded view" aria-pressed={density === 'expanded'} onClick={() => setDensity('expanded')}><PanelRightOpen aria-hidden="true" /></button></div>
          {experience.contributor.canSubmit && activeScope === 'published' ? <button id="library-contribute-trigger" type="button" className={styles.contributeButton} onClick={() => openContributionTool()}><UploadCloud size={16} aria-hidden="true" />Submit new</button> : null}
        </div>
        {activeFailure ? <EnvironmentBoundaryNotice title={`${scopeDefinition.label} is unavailable`} message={`${activeFailure.message}${activeFailure.nextAction ? ` ${activeFailure.nextAction}` : ''} Other Library scopes remain unchanged.`} actionLabel={activeFailure.retryable ? 'Retry' : undefined} onAction={activeFailure.retryable ? refresh : undefined} /> : null}
        {activeFailure && !scopeItems.length ? null : activeLoading && !scopeItems.length ? <div className={styles.emptyState}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing {activeScope}</strong></div> : viewItems.length ? <div className={styles.objectGrid} aria-label={`${activeScope} Library objects`}>
          {viewItems.map((item) => {
            const pipelineItem = item.scope === 'pipeline' ? item : null;
            const lineageId = pipelineLineageFor(item);
            const heart = lineageId ? heartMetrics[lineageId] ?? { count: 0, hearted: false } : null;
            return <article key={item.id} className={styles.objectTile} data-selected={selection.objectId === item.id}>
              <button id={`library-object-${item.id}`} type="button" className={styles.objectButton} onClick={() => openDetail(item)}><span className={styles.visualSlot}><LibraryVisual item={item} cards={cardsFor(item)} template={templateFor(item)} /></span><span className={styles.objectCopy}><span className={styles.objectTopline}><small>{item.kindLabel}</small><small>{item.statusLabel}</small></span><strong>{item.name}</strong><span>{item.sourceLabel}</span><p>{item.summary}</p></span></button>
              {item.scope === 'personal' ? <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className={styles.objectMenu} aria-label={`Actions for ${item.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {personalActions(item.personal).map((action) => <Fragment key={action.id}>
                    {action.commitment === 'destructive' ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      disabled={action.availability.kind === 'disabled'}
                      title={action.availability.kind === 'disabled' ? action.availability.reason : undefined}
                      className={action.commitment === 'destructive' ? 'text-destructive focus:text-destructive' : undefined}
                      onSelect={() => runPersonalAction(action.id, item.personal)}
                    >
                      {action.id === 'library.send-pipeline' ? <UploadCloud aria-hidden="true" /> : action.id === 'library.duplicate' ? <Copy aria-hidden="true" /> : action.id === 'library.delete-copy' ? <Trash2 aria-hidden="true" /> : action.id === 'library.view-source' ? <ExternalLink aria-hidden="true" /> : null}
                      {action.label}
                    </DropdownMenuItem>
                  </Fragment>)}
                </DropdownMenuContent>
              </DropdownMenu> : item.scope === 'published' ? <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className={styles.objectMenu} aria-label={`Actions for ${item.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sharedActions(item).map((action) => <DropdownMenuItem key={action.id} onSelect={() => void runPublishedAction(action.id, item)}>
                    {action.id === 'library.copy-published-template' ? <Copy aria-hidden="true" /> : null}
                    {action.label}
                  </DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu> : null}
              {heart ? <div className={styles.reactionActions}>
                <button type="button" disabled={heartingId === lineageId} data-active={heart.hearted} onClick={() => void toggleHeart(item)} aria-label={`${heart.hearted ? 'Remove heart from' : 'Heart'} ${item.name}`} title={isSignedIn ? 'Heart this Pipeline object' : 'Sign in to heart this Pipeline object'}><Heart aria-hidden="true" />{heart.count}</button>
                {pipelineItem && experience.contributor.canReview ? <>
                  <button type="button" disabled={votingId === pipelineItem.pipeline.submission.id || pipelineItem.pipeline.reviewState === 'self'} data-active={pipelineItem.pipeline.submission.currentUserVote === 'positive'} onClick={() => void vote(pipelineItem.pipeline.submission.id, item.name, 'positive')} aria-label={`Vote up for ${item.name}`} title={pipelineItem.pipeline.reviewState === 'self' ? 'Contributor self-voting is disabled by the owner.' : 'Vote up on this exact revision'}><ThumbsUp aria-hidden="true" />{pipelineItem.pipeline.submission.positiveVotes}</button>
                  <button type="button" disabled={votingId === pipelineItem.pipeline.submission.id || pipelineItem.pipeline.reviewState === 'self'} data-active={pipelineItem.pipeline.submission.currentUserVote === 'negative'} onClick={() => void vote(pipelineItem.pipeline.submission.id, item.name, 'negative')} aria-label={`Vote down for ${item.name}`} title={pipelineItem.pipeline.reviewState === 'self' ? 'Contributor self-voting is disabled by the owner.' : 'Vote down on this exact revision'}><ThumbsDown aria-hidden="true" />{pipelineItem.pipeline.submission.negativeVotes}</button>
                </> : null}
              </div> : null}
            </article>;
          })}
        </div> : <div className={styles.emptyState}><Boxes aria-hidden="true" /><strong>{scopeItems.length ? 'No objects match this view' : `${scopeDefinition.label} is ready`}</strong><p>{scopeItems.length ? 'Clear the search or change the filter.' : activeScope === 'personal' ? 'Create a Set or connect a location to begin.' : activeScope === 'published' ? 'Your published Pipeline work will appear here.' : 'Shared work available to your account will appear here.'}</p></div>}
        </>}
      </section>
      {activeTool === 'locations' ? (
        <EnvironmentToolLayer
          id="library-locations-title"
          eyebrow="Library tool"
          title="Locations & connections"
          summary="Inspect one owner at a time. Changes affect only the named location."
          closeLabel="Close locations and connections"
          onClose={() => runAction(actions[0]!)}
        >
          <DefaultWorkLocationControl isSignedIn={isSignedIn} canUseProjectFiles={experience.capabilities.canUseProjectFiles} driveConnected={projection.driveConnection?.connected ?? false} localFolderSupported={projection.localFolderSupported} />
          {storageConnections ?? <EnvironmentBoundaryNotice title="Location tools are unavailable" message="CardForge could not compose the location controls. Existing work remains unchanged." />}
        </EnvironmentToolLayer>
      ) : null}
      {activeTool === 'contribute' ? (
        <EnvironmentToolLayer
          id="library-contribute-title"
          eyebrow="Library tool"
          title="Submit & revise Pipeline work"
          summary="Use the same Library objects, exact revisions, voting rules, and publication lifecycle."
          closeLabel="Close contribution tool"
          onClose={() => runAction(actions[0]!)}
        >
          <PipelineContributionPanel compact initialSubmitSetId={contributionTargetSetId} />
        </EnvironmentToolLayer>
      ) : null}
      {activeTool === 'edit-contribution' && editingSubmission ? (
        <EnvironmentToolLayer
          id="library-edit-contribution-title"
          eyebrow="Pipeline tool"
          title={`Edit ${editingSubmission.name}`}
          summary="Update the current submission without leaving its Library context or changing the shared object behind your back."
          closeLabel="Close submission editor"
          onClose={() => runAction(actions[0]!)}
        >
          <PipelineSubmissionEditPanel
            submission={editingSubmission}
            onCancel={() => runAction(actions[0]!)}
            onUpdated={async () => {
              await shared.refresh();
              runAction(actions[0]!);
            }}
          />
        </EnvironmentToolLayer>
      ) : null}
    </div>
  </EnvironmentShell>
  <WorkLocationDialog
    item={locationItem}
    open={Boolean(locationItem)}
    onOpenChange={(open) => { if (!open) setLocationItem(null); }}
    isSignedIn={isSignedIn}
    canUseProjectFiles={experience.capabilities.canUseProjectFiles}
    driveConnected={projection.driveConnection?.connected ?? false}
    localFolderSupported={projection.localFolderSupported}
    onChanged={projection.refresh}
  />
  <AlertDialog open={Boolean(pendingDeleteItem)} onOpenChange={(open) => { if (!open) setPendingDeleteItem(null); }}>
    <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this copy?</AlertDialogTitle>
        <AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">
          {pendingDeleteItem?.references.localSetId
            ? `Only the device copy of ${pendingDeleteItem.name} will be removed. Other verified locations remain unchanged.`
            : `The Google Drive copy of ${pendingDeleteItem?.name ?? 'this Set'} will be permanently removed at its exact current revision. Device and local-folder copies remain unchanged.`}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void confirmDeleteCopy()}>Delete named copy</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  </>;
}
