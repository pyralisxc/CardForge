"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, Info, MoreHorizontal, Pencil, Pin, Printer, Save, Trash2, UploadCloud, WandSparkles } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import { workSourceLabel } from '../model/homeDesk';
import styles from './HomeDesk.module.css';

interface DeskWorkObjectProps {
  item: AccountLibraryItem;
  index: number;
  itemCount: number;
  active: boolean;
  featured: boolean;
  focused: boolean;
  obscured: boolean;
  pinned: boolean;
  position?: DeskPosition;
  canUseProjectFiles: boolean;
  canSubmit: boolean;
  preview: ReactNode;
  focusedSurface: ReactNode;
  beginDrag: (itemId: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  moveDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  endDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  shouldSuppressFocus: (itemId: string) => boolean;
  onFocus: (item: AccountLibraryItem) => void;
  onTogglePin: (itemId: string) => void;
  onOpenLane: (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => void;
  onOpenLocation: (item: AccountLibraryItem) => void;
  onOpenPipeline: (setId: string) => void;
  onDuplicate: (item: AccountLibraryItem) => void;
  onMove: (itemId: string, direction: 'earlier' | 'later') => void;
  onInspect: (item: AccountLibraryItem) => void;
  onDelete: (item: AccountLibraryItem) => void;
}

export function DeskWorkObject(props: DeskWorkObjectProps) {
  const positionStyle = props.position
    ? ({ '--desk-x': `${props.position.x}px`, '--desk-y': `${props.position.y}px` } as CSSProperties)
    : undefined;
  return <article
    className={styles.workTile}
    style={positionStyle}
    data-positioned={Boolean(props.position) && !props.focused}
    data-home-work-object
    data-home-set-object-id={props.item.id}
    data-presentation={props.focused ? 'focused' : 'overview'}
    data-featured={props.featured}
    data-slot={props.index % 6}
    data-active={props.active}
    data-pinned={props.pinned}
    aria-hidden={props.obscured || undefined}
  >
    <button
      id={`home-work-${props.item.id}`}
      type="button"
      className={styles.workTileMain}
      disabled={props.focused}
      tabIndex={props.focused ? -1 : undefined}
      aria-hidden={props.focused || undefined}
      onPointerDown={(event) => props.beginDrag(props.item.id, event)}
      onPointerMove={props.moveDrag}
      onPointerUp={props.endDrag}
      onPointerCancel={props.endDrag}
      onClick={() => { if (!props.shouldSuppressFocus(props.item.id)) props.onFocus(props.item); }}
      aria-label={`Focus ${props.item.name}`}
    >
      <div className={styles.workVisual} data-home-set-stack>{props.preview}</div>
      <span className={styles.workMeta}><strong>{props.item.name}</strong><span>{props.item.details.join(' · ') || workSourceLabel(props.item)}</span><span>{workSourceLabel(props.item)}</span></span>
    </button>
    {props.focused ? props.focusedSurface : <div className={styles.tileActions}>
      <button type="button" className={styles.iconButton} data-active={props.pinned} onClick={() => props.onTogglePin(props.item.id)} aria-label={`${props.pinned ? 'Unpin' : 'Pin'} ${props.item.name}`} title={props.pinned ? 'Unpin from desk' : 'Pin to desk'}><Pin size={15} aria-hidden="true" /></button>
      <DropdownMenu><DropdownMenuTrigger asChild><button id={`home-work-info-${props.item.id}`} type="button" className={styles.iconButton} aria-label={`Actions for ${props.item.name}`} title="Actions"><MoreHorizontal size={15} aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent align="end">
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onFocus(props.item)}><Pencil aria-hidden="true" />Open Set</DropdownMenuItem> : <DropdownMenuItem onSelect={() => props.onOpenLane(props.item, 'open')}><Pencil aria-hidden="true" />Open in Studio</DropdownMenuItem>}
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onOpenLane(props.item, 'generate')}><WandSparkles aria-hidden="true" />Generate cards</DropdownMenuItem> : null}
        <DropdownMenuItem disabled={!props.canUseProjectFiles} onSelect={() => props.onOpenLocation(props.item)}><Save aria-hidden="true" />Save / move{props.canUseProjectFiles ? '' : ' · Creator Pass'}</DropdownMenuItem>
        {props.canSubmit && props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onOpenPipeline(props.item.references.localSetId!)}><UploadCloud aria-hidden="true" />Send to Pipeline</DropdownMenuItem> : null}
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onDuplicate(props.item)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
        <DropdownMenuItem disabled={props.index === 0} onSelect={() => props.onMove(props.item.id, 'earlier')}><ArrowUp aria-hidden="true" />Move earlier on desk</DropdownMenuItem>
        <DropdownMenuItem disabled={props.index === props.itemCount - 1} onSelect={() => props.onMove(props.item.id, 'later')}><ArrowDown aria-hidden="true" />Move later on desk</DropdownMenuItem>
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onOpenLane(props.item, 'export')}><Printer aria-hidden="true" />Export / print</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={() => props.onInspect(props.item)}><Info aria-hidden="true" />Details</DropdownMenuItem>
        {props.item.references.localSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => props.onDelete(props.item)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
      </DropdownMenuContent></DropdownMenu>
    </div>}
  </article>;
}
