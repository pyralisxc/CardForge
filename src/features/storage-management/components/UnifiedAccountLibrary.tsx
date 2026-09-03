"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HardDrive } from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { PublicAuthControls } from '@/features/account/client/auth';
import {
  ENVIRONMENT_ZONES, EnvironmentBoundaryNotice, EnvironmentShell, EnvironmentStatus, EnvironmentToolLayer,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type EnvironmentViewer, type SelectionSession,
} from '@/features/app-shell/client/environment';
import type { WorkbenchBusinessIdentity } from '@/features/creator-workbench/client';
import { EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE } from '@/features/contributor-access/client';
import { buildPipelineContentHealth, PipelineContentHealthPanel, type PipelineSubmission } from '@/features/pipeline/client';
import { deleteGoogleDriveProjectCopy } from '@/features/project/client/provider-google-drive';
import { selectAllGeneratedDisplayCards, selectAllTemplates, useProjectStore } from '@/features/project/client/workspace';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import { useAccountLibraryActions } from '../hooks/useAccountLibraryActions';
import { useLibrarySharedProjection } from '../hooks/useLibrarySharedProjection';
import { useLibraryReturnContext } from '../hooks/useLibraryReturnContext';
import { useUnifiedLibraryView } from '../hooks/useUnifiedLibraryView';
import type { AccountLibraryItem } from '../model/accountLibrary';
import {
  getLibraryScopeDefinitions, resolveLibraryScopeForViewer,
  type LibraryDensity, type LibraryScope,
} from '../model/libraryScopes';
import { LibraryCollection } from './LibraryCollection';
import {
  LibraryDetailVisual,
  PipelineDetailContent,
  createLibraryDetailRecord as detailRecord,
  pipelineLineageFor,
  type LibraryViewItem,
} from './LibraryObjectPresentation';
import { DefaultWorkLocationControl, WorkLocationDialog } from './WorkLocationDialog';
import styles from './UnifiedAccountLibrary.module.css';

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
  const [scope, setScope] = useState<LibraryScope>('personal');
  const campaignAccess = experience.contributor.canDraftCampaigns || experience.owner;
  const activeScope = resolveLibraryScopeForViewer(scope, { contributor: pipelineAccess, campaigns: campaignAccess, owner: experience.owner });
  const shared = useLibrarySharedProjection({ pipelineEnabled: pipelineAccess, activeScope });
  const [density, setDensity] = useState<LibraryDensity>('gallery');
  const [sharedType, setSharedType] = useState('all');
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const [activeTool, setActiveTool] = useState<'locations' | 'contribute' | 'edit-contribution' | 'design' | null>(() => initialTool);
  const [designReturnFocusId, setDesignReturnFocusId] = useState<string | null>(null);
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
    } else if (tool === 'design' && params.get('artifact')) {
      const templateId = params.get('artifact')!;
      const store = useProjectStore.getState();
      store.setTemplateEditorSelectedTemplateId(templateId);
      store.setStudioView('template');
      setActiveTool('design');
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

  const { activeFailure, activeLoading, activeStatus, itemMap, scopeItems, sharedTypes, unfilteredScopeItemCount, viewItems } = useUnifiedLibraryView({
    activeScope,
    pipelineAccess,
    projection,
    shared,
    sharedType,
  });
  const currentItem = selection.objectId ? itemMap.get(selection.objectId) ?? null : null;
  const contentHealth = useMemo(() => buildPipelineContentHealth({ catalog: shared.catalog, program: shared.program }), [shared.catalog, shared.program]);
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
  const createLibraryCompatibilityReturnTo = useLibraryReturnContext({
    activeLoading, activeScope, campaignAccess, density, initialReturnContextKey, itemMap,
    owner: experience.owner, pipelineAccess, projection, selection, setDensity, setScope, setSelection,
    setSharedType, sharedType, surfaceRef,
  });

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

  const {
    actions,
    openLocations,
    personalActions,
    runAction,
    runPersonalAction,
    runPublishedRowAction,
  } = useAccountLibraryActions({
    activeLoading,
    activeScope,
    activeTool,
    closeDetail,
    createCompatibilityReturnTo: createLibraryCompatibilityReturnTo,
    currentItem,
    designReturnFocusId,
    editingSubmission,
    experience,
    openContributionTool,
    projection,
    refresh,
    setActiveTool,
    setDesignReturnFocusId,
    setEditingSubmission,
    setLocationItem,
    setPendingDeleteItem,
  });

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
    detailVisual={currentItem ? <LibraryDetailVisual key={currentItem.id} item={currentItem} cards={cardsFor(currentItem)} template={templateFor(currentItem)} /> : undefined}
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
    statusContent={<><EnvironmentStatus label={`${scopeDefinition.label} · ${activeStatus.label}`} tone={activeStatus.kind === 'unavailable' ? 'warning' : activeStatus.kind === 'ready' ? 'success' : 'neutral'} /><EnvironmentStatus label={activeScope === 'campaigns' ? 'Access-gated marketing work' : `${unfilteredScopeItemCount} ${activeScope} object${unfilteredScopeItemCount === 1 ? '' : 's'}`} tone="neutral" /></>}
    footerContent={activeTool ? <span>{activeTool === 'locations' ? 'Nothing moves between locations automatically' : activeTool === 'edit-contribution' ? 'Only your current Pipeline submission details will change' : activeTool === 'design' ? 'Design changes stay with the selected local Template' : 'Submission preserves the selected source until you confirm'}</span> : currentRecord ? <span>{currentRecord.title} selected</span> : <span>Work stays in its named location until you move it.</span>}
    onCommand={() => searchRef.current?.focus()}
    onAction={runAction} onCloseDetail={closeDetail}
  >
    <div className={styles.library} data-density={density} data-tool-open={Boolean(activeTool)}>
      <header className={styles.libraryHeader}>
        <div><p>Library</p><h1>Your materials and work</h1><span>Browse what you own, what CardForge publishes, and what is moving through review.</span></div>
        <button id="library-locations-trigger" type="button" className={styles.locationsButton} onClick={openLocations}><HardDrive size={16} aria-hidden="true" />Locations</button>
      </header>
      <nav className={styles.scopeTabs} aria-label="Library scopes">
        {scopeDefinitions.map((definition) => <button key={definition.id} type="button" aria-current={activeScope === definition.id ? 'page' : undefined} onClick={() => chooseScope(definition.id)}><span>{definition.label}</span><small>{definition.owner}</small></button>)}
      </nav>
      {activeScope === 'pipeline' && experience.owner ? <details className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface-inset)]" open>
        <summary className="cursor-pointer px-4 py-3 font-serif text-lg text-[var(--cf-text-strong)]">Owner Pipeline operations <span className="ml-2 font-sans text-xs text-[var(--cf-text-subtle)]">publication, quotas, routing, revisions</span></summary>
        <div className="border-t border-[var(--cf-border-subtle)] p-4"><OwnerContributorProgramPanel /></div>
      </details> : null}
      {activeScope === 'pipeline' ? <PipelineContentHealthPanel health={contentHealth} canRepair={experience.owner} onOpenObject={(objectId) => { const item = viewItems.find((candidate) => candidate.id === `pipeline:${objectId}` || candidate.id === objectId); if (item) openDetail(item); }} /> : null}
      {storageCallback ? <EnvironmentBoundaryNotice title={storageCallback.title} message={storageCallback.message} /> : null}
      <LibraryCollection
        activeFailure={activeFailure}
        activeLoading={activeLoading}
        activeScope={activeScope}
        campaignNotice={initialCampaignNotice}
        campaignTargetId={campaignTargetId}
        canReview={experience.contributor.canReview}
        canSubmit={experience.contributor.canSubmit}
        cardsFor={cardsFor}
        density={density}
        heartMetrics={heartMetrics}
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
        personalActions={personalActions}
        projection={projection}
        scopeDefinition={scopeDefinition}
        scopeItems={scopeItems}
        searchRef={searchRef}
        selection={selection}
        sharedType={sharedType}
        sharedTypes={sharedTypes}
        templateFor={templateFor}
        unfilteredScopeItemCount={unfilteredScopeItemCount}
        viewItems={viewItems}
        votingId={votingId}
      />
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
      {activeTool === 'design' ? (
        <EnvironmentToolLayer
          id="library-design-title"
          eyebrow="Library tool"
          title="Design Template"
          summary="The selected Template remains in Library while the reusable Design tool edits its local working copy."
          closeLabel="Close Design"
          onClose={() => runAction(actions[0]!)}
          presentation="floating"
        >
          <LibraryDesignWorkspace
            businessIdentity={businessIdentity}
            initialContributorAccess={EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE}
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
