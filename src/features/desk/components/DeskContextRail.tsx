"use client";

import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  Copy,
  Home,
  Info,
  Maximize2,
  Minus,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Printer,
  Save,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';

import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { CardFace } from '@/domain/cards';
import { useArtifactFace } from '@/features/card-rendering/client';
import { useGoogleDriveWorkingSession } from '@/features/project/client/provider-google-drive';
import { useProjectStore } from '@/features/project/client/workspace';

import type { DeskCamera } from '../hooks/useDeskCamera';
import styles from './Desk.module.css';

interface DeskContextRailProps {
  depth: 'desk' | 'set' | 'artifact' | 'tool';
  setName?: string;
  artifactName?: string;
  artifactId?: string;
  toolName?: string;
  toolDirty?: boolean;
  localSet: boolean;
  pinned: boolean;
  renaming: boolean;
  renameDraft: string;
  selectedDeskCount: number;
  selectedArtifactCount: number;
  openWorkCount: number;
  camera: DeskCamera;
  onBack: () => void;
  onReturnToDesk: () => void;
  onCloseTool: () => void;
  onOpenSelectedSet: () => void;
  onClearDeskSelection: () => void;
  onNudgeDeskSelection: (delta: { x: number; y: number }) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onToggleRenaming: () => void;
  onOpenWork: () => void;
  onOpenDesign: (face?: CardFace) => void;
  onOpenGenerate: () => void;
  onOpenLocation: () => void;
  onDuplicateWork: () => void;
  onOpenOutput: () => void;
  onTogglePin: () => void;
  onInspect: () => void;
  onDeleteWork: () => void;
  onEditArtifact: () => void;
  onDesignArtifactCopy: (face: CardFace) => void;
  onReviseSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}

const driveNeedsAttention = (phase: string) => (
  phase === 'offline'
  || phase === 'read-only'
  || phase === 'remote-changed'
  || phase === 'recovery-required'
  || phase === 'error'
);

const compactMenuItemClassName = 'min-h-12';

export function DeskContextRail(props: DeskContextRailProps) {
  const [artifactFace] = useArtifactFace(props.artifactId ?? '');
  const activeSetId = useProjectStore((state) => state.activeCardSet?.id ?? null);
  const driveWorkingSession = useGoogleDriveWorkingSession({
    setId: props.localSet ? activeSetId : null,
    name: props.setName ?? 'CardForge Set',
    enabled: props.localSet && Boolean(activeSetId),
  });
  const focused = props.depth !== 'desk';
  const artifactFocused = props.depth === 'artifact';
  const toolFocused = props.depth === 'tool';
  const backLabel = artifactFocused ? 'Back to Set' : 'Back to Desk';
  const renameInputRef = useRef<HTMLInputElement>(null);
  const setActionsRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!props.renaming || !props.localSet || props.depth !== 'set') return;
    const frame = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [props.depth, props.localSet, props.renaming]);
  const cancelRename = () => {
    props.onRenameDraftChange(props.setName ?? '');
    props.onToggleRenaming();
    requestAnimationFrame(() => setActionsRef.current?.focus());
  };
  const driveState = driveWorkingSession.state;
  const showDriveState = props.localSet && driveState.phase !== 'unlinked';

  return (
    <div className={styles.contextRail} data-depth={props.depth} data-desk-context-rail>
      <nav className={styles.contextPath} aria-label="Creative context">
        {focused && !toolFocused ? <Button type="button" size="sm" variant="outline" className={styles.contextReturn} onClick={artifactFocused ? props.onBack : props.onReturnToDesk}>
          <ArrowLeft aria-hidden="true" /><span>{backLabel}</span>
        </Button> : null}
        {artifactFocused || toolFocused ? <Button type="button" size="sm" variant="ghost" className={styles.contextReturn} onClick={props.onReturnToDesk} aria-label="Return to Desk">
          <Home aria-hidden="true" /><span>Desk</span>
        </Button> : null}
        <div className={styles.contextIdentity}>
          <div className={styles.contextBreadcrumbs}>
            {!focused ? <span className={styles.contextCrumb}>Desk</span> : null}
            {props.setName ? <><ChevronRight aria-hidden="true" /><strong title={props.setName}>{props.setName}</strong></> : null}
            {props.artifactName ? <><ChevronRight aria-hidden="true" /><strong title={props.artifactName}>{props.artifactName}</strong></> : null}
            {props.toolName ? <><ChevronRight aria-hidden="true" /><strong title={props.toolName}>{props.toolName}</strong></> : null}
          </div>
          {props.toolDirty ? <span className={styles.contextDirty}>Unsaved changes</span> : null}
          {showDriveState ? <span
            data-drive-working-state={driveState.phase}
            role={driveNeedsAttention(driveState.phase) ? 'status' : undefined}
            aria-live={driveNeedsAttention(driveState.phase) ? 'polite' : undefined}
            className={`flex min-w-0 items-center gap-1 text-[0.66rem] ${driveNeedsAttention(driveState.phase) ? 'text-[var(--cf-warning)]' : 'text-[var(--cf-text-muted)]'}`}
          >
            <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-[22rem] truncate" title={driveState.message}>{driveState.message}</span>
            {driveState.phase === 'recovery-required' ? <Button type="button" size="sm" variant="ghost" className="h-7 min-h-7 px-2 text-[0.66rem]" onClick={() => void driveWorkingSession.repairLink()}>Repair link</Button> : null}
            {driveState.phase === 'remote-changed' ? <Button type="button" size="sm" variant="ghost" className="h-7 min-h-7 px-2 text-[0.66rem]" onClick={() => void driveWorkingSession.reconcile()}>Check Drive</Button> : null}
          </span> : null}
        </div>
      </nav>

      <div className={styles.contextActions}>
        {props.depth === 'desk' ? <>
          <span className={styles.contextStatus}>{props.selectedDeskCount ? `${props.selectedDeskCount} Set${props.selectedDeskCount === 1 ? '' : 's'} selected` : `${props.openWorkCount} open Set${props.openWorkCount === 1 ? '' : 's'}`}</span>
          {props.selectedDeskCount ? <Button type="button" size="sm" onClick={props.onOpenSelectedSet}>Open</Button> : null}
          {props.selectedDeskCount ? <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="ghost">Position</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: -24, y: 0 })}>Move selected Sets left</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: 0, y: -24 })}>Move selected Sets up</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: 0, y: 24 })}>Move selected Sets down</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: 24, y: 0 })}>Move selected Sets right</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu> : null}
          <Button type="button" size="icon" variant="ghost" onClick={() => props.camera.changeZoom(props.camera.zoom - 0.1)} aria-label="Zoom Desk out"><Minus aria-hidden="true" /></Button>
          <span className={styles.contextZoom} aria-live="polite">{Math.round(props.camera.zoom * 100)}%</span>
          <Button type="button" size="icon" variant="ghost" onClick={() => props.camera.changeZoom(props.camera.zoom + 0.1)} aria-label="Zoom Desk in"><Plus aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" aria-label="Fit the whole Desk in view" onClick={props.camera.fit}><Maximize2 className="mr-1 h-4 w-4" aria-hidden="true" />Fit</Button>
          {props.selectedDeskCount ? <Button type="button" size="icon" variant="ghost" onClick={props.onClearDeskSelection} aria-label="Clear Desk selection"><X aria-hidden="true" /></Button> : null}
        </> : null}

        {props.depth === 'set' ? <>
          {props.renaming && props.localSet ? <form className={styles.contextRename}
            onSubmit={(event) => { event.preventDefault(); props.onCommitRename(); requestAnimationFrame(() => setActionsRef.current?.focus()); }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              cancelRename();
            }}
          >
            <Input id="set-name" ref={renameInputRef} value={props.renameDraft} onChange={(event) => props.onRenameDraftChange(event.target.value)} aria-label="Set name" />
            <Button type="submit" size="sm">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelRename} aria-label="Cancel rename">Cancel</Button>
          </form> : <>
          {!props.localSet ? <Button type="button" size="sm" onClick={props.onOpenWork}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Open work</Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" onClick={() => props.onOpenDesign()}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Design</Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" className="max-[390px]:hidden" onClick={props.onOpenGenerate}><WandSparkles className="mr-1 h-4 w-4" aria-hidden="true" />Generate</Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" className="max-[390px]:hidden" onClick={props.onOpenOutput}><Printer className="mr-1 h-4 w-4" aria-hidden="true" />Output</Button> : null}
          <Button type="button" size="sm" variant="ghost" className={styles.desktopSaveAction} onClick={props.onOpenLocation}><Save className="mr-1 h-4 w-4" aria-hidden="true" />Save &amp; move</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button ref={setActionsRef} type="button" size="icon" variant="ghost" aria-label="More Set actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            {props.localSet ? <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onOpenGenerate}><WandSparkles aria-hidden="true" />Generate</DropdownMenuItem> : null}
            {props.localSet ? <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onOpenOutput}><Printer aria-hidden="true" />Output</DropdownMenuItem> : null}
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onOpenLocation}><Save aria-hidden="true" />Save &amp; move</DropdownMenuItem>
            {props.localSet ? <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onToggleRenaming}><Pencil aria-hidden="true" />Rename</DropdownMenuItem> : null}
            {props.localSet ? <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onDuplicateWork}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onTogglePin}><Pin aria-hidden="true" />{props.pinned ? 'Unpin from Desk' : 'Pin to Desk'}</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onInspect}><Info aria-hidden="true" />Details</DropdownMenuItem>
            {props.localSet ? <><DropdownMenuSeparator /><DropdownMenuItem className={`${compactMenuItemClassName} text-destructive focus:text-destructive`} onSelect={props.onDeleteWork}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
          </DropdownMenuContent></DropdownMenu>
          </>}
        </> : null}

        {props.depth === 'artifact' ? <>
          {props.selectedArtifactCount > 1 ? <span className={styles.contextStatus}>{props.selectedArtifactCount} selected</span> : null}
          <Button type="button" size="sm" onClick={props.onEditArtifact}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Edit</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => props.onOpenDesign(artifactFace)}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Design</Button>
          <Button type="button" size="sm" variant="outline" onClick={props.onReviseSelected}><WandSparkles className="mr-1 h-4 w-4" aria-hidden="true" />Revise</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label="More Artifact actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onDesignArtifactCopy(artifactFace)}><Pencil aria-hidden="true" />Design a copy for this card</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onDuplicateSelected}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={`${compactMenuItemClassName} text-destructive focus:text-destructive`} onSelect={props.onDeleteSelected}><Trash2 aria-hidden="true" />Remove from Set</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
        </> : null}

        {props.depth === 'tool' ? <Button type="button" size="sm" variant="outline" onClick={props.onCloseTool}>{props.toolDirty ? 'Review & close' : 'Done'}</Button> : null}
      </div>
    </div>
  );
}
