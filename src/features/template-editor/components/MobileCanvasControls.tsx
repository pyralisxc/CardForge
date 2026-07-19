"use client";

import { Menu, PanelRight, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/shared/classNames';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';

interface MobileCanvasControlsProps {
  isDirty: boolean;
  templateName?: string;
  onOpenInspector: () => void;
  onOpenMenu: () => void;
  onSave: () => void;
}

export function MobileCanvasControls({
  isDirty,
  templateName,
  onOpenInspector,
  onOpenMenu,
  onSave,
}: MobileCanvasControlsProps) {
  return (
    <div className="cardforge-maker-mobile-switcher no-print lg:hidden" role="toolbar" aria-label="Canvas controls">
      <Button type="button" size="icon" variant="outline" aria-label="Open editor menu" className={cn(makerTheme.toolButton, 'h-10 w-10')} onClick={onOpenMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <span className="min-w-0 flex-1 px-1 text-center">
        <span className="block truncate text-xs font-semibold text-[#f3ead7]">{templateName || 'Untitled card'}</span>
        <span className={cn('mt-0.5 block text-[10px] uppercase tracking-[0.12em]', isDirty ? 'text-[#f5d27b]' : 'text-[#8f95a3]')}>{isDirty ? 'Unsaved' : 'Ready'}</span>
      </span>
      <Button type="button" size="sm" variant="outline" aria-label="Edit selected element" className={cn(makerTheme.toolButton, 'h-10 gap-1 px-2 text-xs')} onClick={onOpenInspector}>
        <PanelRight className="h-4 w-4" />
        Edit
      </Button>
      <Button type="button" size="icon" aria-label="Save template" className="h-10 w-10 rounded-[5px] border border-[#7f6225] bg-[#d5ad54] text-[#11100c] hover:bg-[#f0ca71]" onClick={onSave}>
        <Save className="h-5 w-5" />
      </Button>
    </div>
  );
}
