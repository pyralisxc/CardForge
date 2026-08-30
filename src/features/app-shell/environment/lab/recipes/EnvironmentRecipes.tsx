import Image from 'next/image';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

import {
  CollectionLedgerRow,
  CompactSettingRow,
  EnvironmentLedgerRow,
  EnvironmentSectionHeading,
  EnvironmentSurfaceHeader,
} from '../../components/EnvironmentLedger';
import { EnvironmentStatus } from '../../components/EnvironmentStatus';
import {
  collectionItems,
  homeCurrentWork,
  homeSnapshotItems,
  partialBoundary,
  profileGroups,
  queueItems,
  recipeLabels,
  studioGroups,
} from '../fixtures';
import type { DetailRecord, RecipeId } from '../types';
import styles from '../../components/EnvironmentFoundation.module.css';
import recipeStyles from './EnvironmentRecipes.module.css';

interface RecipeProps {
  selectedId: string | null;
  onOpen: (record: DetailRecord) => void;
}

const boundarySamples = {
  loading: ['Loading', 'Refreshing provider state…', 'Wait'],
  empty: ['Empty', 'No objects exist in this view yet.', 'Create a Set'],
  authentication: ['Authentication required', 'Google Drive needs a fresh sign-in.', 'Reconnect'],
  authorization: ['Not permitted', 'This account cannot publish contributions.', 'Review access'],
  invalid: ['Invalid input', 'One field needs correction before continuing.', 'Review field'],
  conflict: ['Revision conflict', 'A newer revision exists. Authored work is unchanged.', 'Reload revision'],
  not_found: ['Not found', 'The requested object is no longer in this location.', 'Return to Library'],
  limit: ['Limit reached', 'This plan has no remaining temporary workspace capacity.', 'Compare plans'],
  unavailable: ['Service unavailable', 'The provider cannot respond right now.', 'Retry'],
  offline: ['Offline', 'Local work remains available; provider actions are paused.', 'Work locally'],
} as const;

function BoundaryStateSampler() {
  const [sample, setSample] = useState<keyof typeof boundarySamples>('authentication');
  const [title, message, action] = boundarySamples[sample];
  return (
    <section className={styles.sectionGroup} aria-labelledby="boundary-sampler-heading">
      <EnvironmentSectionHeading id="boundary-sampler-heading" title="Boundary vocabulary" meta="Interactive foundation proof" />
      <label className={recipeStyles.boundaryPicker}><span>State</span><select value={sample} onChange={(event) => setSample(event.target.value as keyof typeof boundarySamples)}>{Object.keys(boundarySamples).map((kind) => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select></label>
      <div className={styles.boundary} role="status"><AlertTriangle size={18} aria-hidden="true" /><p><strong>{title}.</strong> {message}</p><button type="button" className={styles.quietButton}>{action}</button></div>
    </section>
  );
}

function Header({ recipe }: { recipe: RecipeId }) {
  return <EnvironmentSurfaceHeader {...recipeLabels[recipe]} />;
}

export function HomeRecipe({ selectedId, onOpen }: RecipeProps) {
  return (
    <>
      <Header recipe="home" />
      <section className={styles.sectionGroup} aria-labelledby="home-current-work-heading">
        <EnvironmentSectionHeading id="home-current-work-heading" title="Current work" meta="Saved moments ago" />
        <div className={styles.settingsGroup}><CompactSettingRow item={homeCurrentWork} selected={selectedId === homeCurrentWork.id} onOpen={onOpen} /></div>
      </section>
      <section className={styles.sectionGroup} aria-labelledby="home-account-snapshot-heading">
        <EnvironmentSectionHeading id="home-account-snapshot-heading" title="Account snapshot" meta="4 essentials" />
        <div className={styles.settingsGroup}>{homeSnapshotItems.map((item) => <CompactSettingRow key={item.id} item={item} selected={selectedId === item.id} onOpen={onOpen} />)}</div>
      </section>
      <section className={styles.sectionGroup} aria-labelledby="home-recent-work-heading">
        <EnvironmentSectionHeading id="home-recent-work-heading" title="Recent work" meta="2 items" />
        {collectionItems.slice(0, 2).map((item) => <CollectionLedgerRow key={item.id} item={item} selected={selectedId === item.id} onOpen={onOpen} />)}
      </section>
    </>
  );
}

export function CollectionRecipe({ query, selectedId, onOpen, onQueryChange, onRetry }: RecipeProps & { query: string; onQueryChange: (value: string) => void; onRetry: () => void }) {
  const normalized = query.trim().toLocaleLowerCase();
  const items = collectionItems.filter((item) => !normalized || `${item.title} ${item.summary} ${item.kind} ${item.location}`.toLocaleLowerCase().includes(normalized));
  const failure = partialBoundary.kind === 'partial' ? partialBoundary.failures[0] : null;
  return (
    <>
      <Header recipe="collection" />
      <label className={recipeStyles.mobileSearch}><span className="sr-only">Search this Library collection</span><Search aria-hidden="true" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search Library…" /></label>
      {failure ? <div className={styles.boundary} role="status"><AlertTriangle size={18} aria-hidden="true" /><p><strong>One source needs attention.</strong> {failure.message}</p><button type="button" className={styles.quietButton} onClick={onRetry}>{failure.nextAction}<RefreshCw size={14} aria-hidden="true" /></button></div> : null}
      <section className={styles.sectionGroup} aria-labelledby="library-objects-heading">
        <EnvironmentSectionHeading id="library-objects-heading" title="Owned work" meta={`${items.length} items`} />
        <div className={styles.ledgerHeader} aria-hidden="true"><span>Name</span><span>Kind</span><span>Location</span><span>Updated</span><span>Detail</span></div>
        {items.length === 0 ? <p className={styles.surfaceCopy} role="status">No Library objects match “{query}”. Clear the search to restore the inventory.</p> : items.map((item) => <CollectionLedgerRow key={item.id} item={item} selected={selectedId === item.id} onOpen={onOpen} />)}
      </section>
    </>
  );
}

export function ProfileRecipe({ selectedId, onOpen }: RecipeProps) {
  return (
    <>
      <Header recipe="profile" />
      {profileGroups.map((group) => {
        const id = `profile-${group.title.replaceAll(' ', '-').toLowerCase()}`;
        return <section key={group.title} className={styles.sectionGroup} aria-labelledby={id}><EnvironmentSectionHeading id={id} title={group.title} meta={`${group.items.length} settings`} /><div className={styles.settingsGroup}>{group.items.map((item) => <CompactSettingRow key={item.id} item={item} selected={selectedId === item.id} onOpen={onOpen} />)}</div></section>;
      })}
    </>
  );
}

export function QueueRecipe({ activePermission, selectedId, onOpen }: RecipeProps & { activePermission: 'contributor' | 'owner' }) {
  const visibleItems = queueItems.filter((item) => activePermission === 'owner' || item.permission === 'contributor');
  return (
    <>
      <Header recipe="queue" />
      {activePermission === 'contributor' ? <BoundaryStateSampler /> : null}
      <section className={styles.sectionGroup} aria-labelledby="queue-review-heading">
        <EnvironmentSectionHeading id="queue-review-heading" title={`${activePermission === 'owner' ? 'Owner' : 'Contributor'} review and follow-up`} meta={`${visibleItems.length} actions`} />
        <div className={styles.ledgerHeader} aria-hidden="true"><span>Action</span><span>Status</span><span>Owner</span><span>Next action</span><span>Detail</span></div>
        {visibleItems.map((item) => <EnvironmentLedgerRow key={item.id} record={item} selected={selectedId === item.id} className={styles.queueRow} onOpen={onOpen}><EnvironmentStatus label={item.status} tone={item.tone} /><span className={styles.ledgerCell}>{item.owner} · {item.updated}</span><span className={styles.ledgerCell}>{item.nextAction}</span></EnvironmentLedgerRow>)}
      </section>
    </>
  );
}

export function StudioRecipe({ selectedId, onOpen }: RecipeProps) {
  return (
    <>
      <Header recipe="studio" />
      <div className={recipeStyles.studioDesk} aria-label="Arcane Playing Deck focused workbench">
        {studioGroups.map((group) => <section key={group.area} className={recipeStyles.studioGroup} data-area={group.area} aria-labelledby={`studio-group-${group.area}`}><div className={recipeStyles.studioGroupHeader}><h3 id={`studio-group-${group.area}`} className={recipeStyles.groupTitle}>{group.title}</h3><EnvironmentStatus label={`${group.items.length} item${group.items.length === 1 ? '' : 's'}`} /></div><div className={recipeStyles.artifactGrid}>{group.items.map((item) => { const Icon = item.icon; return <button key={item.id} id={`environment-object-${item.id}`} type="button" className={recipeStyles.artifactButton} aria-pressed={selectedId === item.id} onClick={() => onOpen(item)}>{item.imageSrc ? <Image className={recipeStyles.artifactImage} src={item.imageSrc} alt="" width={56} height={78} sizes="56px" /> : <Icon size={28} aria-hidden="true" />}<span>{item.title}</span><EnvironmentStatus label={item.status} tone={item.tone} /></button>; })}</div></section>)}
      </div>
    </>
  );
}
