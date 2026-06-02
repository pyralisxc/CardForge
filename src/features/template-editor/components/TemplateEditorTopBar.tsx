"use client";

import { BoxSelect, Eye, EyeOff, Grid3X3, Maximize2, PenTool, Redo2, Save, Search, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TemplateEditorTopBarProps {
  activeFace: 'front' | 'back';
  hasBackFace: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  previewMode: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitToScreen: () => void;
  onCreateBackFace: () => void;
  onSetActiveFace: (face: 'front' | 'back') => void;
  onToggleGrid: () => void;
  onToggleSnapToGrid: () => void;
  onTogglePreviewMode: () => void;
  onOpenCommandPalette: () => void;
  onSave: () => void;
  toolButtonClassName: string;
  activeButtonClassName: string;
}

export function TemplateEditorTopBar({
  activeFace,
  hasBackFace,
  canUndo,
  canRedo,
  showGrid,
  snapToGrid,
  previewMode,
  onUndo,
  onRedo,
  onZoomOut,
  onZoomIn,
  onFitToScreen,
  onCreateBackFace,
  onSetActiveFace,
  onToggleGrid,
  onToggleSnapToGrid,
  onTogglePreviewMode,
  onOpenCommandPalette,
  onSave,
  toolButtonClassName,
  activeButtonClassName,
}: TemplateEditorTopBarProps) {
  const iconActions = [
    { label: 'Undo (Ctrl+Z)', icon: Undo2, action: onUndo, disabled: !canUndo },
    { label: 'Redo (Ctrl+Y)', icon: Redo2, action: onRedo, disabled: !canRedo },
    { label: 'Zoom out (-)', icon: ZoomOut, action: onZoomOut, disabled: false },
    { label: 'Zoom in (+)', icon: ZoomIn, action: onZoomIn, disabled: false },
    { label: 'Fit to screen', icon: Maximize2, action: onFitToScreen, disabled: false },
  ] as const;

  return (
    <div className="flex flex-col border-b border-[#2b2415] bg-[#0b0d11] px-2 py-1.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#6d5323] bg-[#171207] shadow-[inset_0_0_18px_rgba(213,173,84,0.12)]">
          <PenTool className="h-4 w-4 text-[#d5ad54]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-[#f3ead7]">Layout Studio</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f95a3]">Freeform arcane layout studio</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 lg:mt-0">
        {iconActions.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={item.action}
                disabled={item.disabled}
                aria-label={item.label}
                title={item.label}
                className="h-7 w-7 rounded-[4px] text-[#aeb4c0] hover:bg-[#171d29] hover:text-[#f3ead7]"
              >
                <item.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{item.label}</TooltipContent>
          </Tooltip>
        ))}
        {hasBackFace ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSetActiveFace('front')}
                  className={cn(toolButtonClassName, activeFace === 'front' && activeButtonClassName, 'gap-1 px-2 text-xs')}
                >
                  Front Face
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit the primary front face</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSetActiveFace('back')}
                  className={cn(toolButtonClassName, activeFace === 'back' && activeButtonClassName, 'gap-1 px-2 text-xs')}
                >
                  Back Face
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit the optional back face</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreateBackFace}
                className={cn(toolButtonClassName, 'gap-1 px-2 text-xs')}
              >
                Add Back Face
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create an optional back face from the default back template</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleGrid}
              className={cn(toolButtonClassName, showGrid && activeButtonClassName, 'gap-1 px-2 text-xs')}
            >
              <Grid3X3 className="h-4 w-4" /> Grid
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle grid (G)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleSnapToGrid}
              className={cn(toolButtonClassName, snapToGrid && activeButtonClassName, 'gap-1 px-2 text-xs')}
            >
              <BoxSelect className="h-4 w-4" /> Snap
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap movement to grid</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTogglePreviewMode}
              className={cn(toolButtonClassName, previewMode && activeButtonClassName, 'gap-1 px-2 text-xs')}
            >
              {previewMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Preview
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle preview mode (P)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCommandPalette}
              aria-keyshortcuts="Control+K Meta+K"
              className={cn(toolButtonClassName, 'gap-1 px-2 text-xs')}
            >
              <Search className="h-4 w-4" /> Command
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open command palette (Ctrl+K)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={onSave}
              size="sm"
              aria-keyshortcuts="Control+S Meta+S"
              className="h-8 rounded-[4px] border border-[#7f6225] bg-[#d5ad54] px-3 text-xs font-semibold text-[#11100c] hover:bg-[#f0ca71]"
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save template (Ctrl+S)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
