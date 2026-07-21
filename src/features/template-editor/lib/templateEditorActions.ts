import type { LucideIcon } from 'lucide-react';
import {
  BoxSelect,
  Crosshair,
  Eye,
  EyeOff,
  Grid3X3,
  Maximize2,
  Redo2,
  Save,
  Search,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type TemplateEditorActionId =
  | 'undo'
  | 'redo'
  | 'zoom-out'
  | 'zoom-in'
  | 'fit'
  | 'actual-size'
  | 'center'
  | 'grid'
  | 'snap'
  | 'preview'
  | 'command-palette'
  | 'save';

export interface TemplateEditorAction {
  id: TemplateEditorActionId;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  active?: boolean;
}

interface CreateTemplateEditorActionsOptions {
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
  onActualSize: () => void;
  onCenterCanvas: () => void;
  onToggleGrid: () => void;
  onToggleSnapToGrid: () => void;
  onTogglePreviewMode: () => void;
  onOpenCommandPalette: () => void;
  onSave: () => void;
}

export function createTemplateEditorActions({
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
  onActualSize,
  onCenterCanvas,
  onToggleGrid,
  onToggleSnapToGrid,
  onTogglePreviewMode,
  onOpenCommandPalette,
  onSave,
}: CreateTemplateEditorActionsOptions): TemplateEditorAction[] {
  return [
    { id: 'undo', label: 'Undo', shortLabel: 'Undo', description: 'Undo the last change (Ctrl+Z)', icon: Undo2, onSelect: onUndo, disabled: !canUndo },
    { id: 'redo', label: 'Redo', shortLabel: 'Redo', description: 'Redo the last undone change (Ctrl+Y)', icon: Redo2, onSelect: onRedo, disabled: !canRedo },
    { id: 'zoom-out', label: 'Zoom out', shortLabel: 'Zoom out', description: 'Reduce the canvas zoom (-)', icon: ZoomOut, onSelect: onZoomOut },
    { id: 'zoom-in', label: 'Zoom in', shortLabel: 'Zoom in', description: 'Increase the canvas zoom (+)', icon: ZoomIn, onSelect: onZoomIn },
    { id: 'fit', label: 'Fit to screen', shortLabel: 'Fit', description: 'Fit the whole card design in the workspace', icon: Maximize2, onSelect: onFitToScreen },
    { id: 'actual-size', label: 'Actual size', shortLabel: '100%', description: 'Set the canvas to 100 percent', icon: Maximize2, onSelect: onActualSize },
    { id: 'center', label: 'Center canvas', shortLabel: 'Center', description: 'Center the card design in the workspace', icon: Crosshair, onSelect: onCenterCanvas },
    { id: 'grid', label: 'Grid', shortLabel: 'Grid', description: 'Toggle the layout grid (G)', icon: Grid3X3, onSelect: onToggleGrid, active: showGrid },
    { id: 'snap', label: 'Snap to grid', shortLabel: 'Snap', description: 'Snap movement to the layout grid', icon: BoxSelect, onSelect: onToggleSnapToGrid, active: snapToGrid },
    { id: 'preview', label: 'Preview mode', shortLabel: 'Preview', description: 'Toggle card preview mode (P)', icon: previewMode ? Eye : EyeOff, onSelect: onTogglePreviewMode, active: previewMode },
    { id: 'command-palette', label: 'Command palette', shortLabel: 'Commands', description: 'Open every editor command (Ctrl+K)', icon: Search, onSelect: onOpenCommandPalette },
    { id: 'save', label: 'Save card design', shortLabel: 'Save', description: 'Save this card design (Ctrl+S)', icon: Save, onSelect: onSave },
  ];
}
