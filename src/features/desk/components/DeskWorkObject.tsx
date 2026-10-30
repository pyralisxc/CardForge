"use client";

import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Copy, Info, MoreHorizontal, Pencil, Printer, RefreshCcw, Save, Trash2, UploadCloud, WandSparkles } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useArtifactFaces, useCaptureArtifactStackOrigins } from '@/features/card-rendering/client';
import type { ActionDescriptor } from '@/features/app-shell/client/environment';
import type { CardFace } from '@/domain/cards';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import { DESK_METADATA_SEPARATOR, getDeskWorkKeyboardIntent, getDeskWorkPresentationMeta, getWorkActions } from '../model/desk';
import styles from './Desk.module.css';

interface DeskWorkObjectProps {
  item: AccountLibraryItem;
  active: boolean;
  featured: boolean;
  focused: boolean;
  selected: boolean;
  arrangeMode: boolean;
  obscured: boolean;
  position?: DeskPosition;
  presentationSize?: { width: number; height: number; visualHeight: number; physical: boolean };
  canUseProjectFiles: boolean;
  canSubmit: boolean;
  isOwner?: boolean;
  onRunWorkAction?: (item: AccountLibraryItem, action: ActionDescriptor) => void;
  preview: (face: CardFace) => ReactNode;
  canFlip: boolean;
  artifactIds: string[];
  focusedSurface: ReactNode;
  beginDrag: (itemId: string, event: ReactPointerEvent<HTMLButtonElement>, options?: { additive?: boolean }) => void;
  moveDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  endDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  shouldSuppressActivation: (itemId: string) => boolean;
  onSelect: (item: AccountLibraryItem, options?: { additive?: boolean; range?: boolean }) => void;
  onFocus: (item: AccountLibraryItem) => void;
  onOpenLane: (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => void;
  onOpenLocation: (item: AccountLibraryItem) => void;
  onOpenPipeline: (setId: string) => void;
  onDuplicate: (item: AccountLibraryItem) => void;
  onInspect: (item: AccountLibraryItem) => void;
  onDelete: (item: AccountLibraryItem) => void;
}

const menuItemClassName = 'min-h-11 md:min-h-9';
const tileActionClassName = 'min-h-11 min-w-11 md:min-h-9 md:min-w-9';

export function DeskWorkObject(props: DeskWorkObjectProps) {
  const [faces, setFace] = useArtifactFaces();
  const captureStackOrigins = useCaptureArtifactStackOrigins();
  const face = faces[props.artifactIds[0]] ?? 'front';
  const lastPointerTypeRef = useRef('mouse');
  const suppressTouchSelectionClickRef = useRef(false);
  const openSet = () => {
    const setId = props.item.references.localSetId;
    if (setId && captureStackOrigins) captureStackOrigins(setId, () => props.onFocus(props.item));
    else props.onFocus(props.item);
  };
  const presentationMeta = getDeskWorkPresentationMeta(props.item);
  const positionStyle = props.position
    ? ({
        '--desk-x': `${props.position.x}px`,
        '--desk-y': `${props.position.y}px`,
        '--desk-z': props.position.z,
        '--desk-width': `${props.presentationSize?.width ?? 82}px`,
        '--desk-height': `${props.presentationSize?.height ?? 126}px`,
        '--desk-visual-height': `${props.presentationSize?.visualHeight ?? 90}px`,
      } as CSSProperties)
    : undefined;

  const selectMenuAction = (action: () => void) => () => {
    // Radix owns selection dismissal and focus restoration. Deferring the next
    // surface by one task lets that lifecycle finish before a dialog, inspector,
    // or focused workspace takes ownership. Do not prevent onSelect: Radix uses
    // preventDefault specifically to mean "keep this menu open".
    window.setTimeout(action, 0);
  };

  return <article
    className={styles.workTile}
    style={positionStyle}
    data-positioned={Boolean(props.position) && !props.focused}
    data-set-object
    data-desk-set-object-id={props.item.id}
    data-presentation={props.focused ? 'focused' : 'overview'}
    data-featured={props.featured && !props.focused}
    data-physical-footprint={props.presentationSize?.physical || undefined}
    data-active={props.active}
    data-selected={props.selected}
    aria-hidden={props.obscured || undefined}
  >
    <button
      id={`set-${props.item.id}`}
      type="button"
      className={styles.workTileMain}
      style={{ cursor: 'grab' }}
      disabled={props.focused}
      tabIndex={props.focused ? -1 : undefined}
      aria-hidden={props.focused || undefined}
      aria-pressed={props.selected}
      title="Drag to move · Double-click to open"
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        lastPointerTypeRef.current = event.pointerType;
        event.currentTarget.style.cursor = 'grabbing';
        const modified = event.metaKey || event.ctrlKey || event.shiftKey;
        const additiveModeSelection = props.arrangeMode && !props.selected && !modified;
        if (!props.selected && !modified && !additiveModeSelection) props.onSelect(props.item);
        if (additiveModeSelection) suppressTouchSelectionClickRef.current = true;
        if (!modified) props.beginDrag(props.item.id, event, { additive: additiveModeSelection });
      }}
      onPointerMove={props.moveDrag}
      onPointerUp={(event) => { event.currentTarget.style.cursor = 'grab'; props.endDrag(event); }}
      onPointerCancel={(event) => { event.currentTarget.style.cursor = 'grab'; props.endDrag(event); }}
      onClick={(event) => {
        if (props.shouldSuppressActivation(props.item.id)) return;
        if (suppressTouchSelectionClickRef.current) { suppressTouchSelectionClickRef.current = false; return; }
        props.onSelect(props.item, {
          additive: event.metaKey || event.ctrlKey || props.arrangeMode,
          range: event.shiftKey,
        });
      }}
      onDoubleClick={props.arrangeMode ? undefined : openSet}
      onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
        const intent = getDeskWorkKeyboardIntent(event.key, event.shiftKey || event.metaKey || event.ctrlKey);
        if (intent === 'open') { event.preventDefault(); openSet(); }
        else if (intent === 'select' || intent === 'select-additive') { event.preventDefault(); props.onSelect(props.item, { additive: props.arrangeMode || intent === 'select-additive' }); }
      }}
      aria-label={`${props.selected ? 'Selected' : 'Select'} ${props.item.name}. Drag to move; press Enter to open.`}
    >
      <div className={styles.workVisual} data-desk-set-stack data-card-face={face}>{props.preview(face)}</div>
      <span className={styles.workMeta}>
        <strong className={styles.workMetaTitle} title={props.item.name}>{props.item.name}</strong>
        <span className={styles.workMetaSummary} title={presentationMeta.summary}>{presentationMeta.summary}</span>
        {presentationMeta.organization ? <span className={styles.workOrganization} title={presentationMeta.organization}>{presentationMeta.organization}</span> : null}
      </span>
    </button>
    {props.focused ? props.focusedSurface : <>
      {props.canFlip ? <button type="button" className={styles.deskTileFlip} onClick={() => props.artifactIds.forEach((id) => setFace(id, face === 'front' ? 'back' : 'front'))} aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${props.item.name}`} title={`Show ${face === 'front' ? 'back' : 'front'}`}><RefreshCcw size={15} aria-hidden="true" /></button> : null}
      <div className={styles.tileActions}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button id={`set-info-${props.item.id}`} type="button" className={`${styles.iconButton} ${tileActionClassName}`} aria-label={`Actions for ${props.item.name}`} title="Actions"><MoreHorizontal size={15} aria-hidden="true" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {props.item.references.localSetId
              ? <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(openSet)}><Pencil aria-hidden="true" />Open Set</DropdownMenuItem>
              : <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(() => props.onOpenLane(props.item, 'open'))}><Pencil aria-hidden="true" />Open in Studio</DropdownMenuItem>}
            {props.item.references.localSetId ? <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(() => props.onOpenLane(props.item, 'generate'))}><WandSparkles aria-hidden="true" />Generate cards</DropdownMenuItem> : null}
            <DropdownMenuItem className={menuItemClassName} disabled={!props.canUseProjectFiles} onSelect={selectMenuAction(() => props.onOpenLocation(props.item))}><Save aria-hidden="true" />Save & move{props.canUseProjectFiles ? '' : `${DESK_METADATA_SEPARATOR}Creator Pass`}</DropdownMenuItem>
            {props.canSubmit && props.item.references.localSetId ? <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(() => props.onOpenPipeline(props.item.references.localSetId!))}><UploadCloud aria-hidden="true" />Send to Pipeline</DropdownMenuItem> : null}
            {props.item.references.localSetId ? <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(() => props.onDuplicate(props.item))}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
            {props.item.references.localSetId ? <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(() => props.onOpenLane(props.item, 'export'))}><Printer aria-hidden="true" />Output</DropdownMenuItem> : null}
            <DropdownMenuItem className={menuItemClassName} onSelect={selectMenuAction(() => props.onInspect(props.item))}><Info aria-hidden="true" />Details</DropdownMenuItem>
            {props.onRunWorkAction ? getWorkActions(props.item, true, props.canSubmit, props.canUseProjectFiles, props.isOwner).filter(action=>['library.view-source','library.manage-location','library.delete-copy','desk.review-manage'].includes(action.id)).map(action=><DropdownMenuItem key={action.id} className={menuItemClassName} disabled={action.availability.kind !== 'available'} title={action.availability.kind === 'disabled' ? action.availability.reason : undefined} onSelect={selectMenuAction(()=>{ document.getElementById(`set-info-${props.item.id}`)?.focus({preventScroll:true}); props.onRunWorkAction?.(props.item,action); })}>{action.label}</DropdownMenuItem>) : null}
            {props.item.references.localSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className={`${menuItemClassName} text-destructive focus:text-destructive`} onSelect={selectMenuAction(() => props.onDelete(props.item))}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>}
  </article>;
}
