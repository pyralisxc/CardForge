"use client";

import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Copy,
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

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

import type { DeskCamera } from '../hooks/useDeskCamera';
import styles from './Desk.module.css';

interface DeskContextRailProps {
  depth: 'desk' | 'set' | 'artifact' | 'tool';
  setName?: string;
  artifactName?: string;
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
  onCloseTool: () => void;
  onOpenSelectedSet: () => void;
  onClearDeskSelection: () => void;
  onNudgeDeskSelection: (delta: { x: number; y: number }) => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onToggleRenaming: () => void;
  onOpenWork: () => void;
  onOpenDesign: () => void;
  onOpenGenerate: () => void;
  onOpenLocation: () => void;
  onDuplicateWork: () => void;
  onOpenOutput: () => void;
  onTogglePin: () => void;
  onInspect: () => void;
  onDeleteWork: () => void;
  onEditArtifact: () => void;
  onReviseSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}

export function DeskContextRail(props: DeskContextRailProps) {
  const focused = props.depth !== 'desk';
  const artifactFocused = props.depth === 'artifact';
  const toolFocused = props.depth === 'tool';
  const backLabel = artifactFocused ? 'Back to Set' : 'Back to Desk';

  return (
    <div className={styles.contextRail} data-depth={props.depth} data-desk-context-rail>
      <div className={styles.contextPath} aria-label="Creative context">
        {focused && !toolFocused ? <Button type="button" size="icon" variant="ghost" onClick={props.onBack} aria-label={backLabel}><ArrowLeft aria-hidden="true" /></Button> : null}
        <span className={styles.contextCrumb}>Desk</span>
        {props.setName ? <><ChevronRight aria-hidden="true" /><strong title={props.setName}>{props.setName}</strong></> : null}
        {props.artifactName ? <><ChevronRight aria-hidden="true" /><strong title={props.artifactName}>{props.artifactName}</strong></> : null}
        {props.toolName ? <><ChevronRight aria-hidden="true" /><strong title={props.toolName}>{props.toolName}</strong></> : null}
        {props.toolDirty ? <span className={styles.contextDirty}>Unsaved changes</span> : null}
      </div>

      <div className={styles.contextActions}>
        {props.depth === 'desk' ? <>
          <span className={styles.contextStatus}>{props.selectedDeskCount ? `${props.selectedDeskCount} Set${props.selectedDeskCount === 1 ? '' : 's'} selected` : `${props.openWorkCount} open Set${props.openWorkCount === 1 ? '' : 's'}`}</span>
          {props.selectedDeskCount ? <Button type="button" size="sm" onClick={props.onOpenSelectedSet}>Open</Button> : null}
          {props.selectedDeskCount ? <span className={styles.contextNudge} role="group" aria-label="Move selected Sets">
            <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets left" onClick={() => props.onNudgeDeskSelection({ x: -24, y: 0 })}><ArrowLeft aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets up" onClick={() => props.onNudgeDeskSelection({ x: 0, y: -24 })}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets down" onClick={() => props.onNudgeDeskSelection({ x: 0, y: 24 })}><ArrowDown aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets right" onClick={() => props.onNudgeDeskSelection({ x: 24, y: 0 })}><ArrowRight aria-hidden="true" /></Button>
          </span> : null}
          <Button type="button" size="icon" variant="ghost" onClick={() => props.camera.changeZoom(props.camera.zoom - 0.1)} aria-label="Zoom Desk out"><Minus aria-hidden="true" /></Button>
          <span className={styles.contextZoom} aria-live="polite">{Math.round(props.camera.zoom * 100)}%</span>
          <Button type="button" size="icon" variant="ghost" onClick={() => props.camera.changeZoom(props.camera.zoom + 0.1)} aria-label="Zoom Desk in"><Plus aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" aria-label="Fit the whole Desk in view" onClick={props.camera.fit}><Maximize2 className="mr-1 h-4 w-4" aria-hidden="true" />Fit</Button>
          {props.selectedDeskCount ? <Button type="button" size="icon" variant="ghost" onClick={props.onClearDeskSelection} aria-label="Clear Desk selection"><X aria-hidden="true" /></Button> : null}
        </> : null}

        {props.depth === 'set' ? <>
          {props.renaming && props.localSet ? <form className={styles.contextRename} onSubmit={(event) => { event.preventDefault(); props.onCommitRename(); }}><Input value={props.renameDraft} onChange={(event) => props.onRenameDraftChange(event.target.value)} aria-label="Set name" /><Button type="submit" size="sm">Save</Button></form> : null}
          {!props.localSet ? <Button type="button" size="sm" onClick={props.onOpenWork}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Open work</Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" onClick={props.onOpenDesign}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Design</Button> : null}
          {props.localSet ? <Button type="button" size="sm" variant="outline" onClick={props.onOpenGenerate}><WandSparkles className="mr-1 h-4 w-4" aria-hidden="true" />Generate</Button> : null}
          <Button type="button" size="sm" variant="ghost" className={styles.desktopSaveAction} onClick={props.onOpenLocation}><Save className="mr-1 h-4 w-4" aria-hidden="true" />Save &amp; move</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label="More Set actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={props.onOpenLocation}><Save aria-hidden="true" />Save &amp; move</DropdownMenuItem>
            {props.localSet ? <DropdownMenuItem onSelect={props.onToggleRenaming}><Pencil aria-hidden="true" />Rename</DropdownMenuItem> : null}
            {props.localSet ? <DropdownMenuItem onSelect={props.onDuplicateWork}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
            {props.localSet ? <DropdownMenuItem onSelect={props.onOpenOutput}><Printer aria-hidden="true" />Output</DropdownMenuItem> : null}
            <DropdownMenuItem onSelect={props.onTogglePin}><Pin aria-hidden="true" />{props.pinned ? 'Unpin from Desk' : 'Pin to Desk'}</DropdownMenuItem>
            <DropdownMenuItem onSelect={props.onInspect}><Info aria-hidden="true" />Details</DropdownMenuItem>
            {props.localSet ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={props.onDeleteWork}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
          </DropdownMenuContent></DropdownMenu>
        </> : null}

        {props.depth === 'artifact' ? <>
          <span className={styles.contextStatus}>{props.selectedArtifactCount > 1 ? `${props.selectedArtifactCount} selected` : 'Artifact focus'}</span>
          <Button type="button" size="sm" onClick={props.onEditArtifact}><Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Edit</Button>
          <Button type="button" size="sm" variant="outline" onClick={props.onReviseSelected}><WandSparkles className="mr-1 h-4 w-4" aria-hidden="true" />Revise</Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label="More Artifact actions"><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={props.onDuplicateSelected}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={props.onDeleteSelected}><Trash2 aria-hidden="true" />Remove from Set</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
        </> : null}

        {props.depth === 'tool' ? <Button type="button" size="sm" variant="outline" onClick={props.onCloseTool}>{props.toolDirty ? 'Review & close' : 'Done'}</Button> : null}
      </div>
    </div>
  );
}
