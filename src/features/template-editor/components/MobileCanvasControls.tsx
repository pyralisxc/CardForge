"use client";

import { Menu, PanelRight, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { TemplateEditorAction } from '@/features/template-editor/lib/templateEditorActions';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';
import { cn } from '@/shared/classNames';

interface MobileCanvasControlsProps {
  actions: TemplateEditorAction[];
  isDirty: boolean;
  templateName?: string;
  onOpenInspector: () => void;
  onOpenMenu: () => void;
}

export function MobileCanvasControls({
  actions,
  isDirty,
  templateName,
  onOpenInspector,
  onOpenMenu,
}: MobileCanvasControlsProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const undoAction = actionById.get('undo');
  const redoAction = actionById.get('redo');
  const saveAction = actionById.get('save');

  const runTool = (action: TemplateEditorAction) => {
    action.onSelect();
    setToolsOpen(false);
  };

  return (
    <div className="cardforge-maker-mobile-switcher no-print lg:hidden" role="toolbar" aria-label="Canvas controls">
      <Button type="button" size="icon" variant="outline" aria-label="Open editor menu" className={cn(makerTheme.toolButton, 'h-10 w-10 shrink-0')} onClick={onOpenMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      {undoAction ? (
        <Button type="button" size="icon" variant="ghost" aria-label="Undo" className="h-9 w-9 shrink-0 text-[#aeb4c0]" onClick={undoAction.onSelect} disabled={undoAction.disabled}>
          <undoAction.icon className="h-4 w-4" />
        </Button>
      ) : null}
      {redoAction ? (
        <Button type="button" size="icon" variant="ghost" aria-label="Redo" className="h-9 w-9 shrink-0 text-[#aeb4c0]" onClick={redoAction.onSelect} disabled={redoAction.disabled}>
          <redoAction.icon className="h-4 w-4" />
        </Button>
      ) : null}
      <span className="min-w-0 flex-1 px-1 text-center">
        <span className="block truncate text-xs font-semibold text-[#f3ead7]">{templateName || 'Untitled Template'}</span>
        <span className={cn('mt-0.5 block text-[10px] uppercase tracking-[0.12em]', isDirty ? 'text-[#f5d27b]' : 'text-[#8f95a3]')}>{isDirty ? 'Unsaved' : 'Ready'}</span>
      </span>
      <Button type="button" size="icon" variant="outline" aria-label="Edit selected element" className={cn(makerTheme.toolButton, 'h-10 w-10 shrink-0')} onClick={onOpenInspector}>
        <PanelRight className="h-4 w-4" />
      </Button>
      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetTrigger asChild>
          <Button type="button" size="icon" variant="outline" aria-label="Open editor tools" className={cn(makerTheme.toolButton, 'h-10 w-10 shrink-0')}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[78svh] overflow-y-auto border-[#3b4352] bg-[#0d1117] text-[#f3ead7]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-[#f3ead7]">Editor tools</SheetTitle>
            <SheetDescription className="text-[#aeb6c4]">The same canvas commands available in the desktop toolbar.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {actions.map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                className={cn(
                  'min-h-12 justify-start gap-2 border-[#3b4352] bg-[#111720] text-[#f3ead7] hover:bg-[#1b2430] hover:text-[#f3ead7]',
                  action.active && 'border-[#d5ad54] bg-[#2a2112] text-[#f5d27b]',
                )}
                onClick={() => runTool(action)}
                disabled={action.disabled}
                aria-pressed={action.active === undefined ? undefined : action.active}
              >
                <action.icon className="h-4 w-4 shrink-0" />
                <span className="text-left">{action.shortLabel}</span>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      {saveAction ? (
        <Button type="button" size="icon" aria-label={saveAction.label} disabled={saveAction.disabled} className="h-10 w-10 shrink-0 rounded-[5px] border border-[#7f6225] bg-[#d5ad54] text-[#11100c] hover:bg-[#f0ca71]" onClick={saveAction.onSelect}>
          <saveAction.icon className="h-5 w-5" />
        </Button>
      ) : null}
    </div>
  );
}
