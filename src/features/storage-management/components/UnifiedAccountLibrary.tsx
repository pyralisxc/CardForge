"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Boxes, Cloud, FolderOpen, Grid2X2, HardDrive, ImageIcon,
  Copy, ExternalLink, LayoutList, Loader2, MapPin, MoreHorizontal, PanelRightOpen, Search, Sparkles, ThumbsDown,
  ThumbsUp, Trash2, X, type LucideIcon,
} from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import {
  ENVIRONMENT_ZONES, EnvironmentBoundaryNotice, EnvironmentShell, EnvironmentStatus,
  closeEnvironmentDetail, createSelectionSession, getVisibleEnvironmentZones, openEnvironmentDetail,
  type ActionDescriptor, type EnvironmentDetailRecord, type EnvironmentStatusTone,
  type EnvironmentViewer, type SelectionSession, type ZoneDefinition,
} from '@/features/app-shell/client/environment';
import { AuthoredObjectPreview } from '@/features/card-rendering/client';
import { deleteGoogleDriveProjectCopy, selectAllGeneratedDisplayCards, selectAllTemplates, useProjectStore, type ProjectPersistenceScope } from '@/features/project/client';
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
  getLibraryScopeDefinitions, getLibraryScopeStatus,
  type LibraryDensity, type LibraryScope,
} from '../model/libraryScopes';
import { accountLibraryKindLabels, formatAccountLibraryBytes, formatAccountLibraryDate } from './AccountLibraryItemRow';
import { DefaultWorkLocationControl, WorkLocationDialog } from './WorkLocationDialog';
import styles from './UnifiedAccountLibrary.module.css';

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  isDeveloper?: boolean;
  isOwner?: boolean;
  initialTool?: 'locations' | null;
  storageConnections?: ReactNode;
}

type LibraryViewItem =
  | { id: string; scope: 'personal'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: null; fontFamily: null; personal: AccountLibraryItem }
  | { id: string; scope: 'published'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: null; sizeBytes: number | null; previewUrl: string | null; fontFamily: string | null; published: PublishedLibraryObject }
  | { id: string; scope: 'pipeline'; name: string; kindLabel: string; sourceLabel: string; statusLabel: string; summary: string; updatedAt: string | null; sizeBytes: number | null; previewUrl: string | null; fontFamily: null; pipeline: PipelineLibraryObject };

const LIBRARY_SOURCES: AccountLibrarySource[] = ['device', 'google-drive', 'local-folder', 'assistant-draft'];
const kindIcons: Record<AccountLibraryKind, LucideIcon> = { set: Boxes, template: Boxes, asset: ImageIcon, 'working-draft': Sparkles };
const sharedKindIcons: Record<string, LucideIcon> = { Template: Boxes, Image: ImageIcon, Texture: ImageIcon, Divider: ImageIcon, Icon: Sparkles, Style: Sparkles, Font: ImageIcon };

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

  if (item.scope === 'published' && item.published.template) {
    return <AuthoredObjectPreview template={item.published.template} label={item.name} size="standard" />;
  }
  if (previewUrl && !previewFailed) {
    return <img src={previewUrl} alt="" className={styles.objectImage} onError={() => setPreviewFailed(true)} />;
  }
  if (item.fontFamily) return <span className={styles.fontSample} style={{ fontFamily: item.fontFamily }}>Aa</span>;
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
      ['Relationship', item.pipeline.relationship === 'owned' ? 'Your submission' : 'Available to review'],
      ['Revision', String(item.pipeline.submission.revisionNumber ?? 1)],
      ['Votes', `${item.pipeline.submission.positiveVotes} up · ${item.pipeline.submission.negativeVotes} down`],
      ['Updated', formatDate(item.updatedAt)],
    ],
  };
};

const zoneAction = (id: 'library.refresh' | 'library.close-locations', label: string, loading = false): ActionDescriptor => ({
  id, label, ownerFeature: 'storage-management', supportedObjectKinds: [], supportedSources: [], revisionPolicy: 'none',
  requiredPermission: 'guest', scope: 'zone', hierarchy: 'primary',
  availability: loading ? { kind: 'disabled', reason: 'Library sources are already refreshing.' } : { kind: 'available' },
  commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: id === 'library.refresh' ? 'mutation' : 'navigation',
});

const sharedActions = (item: Extract<LibraryViewItem, { scope: 'published' | 'pipeline' }>): ActionDescriptor[] => {
  if (item.scope === 'pipeline') return [{
    id: 'library.open-pipeline', label: 'Open in Forge Review', ownerFeature: 'developer-assets', supportedObjectKinds: ['pipeline-asset'],
    supportedSources: ['provider-native'], revisionPolicy: 'current-required', requiredPermission: 'developer', scope: 'object', hierarchy: 'primary',
    availability: { kind: 'available' }, commitment: 'none', automation: { kind: 'human-only', owner: 'cardforge' }, result: 'navigation',
  }];
  const actions: ActionDescriptor[] = [{
    id: 'library.use-published', label: item.published.template ? 'Use in Studio' : 'Open Studio', ownerFeature: 'developer-assets', supportedObjectKinds: ['published-asset'],
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

export function UnifiedAccountLibrary({ persistenceScope, isSignedIn, isDeveloper = false, isOwner = false, initialTool = null, storageConnections }: UnifiedAccountLibraryProps) {
  const projection = useAccountLibraryProjection({ persistenceScope, isSignedIn });
  const { toast } = useToast();
  const [scope, setScope] = useState<LibraryScope>('personal');
  const shared = useLibrarySharedProjection({ pipelineEnabled: isDeveloper || isOwner, activeScope: scope });
  const [density, setDensity] = useState<LibraryDensity>('gallery');
  const [sharedType, setSharedType] = useState('all');
  const [selection, setSelection] = useState<SelectionSession>(() => createSelectionSession());
  const [activeTool, setActiveTool] = useState<'locations' | null>(() => initialTool);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [storageCallback, setStorageCallback] = useState<{ title: string; message: string } | null>(null);
  const [locationItem, setLocationItem] = useState<AccountLibraryItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<AccountLibraryItem | null>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const displayCards = useProjectStore(selectAllGeneratedDisplayCards);
  const templates = useProjectStore(selectAllTemplates);
  const cardSets = useProjectStore((state) => state.cardSets);
  const viewer: EnvironmentViewer = { signedIn: isSignedIn, developer: isDeveloper || isOwner, owner: isOwner };
  const scopeDefinitions = getLibraryScopeDefinitions(viewer);
  const visibleZones = getVisibleEnvironmentZones(viewer);
  const libraryDefinition = ENVIRONMENT_ZONES.find((zone) => zone.id === 'library')!;
  const zones = visibleZones.some((zone) => zone.id === 'library') ? visibleZones : [{ ...libraryDefinition, minimumAccess: 'guest' as const }, ...visibleZones];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedScope = params.get('scope');
    if (requestedScope === 'published' || (requestedScope === 'pipeline' && (isDeveloper || isOwner))) setScope(requestedScope);
    const status = params.get('storage');
    if (status === 'google-drive-connected') setStorageCallback({ title: 'Google Drive connected', message: 'Google Drive is now available as a durable project and asset location.' });
    else if (status === 'google-drive-error') setStorageCallback({ title: 'Google Drive could not be connected', message: params.get('message') || 'Review Locations & connections and try again. Existing work remains unchanged.' });
    else setStorageCallback(null);
  }, [isDeveloper, isOwner]);
  useEffect(() => { setActiveTool(initialTool); }, [initialTool]);

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
    id: `pipeline:${item.submission.id}`, scope: 'pipeline', name: item.submission.name, kindLabel: item.kindLabel,
    sourceLabel: item.relationship === 'owned' ? 'Your submission' : 'Review queue', statusLabel: item.statusLabel,
    summary: item.submission.description || `${item.kindLabel} in Forge Review.`, updatedAt: item.submission.updatedAt ?? item.submission.submittedAt,
    sizeBytes: item.submission.sourceFileSizeBytes, previewUrl: item.submission.previewUrl || item.submission.sourceUrl,
    fontFamily: null, pipeline: item,
  })), [shared.pipelineItems]);

  const scopeItems = scope === 'personal' ? personalItems : scope === 'published' ? publishedItems : pipelineItems;
  const normalizedQuery = projection.query.trim().toLocaleLowerCase();
  const viewItems = useMemo(() => scopeItems.filter((item) => {
    if (scope !== 'personal' && sharedType !== 'all' && item.kindLabel !== sharedType && item.statusLabel !== sharedType) return false;
    return !normalizedQuery || [item.name, item.kindLabel, item.sourceLabel, item.statusLabel, item.summary].join(' ').toLocaleLowerCase().includes(normalizedQuery);
  }).toSorted((left, right) => projection.sort === 'name'
    ? left.name.localeCompare(right.name)
    : projection.sort === 'kind'
      ? left.kindLabel.localeCompare(right.kindLabel) || left.name.localeCompare(right.name)
      : (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0) || left.name.localeCompare(right.name)), [normalizedQuery, projection.sort, scope, scopeItems, sharedType]);
  const sharedTypes = useMemo(() => [...new Set(scopeItems.flatMap((item) => scope === 'pipeline' ? [item.kindLabel, item.statusLabel] : [item.kindLabel]))].toSorted(), [scope, scopeItems]);
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
    const set = cardSets.find((candidate) => candidate.id === item.personal.references.localSetId);
    return set?.frontTemplateId ? templateById.get(set.frontTemplateId) ?? templates[0] ?? null : templates[0] ?? null;
  };
  const activeFailure = scope === 'personal' ? projection.failures[0] ?? null : scope === 'published' ? shared.catalogFailure : shared.pipelineFailure;
  const activeLoading = scope === 'personal' ? projection.isLoading : scope === 'published' ? shared.catalogLoading : shared.pipelineLoading;
  const activeStatus = getLibraryScopeStatus({ loading: activeLoading, itemCount: scopeItems.length, failure: activeFailure?.message ?? null });

  const chooseScope = (nextScope: LibraryScope) => {
    setScope(nextScope); setSharedType('all'); setSelection(closeEnvironmentDetail);
    projection.router.replace(`/account?section=library&scope=${nextScope}`);
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
  const vote = async (item: Extract<LibraryViewItem, { scope: 'pipeline' }>, value: 'positive' | 'negative') => {
    setVotingId(item.pipeline.submission.id);
    try {
      const response = await fetch(`/api/developer-assets/${item.pipeline.submission.id}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: value }) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to record this vote.'));
      toast({ title: 'Vote recorded', description: `${item.name} has been updated in Forge Review.` });
      await shared.refresh();
    } catch (error) {
      toast({ title: 'Vote was not recorded', description: error instanceof Error ? error.message : 'Forge Review is unavailable.', variant: 'destructive' });
    } finally { setVotingId(null); }
  };

  const actions: ActionDescriptor[] = activeTool === 'locations'
    ? [zoneAction('library.close-locations', 'Close locations')]
    : currentItem?.scope === 'personal'
      ? getAccountLibraryEnvironmentActions(currentItem.personal, projection.busyItemId !== null ? 'Finish the current Library action first.' : undefined)
      : currentItem?.scope === 'published' || currentItem?.scope === 'pipeline' ? sharedActions(currentItem)
        : [zoneAction('library.refresh', activeLoading ? 'Refreshing' : 'Refresh Library', activeLoading)];

  const runPersonalAction = (actionId: string, item: AccountLibraryItem) => {
    if (actionId === 'library.open' || actionId === 'library.continue') void projection.openItem(item);
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

  const runPublishedAction = (actionId: string, item: Extract<LibraryViewItem, { scope: 'published' }>) => {
    const template = item.published.template;
    if (!template) {
      projection.router.push('/studio');
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
    store.setActiveTab('templates');
    if (actionId === 'library.copy-published-template') {
      toast({ title: 'Editable copy created', description: `${item.name} is now in your personal Templates.` });
    }
    projection.router.push('/studio');
  };

  const runAction = (action: ActionDescriptor) => {
    if (action.id === 'library.close-locations') {
      setActiveTool(null); projection.router.replace(`/account?section=library&scope=${scope}`);
      requestAnimationFrame(() => document.getElementById('library-locations-trigger')?.focus());
    } else if (currentItem?.scope === 'personal' && action.id.startsWith('library.')) runPersonalAction(action.id, currentItem.personal);
    else if ((action.id === 'library.use-published' || action.id === 'library.copy-published-template') && currentItem?.scope === 'published') runPublishedAction(action.id, currentItem);
    else if (action.id === 'library.open-pipeline' && currentItem?.scope === 'pipeline') projection.router.push(`/developer/cockpit?tab=library&submission=${encodeURIComponent(currentItem.pipeline.submission.id)}`);
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

  const scopeDefinition = scopeDefinitions.find((definition) => definition.id === scope)!;
  return <>
  <EnvironmentShell
    ariaLabel="CardForge Library" brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }} viewer={viewer}
    zones={zones} activeZone="library" viewportPolicy="desk" detail={activeTool ? null : currentRecord}
    detailVisual={currentItem ? <LibraryVisual item={currentItem} cards={cardsFor(currentItem)} template={templateFor(currentItem)} large /> : undefined}
    actions={actions} focusReturnId={selection.focusReturnId ?? undefined} surfaceRef={surfaceRef}
    statusContent={<><EnvironmentStatus label={`${scopeDefinition.label} · ${activeStatus.label}`} tone={activeStatus.kind === 'unavailable' ? 'warning' : activeStatus.kind === 'ready' ? 'success' : 'neutral'} /><EnvironmentStatus label={scope === 'personal' ? `${projection.items.length} personal objects` : scope === 'published' ? `${publishedItems.length} published objects` : `${pipelineItems.length} pipeline objects`} tone="neutral" /></>}
    footerContent={activeTool ? <span>Nothing moves between locations automatically</span> : currentRecord ? <span>{currentRecord.title} selected</span> : <button id="library-locations-trigger" type="button" onClick={() => { setActiveTool('locations'); projection.router.replace('/account?section=storage'); }}><MapPin size={14} aria-hidden="true" /> Locations &amp; connections</button>}
    onChooseZone={(zone: ZoneDefinition) => projection.router.push(zone.href)} onCommand={() => searchRef.current?.focus()}
    onAction={runAction} onCloseDetail={closeDetail}
  >
    <div className={styles.library} data-density={density} data-tool-open={Boolean(activeTool)}>
      <header className={styles.libraryHeader}>
        <div><p>Library</p><h1>Your materials and work</h1><span>Browse what you own, what CardForge publishes, and what is moving through review.</span></div>
        <button type="button" className={styles.locationsButton} onClick={() => { setActiveTool('locations'); closeDetail(); projection.router.replace('/account?section=storage'); }}><HardDrive size={16} aria-hidden="true" />Locations</button>
      </header>
      <nav className={styles.scopeTabs} aria-label="Library scopes">
        {scopeDefinitions.map((definition) => <button key={definition.id} type="button" aria-current={scope === definition.id ? 'page' : undefined} onClick={() => chooseScope(definition.id)}><span>{definition.label}</span><small>{definition.owner}</small></button>)}
      </nav>
      {storageCallback ? <EnvironmentBoundaryNotice title={storageCallback.title} message={storageCallback.message} /> : null}
      <section className={styles.collection} aria-labelledby="library-collection-heading">
        <div className={styles.collectionHeading}><div><h2 id="library-collection-heading">{scopeDefinition.label}</h2><p>{scopeDefinition.description}</p></div><span>{viewItems.length} shown</span></div>
        <div className={styles.toolbar} aria-label="Library toolbar">
          <label className={styles.searchField}><span className="sr-only">Search Library</span><Search aria-hidden="true" /><Input ref={searchRef} id="library-search" value={projection.query} onChange={(event) => projection.setQuery(event.target.value)} placeholder={`Search ${scope}`} /></label>
          {scope === 'personal' ? <>
            <Select value={projection.source} onValueChange={(value) => projection.setSource(value as AccountLibrarySource | 'all')}><SelectTrigger aria-label="Filter by source" className={styles.filterSelect}><span>{projection.source === 'all' ? 'All sources' : getAccountLibrarySourceLabel(projection.source)}</span></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{LIBRARY_SOURCES.map((source) => <SelectItem key={source} value={source}>{getAccountLibrarySourceLabel(source)} · {projection.sourceCounts.get(source) ?? 0}</SelectItem>)}</SelectContent></Select>
            <Select value={projection.kind} onValueChange={(value) => projection.setKind(value as AccountLibraryKind | 'all')}><SelectTrigger aria-label="Filter by type" className={styles.filterSelect}><span>{projection.kind === 'all' ? 'All types' : accountLibraryKindLabels[projection.kind]}</span></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{ACCOUNT_LIBRARY_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{accountLibraryKindLabels[kind]}</SelectItem>)}</SelectContent></Select>
          </> : <Select value={sharedType} onValueChange={setSharedType}><SelectTrigger aria-label={scope === 'pipeline' ? 'Filter Pipeline' : 'Filter by type'} className={styles.filterSelect}><span>{sharedType === 'all' ? scope === 'pipeline' ? 'All work' : 'All types' : sharedType}</span></SelectTrigger><SelectContent><SelectItem value="all">{scope === 'pipeline' ? 'All work' : 'All types'}</SelectItem>{sharedTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}
          <Select value={projection.sort} onValueChange={(value) => projection.setSort(value as 'recent' | 'name' | 'kind')}><SelectTrigger aria-label="Sort library" className={styles.sortSelect}><span>{projection.sort === 'name' ? 'Name' : projection.sort === 'kind' ? 'Type' : 'Recent'}</span></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="kind">Type</SelectItem></SelectContent></Select>
          <div className={styles.densityControls} aria-label="Collection view"><button type="button" aria-label="Gallery view" aria-pressed={density === 'gallery'} onClick={() => setDensity('gallery')}><Grid2X2 aria-hidden="true" /></button><button type="button" aria-label="Compact list view" aria-pressed={density === 'list'} onClick={() => setDensity('list')}><LayoutList aria-hidden="true" /></button><button type="button" aria-label="Expanded view" aria-pressed={density === 'expanded'} onClick={() => setDensity('expanded')}><PanelRightOpen aria-hidden="true" /></button></div>
        </div>
        {activeFailure ? <EnvironmentBoundaryNotice title={`${scopeDefinition.label} is unavailable`} message={`${activeFailure.message}${activeFailure.nextAction ? ` ${activeFailure.nextAction}` : ''} Other Library scopes remain unchanged.`} actionLabel={activeFailure.retryable ? 'Retry' : undefined} onAction={activeFailure.retryable ? refresh : undefined} /> : null}
        {activeLoading && !scopeItems.length ? <div className={styles.emptyState}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing {scope}</strong></div> : viewItems.length ? <div className={styles.objectGrid} aria-label={`${scope} Library objects`}>
          {viewItems.map((item) => {
            const pipelineItem = item.scope === 'pipeline' ? item : null;
            return <article key={item.id} className={styles.objectTile} data-selected={selection.objectId === item.id}>
              <button id={`library-object-${item.id}`} type="button" className={styles.objectButton} onClick={() => openDetail(item)}><span className={styles.visualSlot}><LibraryVisual item={item} cards={cardsFor(item)} template={templateFor(item)} /></span><span className={styles.objectCopy}><span className={styles.objectTopline}><small>{item.kindLabel}</small><small>{item.statusLabel}</small></span><strong>{item.name}</strong><span>{item.sourceLabel}</span><p>{item.summary}</p></span></button>
              {item.scope === 'personal' ? <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className={styles.objectMenu} aria-label={`Actions for ${item.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {getAccountLibraryEnvironmentActions(item.personal).map((action) => <Fragment key={action.id}>
                    {action.commitment === 'destructive' ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      disabled={action.availability.kind === 'disabled'}
                      className={action.commitment === 'destructive' ? 'text-destructive focus:text-destructive' : undefined}
                      onSelect={() => runPersonalAction(action.id, item.personal)}
                    >
                      {action.id === 'library.duplicate' ? <Copy aria-hidden="true" /> : action.id === 'library.delete-copy' ? <Trash2 aria-hidden="true" /> : action.id === 'library.view-source' ? <ExternalLink aria-hidden="true" /> : null}
                      {action.label}
                    </DropdownMenuItem>
                  </Fragment>)}
                </DropdownMenuContent>
              </DropdownMenu> : item.scope === 'published' ? <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className={styles.objectMenu} aria-label={`Actions for ${item.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sharedActions(item).map((action) => <DropdownMenuItem key={action.id} onSelect={() => runPublishedAction(action.id, item)}>
                    {action.id === 'library.copy-published-template' ? <Copy aria-hidden="true" /> : null}
                    {action.label}
                  </DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu> : null}
              {pipelineItem?.pipeline.relationship === 'review' ? <div className={styles.voteActions} aria-label={`Vote on ${item.name}`}><button type="button" disabled={votingId === pipelineItem.pipeline.submission.id} data-active={pipelineItem.pipeline.submission.currentUserVote === 'positive'} onClick={() => void vote(pipelineItem, 'positive')} aria-label={`Vote up for ${item.name}`}><ThumbsUp aria-hidden="true" />{pipelineItem.pipeline.submission.positiveVotes}</button><button type="button" disabled={votingId === pipelineItem.pipeline.submission.id} data-active={pipelineItem.pipeline.submission.currentUserVote === 'negative'} onClick={() => void vote(pipelineItem, 'negative')} aria-label={`Vote down for ${item.name}`}><ThumbsDown aria-hidden="true" />{pipelineItem.pipeline.submission.negativeVotes}</button></div> : null}
            </article>;
          })}
        </div> : <div className={styles.emptyState}><Boxes aria-hidden="true" /><strong>{scopeItems.length ? 'No objects match this view' : `${scopeDefinition.label} is ready`}</strong><p>{scopeItems.length ? 'Clear the search or change the filter.' : scope === 'personal' ? 'Create a Set or connect a location to begin.' : scope === 'published' ? 'Published assets will appear here when the catalog is available.' : 'Your submissions and reviewable work will appear here.'}</p></div>}
      </section>
      {activeTool === 'locations' ? <div className={styles.toolLayer} role="dialog" aria-modal="false" aria-labelledby="library-locations-title"><button type="button" className={styles.toolScrim} aria-label="Close locations and connections" onClick={() => runAction(actions[0]!)} /><section className={styles.toolPanel}><header><div><p>Library tool</p><h2 id="library-locations-title">Locations &amp; connections</h2><span>Inspect one owner at a time. Changes affect only the named location.</span></div><button type="button" onClick={() => runAction(actions[0]!)} aria-label="Close locations and connections"><X aria-hidden="true" /></button></header><div className={styles.toolContent}><DefaultWorkLocationControl isSignedIn={isSignedIn} driveConnected={projection.driveConnection?.connected ?? false} localFolderSupported={projection.localFolderSupported} />{storageConnections ?? <EnvironmentBoundaryNotice title="Location tools are unavailable" message="CardForge could not compose the location controls. Existing work remains unchanged." />}</div></section></div> : null}
    </div>
  </EnvironmentShell>
  <WorkLocationDialog
    item={locationItem}
    open={Boolean(locationItem)}
    onOpenChange={(open) => { if (!open) setLocationItem(null); }}
    isSignedIn={isSignedIn}
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
