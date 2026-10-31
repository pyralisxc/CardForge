"use client";

import { Boxes, FolderPlus, Loader2, Pencil } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PublishedSetCatalogItem } from '@/domain/publishedSets';
import styles from './NewSetDialog.module.css';

interface NewSetDialogProps {
  renderPublishedSetDetails?: (set: PublishedSetCatalogItem) => ReactNode;
  createOpen: boolean;
  publishedSets: PublishedSetCatalogItem[];
  publishedSetsLoading: boolean;
  publishedSetsFailure: string | null;
  creatingPublishedSetId: string | null;
  onCreateOpenChange: (open: boolean) => void;
  onCreateWork: (openDesign: boolean) => void;
  onCreatePublishedSet: (set: PublishedSetCatalogItem) => void;
  onRetryPublishedSets: () => void;
}

export function NewSetDialog(props: NewSetDialogProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const freshSetDescriptionId = useId();
  const freshSetDesignDescriptionId = useId();
  return (
    <Dialog open={props.createOpen} onOpenChange={props.onCreateOpenChange}><DialogContent className={styles.createDialog} onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}><DialogHeader><DialogTitle>Start a new Set</DialogTitle><DialogDescription>Start empty, design a card layout, or customize a published starter. Your starter copy is independent; the published original stays unchanged.</DialogDescription></DialogHeader><div className={styles.createChoices}>
      <button type="button" className={styles.createChoice} aria-label="Fresh Set" aria-describedby={freshSetDescriptionId} onClick={() => props.onCreateWork(false)}><span className={styles.createChoiceVisual}><FolderPlus aria-hidden="true" /></span><span><strong>Fresh Set</strong><small id={freshSetDescriptionId}>Start with no cards. Add a layout and generate cards when you are ready.</small></span></button>
      <button type="button" className={styles.createChoice} aria-label="Fresh Set + Design" aria-describedby={freshSetDesignDescriptionId} onClick={() => props.onCreateWork(true)}><span className={styles.createChoiceVisual}><Pencil aria-hidden="true" /></span><span><strong>Fresh Set + Design</strong><small id={freshSetDesignDescriptionId}>Create a Set and open the card layout editor. Design once, then use that layout for many cards.</small></span></button>
      {props.publishedSets.map((set) => <div key={set.id}><button type="button" className={`${styles.createChoice} w-full`} disabled={props.creatingPublishedSetId !== null} onClick={() => props.onCreatePublishedSet(set)}><span className={styles.createChoiceVisual}>{set.previewUrl ? <img src={set.previewUrl} alt="" /> : <Boxes aria-hidden="true" />}</span><span><strong>{set.name}</strong><small>{set.description} · Revision {set.revision}</small></span>{props.creatingPublishedSetId === set.id ? <Loader2 className="animate-spin" aria-label="Creating Set" /> : null}</button>{props.renderPublishedSetDetails?.(set)}</div>)}
      {props.publishedSetsLoading ? <div className={styles.createStatus}><Loader2 className="animate-spin" aria-hidden="true" />Loading published Sets</div> : null}
      {props.publishedSetsFailure ? <div role="alert"><strong>Published Sets are unavailable</strong><p>{props.publishedSetsFailure} You can still create a fresh Set.</p><Button type="button" variant="outline" onClick={props.onRetryPublishedSets}>Retry</Button></div> : null}
      {!props.publishedSetsLoading && !props.publishedSetsFailure && props.publishedSets.length === 0 ? <p className={styles.createStatus}>No published Set starters yet. Fresh Set remains available.</p> : null}
    </div></DialogContent></Dialog>
  );
}
