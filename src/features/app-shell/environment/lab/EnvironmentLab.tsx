"use client";

import { Search, Undo2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import {
  closeEnvironmentDetail,
  createSelectionSession,
  getVisibleEnvironmentZones,
  isActionAvailable,
  openEnvironmentDetail,
  type ActionDescriptor,
  type EnvironmentViewer,
  type SelectionSession,
  type ZoneDefinition,
  type ZoneId,
} from '../model';
import { EnvironmentShell } from '../components/EnvironmentShell';
import { EnvironmentStatus } from '../components/EnvironmentStatus';
import styles from '../components/EnvironmentFoundation.module.css';
import labStyles from './EnvironmentLab.module.css';
import { detailRecords, getActionsForRecord, recipeLabels } from './fixtures';
import { CollectionRecipe, HomeRecipe, ProfileRecipe, QueueRecipe, StudioRecipe } from './recipes/EnvironmentRecipes';
import type { DetailRecord, RecipeId } from './types';

const initialSelections = (): Record<ZoneId, SelectionSession> => ({
  home: createSelectionSession(),
  library: createSelectionSession(),
  studio: createSelectionSession({ objectId: null, listOffset: 0, focusReturnId: null, zoom: 0.64 }),
  profile: createSelectionSession(),
  developer: createSelectionSession(),
  owner: createSelectionSession(),
});

const recipeForZone = (zone: ZoneId): RecipeId => {
  if (zone === 'home') return 'home';
  if (zone === 'library') return 'collection';
  if (zone === 'profile') return 'profile';
  if (zone === 'studio') return 'studio';
  return 'queue';
};

export function EnvironmentLab() {
  const [viewerMode, setViewerMode] = useState<'owner' | 'guest'>('owner');
  const viewer: EnvironmentViewer = useMemo(() => viewerMode === 'owner'
    ? { signedIn: true, contributor: true, owner: true }
    : { signedIn: false, contributor: false, owner: false }, [viewerMode]);
  const zones = useMemo(() => getVisibleEnvironmentZones(viewer), [viewer]);
  const [activeZone, setActiveZone] = useState<ZoneId>('home');
  const [selections, setSelections] = useState(initialSelections);
  const [query, setQuery] = useState('');
  const [announcement, setAnnouncement] = useState('Environment laboratory ready. All visible account and provider values are simulated.');
  const surfaceRef = useRef<HTMLElement | null>(null);

  const recipe = recipeForZone(activeZone);
  const selection = selections[activeZone];
  const currentRecord = detailRecords.find((record) => record.id === selection.objectId) ?? null;
  const actions = getActionsForRecord(recipe, currentRecord, activeZone).filter((action) => action.availability.kind !== 'hidden');
  const viewportPolicy = recipe === 'studio' ? 'desk' : 'flow';

  const replaceSelection = (zone: ZoneId, update: (current: SelectionSession) => SelectionSession) => {
    setSelections((current) => ({ ...current, [zone]: update(current[zone]) }));
  };

  const closeDetail = () => {
    const closingSelection = selections[activeZone];
    const restore = closingSelection.detailRestore;
    const focusReturnId = closingSelection.focusReturnId;
    replaceSelection(activeZone, closeEnvironmentDetail);
    setAnnouncement('Detail closed. Previous selection, position, and focus restored.');
    requestAnimationFrame(() => {
      if (restore) {
        const surface = document.querySelector<HTMLElement>(`.${styles.primarySurface}`);
        surface?.scrollTo({ top: restore.listOffset });
        if (focusReturnId) document.getElementById(focusReturnId)?.focus();
      }
    });
  };

  const openDetail = (record: DetailRecord) => {
    const listOffset = surfaceRef.current?.scrollTop ?? 0;
    const target = {
      objectId: record.id,
      listOffset,
      focusReturnId: `environment-object-${record.id}`,
      ...(activeZone === 'studio' ? { zoom: selections.studio.zoom ?? 0.64 } : {}),
    };
    replaceSelection(activeZone, (current) => openEnvironmentDetail({ ...current, listOffset }, target));
    setAnnouncement(`${record.title} selected. Detail opened with ${getActionsForRecord(recipe, record, activeZone).length} valid action${getActionsForRecord(recipe, record, activeZone).length === 1 ? '' : 's'}.`);
  };

  const chooseZone = (zone: ZoneDefinition) => {
    const currentOffset = surfaceRef.current?.scrollTop ?? 0;
    setSelections((current) => ({ ...current, [activeZone]: { ...current[activeZone], listOffset: currentOffset } }));
    setActiveZone(zone.id);
    if (zone.id !== 'library') setQuery('');
    const nextRecipe = recipeForZone(zone.id);
    const existing = selections[zone.id];
    setAnnouncement(`${recipeLabels[nextRecipe].title} selected.${existing.objectId ? ' Previous zone context restored.' : ''}`);
    requestAnimationFrame(() => {
      surfaceRef.current?.scrollTo({ top: existing.listOffset });
      if (existing.focusReturnId) document.getElementById(existing.focusReturnId)?.focus();
    });
  };

  const chooseViewerMode = (mode: 'owner' | 'guest') => {
    setViewerMode(mode);
    if (mode === 'guest') setActiveZone('studio');
    setAnnouncement(`${mode === 'guest' ? 'Signed-out guest Studio' : 'Signed-in Owner environment'} simulation selected.`);
  };

  const runAction = (action: ActionDescriptor) => {
    if (!isActionAvailable(action)) return;
    const target = currentRecord?.title ?? recipeLabels[recipe].title;
    const automation = action.automation.kind === 'published-mcp'
      ? `MCP parity: ${action.automation.tools.join(' → ')}.`
      : action.automation.kind === 'planned-mcp'
        ? `Planned MCP counterpart: ${action.automation.capability}.`
        : `${action.automation.owner === 'provider' ? 'Provider-native' : 'Human'} action.`;
    setAnnouncement(`${action.label} demonstrated for ${target}. ${automation}`);
  };

  const search = recipe === 'collection' ? (
    <label className={styles.searchWrap}>
      <span className="sr-only">Search this Library collection</span>
      <Search className={styles.searchIcon} aria-hidden="true" />
      <input className={styles.searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Library…" />
    </label>
  ) : undefined;

  return (
    <>
      <div className={labStyles.simulationBanner} role="note"><strong>Preview laboratory</strong><span>Simulated data — no live services are changed.</span><div className={labStyles.viewerToggle} aria-label="Simulated viewer"><button type="button" aria-pressed={viewerMode === 'owner'} onClick={() => chooseViewerMode('owner')}>Owner</button><button type="button" aria-pressed={viewerMode === 'guest'} onClick={() => chooseViewerMode('guest')}>Guest Studio</button></div></div>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <EnvironmentShell
        ariaLabel="CardForge environment foundation laboratory"
        brand={{ src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' }}
        viewer={viewer}
        zones={zones}
        activeZone={activeZone}
        viewportPolicy={viewportPolicy}
        detail={currentRecord}
        actions={actions}
        focusReturnId={selection.focusReturnId ?? undefined}
        primaryDisabledReason={actions.some((action) => action.hierarchy === 'primary') && !currentRecord && actions.every((action) => action.scope !== 'zone') ? 'Select an object first.' : undefined}
        search={search}
        statusContent={<><EnvironmentStatus label={currentRecord ? '1 object selected' : 'No selection'} tone={currentRecord ? 'warning' : 'neutral'} /><EnvironmentStatus label="Local work saved" tone="success" /><EnvironmentStatus label={viewportPolicy === 'desk' ? 'Desk viewport' : 'Flow viewport'} /></>}
        footerContent={recipe === 'studio' ? <><button type="button" className={styles.quietButton} onClick={() => setAnnouncement('Undo demonstrated.')}><Undo2 size={15} aria-hidden="true" /> Undo</button><span>{Math.round((selection.zoom ?? 0.64) * 100)}%</span></> : <span>Foundation laboratory</span>}
        surfaceRef={surfaceRef}
        onChooseZone={chooseZone}
        onCommand={() => setAnnouncement('Command search opened for the active zone.')}
        onAction={runAction}
        onCloseDetail={closeDetail}
      >
        {recipe === 'home' ? <HomeRecipe selectedId={selection.objectId} onOpen={openDetail} /> : null}
        {recipe === 'collection' ? <CollectionRecipe query={query} selectedId={selection.objectId} onOpen={openDetail} onQueryChange={setQuery} onRetry={() => setAnnouncement('Google Drive retry demonstrated. Available local work remains visible during recovery.')} /> : null}
        {recipe === 'profile' ? <ProfileRecipe selectedId={selection.objectId} onOpen={openDetail} /> : null}
        {recipe === 'queue' ? <QueueRecipe activePermission={activeZone === 'owner' ? 'owner' : 'developer'} selectedId={selection.objectId} onOpen={openDetail} /> : null}
        {recipe === 'studio' ? <StudioRecipe selectedId={selection.objectId} onOpen={openDetail} /> : null}
      </EnvironmentShell>
    </>
  );
}
