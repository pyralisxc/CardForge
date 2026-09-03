"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Copy, Info, MoreHorizontal, Pencil, Pin, Printer, RefreshCcw, Save, Trash2, UploadCloud, WandSparkles } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CardFace } from '@/domain/cards';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import { getDeskWorkKeyboardIntent, workSourceLabel } from '../model/desk';
import styles from './Desk.module.css';

interface DeskWorkObjectProps {
  item: AccountLibraryItem;
  active: boolean;
  featured: boolean;
  focused: boolean;
  selected: boolean;
  arrangeMode: boolean;
  obscured: boolean;
  pinned: boolean;
  position?: DeskPosition;
  canUseProjectFiles: boolean;
  canSubmit: boolean;
  preview: (face: CardFace) => ReactNode;
  canFlip: boolean;
  focusedSurface: ReactNode;
  beginDrag: (itemId: string, event: ReactPointerEvent<HTMLButtonElement>, options?: { additive?: boolean }) => void;
  moveDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  endDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  shouldSuppressActivation: (itemId: string) => boolean;
  onSelect: (item: AccountLibraryItem, options?: { additive?: boolean; range?: boolean }) => void;
  onFocus: (item: AccountLibraryItem) => void;
  onTogglePin: (itemId: string) => void;
  onOpenLane: (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => void;
  onOpenLocation: (item: AccountLibraryItem) => void;
  onOpenPipeline: (setId: string) => void;
  onDuplicate: (item: AccountLibraryItem) => void;
  onInspect: (item: AccountLibraryItem) => void;
  onDelete: (item: AccountLibraryItem) => void;
}

export function DeskWorkObject(props: DeskWorkObjectProps) {
  const [face, setFace] = useState<CardFace>('front');
  const lastPointerTypeRef = useRef('mouse');
  const suppressTouchSelectionClickRef = useRef(false);
  const openWithMotion = () => props.onFocus(props.item);
  const positionStyle = props.position
    ? ({ '--desk-x': `${props.position.x}px`, '--desk-y': `${props.position.y}px`, '--desk-z': props.position.z } as CSSProperties)
    : undefined;
  return <article
    className={styles.workTile}
    style={positionStyle}
    data-positioned={Boolean(props.position) && !props.focused}
    data-set-object
    data-desk-set-object-id={props.item.id}
    data-presentation={props.focused ? 'focused' : 'overview'}
    data-featured={props.featured && !props.focused}
    data-active={props.active}
    data-selected={props.selected}
    data-pinned={props.pinned}
    aria-hidden={props.obscured || undefined}
  >
    <button
      id={`set-${props.item.id}`}
      type="button"
      className={styles.workTileMain}
      disabled={props.focused}
      tabIndex={props.focused ? -1 : undefined}
      aria-hidden={props.focused || undefined}
      aria-pressed={props.selected}
      onPointerDown={(event) => {
        lastPointerTypeRef.current = event.pointerType;
        const modified = event.metaKey || event.ctrlKey || event.shiftKey;
        const touchArrangeSelection = event.pointerType === 'touch' && props.arrangeMode && !props.selected && !modified;
        if (!props.selected && !modified && !touchArrangeSelection) {
          props.onSelect(props.item, { additive: touchArrangeSelection });
        }
        if (touchArrangeSelection) suppressTouchSelectionClickRef.current = true;
        if (!modified && (event.pointerType !== 'touch' || props.arrangeMode)) {
          props.beginDrag(props.item.id, event, { additive: touchArrangeSelection });
        }
      }}
      onPointerMove={props.moveDrag}
      onPointerUp={props.endDrag}
      onPointerCancel={props.endDrag}
      onClick={(event) => {
        if (props.shouldSuppressActivation(props.item.id)) return;
        if (suppressTouchSelectionClickRef.current) {
          suppressTouchSelectionClickRef.current = false;
          return;
        }
        props.onSelect(props.item, {
          additive: event.metaKey || event.ctrlKey || (props.arrangeMode && lastPointerTypeRef.current === 'touch'),
          range: event.shiftKey,
        });
      }}
      onDoubleClick={openWithMotion}
      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
        const intent = getDeskWorkKeyboardIntent(event.key, event.shiftKey || event.metaKey || event.ctrlKey);
        if (intent === 'open') {
          event.preventDefault();
          openWithMotion();
        } else if (intent === 'select' || intent === 'select-additive') {
          event.preventDefault();
          props.onSelect(props.item, { additive: intent === 'select-additive' });
        }
      }}
      aria-label={`${props.selected ? 'Selected' : 'Select'} ${props.item.name}. Press Enter to open.`}
    >
      <div className={styles.workVisual} data-desk-set-stack data-card-face={face}>{props.preview(face)}</div>
      <span className={styles.workMeta}><strong>{props.item.name}</strong><span>{props.item.details.join(' · ') || workSourceLabel(props.item)}</span><span>{workSourceLabel(props.item)}</span></span>
    </button>
    {props.focused ? props.focusedSurface : <>
      {props.canFlip ? <button type="button" className={styles.deskTileFlip} onClick={() => setFace((current) => current === 'front' ? 'back' : 'front')} aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${props.item.name}`} title={`Show ${face === 'front' ? 'back' : 'front'}`}><RefreshCcw size={15} aria-hidden="true" /></button> : null}
      <div className={styles.tileActions}>
      <button type="button" className={styles.iconButton} data-active={props.pinned} onClick={() => props.onTogglePin(props.item.id)} aria-label={`${props.pinned ? 'Unpin' : 'Pin'} ${props.item.name}`} title={props.pinned ? 'Unpin from desk' : 'Pin to desk'}><Pin size={15} aria-hidden="true" /></button>
      <DropdownMenu><DropdownMenuTrigger asChild><button id={`set-info-${props.item.id}`} type="button" className={styles.iconButton} aria-label={`Actions for ${props.item.name}`} title="Actions"><MoreHorizontal size={15} aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent align="end">
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={openWithMotion}><Pencil aria-hidden="true" />Open Set</DropdownMenuItem> : <DropdownMenuItem onSelect={() => props.onOpenLane(props.item, 'open')}><Pencil aria-hidden="true" />Open in Studio</DropdownMenuItem>}
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onOpenLane(props.item, 'generate')}><WandSparkles aria-hidden="true" />Generate cards</DropdownMenuItem> : null}
        <DropdownMenuItem disabled={!props.canUseProjectFiles} onSelect={() => props.onOpenLocation(props.item)}><Save aria-hidden="true" />Save / move{props.canUseProjectFiles ? '' : ' · Creator Pass'}</DropdownMenuItem>
        {props.canSubmit && props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onOpenPipeline(props.item.references.localSetId!)}><UploadCloud aria-hidden="true" />Send to Pipeline</DropdownMenuItem> : null}
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onDuplicate(props.item)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
        {props.item.references.localSetId ? <DropdownMenuItem onSelect={() => props.onOpenLane(props.item, 'export')}><Printer aria-hidden="true" />Export / print</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={() => props.onInspect(props.item)}><Info aria-hidden="true" />Details</DropdownMenuItem>
        {props.item.references.localSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => props.onDelete(props.item)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
      </DropdownMenuContent></DropdownMenu>
      </div>
    </>}
  </article>;
}
