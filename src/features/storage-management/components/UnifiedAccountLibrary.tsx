"use client";
import { getPipelineTrashState } from '@/features/pipeline/client';

import { PIPELINE_ENGAGEMENT_CHANGED, notifyPipelineEngagementChanged, loadPipelineEngagement, loadPipelineHeartMetric, submitPipelineVote, submitPipelineHeart, PipelineSourceDisclosure, type PipelineDesignSource } from '@/features/pipeline/client/engagement';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HardDrive } from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import type { DisplayCard } from '@/domain/rendering';
import { getCardTitle, type CardFace } from '@/domain/cards';
import { createCardFaceExportRenderer, getExportProfile } from '@/features/card-generator/client/export';
import { createGoogleDriveProjectThumbnail } from '@/features/card-generator/client';
import { LinkedFolderSave, SelectedDriveFileActions } from '@/features/project/client/locations';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { PublicAuthControls } from '@/features/account/client/auth';
import {
  ENVIRONMENT_ZONES, EnvironmentBoundaryNotice, EnvironmentSearch, EnvironmentShell, EnvironmentStatus, EnvironmentToolLayer, useEnvironmentToolLifecycle,
  closeEnvironmentDetail, closeEnvironmentToolSession, createSelectionSession, deriveEnvironmentPresentation, getVisibleEnvironmentZones,
  openEnvironmentDetail, openEnvironmentToolSession, setEnvironmentToolSessionDirty,
  type EnvironmentToolSession, type EnvironmentViewer, type SelectionSession,
} from '@/features/app-shell/client/environment';
import type { WorkbenchBusinessIdentity } from '@/features/creator-workbench/client';
import { EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE } from '@/features/contributor-access/client';
import { buildPipelineContentHealth, PipelineContentHealthPanel, type PipelineSubmission } from '@/features/pipeline/client';
import { shouldOfferGoogleDriveReconciliation, useGoogleDriveWorkingSession } from '@/features/project/client/provider-google-drive';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import { NewSetDialog, usePublishedSetStarters } from '@/features/project/client/new-set';
import { useProjectLibraryWorkspace, type LibraryCardEditSession } from '@/features/project/client/libraryWorkspace';
import { FocusedArtifactWorkspace } from '@/features/artifact-edit/client';
import { CardRemovalUndo, SetDirection, SetTemplates, SetUpdates, WorkspaceUpdateNotices, useWorkspaceUpdates, useProjectDownload } from '@/features/project/client/ui';
import { createDeskReturnHref } from '@/features/app-shell/client/navigation';
import { CardPreview, getTemplateAccent } from '@/features/card-rendering/client';
import { retainReviewedTemplateAttempt, resolveTemplatePipelineAttempt } from '@/features/template-editor/client';

import { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import { useAccountLibraryActions } from '../hooks/useAccountLibraryActions';
import { useLibrarySharedProjection } from '../hooks/useLibrarySharedProjection';
import { useLibraryReturnContext } from '../hooks/useLibraryReturnContext';
import { useUnifiedLibraryView, toPipelineLibraryViewItem } from '../hooks/useUnifiedLibraryView';
import type { AccountLibraryItem } from '../model/accountLibrary';
import {
  getLibraryScopeDefinitions, resolveLibraryScopeForViewer,
  type LibraryDensity, type LibraryScope,
} from '../model/libraryScopes';
import { useLibraryRevisionQueue } from '../hooks/useLibraryRevisionQueue';
import { LibraryRevisionQueueControls } from './LibraryRevisionQueueControls';
import { SharedPipelineTrashCollection } from './SharedPipelineTrashCollection';
import { LibraryCollection } from './LibraryCollection';
import { SetTrashDialog } from './SetTrashDialog';
import {
  LibraryDetailVisual,
  PipelineDetailContent,
  PublishedRevisionFeedback,
  createLibraryZoneAction,
  createLibraryDetailRecord as detailRecord,
  pipelineLineageFor,
  type LibraryViewItem,
} from './LibraryObjectPresentation';
import { DefaultWorkLocationControl, WorkLocationDialog } from './WorkLocationDialog';
import styles from './UnifiedAccountLibrary.module.css';
import { createPipelineReviewTarget, type PipelineReviewTarget } from '@/features/pipeline/client';
import { libraryReviewSelection } from '../lib/libraryReviewSelection';
const LibraryRevisionEntry = dynamic(() => import('./LibraryRevisionEntry').then(module => module.LibraryRevisionEntry));
const TemplatePipelineAttemptRecovery = dynamic(() => import('@/features/template-editor/client').then(module => module.TemplatePipelineAttemptRecovery));
const ignoreAttemptState = () => {};

const renderTemplatePreview = (card: DisplayCard, face: 'front' | 'back', targetWidthPx: number, highlightedElementId?: string) => (
  <CardPreview card={card} face={face} targetWidthPx={targetWidthPx} highlightedElementId={highlightedElementId} />
);

const renderPipelineTemplateSpecimen = async (
  card: DisplayCard,
  face: CardFace,
  dpi: number,
): Promise<Blob> => {
  const profile = { ...getExportProfile('physical', dpi), canvasPixelRatio: 1 };
  const renderer = createCardFaceExportRenderer(profile);
  try {
    return await renderer.renderToBlob(card, face);
  } finally {
    renderer.cleanup();
  }
};

const PipelineContributionPanel = dynamic(() => import(
  '@/features/pipeline/client/contribution-panel'
).then((module) => module.PipelineContributionPanel));
const PipelineSubmissionEditPanel = dynamic(() => import(
  '@/features/pipeline/client/submission-edit-panel'
).then((module) => module.PipelineSubmissionEditPanel));
const OwnerContributorProgramPanel = dynamic(() => import(
  '@/features/pipeline/client/owner'
).then((module) => module.OwnerContributorProgramPanel));
const LibraryDesignWorkspace = dynamic(() => import(
  '@/features/creator-workbench/client'
).then((module) => module.CreatorWorkbench), { ssr: false });

type LibraryToolId = 'review-manage' | 'pipeline-operations' | 'revise-existing' | 'locations' | 'contribute' | 'edit-contribution' | 'design' | 'card-edit';

const createLibraryToolSession = (
  toolId: LibraryToolId,
  targetIds: readonly string[] = [],
): EnvironmentToolSession<LibraryToolId> => ({
  instanceId: `library-${toolId}`,
  toolId,
  ownerFeature: toolId === 'locations'
    ? 'storage-management'
    : toolId === 'design'
      ? 'template-editor'
      : toolId === 'card-edit' ? 'card-generator'
      : 'pipeline',
  presentation: toolId === 'design' || toolId === 'card-edit' ? 'floating' : 'sheet',
  targetIds: [...targetIds],
  dirty: false,
});

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  experience: AccountExperienceProjection;
  businessIdentity: WorkbenchBusinessIdentity;
  initialReturnContextKey?: string | null;
  initialTool?: 'locations' | null;
  initialCampaignNotice?: { kind: 'success' | 'error'; message: string };
  storageConnections?: ReactNode;
}

export function UnifiedAccountLibrary({ persistenceScope, experience, businessIdentity, initialReturnContextKey = null, initialTool = null, initialCampaignNotice, storageConnections }: UnifiedAccountLibraryProps) {
  const isSignedIn = experience.signedIn;
  const pipelineAccess = experience.contributor.canSubmit || experience.contributor.canReview || experience.contributor.canPublish;
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const { toast } = useToast();
  const workspaceUpdates = useWorkspaceUpdates();
  const updateSetIds = useMemo(() => new Set(workspaceUpdates.sets.filter((set) => set.pending > 0).map((set) => set.set.id)), [workspaceUpdates.sets]);
  const [campaignDirty, setCampaignDirty] = useState(false);
  const [campaignCloseBlocked, setCampaignCloseBlocked] = useState<string | null>(null);
  const campaignExitReason = campaignCloseBlocked ?? (campaignDirty ? 'Save or cancel campaign edits before starting a Set.' : undefined);
  const [scope, setScope] = useState<LibraryScope>('personal');
  const campaignAccess = experience.contributor.canDraftCampaigns || experience.owner;
  const activeScope = resolveLibraryScopeForViewer(scope, { contributor: pipelineAccess, campaigns: campaignAccess, owner: experience.owner });
  const shared = useLibrarySharedProjection({ pipelineEnabled: pipelineAccess, activeScope });
  const [sharedTrashMode, setSharedTrashMode] = useState(false);
  const [sharedTrashRefreshEpoch, setSharedTrashRefreshEpoch] = useState(0);


  const [revisionMode, setRevisionMode] = useState(false);
  const revisionsEnabled = activeScope === 'pipeline' && experience.owner && isSignedIn && revisionMode;
  const revisionQueue = useLibraryRevisionQueue({ enabled: revisionsEnabled, query: projection.query, catalog: shared.catalog, catalogLoading: shared.catalogLoading, catalogFailure: shared.catalogFailure });
  const [density, setDensity] = useState<LibraryDensity>('gallery');
  const [sharedType, setSharedType] = useState('all');
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const [toolStack, setToolStack] = useState<EnvironmentToolSession<LibraryToolId>[]>(() => (
    initialTool ? [createLibraryToolSession(initialTool)] : []
  ));
  const activeToolSession = toolStack.at(-1) ?? null;
  const activeTool = activeToolSession?.toolId ?? null;
  const sharedTrashSessionKey = JSON.stringify([activeScope, isSignedIn, experience.owner, persistenceScope, sharedTrashMode, activeTool]);
  const toolDirty = activeToolSession?.dirty ?? false;
  const [cardEditSession, setCardEditSession] = useState<LibraryCardEditSession | null>(null);
  const [pendingCardRemoval, setPendingCardRemoval] = useState<{ session: LibraryCardEditSession; itemId: string; name: string } | null>(null);
  const cardsSectionRef = useRef<HTMLElement | null>(null);
  const removedCardFocusRef = useRef(false);
  const [cardQuery, setCardQuery] = useState('');
  const cardEditContext = useRef({ scope: persistenceScope, itemId: '' });
  const libraryMounted = useRef(false);
  const setOpenContext = useRef('');
  useEffect(() => { libraryMounted.current = true; return () => { libraryMounted.current = false; }; }, []);
  const [designSourceState, setDesignSourceState] = useState<{ scope: string; source: PipelineDesignSource } | null>(null);
  const designSourceScope = persistenceScope;
  const designSource = designSourceState?.scope === designSourceScope ? designSourceState.source : null;
  useEffect(() => { setDesignSourceState(null); }, [designSourceScope]);
  const setDesignSource = (source: PipelineDesignSource | null) => setDesignSourceState(source ? { scope: designSourceScope, source } : null);
  const [designReturnFocusId, setDesignReturnFocusId] = useState<string | null>(null);
  const [discardToolRequested, setDiscardToolRequested] = useState(false);
  const [contributionTargetSetId, setContributionTargetSetId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<PipelineReviewTarget | null>(null);
  const [toolCloseBlocked, setToolCloseBlocked] = useState<string | null>(null);
  const [revisionKind, setRevisionKind] = useState<'templates' | 'elementPresets' | null>(null);
  const sharedTrashRequestEpoch = useRef(0);
  const sharedTrashContext = useRef('');
  const reviewReturn = useRef<{ focus: HTMLElement | null; focusId?: string | null; scroll: number } | null>(null);
  sharedTrashContext.current = sharedTrashSessionKey;
  useEffect(() => { sharedTrashRequestEpoch.current += 1; }, [sharedTrashSessionKey]);
  const [editingSubmission, setEditingSubmission] = useState<PipelineSubmission | null>(null);
  const revisionHandoffContext = useRef('');
  const revisionHandoffMounted = useRef(false);
  revisionHandoffContext.current = JSON.stringify([sharedTrashSessionKey, editingSubmission?.id ?? null, experience.contributor.active]);
  useEffect(() => { revisionHandoffMounted.current = true; return () => { revisionHandoffMounted.current = false; }; }, []);
  const [requestedSubmissionId, setRequestedSubmissionId] = useState<string | null>(null);
  const [campaignTargetId, setCampaignTargetId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const voteInFlight = useRef(false);
  const [voteAttempt, setVoteAttempt] = useState<{ submissionId: string; outcome: 'committed' | 'uncertain'; message: string; readConfirmed?: boolean } | null>(null);
  const [voteMetrics, setVoteMetrics] = useState<Record<string, { positiveVotes: number; negativeVotes: number; currentUserVote: 'positive' | 'negative' | null; voteIssue: string | null }>>({});
  const voteMetricsRef = useRef(voteMetrics);
  voteMetricsRef.current = voteMetrics;
  const voteReadEpoch = useRef<Record<string, number>>({});
  const voteScopeEpoch = useRef(0);
  const [voteReadStatus, setVoteReadStatus] = useState<Record<string, 'pending' | 'failed'>>({});
  const readExactVote = useCallback(async (submissionId: string) => {
    const epoch = (voteReadEpoch.current[submissionId] ?? 0) + 1;
    voteReadEpoch.current[submissionId] = epoch;
    const scopeEpoch = voteScopeEpoch.current;
    setVoteReadStatus(current => ({ ...current, [submissionId]: 'pending' }));
    const current = () => voteScopeEpoch.current === scopeEpoch && voteReadEpoch.current[submissionId] === epoch;
    try {
      const exact = await loadPipelineEngagement(submissionId);
      if (!current()) return false;
      setVoteMetrics(previous => ({ ...previous, [submissionId]: { positiveVotes: exact.positiveVotes, negativeVotes: exact.negativeVotes, currentUserVote: exact.currentUserVote, voteIssue: exact.voteIssue } }));
      setVoteReadStatus(previous => { const next = { ...previous }; delete next[submissionId]; return next; });
      return true;
    } catch {
      if (current()) setVoteReadStatus(previous => ({ ...previous, [submissionId]: 'failed' }));
      return false;
    }
  }, []);
  const isVoteBlocked = (submissionId: string) => Boolean(votingId || voteAttempt || voteReadStatus[submissionId]);
  const [heartingId, setHeartingId] = useState<string | null>(null);
  const heartInFlight = useRef(false);
  const heartReadEpoch = useRef(0);
  const [heartAttempt, setHeartAttempt] = useState<{ lineageId: string; message: string; readConfirmed?: boolean } | null>(null);
  const [heartMetrics, setHeartMetrics] = useState<Record<string, { count: number; hearted: boolean }>>({});
  const [heartMetricsLoading, setHeartMetricsLoading] = useState(false);
  const [heartMetricsFailed, setHeartMetricsFailed] = useState(false);
  const [storageCallback, setStorageCallback] = useState<{ title: string; message: string } | null>(null);
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<AccountLibraryItem | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const projectWorkspace = useProjectLibraryWorkspace();
  const { createSet: createProjectSet, activateSet: activateCreatedSet } = projectWorkspace.actions;
  const focusCreatedSet = (setId: string, design = false) => {
    activateCreatedSet(setId);
    const href = createDeskReturnHref(`set:${setId}`, undefined, createLibraryCompatibilityReturnTo());
    projection.router.push(design ? `${href}&tool=design` : href);
  };
  const setStarters = usePublishedSetStarters({ focusCreatedSet, refreshLibrary: projection.refresh });
  const createSet = (design: boolean) => {
    if (campaignExitReason) { toast({ title: 'Keep campaign work open', description: campaignExitReason }); return; }
    const id = createProjectSet();
    setStarters.setCreateOpen(false);
    focusCreatedSet(id, design);
  };
  const { displayCards, templates, cardSets } = projectWorkspace;
  const { openTemplateDesign } = projectWorkspace.actions;
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, contributor: experience.contributor.active, owner: experience.owner };
  const scopeDefinitions = getLibraryScopeDefinitions({ contributor: pipelineAccess, campaigns: campaignAccess, owner: experience.owner });
  const visibleZones = getVisibleEnvironmentZones(viewer);
  const libraryDefinition = ENVIRONMENT_ZONES.find((zone) => zone.id === 'library')!;
  const zones = visibleZones.some((zone) => zone.id === 'library') ? visibleZones : [{ ...libraryDefinition, minimumAccess: 'guest' as const }, ...visibleZones];

  const openTool = (toolId: LibraryToolId, targetIds: readonly string[] = []) => {
    setToolStack(openEnvironmentToolSession([], createLibraryToolSession(toolId, targetIds)));
  };
  const closeTool = () => {
    setDesignSource(null);
    setCardEditSession(null);
    setToolStack((current) => closeEnvironmentToolSession(current).stack);
  };
  const setToolDirty = useCallback((dirty: boolean) => {
    setToolStack((current) => {
      const active = current.at(-1);
      return active && active.dirty !== dirty ? setEnvironmentToolSessionDirty(current, active.instanceId, dirty) : current;
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedScope = params.get('scope');
    if (requestedScope === 'published' || requestedScope === 'pipeline' || requestedScope === 'campaigns') setScope(requestedScope);
    const tool = params.get('tool');
    if ((tool === 'edit-contribution' || tool === 'contribute') && params.get('submission') && experience.contributor.canSubmit) {
      setRequestedSubmissionId(params.get('submission'));
    } else if (tool === 'contribute' && experience.contributor.canSubmit) {
      const setId = params.get('submitSet');
      setToolStack(openEnvironmentToolSession([], createLibraryToolSession('contribute', setId ? [setId] : [])));
      setContributionTargetSetId(setId);
    } else if (tool === 'design' && params.get('artifact')) {
      const templateId = params.get('artifact')!;
      openTemplateDesign(templateId);
      setToolStack(openEnvironmentToolSession([], createLibraryToolSession('design', [templateId])));
    }
    setCampaignTargetId(params.get('campaign'));
    const status = params.get('storage');
    if (status === 'google-drive-connected') setStorageCallback({ title: 'Google Drive connected', message: 'Choose an existing project folder or create a new one before saving projects to Drive.' });
    else if (status === 'google-drive-error') setStorageCallback({ title: 'Google Drive could not be connected', message: params.get('message') || 'Review Locations & connections and try again. Existing work remains unchanged.' });
    else setStorageCallback(null);
  }, [experience.contributor.canSubmit, openTemplateDesign]);
  useEffect(() => {
    if (!requestedSubmissionId || !shared.program) return;
    const submission = shared.program.submissions.find((candidate) => candidate.id === requestedSubmissionId);
    if (submission && shared.program.currentContributorIds.includes(submission.contributorId)
      && !submission.trashedAt && !submission.purgeState
      && ['draft', 'submitted', 'voting', 'publish_candidate'].includes(submission.status)) {
      setEditingSubmission(submission);
      setToolStack(openEnvironmentToolSession([], createLibraryToolSession('edit-contribution', [submission.id])));
    } else {
      toast({ title: 'Pipeline draft unavailable', description: 'This exact revision cannot be edited here. Find your current revision in Pipeline Library.', variant: 'destructive' });
    }
    setRequestedSubmissionId(null);
  }, [requestedSubmissionId, shared.program, toast]);
  useEffect(() => {
    if (scope === activeScope) return;
    setScope(activeScope);
    setSharedType('all');
    setSelection(closeEnvironmentDetail);
    projection.router.replace(`/account?section=library&scope=${activeScope}`);
  }, [activeScope, projection.router, scope]);
  useEffect(() => {
    if (initialTool) setToolStack(openEnvironmentToolSession([], createLibraryToolSession(initialTool)));
  }, [initialTool]);

  const { activeFailure, activeLoading, activeStatus, itemMap, scopeItems, sharedTypes, unfilteredScopeItemCount, viewItems } = useUnifiedLibraryView({
    activeScope,
    pipelineAccess,
    projection,
    shared,
    sharedType,
    revisionPage: revisionsEnabled ? revisionQueue : undefined,
    updateSetIds,
  });
  const revisionNavigationKey = JSON.stringify([revisionQueue.page, revisionQueue.status, revisionQueue.assetType, revisionQueue.trash, projection.query]);
  const priorRevisionNavigation = useRef(revisionNavigationKey);
  useEffect(() => {
    if (!activeTool && revisionsEnabled && priorRevisionNavigation.current !== revisionNavigationKey) setSelection(closeEnvironmentDetail);
    if (!activeTool) priorRevisionNavigation.current = revisionNavigationKey;
  }, [activeTool, revisionsEnabled, revisionNavigationKey]);
  const currentItem = selection.objectId ? itemMap.get(selection.objectId) ?? null : null;
  cardEditContext.current = { scope: persistenceScope, itemId: selection.objectId ?? '' };
  setOpenContext.current = JSON.stringify([persistenceScope, activeScope, activeTool, selection.objectId]);
  const contentHealth = useMemo(() => buildPipelineContentHealth({ catalog: shared.catalog, program: shared.program }), [shared.catalog, shared.program]);
  const publishedRevisionByLineage = useMemo(() => new Map(
    shared.pipelineItems.flatMap((item) => item.currentPublishedSubmission?.lineageId
      ? [[item.currentPublishedSubmission.lineageId, item.currentPublishedSubmission] as const]
      : []),
  ), [shared.pipelineItems]);
  const currentRecord = currentItem ? detailRecord(currentItem) : null;
  const selectedLocalSet = currentItem?.scope === 'personal'
    ? cardSets.find((set) => set.id === currentItem.personal.references.localSetId) : undefined;
  const downloadSelectedSet = useProjectDownload({ canUseProjectFiles: experience.capabilities.canUseProjectFiles, setId: selectedLocalSet?.id ?? null, toast });
  const hasLinkedDrive = Boolean(selectedLocalSet && currentItem?.scope === 'personal' && currentItem.personal.references.driveFileId);
  const driveWorkingSession = useGoogleDriveWorkingSession({
    setId: selectedLocalSet?.id ?? null,
    name: selectedLocalSet?.name ?? 'CardForge Set',
    enabled: hasLinkedDrive && isSignedIn && experience.capabilities.canUseProjectFiles,
    renderThumbnail: createGoogleDriveProjectThumbnail,
  });
  useEffect(() => { setCardQuery(''); }, [selectedLocalSet?.id]);
  useEffect(() => {
    setCardEditSession(null);
    setPendingCardRemoval(null);
    setToolStack((current) => current.at(-1)?.toolId === 'card-edit' ? [] : current);
  }, [persistenceScope]);
  const prepareSelectedSetHere = async (item: AccountLibraryItem) => {
    const captured = setOpenContext.current;
    try {
      const setId = await projection.prepareSetInLibrary(item, () => libraryMounted.current && setOpenContext.current === captured);
      if (!libraryMounted.current || setOpenContext.current !== captured) return;
      setSelection((current) => openEnvironmentDetail(current, { objectId: `set:${setId}`, listOffset: current.listOffset, focusReturnId: `library-object-set:${setId}` }));
    } catch (error) {
      toast({ title: 'Set was not opened', description: error instanceof Error ? error.message : 'Refresh the location and try again.', variant: 'destructive' });
    }
  };
  const selectedSetCards = selectedLocalSet ? displayCards.filter((card) => (
    (card.setId ?? cardSets[0]?.id) === selectedLocalSet.id
  )) : [];
  const cardIndexById = new Map(selectedSetCards.map((card, index) => [card.uniqueId, index]));
  const cardTitle = (card: DisplayCard) => getCardTitle(card, cardIndexById.get(card.uniqueId) ?? 0);
  const visibleSetCards = selectedSetCards.filter((card) => (
    cardTitle(card).toLocaleLowerCase().includes(cardQuery.trim().toLocaleLowerCase())
  ));
  const startCardEdit = (setId: string, cardId: string) => {
    const session = projectWorkspace.actions.beginCardEdit(setId, cardId);
    if (!session) { toast({ title: 'Card unavailable', description: 'Refresh this Set before editing. No work was changed.', variant: 'destructive' }); return; }
    setCardEditSession(session);
    setDesignReturnFocusId(`library-edit-card-${cardId}`);
    openTool('card-edit', [setId, cardId]);
  };
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
  const createLibraryCompatibilityReturnTo = useLibraryReturnContext({
    activeLoading, activeScope, campaignAccess, density, initialReturnContextKey, itemMap,
    owner: experience.owner, pipelineAccess, projection, selection, setDensity, setScope, setSelection,
    setSharedType, sharedType, surfaceRef,
  });

  const openReview = (item: LibraryViewItem, revision?: PipelineSubmission) => {
    if (!experience.owner || !isSignedIn) throw new Error('Owner access is required for Review & manage.');
    const rows = [...(shared.program?.submissions ?? []), ...(shared.program?.votingQueue ?? [])];
    const target = revision ? createPipelineReviewTarget(revision) : libraryReviewSelection(item, rows);
    if (!target) throw new Error('The exact selected revision could not be resolved. Refresh Library; no latest revision was substituted.');
    const publication = shared.catalog?.pipeline?.items.find(entry => entry.id === target.assetId
      && entry.lineageId === target.lineageId && entry.submissionId === target.submissionId);
    if (publication?.submissionId) target.catalogPublication = { submissionId: publication.submissionId, updatedAt: publication.updatedAt };
    reviewReturn.current = { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, focusId: selection.focusReturnId ?? `library-object-${item.id}`, scroll: surfaceRef.current?.scrollTop ?? 0 };
    setReviewTarget(target); setRevisionKind(null); openTool('review-manage', [target.lineageId, target.submissionId]);
  };
  const openHealthObject = (objectId: string, submissionId?: string) => {
    const matches = (candidate: LibraryViewItem) => candidate.id === objectId
      || candidate.scope === 'pipeline' && (candidate.pipeline.submission.lineageId === objectId
        || candidate.pipeline.submission.registryAssetId === objectId || candidate.pipeline.submission.targetRegistryAssetId === objectId)
      || candidate.scope === 'published' && (candidate.published.lineageId === objectId || candidate.published.id === objectId);
    const item = scopeItems.find(matches) ?? shared.pipelineItems.map(item => toPipelineLibraryViewItem(item)).find(matches);
    if (!item) { toast({ title: 'Object unavailable', description: 'Refresh the Library before opening this finding.' }); return; }
    if (!submissionId) { openDetail(item); return; }
    const revision = [...(shared.program?.submissions ?? []), ...(shared.program?.votingQueue ?? [])]
      .find(candidate => candidate.id === submissionId && candidate.lineageId === objectId);
    if (!revision) { toast({ title: 'Revision unavailable', description: 'The exact affected revision is no longer loaded. Refresh before continuing.' }); return; }
    if (!experience.owner) {
      if (item.scope === 'pipeline' && item.pipeline.submission.id === submissionId) openDetail(item);
      else toast({ title: 'Revision unavailable', description: 'Refresh before opening this exact affected revision.' });
      return;
    }
    try { openReview(item, revision); }
    catch (error) { toast({ title: 'Revision unavailable', description: error instanceof Error ? error.message : 'Refresh Library.' }); }
  };
  const closeContextualTool = () => {
    closeTool(); setReviewTarget(null); setRevisionKind(null); setToolCloseBlocked(null);
    const restore = reviewReturn.current;
    requestAnimationFrame(() => {
      const focus = restore?.focus?.isConnected ? restore.focus : restore?.focusId ? document.getElementById(restore.focusId) : null;
      focus?.focus({ preventScroll: true });
      surfaceRef.current?.scrollTo({ top: restore?.scroll ?? selection.listOffset });
    });
  };
  const reviseSelected = (submission: PipelineSubmission) => {
    if (toolDirty) { toast({ title: 'Finish the current changes first', description: 'Save your management changes or close and discard them before preparing a revision.' }); return; }
    if (!reviewTarget || submission.id !== reviewTarget.submissionId || submission.status !== 'published'
      || !['templates', 'elementPresets'].includes(submission.assetType)) return;
    setRevisionKind(submission.assetType as 'templates' | 'elementPresets'); openTool('revise-existing', [reviewTarget.submissionId]);
  };
  const chooseScope = (nextScope: LibraryScope) => {
    setScope(nextScope); setSharedType('all'); setSelection(closeEnvironmentDetail); setToolStack([]);
    projection.router.replace(`/account?section=library&scope=${nextScope}`);
  };
  const openContributionTool = ({ setId = null }: { setId?: string | null } = {}) => {
    setContributionTargetSetId(setId);
    openTool('contribute', setId ? [setId] : []);
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
  const refresh = () => { setSharedTrashRefreshEpoch(value => value + 1); projection.refresh(); void shared.refresh(); if (revisionsEnabled) revisionQueue.refresh(); };

  useEffect(() => { ++heartReadEpoch.current; ++voteScopeEpoch.current; setHeartMetrics({}); setVoteMetrics({}); setVoteReadStatus({}); }, [persistenceScope, isSignedIn]);

  useEffect(() => {
    const epoch = ++heartReadEpoch.current;
    const lineageIds = [...new Set(scopeItems.flatMap((item) => pipelineLineageFor(item) ? [pipelineLineageFor(item)!] : []))];
    if (!lineageIds.length) { setHeartMetricsLoading(false); setHeartMetricsFailed(false); return; }
    const query = new URLSearchParams();
    lineageIds.forEach((lineageId) => query.append('lineageId', lineageId));
    let cancelled = false;
    setHeartMetricsLoading(true);
    setHeartMetricsFailed(false);
    void fetch(`/api/pipeline/hearts?${query.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Pipeline reactions are unavailable.'));
        return response.json() as Promise<{ metrics: Array<{ lineageId: string; count: number; hearted: boolean }> }>;
      })
      .then(({ metrics }) => {
        if (!cancelled && epoch === heartReadEpoch.current) setHeartMetrics(Object.fromEntries(metrics.map((metric) => [metric.lineageId, { count: metric.count, hearted: metric.hearted }])));
      })
      .catch(() => { if (!cancelled && epoch === heartReadEpoch.current) setHeartMetricsFailed(true); })
      .finally(() => { if (!cancelled && epoch === heartReadEpoch.current) setHeartMetricsLoading(false); });
    return () => { cancelled = true; };
  }, [scopeItems]);

  const refreshShared = shared.refresh;
  useEffect(() => {
    const reload = () => { void refreshShared(); for (const id of Object.keys(voteMetricsRef.current)) void readExactVote(id); };
    window.addEventListener(PIPELINE_ENGAGEMENT_CHANGED, reload);
    return () => window.removeEventListener(PIPELINE_ENGAGEMENT_CHANGED, reload);
  }, [refreshShared, readExactVote]);

  // A newer Library projection must not be hidden behind an old exact vote snapshot.
  // Re-read affected revisions and keep their controls blocked if that read fails.
  useEffect(() => {
    for (const id of Object.keys(voteMetricsRef.current)) void readExactVote(id);
  }, [shared.program, revisionQueue.items, readExactVote]);

  const toggleHeart = async (item: LibraryViewItem) => {
    const lineageId = pipelineLineageFor(item);
    if (!lineageId || heartAttempt || heartInFlight.current) return;
    if (!isSignedIn) {
      toast({ title: 'Sign in to heart Pipeline work', description: 'Your heart follows this work across future revisions.' });
      return;
    }
    const current = heartMetrics[lineageId];
    if (!current) { toast({ title: 'Heart status unavailable', description: 'Refresh the exact heart status before acting.', variant: 'destructive' }); return; }
    heartInFlight.current = true;
    ++heartReadEpoch.current;
    setHeartMetricsLoading(false);
    setHeartingId(lineageId);
    let committed = false;
    try {
      const result = await submitPipelineHeart(lineageId, !current.hearted);
      if (result.outcome === 'rejected') { toast({ title: 'Heart rejected', description: result.message, variant: 'destructive' }); return; }
      if (result.outcome === 'uncertain') throw new Error('Heart outcome is unconfirmed.');
      committed = true;
      ++heartReadEpoch.current;
      setHeartMetricsLoading(false);
      setHeartMetrics((metrics) => ({ ...metrics, [lineageId]: { count: result.metric.count, hearted: result.metric.hearted } }));
      notifyPipelineEngagementChanged();
    } catch {
      if (committed) { toast({ title: 'Heart saved', description: 'The heart committed; local refresh is incomplete.' }); return; }
      setHeartAttempt({ lineageId, message: 'Heart outcome is unconfirmed. Read exact heart status; do not repeat the action automatically.' });
      toast({ title: 'Heart not confirmed', description: 'Read exact heart status before another heart action. No request was replayed.', variant: 'destructive' });
    } finally { heartInFlight.current = false; setHeartingId(null); }
  };
  const vote = async (submissionId: string, name: string, value: 'positive' | 'negative') => {
    if (voteAttempt || voteInFlight.current || voteReadStatus[submissionId]) return;
    voteInFlight.current = true;
    voteReadEpoch.current[submissionId] = (voteReadEpoch.current[submissionId] ?? 0) + 1;
    setVotingId(submissionId);
    let committed = false;
    try {
      const result = await submitPipelineVote(submissionId, value);
      if (result.outcome === 'rejected') { toast({ title: 'Vote rejected', description: result.message, variant: 'destructive' }); return; }
      if (result.outcome === 'uncertain') throw new Error('Vote outcome is unconfirmed.');
      const { receipt } = result;
      const program = result.program as Parameters<typeof shared.acceptProgram>[0] | null;
      committed = true;
      setVoteAttempt({ submissionId, outcome: 'committed', message: 'Vote committed. Reading exact engagement before another vote.' });
      notifyPipelineEngagementChanged();
      if (program) shared.acceptProgram(program);
      if (revisionsEnabled) revisionQueue.refresh();
      try {
        if (!await readExactVote(submissionId)) throw new Error('Exact engagement unavailable.');
        setVoteAttempt(null);
      } catch {
        setVoteAttempt({ submissionId, outcome: 'committed', message: 'Vote committed. Exact engagement is unavailable; read it before another vote.' });
      }
      toast({ title: 'Vote recorded', description: !program || receipt.warnings.length ? `${name}: vote committed; refresh is incomplete. Read current engagement before further action.` : `${name} has been updated in Forge Review.` });
    } catch {
      if (committed) { setVoteAttempt({ submissionId, outcome: 'committed', message: 'Vote committed. Exact engagement is unavailable; read it before another vote.' }); toast({ title: 'Vote recorded', description: 'The vote committed; local refresh is incomplete. Read current engagement before further action.' }); return; }
      setVoteAttempt({ submissionId, outcome: 'uncertain', message: 'Vote outcome is unconfirmed. Read exact engagement; do not repeat the vote automatically.' });
      toast({ title: 'Vote not confirmed', description: 'Read exact engagement before any further vote. No request was replayed.', variant: 'destructive' });
    } finally { voteInFlight.current = false; setVotingId(null); }
  };

  const {
    actions,
    openLocations,
    personalActions,
    runAction: executeAction,
    actionError,
    runPersonalAction,
    runPublishedRowAction,
  } = useAccountLibraryActions({
    reviewUpdates: workspaceUpdates.openSet,
    activeLoading,
    activeScope,
    activeTool,
    openCreateSet: () => { if (campaignExitReason) { toast({ title: 'Keep campaign work open', description: campaignExitReason }); return; } setStarters.openCreateMenu(); },
    closeDetail,
    createCompatibilityReturnTo: createLibraryCompatibilityReturnTo,
    currentItem,
    designReturnFocusId,
    editingSubmission,
    experience,
    openContributionTool,
    openReview,
    closeContextualTool,
    projection,
    refresh,
    closeTool,
    openTool,
    setDesignSource,
    setDesignReturnFocusId,
    setEditingSubmission,
    setLocationItem,
    setPendingDeleteItem,
  });

  const closeOrExecute: typeof executeAction = (action) => {
    if ((action.id === 'library.close-tool' || action.id === 'library.close-locations') && window.history.state?.cardforgeToolLayer) {
      window.history.back();
      return;
    }
    executeAction(action);
  };
  const requestDirtyToolClose = () => {
    if (toolCloseBlocked) { toast({ title: 'Keep the submission attempt open', description: toolCloseBlocked }); return; }
    setDiscardToolRequested(true);
  };
  const runAction: typeof executeAction = (action) => {
    if (toolCloseBlocked && (action.id === 'library.close-tool' || action.id === 'library.close-locations')) { requestDirtyToolClose(); return; }
    if (toolDirty && (action.id === 'library.close-tool' || action.id === 'library.close-locations')) {
      setDiscardToolRequested(true);
      return;
    }
    closeOrExecute(action);
  };

  const scopeDefinition = scopeDefinitions.find((definition) => definition.id === activeScope)!;
  const presentation = deriveEnvironmentPresentation({
    focusDepth: activeTool ? 'tool' : currentRecord ? 'object' : 'zone',
    activity: activeTool === 'design' ? 'edit' : activeTool ? 'task' : 'none',
  });
  return <>
  <EnvironmentShell
    ariaLabel="CardForge Library" brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }} viewer={viewer}
    zones={zones} activeZone="library" viewportPolicy="desk" primaryScroll="contained" detail={activeTool ? null : currentRecord}
    presentation={presentation}
    detailVisual={currentItem ? <LibraryDetailVisual key={currentItem.id} item={currentItem} cards={cardsFor(currentItem)} template={templateFor(currentItem)} /> : undefined}
    detailContent={<>{actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}{currentItem?.scope === 'personal' && currentItem.personal.references.driveFileId ? <SelectedDriveFileActions key={currentItem.id} fileId={currentItem.personal.references.driveFileId} accountId={currentItem.personal.references.driveAccountId} name={currentItem.name} localSetId={currentItem.personal.references.localSetId} disabled={!isSignedIn || !experience.capabilities.canUseProjectFiles} onChanged={projection.refresh} onOpenCopy={(id) => projection.router.push(id ? createDeskReturnHref(`set:${id}`) : "/account")} /> : null}{selectedLocalSet ? <div className="min-w-0"><div className="flex flex-wrap gap-1 border-b pb-3" aria-label="Set tools">
      <SetDirection key={`direction-${selectedLocalSet.id}`} set={selectedLocalSet} useLifecycle={useEnvironmentToolLifecycle} />
      <SetUpdates key={`updates-${selectedLocalSet.id}`} setId={selectedLocalSet.id} />
      <Button type="button" variant="outline" onClick={() => { void downloadSelectedSet(); }}>Download Set</Button>
    </div>
    {hasLinkedDrive ? <section className="space-y-2 border-t pt-4" aria-label="Google Drive save">
      <p role="status" className="text-sm text-muted-foreground">{driveWorkingSession.state.message}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!isSignedIn || !experience.capabilities.canUseProjectFiles || !['clean', 'dirty'].includes(driveWorkingSession.state.phase)} onClick={() => { void driveWorkingSession.saveNow(); }}>Save to Google Drive</Button>
        {driveWorkingSession.state.phase === 'recovery-required' ? <Button type="button" variant="outline" onClick={() => { void driveWorkingSession.repairLink(); }}>Repair link</Button> : null}
        {shouldOfferGoogleDriveReconciliation(driveWorkingSession.state.phase) ? <Button type="button" variant="outline" onClick={() => { void driveWorkingSession.reconcile(); }}>Check Drive</Button> : null}
      </div>
    </section> : null}
    {currentItem?.scope === 'personal' && currentItem.personal.references.localFolder && experience.capabilities.canUseProjectFiles ? <section className="pt-3" aria-label="Linked folder save"><LinkedFolderSave key={selectedLocalSet.id} setId={selectedLocalSet.id} onChanged={projection.refresh} /></section> : null}
    <SetTemplates key={`templates-${selectedLocalSet.id}`} presentation="contents" set={selectedLocalSet} cards={displayCards.filter((card) => (card.setId ?? cardSets[0]?.id) === selectedLocalSet.id)} templates={templates} onDesign={(id) => {
      const returnFocusId = document.activeElement instanceof HTMLElement ? document.activeElement.id : null;
      openTemplateDesign(id); setDesignReturnFocusId(returnFocusId || selection.focusReturnId || null); openTool('design', [id]);
    }} renderPreview={renderTemplatePreview} getTemplateAccent={getTemplateAccent} />
    <section ref={cardsSectionRef} tabIndex={-1} className="space-y-2 pt-4" aria-label="Cards in this Set">
      <h3 className="font-semibold">Cards · {selectedSetCards.length}</h3>
      <p className="text-xs text-muted-foreground">Edit or remove a card here. Changes update the local working copy; use Save &amp; move for another location.</p>
      <CardRemovalUndo key={selectedLocalSet.id} setId={selectedLocalSet.id} setName={selectedLocalSet.name} returnFocusRef={cardsSectionRef} />
      {selectedSetCards.length > 0 ? <>
        <label className="sr-only" htmlFor="library-card-search">Search cards in this Set</label>
        <input id="library-card-search" className="w-full rounded border bg-background px-3 py-2 text-sm" value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Search cards" />
        <ul className="grid gap-2">{visibleSetCards.map((card) => {
          const name = cardTitle(card);
          return <li key={card.uniqueId} className="flex flex-wrap gap-2"><Button id={`library-edit-card-${card.uniqueId}`} type="button" variant="outline" className="min-w-0 flex-1 justify-start" onClick={() => startCardEdit(selectedLocalSet.id, card.uniqueId)}>Edit {name}</Button><Button type="button" variant="ghost" aria-label={`Remove ${name}`} onClick={() => {
            const session = projectWorkspace.actions.beginCardEdit(selectedLocalSet.id, card.uniqueId);
            if (!session || session.scope !== persistenceScope) { toast({ title: 'Card unavailable', description: 'Refresh this Set before removing a card. No work was changed.', variant: 'destructive' }); return; }
            setPendingCardRemoval({ session, itemId: currentItem!.id, name });
          }}>Remove</Button></li>;
        })}</ul>
        {!visibleSetCards.length ? <p className="text-sm text-muted-foreground">No matching cards.</p> : null}
      </> : <p className="text-sm text-muted-foreground">No editable cards in this Set.</p>}
    </section></div> : currentItem?.scope === 'personal' && currentItem.personal.kind === 'set' && (currentItem.personal.references.driveFileId || currentItem.personal.references.localFolderWorkId) ? <div className="space-y-2"><p className="text-sm text-muted-foreground">Open the current Set in this workspace to edit its cards in Library.</p><Button type="button" variant="outline" disabled={Boolean(projection.busyItemId) || !experience.capabilities.canUseProjectFiles} onClick={() => void prepareSelectedSetHere(currentItem.personal)}>Open Set in Library</Button></div> : currentItem?.scope === 'pipeline' ? <PipelineDetailContent
      item={currentItem}
      voteMetrics={voteMetrics}
      isOwner={experience.owner}
      currentContributorIds={shared.program?.currentContributorIds ?? []}
      onEditRevision={isSignedIn && experience.contributor.canSubmit ? revision => {
        if (!isSignedIn || !experience.contributor.canSubmit || currentItem.pipeline.ownership !== 'mine'
          || currentItem.pipeline.editableSubmission?.id !== revision.id) return;
        setEditingSubmission(revision); openTool('edit-contribution', [revision.id]);
      } : undefined}
      onReviewRevision={revision => { try { openReview(currentItem, revision); } catch (error) { toast({ title: 'Revision unavailable', description: error instanceof Error ? error.message : 'Refresh Library.', variant: 'destructive' }); } }}
      onRevisionCreated={async () => { await shared.refresh(); }}
      onVoteRevision={(submissionId, name, value) => void vote(submissionId, name, value)}
      canReview={experience.contributor.canReview}
      isVoteBlocked={isVoteBlocked}
      isSelfVoteBlocked={(contributorId) => Boolean(
        shared.program
        && !shared.program.settings.allowContributorSelfVoting
        && shared.program.currentContributorIds.includes(contributorId)
      )}
    /> : currentItem?.scope === 'published' && currentItem.published.lineageId && publishedRevisionByLineage.get(currentItem.published.lineageId) ? <PublishedRevisionFeedback
      revision={{ ...publishedRevisionByLineage.get(currentItem.published.lineageId)!, ...voteMetrics[publishedRevisionByLineage.get(currentItem.published.lineageId)!.id] }}
      name={currentItem.name}
      canReview={experience.contributor.canReview}
      isVoteBlocked={isVoteBlocked}
      selfVoteBlocked={Boolean(voteMetrics[publishedRevisionByLineage.get(currentItem.published.lineageId)!.id]?.voteIssue) || Boolean(
        shared.program && !shared.program.settings.allowContributorSelfVoting
        && shared.program.currentContributorIds.includes(publishedRevisionByLineage.get(currentItem.published.lineageId)!.contributorId)
      )}
      onVoteRevision={(submissionId, name, value) => void vote(submissionId, name, value)}
    /> : undefined}</>}
    primaryDisabledReason={campaignExitReason}
    primaryAction={createLibraryZoneAction('library.create-set', 'New Set')}
    showPrimaryAction={!activeTool}
    actions={actions}
    accountControl={<><WorkspaceUpdateNotices /><PublicAuthControls /></>}
    search={<EnvironmentSearch id="library-global-search" label={`Search ${activeScope}`} value={projection.query} onChange={projection.setQuery} inputRef={searchRef} disabled={Boolean(activeTool)} />}
    focusReturnId={selection.focusReturnId ?? undefined}
    surfaceRef={surfaceRef}
    statusContent={<>
      <EnvironmentStatus label={`${scopeDefinition.label} · ${activeStatus.label}`} tone={activeStatus.kind === 'unavailable' || activeStatus.kind === 'partial' ? 'warning' : activeStatus.kind === 'ready' ? 'success' : 'neutral'} />
      <EnvironmentStatus label="Storage" icon={HardDrive} tone={projection.failures.length ? 'warning' : 'success'} onClick={openLocations} title="Open Locations & connections" />
      <EnvironmentStatus label={activeScope === 'campaigns' ? 'Marketing work' : activeLoading ? 'Loading objects' : `${unfilteredScopeItemCount} object${unfilteredScopeItemCount === 1 ? '' : 's'}`} tone={activeLoading ? 'warning' : 'neutral'} />
    </>}
    footerContent={activeTool ? <span>{activeTool === 'locations' ? 'Nothing moves between locations automatically' : activeTool === 'edit-contribution' ? 'Only your current Pipeline submission details will change' : activeTool === 'design' ? 'Design changes stay with the selected local Template' : activeTool === 'card-edit' ? 'Card changes update this local working copy' : 'Submission preserves the selected source until you confirm'}</span> : currentRecord ? <span>{currentRecord.title} selected</span> : <span>Work stays in its named location until you move it.</span>}
    onCommand={() => searchRef.current?.focus()}
    onAction={runAction} onCloseDetail={closeDetail}
  >
    <div className={styles.library} data-library-surface data-density={density} data-tool-open={Boolean(activeTool)}>
      <h1 className="sr-only">Library</h1>
      {heartAttempt ? <div role="status"><p>{heartAttempt.message}</p><button type="button" disabled={Boolean(heartingId)} onClick={async () => {
        if (heartInFlight.current) return;
        heartInFlight.current = true;
        setHeartingId(heartAttempt.lineageId);
        try {
          const metric = await loadPipelineHeartMetric(heartAttempt.lineageId);
          ++heartReadEpoch.current;
          setHeartMetricsLoading(false);
          setHeartMetricsFailed(false);
          setHeartMetrics(current => ({ ...current, [metric.lineageId]: { count: metric.count, hearted: metric.hearted } }));
          setHeartAttempt({ ...heartAttempt, readConfirmed: true, message: 'Exact heart status was read. Current state does not prove the earlier operation outcome. You may choose a new heart action explicitly.' });
        } catch { setHeartAttempt({ lineageId: heartAttempt.lineageId, message: 'Exact heart status is unavailable. The heart remains unconfirmed; do not repeat it.' }); }
        finally { heartInFlight.current = false; setHeartingId(null); }
      }}>Read exact heart status</button>{heartAttempt.readConfirmed ? <button type="button" disabled={Boolean(heartingId)} onClick={() => setHeartAttempt(null)}>Allow a new explicit heart action</button> : null}</div> : null}
      {!voteAttempt ? Object.entries(voteReadStatus).filter(([, status]) => status === 'failed').map(([id]) => <div role="status" key={id}><p>Exact vote engagement is unavailable. Read it before another vote.</p><button type="button" onClick={() => void readExactVote(id)}>Retry exact vote engagement</button></div>) : null}
      {voteAttempt ? <div role="status"><p>{voteAttempt.message}</p><button type="button" disabled={Boolean(votingId)} onClick={async () => {
        if (voteInFlight.current) return;
        voteInFlight.current = true;
        setVotingId(voteAttempt.submissionId);
        setVoteAttempt({ ...voteAttempt, readConfirmed: false, message: 'Exact engagement read is pending. Do not repeat the vote.' });
        try {
          if (!await readExactVote(voteAttempt.submissionId)) throw new Error('Exact engagement unavailable.');
          setVoteAttempt({ ...voteAttempt, readConfirmed: true, message: voteAttempt.outcome === 'committed' ? 'Vote committed and exact engagement was read. You may choose a new vote explicitly.' : 'Exact engagement was read. Current state does not prove the earlier operation outcome. You may choose a new vote explicitly.' });
        } catch { setVoteAttempt({ ...voteAttempt, readConfirmed: false, message: voteAttempt.outcome === 'committed' ? 'Vote committed. Exact engagement is unavailable; read it before another vote.' : 'Exact engagement is unavailable. The vote remains unconfirmed; do not repeat it.' }); }
        finally { voteInFlight.current = false; setVotingId(null); }
      }}>Read exact vote engagement</button>{voteAttempt.readConfirmed ? <button type="button" disabled={Boolean(votingId)} onClick={() => setVoteAttempt(null)}>Allow a new explicit vote</button> : null}</div> : null}
      <nav className={styles.scopeTabs} aria-label="Library scopes">
        {scopeDefinitions.map((definition) => <button key={definition.id} type="button" aria-current={activeScope === definition.id ? 'page' : undefined} disabled={Boolean(activeTool)} onClick={() => chooseScope(definition.id)}><span>{definition.label}</span><small>{definition.owner}</small></button>)}
      </nav>
      {experience.owner && activeScope === 'pipeline' ? <button id="library-pipeline-operations" type="button" disabled={Boolean(activeTool)} className="border px-3 py-2 text-sm" onClick={() => {
        reviewReturn.current = { focus: document.activeElement as HTMLElement, scroll: surfaceRef.current?.scrollTop ?? 0 };
        openTool('pipeline-operations');
      }}>Pipeline operations</button> : null}
      {activeScope === 'pipeline' ? <PipelineContentHealthPanel catalog={shared.catalog} onClassified={shared.refresh} health={contentHealth} canRepair={experience.owner} canOpenObject={experience.owner || experience.contributor.canReview} onOpenObject={openHealthObject} /> : null}
      {storageCallback ? <EnvironmentBoundaryNotice title={storageCallback.title} message={storageCallback.message} /> : null}
      {activeScope === 'pipeline' && experience.owner && isSignedIn ? <LibraryRevisionQueueControls disabled={Boolean(activeTool)} revisions={revisionsEnabled} queue={revisionQueue} onModeChange={value => { setRevisionMode(value); setSelection(closeEnvironmentDetail); }} /> : null}
      <NewSetDialog renderPublishedSetDetails={set => set.submissionId ? <PipelineSourceDisclosure submissionId={set.submissionId} /> : <p className="text-xs">Exact source reactions are unavailable for this starter.</p>} createOpen={setStarters.createOpen} onCreateOpenChange={setStarters.setCreateOpen} onCreateWork={createSet} onSetFileOpened={focusCreatedSet} onCreatePublishedSet={set => { void setStarters.createFromPublishedSet(set); }} onRetryPublishedSets={setStarters.openCreateMenu} publishedSets={setStarters.publishedSets} publishedSetsLoading={setStarters.publishedSetsLoading} publishedSetsFailure={setStarters.publishedSetsFailure} creatingPublishedSetId={setStarters.creatingPublishedSetId} />
      {campaignExitReason ? <p role="status" className="px-3 py-2 text-sm text-[var(--cf-warning)]">{campaignExitReason}</p> : null}
      {activeScope === 'pipeline' && isSignedIn ? <div className="flex flex-wrap items-center gap-2 px-3 py-2" aria-label="Shared Pipeline discovery">
        <button type="button" disabled={Boolean(activeTool)} aria-pressed={sharedTrashMode} className="border border-[var(--cf-border)] px-3 py-2 text-sm" onClick={() => { setSharedTrashMode(value => !value); setSelection(closeEnvironmentDetail); }}>
          {sharedTrashMode ? 'Return to Pipeline' : 'Browse shared Trash'}
        </button>
      </div> : null}
      {activeScope === 'pipeline' && isSignedIn && sharedTrashMode ? <SharedPipelineTrashCollection refreshEpoch={sharedTrashRefreshEpoch} actorScope={JSON.stringify([persistenceScope, isSignedIn, experience.owner, experience.contributor.active])} onOpenAuthorizedRevision={experience.owner ? async item => {
        if (activeTool || !sharedTrashMode || activeScope !== 'pipeline' || !experience.owner || !isSignedIn) return;
        const requestId = ++sharedTrashRequestEpoch.current;
        const context = sharedTrashSessionKey;
        try {
          const response = await fetch('/api/pipeline/library?trash=trashed', { cache: 'no-store' });
          if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Exact revision is unavailable.'));
          const payload = await response.json() as { program: { submissions: PipelineSubmission[]; votingQueue: PipelineSubmission[] } };
          if (requestId !== sharedTrashRequestEpoch.current || sharedTrashContext.current !== context) return;
          const exact = [...payload.program.submissions, ...payload.program.votingQueue].find(row => row.id === item.id && row.lineageId === item.lineageId && getPipelineTrashState(row).trashed);
          const target = exact ? createPipelineReviewTarget(exact) : null;
          if (!target) throw new Error('This exact trashed revision is unavailable to your Owner account. Refresh before retrying.');
          reviewReturn.current = { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scroll: surfaceRef.current?.scrollTop ?? 0 };
          setReviewTarget(target); setRevisionKind(null); openTool('review-manage', [target.lineageId, target.submissionId]);
        } catch (error) {
          if (requestId !== sharedTrashRequestEpoch.current || sharedTrashContext.current !== context) return;
          toast({ title: 'Exact revision unavailable', description: error instanceof Error ? error.message : 'Refresh Library.', variant: 'destructive' });
        }
      } : undefined} /> : <LibraryCollection
        onCampaignDirtyChange={setCampaignDirty}
        onCampaignCloseBlockedChange={setCampaignCloseBlocked}
        serverFiltered={revisionsEnabled}
        interactionDisabled={Boolean(activeTool)}
        activeFailure={activeFailure}
        activeLoading={activeLoading}
        activeScope={activeScope}
        campaignNotice={initialCampaignNotice}
        campaignTargetId={campaignTargetId}
        canReview={experience.contributor.canReview}
        isSelfVoteBlocked={(contributorId) => Boolean(
          shared.program
          && !shared.program.settings.allowContributorSelfVoting
          && shared.program.currentContributorIds.includes(contributorId)
        )}
        canSubmit={experience.contributor.canSubmit}
        cardsFor={cardsFor}
        density={density}
        heartMetrics={heartMetrics}
        voteMetrics={voteMetrics}
        heartBlocked={Boolean(heartAttempt)}
        heartMetricsFailed={heartMetricsFailed}
        heartMetricsLoading={heartMetricsLoading}
        heartingId={heartingId}
        isSignedIn={isSignedIn}
        isOwner={experience.owner}
        onDensityChange={setDensity}
        onOpenContribution={() => openContributionTool()}
        onOpenDetail={openDetail}
        onPersonalAction={runPersonalAction}
        onPublishedAction={runPublishedRowAction}
        onRefresh={refresh}
        onSharedTypeChange={setSharedType}
        onToggleHeart={(item) => void toggleHeart(item)}
        onVote={(submissionId, name, value) => void vote(submissionId, name, value)}
        publishedRevisionByLineage={publishedRevisionByLineage}
        personalActions={personalActions}
        projection={projection}
        scopeDefinition={scopeDefinition}
        selection={selection}
        sharedType={sharedType}
        sharedTypes={sharedTypes}
        templateFor={templateFor}
        unfilteredScopeItemCount={unfilteredScopeItemCount}
        viewItems={viewItems}
        isVoteBlocked={isVoteBlocked}
      />}
      {(activeTool === 'review-manage' || activeTool === 'pipeline-operations' || activeTool === 'revise-existing') ? (
        <EnvironmentToolLayer id="library-pipeline-context" eyebrow="Library Pipeline tool"
          title={activeTool === 'pipeline-operations' ? 'Pipeline operations' : activeTool === 'revise-existing' ? 'Revise existing' : 'Review & manage'}
          summary={reviewTarget ? `Selected ${reviewTarget.assetId ?? reviewTarget.submissionId} · revision ${reviewTarget.revisionNumber ?? 'unassigned'} · ${reviewTarget.status}` : 'Global queue, rules, quotas and routing.'}
          closeLabel="Close Pipeline tool" onClose={() => runAction(actions[0]!)} dirty={toolDirty} closeBlocked={Boolean(toolCloseBlocked)}
          onDirtyCloseRequest={requestDirtyToolClose} presentation={activeTool === 'pipeline-operations' ? 'inline' : activeToolSession?.presentation}>
          <div className="w-full min-w-0 overflow-auto">
          {!experience.owner || !isSignedIn ? <p>Owner access is required. Close this tool to return to Library.</p>
            : activeTool === 'revise-existing' && reviewTarget && revisionKind ? <LibraryRevisionEntry key={reviewTarget.submissionId} target={reviewTarget} kind={revisionKind} onDirtyChange={setToolDirty} onCloseBlockedChange={setToolCloseBlocked}
              onTemplateDraft={draft => {
                const id = projectWorkspace.actions.installTemplate(draft, 'user');
                if (id) { openTemplateDesign(id); setDesignReturnFocusId(selection.focusReturnId ?? null); openTool('design', [id]); }
              }} />
            : activeTool === 'review-manage' && !reviewTarget ? <p>The exact selection is unavailable. Close this tool and refresh Library.</p>
            : <OwnerContributorProgramPanel key={activeTool === 'pipeline-operations' ? 'global' : reviewTarget?.submissionId}
              target={activeTool === 'pipeline-operations' ? undefined : reviewTarget ?? undefined}
              navigationBlocked={toolDirty || Boolean(toolCloseBlocked)}
              onOpenRevisionQueue={activeTool === 'pipeline-operations' ? () => {
                if (toolDirty || toolCloseBlocked) return;
                closeContextualTool(); chooseScope('pipeline'); setRevisionMode(true);
                requestAnimationFrame(() => document.getElementById('library-revision-mode')?.focus());
              } : undefined}
              onDirtyChange={setToolDirty} onSelectionMutated={() => { closeContextualTool(); refresh(); }} onRevise={reviseSelected} renderTemplateSpecimen={renderPipelineTemplateSpecimen} />}
          </div>
        </EnvironmentToolLayer>
      ) : null}
      {activeTool === 'locations' ? (
        <EnvironmentToolLayer
          id="library-locations-title"
          eyebrow="Library tool"
          title="Locations & connections"
          summary="Inspect one owner at a time. Changes affect only the named location."
          closeLabel="Close locations and connections"
          onClose={() => runAction(actions[0]!)}
          presentation={activeToolSession?.presentation}
        >
          <DefaultWorkLocationControl isSignedIn={isSignedIn} canUseProjectFiles={experience.capabilities.canUseProjectFiles} driveConnected={Boolean(projection.driveConnection?.connected && projection.driveConnection.rootFolderId)} localFolderSupported={projection.localFolderSupported} />
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
          presentation={activeToolSession?.presentation}
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
          dirty={toolDirty}
          onDirtyCloseRequest={requestDirtyToolClose}
          closeLabel="Close submission editor"
          onClose={() => runAction(actions[0]!)}
          presentation={activeToolSession?.presentation}
        >
          <PipelineSubmissionEditPanel
            onDirtyChange={setToolDirty}
            submission={editingSubmission}
            savedTemplates={templates}
            onContinueRevision={isSignedIn && experience.contributor.canSubmit ? async (template, base) => {
              const context = revisionHandoffContext.current;
              if (base.parentSubmissionId !== editingSubmission.id) throw new Error('The exact reviewed revision changed. Refresh before continuing.');
              const { attempt, created } = await retainReviewedTemplateAttempt(template, base);
              if (!revisionHandoffMounted.current || revisionHandoffContext.current !== context) throw new Error('The saved attempt is available in Design.');
              const destination = await resolveTemplatePipelineAttempt(attempt, created);
              if (!destination) throw new Error('No committed draft was found. Check the saved attempt below before retrying its original snapshot.');
              if (revisionHandoffMounted.current && revisionHandoffContext.current === context) window.location.assign(destination);
            } : undefined}
            renderRevisionRecovery={(templateId, busy) => {
              const context = revisionHandoffContext.current;
              return <TemplatePipelineAttemptRecovery templateId={templateId} busy={busy}
                onAttemptsChange={ignoreAttemptState} onReadyChange={ignoreAttemptState}
                onOpenDestination={url => { if (revisionHandoffMounted.current && revisionHandoffContext.current === context) window.location.assign(url); }} />;
            }}
            onCancel={() => runAction(actions[0]!)}
            onUpdated={async () => {
              setToolDirty(false);
              if (revisionsEnabled) revisionQueue.refresh();
              await shared.refresh();
              closeOrExecute(actions[0]!);
            }}
          />
        </EnvironmentToolLayer>
      ) : null}
      {activeTool === 'card-edit' && cardEditSession?.scope === persistenceScope ? (
        <EnvironmentToolLayer id="library-card-edit-title" eyebrow="Library tool"
          title={`Edit ${cardTitle(cardEditSession.card)}`}
          summary="Edit this card in its Set without leaving Library."
          closeLabel="Close card editor" onClose={() => runAction(actions[0]!)} dirty={toolDirty}
          onDirtyCloseRequest={requestDirtyToolClose} presentation={activeToolSession?.presentation}>
          <div className={`${styles.libraryCardEditor} relative h-full min-h-0 w-full min-w-0`}>
            <FocusedArtifactWorkspace key={cardEditSession.card.uniqueId}
              artifactId={cardEditSession.card.uniqueId} card={cardEditSession.card}
              canExportClean={experience.capabilities.canExportClean} canUseProjectFiles={experience.capabilities.canUseProjectFiles}
              setName={cardEditSession.card.setName ?? 'Set'} title={cardTitle(cardEditSession.card)}
              subtitle={cardEditSession.card.template.name ?? 'Card'}
              availableDirections={{ up: false, down: false, left: false, right: false }} onBrowse={() => {}}
              editing onEdit={() => {}} onExitFocus={() => runAction(actions[0]!)}
              onCancelEdit={() => { if (toolDirty) requestDirtyToolClose(); else runAction(actions[0]!); }}
              onDirtyChange={setToolDirty}
              onSave={(card) => {
                try {
                  if (!projectWorkspace.actions.saveCardEdit(cardEditSession, card)) throw new Error('This card, Template or account changed while you were editing. Your draft is still open; copy your changes and reopen the current card.');
                  setToolDirty(false); closeTool();
                  requestAnimationFrame(() => document.getElementById(`library-edit-card-${card.uniqueId}`)?.focus());
                  return true;
                } catch (error) {
                  toast({ title: 'Card was not updated', description: error instanceof Error ? error.message : 'The card could not be updated.', variant: 'destructive' });
                  return false;
                }
              }}
              onDesign={(card, face) => {
                const id = face === 'back' ? card.backingTemplate?.id : card.template.id;
                if (!id) { toast({ title: 'Template unavailable', description: 'Refresh this Set before opening Design.', variant: 'destructive' }); return; }
                openTemplateDesign(id); setDesignReturnFocusId(`library-edit-card-${card.uniqueId}`); openTool('design', [id]);
              }} />
          </div>
        </EnvironmentToolLayer>
      ) : null}
      {activeTool === 'design' ? (
        <EnvironmentToolLayer
          id="library-design-title"
          eyebrow="Library tool"
          title="Design Template"
          summary="The selected Template remains in Library while the reusable Design tool edits its local working copy."
          closeLabel="Close Design"
          onClose={() => runAction(actions[0]!)}
          dirty={toolDirty}
          onDirtyCloseRequest={requestDirtyToolClose}
          presentation={activeToolSession?.presentation}
        >
          <LibraryDesignWorkspace
            key={persistenceScope}
            pipelineDesignSource={designSource}
            businessIdentity={businessIdentity}
            initialContributorAccess={EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE}
            tool="design"
            contextSetId={selectedLocalSet?.id ?? null}
            onDirtyChange={setToolDirty}
          />
        </EnvironmentToolLayer>
      ) : null}
    </div>
  </EnvironmentShell>
  <AlertDialog open={Boolean(pendingCardRemoval)} onOpenChange={(open) => { if (!open) setPendingCardRemoval(null); }}>
    <AlertDialogContent onCloseAutoFocus={(event) => { if (removedCardFocusRef.current) { event.preventDefault(); removedCardFocusRef.current = false; cardsSectionRef.current?.focus(); } }}>
      <AlertDialogHeader>
        <AlertDialogTitle>Remove {pendingCardRemoval?.name ?? 'this card'} from the Set?</AlertDialogTitle>
        <AlertDialogDescription>The card and its data will be removed from this local Set. Reusable Templates and other cards remain available.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
          const pending = pendingCardRemoval;
          if (!pending || cardEditContext.current.itemId !== pending.itemId || cardEditContext.current.scope !== pending.session.scope || !projectWorkspace.actions.removeCard(pending.session)) {
            toast({ title: 'Card was not removed', description: 'The card, Template, Set or account changed. Refresh the Set and choose the card again.', variant: 'destructive' });
            return;
          }
          removedCardFocusRef.current = true;
        }}>Remove card</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={discardToolRequested} onOpenChange={setDiscardToolRequested}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
        <AlertDialogDescription>Discard the unsaved changes in this tool? Saved content remains unchanged.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep editing</AlertDialogCancel>
        <AlertDialogAction onClick={() => { if (toolCloseBlocked) { requestDirtyToolClose(); return; } setToolDirty(false); setDiscardToolRequested(false); closeOrExecute(actions[0]!); }}>Discard changes</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <WorkLocationDialog
    item={locationItem}
    open={Boolean(locationItem)}
    onOpenChange={(open) => { if (!open) setLocationItem(null); }}
    isSignedIn={isSignedIn}
    canUseProjectFiles={experience.capabilities.canUseProjectFiles}
    driveConnected={Boolean(projection.driveConnection?.connected && projection.driveConnection.rootFolderId)}
    localFolderSupported={projection.localFolderSupported}
    onChanged={projection.refresh}
  />
      {pendingDeleteItem ? <SetTrashDialog item={pendingDeleteItem} canUseDrive={isSignedIn && experience.capabilities.canUseProjectFiles} onClose={() => setPendingDeleteItem(null)} onCompleted={() => { closeDetail(); projection.refresh(); }} /> : null}
  </>;
}
