"use client";

import { Boxes, FolderPlus, Loader2, Pencil } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { DisplayCard } from '@/domain/rendering';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { CardForgeCatalogManifest } from '@/features/pipeline/client';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { ArtifactSelectionScope } from '../model/focusedArtifactLayout';
import styles from './HomeDesk.module.css';

interface HomeDeskDialogsProps {
  createOpen: boolean;
  publishedSets: CardForgeCatalogManifest['sets']['items'];
  publishedSetsLoading: boolean;
  publishedSetsFailure: string | null;
  creatingPublishedSetId: string | null;
  dirtyCloseRequested: boolean;
  pendingDeleteWork: AccountLibraryItem | null;
  pendingDeleteCards: DisplayCard[];
  selectionScope: ArtifactSelectionScope;
  onDirtyCloseOpenChange: (open: boolean) => void;
  onConfirmDirtyClose: () => void;
  onCreateOpenChange: (open: boolean) => void;
  onCreateWork: (openDesign: boolean) => void;
  onCreatePublishedSet: (set: CardForgeCatalogManifest['sets']['items'][number]) => void;
  onRetryPublishedSets: () => void;
  onDeleteWorkOpenChange: (open: boolean) => void;
  onConfirmDeleteWork: () => void;
  onDeleteCardsOpenChange: (open: boolean) => void;
  onConfirmDeleteCards: () => void;
}

export function HomeDeskDialogs(props: HomeDeskDialogsProps) {
  return <>
    <Dialog open={props.createOpen} onOpenChange={props.onCreateOpenChange}><DialogContent className={styles.createDialog}><DialogHeader><DialogTitle>Start a new Set</DialogTitle><DialogDescription>Begin empty or make an independent editable copy of a published Set.</DialogDescription></DialogHeader><div className={styles.createChoices}>
      <button type="button" className={styles.createChoice} onClick={() => props.onCreateWork(false)}><span className={styles.createChoiceVisual}><FolderPlus aria-hidden="true" /></span><span><strong>Fresh Set</strong><small>An empty, flexible space for any cards or creative objects.</small></span></button>
      <button type="button" className={styles.createChoice} onClick={() => props.onCreateWork(true)}><span className={styles.createChoiceVisual}><Pencil aria-hidden="true" /></span><span><strong>Fresh Set + Design</strong><small>Create the Set and open the contextual Design tool immediately.</small></span></button>
      {props.publishedSets.map((set) => <button key={set.id} type="button" className={styles.createChoice} disabled={props.creatingPublishedSetId !== null} onClick={() => props.onCreatePublishedSet(set)}><span className={styles.createChoiceVisual}>{set.previewUrl ? <img src={set.previewUrl} alt="" /> : <Boxes aria-hidden="true" />}</span><span><strong>{set.name}</strong><small>{set.description} · Revision {set.revision}</small></span>{props.creatingPublishedSetId === set.id ? <Loader2 className="animate-spin" aria-label="Creating Set" /> : null}</button>)}
      {props.publishedSetsLoading ? <div className={styles.createStatus}><Loader2 className="animate-spin" aria-hidden="true" />Loading published Sets</div> : null}
      {props.publishedSetsFailure ? <EnvironmentBoundaryNotice title="Published Sets are unavailable" message={`${props.publishedSetsFailure} You can still create a fresh Set.`} actionLabel="Retry" onAction={props.onRetryPublishedSets} /> : null}
      {!props.publishedSetsLoading && !props.publishedSetsFailure && props.publishedSets.length === 0 ? <p className={styles.createStatus}>No published Set starters yet. Fresh Set remains available.</p> : null}
    </div></DialogContent></Dialog>
    <AlertDialog open={Boolean(props.pendingDeleteWork)} onOpenChange={props.onDeleteWorkOpenChange}><AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]"><AlertDialogHeader><AlertDialogTitle>Delete this Set from this device?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">{props.pendingDeleteWork?.name} and its local cards will be removed from this browser workspace. Provider copies and shared Library content remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={props.onConfirmDeleteWork}>Delete local Set</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={props.pendingDeleteCards.length > 0} onOpenChange={props.onDeleteCardsOpenChange}><AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]"><AlertDialogHeader><AlertDialogTitle>Remove {props.pendingDeleteCards.length === 1 ? 'this card' : `${props.pendingDeleteCards.length} cards`} from the Set?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">The selected rendered {props.pendingDeleteCards.length === 1 ? 'card and its data' : 'cards and their data'} will be removed from this local Set.{props.selectionScope.hidden ? ` This includes ${props.selectionScope.hidden} selected Artifact${props.selectionScope.hidden === 1 ? '' : 's'} hidden by the current filters.` : ''} Reusable Templates remain available.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={props.onConfirmDeleteCards}>Remove {props.pendingDeleteCards.length === 1 ? 'card' : 'cards'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={props.dirtyCloseRequested} onOpenChange={props.onDirtyCloseOpenChange}><AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]"><AlertDialogHeader><AlertDialogTitle>Close Design with unsaved changes?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">Your current Design draft remains recoverable in this browser, but it has not been saved as the active Template revision.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={props.onConfirmDirtyClose}>Close Design</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
