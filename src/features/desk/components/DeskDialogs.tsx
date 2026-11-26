"use client";

import { PipelineSourceDisclosure } from '@/features/pipeline/client/engagement';
import { NewSetDialog } from '@/features/project/client/new-set';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { DisplayCard } from '@/domain/rendering';
import type { CardForgeCatalogManifest } from '@/features/pipeline/client';

import type { ArtifactSelectionScope } from '../model/focusedArtifactLayout';

interface DeskDialogsProps {
  createOpen: boolean;
  publishedSets: CardForgeCatalogManifest['sets']['items'];
  publishedSetsLoading: boolean;
  publishedSetsFailure: string | null;
  creatingPublishedSetId: string | null;
  dirtyCloseRequested: boolean;
  dirtyCloseToDesk?: boolean;
  dirtyToolName?: string;
  pendingDeleteCards: DisplayCard[];
  selectionScope: ArtifactSelectionScope;
  onDirtyCloseOpenChange: (open: boolean) => void;
  onConfirmDirtyClose: () => void;
  onCreateOpenChange: (open: boolean) => void;
  onCreateWork: (openDesign: boolean) => void;
  onSetFileOpened: (setId: string) => void;
  onCreatePublishedSet: (set: CardForgeCatalogManifest['sets']['items'][number]) => void;
  onRetryPublishedSets: () => void;
  onDeleteCardsOpenChange: (open: boolean) => void;
  onConfirmDeleteCards: () => void;
}

export function DeskDialogs(props: DeskDialogsProps) {

  return <>
    <NewSetDialog {...props} renderPublishedSetDetails={set => set.submissionId ? <PipelineSourceDisclosure submissionId={set.submissionId} /> : <p className="text-xs">Exact source reactions are unavailable for this starter.</p>} />

    <AlertDialog open={props.pendingDeleteCards.length > 0} onOpenChange={props.onDeleteCardsOpenChange}><AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]"><AlertDialogHeader><AlertDialogTitle>Remove {props.pendingDeleteCards.length === 1 ? 'this card' : `${props.pendingDeleteCards.length} cards`} from the Set?</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">The selected rendered {props.pendingDeleteCards.length === 1 ? 'card and its data' : 'cards and their data'} will be removed from this local Set.{props.selectionScope.hidden ? ` This includes ${props.selectionScope.hidden} selected Artifact${props.selectionScope.hidden === 1 ? '' : 's'} hidden by the current filters.` : ''} Reusable Templates remain available.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={props.onConfirmDeleteCards}>Remove {props.pendingDeleteCards.length === 1 ? 'card' : 'cards'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={props.dirtyCloseRequested} onOpenChange={props.onDirtyCloseOpenChange}><AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]"><AlertDialogHeader><AlertDialogTitle>{props.dirtyCloseToDesk ? 'Return to Desk with unsaved changes?' : `Close ${props.dirtyToolName ?? 'Design'} with unsaved changes?`}</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[var(--cf-text-muted)]">{props.dirtyCloseToDesk ? 'Returning to Desk closes the open tools and discards their unsaved drafts. Your saved Sets, cards, and Templates stay unchanged.' : 'Save your changes before closing to keep them. Closing will leave your saved work unchanged.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={props.onConfirmDirtyClose}>{props.dirtyCloseToDesk ? 'Discard & return to Desk' : `Close ${props.dirtyToolName ?? 'Design'}`}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
