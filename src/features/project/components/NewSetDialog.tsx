"use client";

import { Boxes, FolderOpen, FolderPlus, Loader2, Pencil } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
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
  onSetFileOpened: (setId: string) => void;
  onCreatePublishedSet: (set: PublishedSetCatalogItem) => void;
  onRetryPublishedSets: () => void;
}

function SetFileChoice({ onOpened }: { onOpened: (setId: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const [opening, setOpening] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const descriptionId = useId();
  useLayoutEffect(() => () => operation.current?.abort(), []);

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const controller = new AbortController();
    operation.current = controller;
    setOpening(true);
    setFailure(null);
    try {
      const { openBrowserSetFile } = await import('../client/openBrowserSetFile');
      const setId = await openBrowserSetFile(file, controller.signal);
      if (!controller.signal.aborted) onOpened(setId);
    } catch (error) {
      if (!controller.signal.aborted) setFailure(error instanceof Error ? error.message : 'The Set file could not be opened. Existing work was left unchanged.');
    } finally {
      if (!controller.signal.aborted) setOpening(false);
    }
  };

  return <div>
    <input ref={input} type="file" accept=".cardforge" aria-label="Choose a .cardforge Set file" hidden onChange={(event) => { void chooseFile(event); }} />
    <button type="button" className={`${styles.createChoice} w-full`} aria-label="Open a Set file" aria-describedby={descriptionId} aria-busy={opening} disabled={opening} onClick={() => input.current?.click()}>
      <span className={styles.createChoiceVisual}>{opening ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}</span>
      <span><strong>{opening ? 'Opening Set…' : 'Open a Set file'}</strong><small id={descriptionId}>Open an independent browser copy from a .cardforge file. Existing Sets and saved files stay unchanged.</small></span>
    </button>
    {failure ? <p role="alert" className="mt-2 text-sm text-destructive">{failure}</p> : null}
  </div>;
}

export function NewSetDialog(props: NewSetDialogProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const freshSetDescriptionId = useId();
  const freshSetDesignDescriptionId = useId();
  return (
    <Dialog open={props.createOpen} onOpenChange={props.onCreateOpenChange}><DialogContent className={styles.createDialog} onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}><DialogHeader><DialogTitle>Start a new Set</DialogTitle><DialogDescription>Start empty, open a Set file, design a card layout, or customize a published starter. File and starter copies are independent; originals stay unchanged.</DialogDescription></DialogHeader><div className={styles.createChoices}>
      <button type="button" className={styles.createChoice} aria-label="Fresh Set" aria-describedby={freshSetDescriptionId} onClick={() => props.onCreateWork(false)}><span className={styles.createChoiceVisual}><FolderPlus aria-hidden="true" /></span><span><strong>Fresh Set</strong><small id={freshSetDescriptionId}>Start with no cards. Add a layout and generate cards when you are ready.</small></span></button>
      <button type="button" className={styles.createChoice} aria-label="Fresh Set + Design" aria-describedby={freshSetDesignDescriptionId} onClick={() => props.onCreateWork(true)}><span className={styles.createChoiceVisual}><Pencil aria-hidden="true" /></span><span><strong>Fresh Set + Design</strong><small id={freshSetDesignDescriptionId}>Create a Set and open the card layout editor. Design once, then use that layout for many cards.</small></span></button>
      {props.createOpen ? <SetFileChoice onOpened={(setId) => { props.onCreateOpenChange(false); props.onSetFileOpened(setId); }} /> : null}
      {props.publishedSets.map((set) => <div key={set.id}><button type="button" className={`${styles.createChoice} w-full`} disabled={props.creatingPublishedSetId !== null} onClick={() => props.onCreatePublishedSet(set)}><span className={styles.createChoiceVisual}>{set.previewUrl ? <img src={set.previewUrl} alt="" /> : <Boxes aria-hidden="true" />}</span><span><strong>{set.name}</strong><small>{set.description} · Revision {set.revision}</small></span>{props.creatingPublishedSetId === set.id ? <Loader2 className="animate-spin" aria-label="Creating Set" /> : null}</button>{props.renderPublishedSetDetails?.(set)}</div>)}
      {props.publishedSetsLoading ? <div className={styles.createStatus}><Loader2 className="animate-spin" aria-hidden="true" />Loading published Sets</div> : null}
      {props.publishedSetsFailure ? <div role="alert"><strong>Published Sets are unavailable</strong><p>{props.publishedSetsFailure} You can still create a fresh Set.</p><Button type="button" variant="outline" onClick={props.onRetryPublishedSets}>Retry</Button></div> : null}
      {!props.publishedSetsLoading && !props.publishedSetsFailure && props.publishedSets.length === 0 ? <p className={styles.createStatus}>No published Set starters yet. Fresh Set remains available.</p> : null}
    </div></DialogContent></Dialog>
  );
}
