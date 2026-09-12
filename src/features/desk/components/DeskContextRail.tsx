"use client";

import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  Copy,
  Home,
  Info,
  MoreHorizontal,
  Move,
  Pencil,
  Pin,
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
  /** Kept for compatibility with older callers; open-project count now lives in the bottom status rail. */
  openWorkCount: number;
  /** Desk camera controls live in the overview action rail, not the contextual header. */
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
  const selectMenuAction = (action: () => void) => () => {
    // Let Radix complete menu dismissal first. Preventing onSelect is Radix's
    // documented way to keep a menu open, which is the opposite of a surface
    // handoff such as Rename, Details, Delete, or opening another tool.
    window.setTimeout(action, 0);
  };
  const driveState = driveWorkingSession.state;
  const showDriveState = props.localSet && driveState.phase !== 'unlinked';

  // The overview header is owned by search/account/primary action. Selection
  // context appears here only when there is actual selected work to act on.
  // Camera controls belong to the Desk action rail across every viewport size.
  if (props.depth === 'desk' && props.selectedDeskCount === 0) return null;

  return (
    <div className={styles.contextRail} data-depth={props.depth} data-desk-context-rail>
      <nav className={styles.contextPath} aria-label="Creative context">
        {focused && !toolFocused ? <Button type="button" size="sm" variant="outline" className={styles.contextReturn} title={backLabel} onClick={artifactFocused ? props.onBack : props.onReturnToDesk}>
          <ArrowLeft aria-hidden="true" /><span>{backLabel}</span>
        </Button> : null}
        {artifactFocused || toolFocused ? <Button type="button" size="sm" variant="ghost" className={styles.contextReturn} onClick={props.onReturnToDesk} aria-label="Return to Desk" title="Return to Desk">
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
          <span className={styles.contextStatus}>{`${props.selectedDeskCount} Set${props.selectedDeskCount === 1 ? '' : 's'} selected`}</span>
          <Button type="button" size="sm" title="Open selected Set" onClick={props.onOpenSelectedSet}><Pencil className="h-4 w-4" aria-hidden="true" /><span>Open</span></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="ghost" title="Position selected Sets"><Move className="h-4 w-4" aria-hidden="true" /><span>Position</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: -24, y: 0 })}>Move selected Sets left</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: 0, y: -24 })}>Move selected Sets up</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: 0, y: 24 })}>Move selected Sets down</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={() => props.onNudgeDeskSelection({ x: 24, y: 0 })}>Move selected Sets right</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
          <Button type="button" size="icon" variant="ghost" onClick={props.onClearDeskSelection} aria-label="Clear Desk selection" title="Clear Desk selection"><X aria-hidden="true" /></Button>
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
          {!props.localSet ? <Button type="button" size="sm" title="Open work" onClick={props.onOpenWork}><Pencil className="h-4 w-4" aria-hidden="true" /><span>Open work</span></Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" title="Design" onClick={() => props.onOpenDesign()}><Pencil className="h-4 w-4" aria-hidden="true" /><span>Design</span></Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" className="max-[390px]:hidden" title="Generate" onClick={props.onOpenGenerate}><WandSparkles className="h-4 w-4" aria-hidden="true" /><span>Generate</span></Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" className="max-[390px]:hidden" title="Output" onClick={props.onOpenOutput}><Printer className="h-4 w-4" aria-hidden="true" /><span>Output</span></Button> : null}
          <Button type="button" size="sm" variant="ghost" className={styles.desktopSaveAction} title="Save & move" onClick={props.onOpenLocation}><Save className="h-4 w-4" aria-hidden="true" /><span>Save &amp; move</span></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button ref={setActionsRef} type="button" size="icon" variant="ghost" aria-label="More Set actions" title="More Set actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            {props.localSet ? <DropdownMenuItem className={`${compactMenuItemClassName} min-[391px]:hidden`} onSelect={selectMenuAction(props.onOpenGenerate)}><WandSparkles aria-hidden="true" />Generate</DropdownMenuItem> : null}
            {props.localSet ? <DropdownMenuItem className={`${compactMenuItemClassName} min-[391px]:hidden`} onSelect={selectMenuAction(props.onOpenOutput)}><Printer aria-hidden="true" />Output</DropdownMenuItem> : null}
            <DropdownMenuItem className={`${compactMenuItemClassName} md:hidden`} onSelect={selectMenuAction(props.onOpenLocation)}><Save aria-hidden="true" />Save &amp; move</DropdownMenuItem>
            {props.localSet ? <DropdownMenuItem className={compactMenuItemClassName} onSelect={selectMenuAction(props.onToggleRenaming)}><Pencil aria-hidden="true" />Rename</DropdownMenuItem> : null}
            {props.localSet ? <DropdownMenuItem className={compactMenuItemClassName} onSelect={selectMenuAction(props.onDuplicateWork)}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onTogglePin}><Pin aria-hidden="true" />{props.pinned ? 'Unpin from Desk' : 'Pin to Desk'}</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={selectMenuAction(props.onInspect)}><Info aria-hidden="true" />Details</DropdownMenuItem>
            {props.localSet ? <><DropdownMenuSeparator /><DropdownMenuItem className={`${compactMenuItemClassName} text-destructive focus:text-destructive`} onSelect={selectMenuAction(props.onDeleteWork)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
          </DropdownMenuContent></DropdownMenu>
          </>}
        </> : null}

        {props.depth === 'artifact' ? <>
          {props.selectedArtifactCount > 1 ? <span className={styles.contextStatus}>{props.selectedArtifactCount} selected</span> : null}
          <Button type="button" size="sm" title="Edit card content" onClick={props.onEditArtifact}><Pencil className="h-4 w-4" aria-hidden="true" /><span>Edit</span></Button>
          <Button type="button" size="sm" variant="outline" title="Design Template" onClick={() => props.onOpenDesign(artifactFace)}><Pencil className="h-4 w-4" aria-hidden="true" /><span>Design</span></Button>
          <Button type="button" size="sm" variant="outline" title="Revise selected Artifacts" onClick={props.onReviseSelected}><WandSparkles className="h-4 w-4" aria-hidden="true" /><span>Revise</span></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label="More Artifact actions" title="More Artifact actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={selectMenuAction(() => props.onDesignArtifactCopy(artifactFace))}><Pencil aria-hidden="true" />Design a copy for this card</DropdownMenuItem>
            <DropdownMenuItem className={compactMenuItemClassName} onSelect={props.onDuplicateSelected}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={`${compactMenuItemClassName} text-destructive focus:text-destructive`} onSelect={selectMenuAction(props.onDeleteSelected)}><Trash2 aria-hidden="true" />Remove from Set</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
        </> : null}

        {props.depth === 'tool' ? <Button type="button" size="sm" variant="outline" title={props.toolDirty ? 'Review & close' : 'Done'} onClick={props.onCloseTool}><X className="h-4 w-4" aria-hidden="true" /><span>{props.toolDirty ? 'Review & close' : 'Done'}</span></Button> : null}
      </div>
    </div>
  );
}