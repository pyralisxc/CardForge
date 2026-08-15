"use client";

import { PenTool } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TemplateEditorAction, TemplateEditorActionId } from '@/features/template-editor/lib/templateEditorActions';
import { cn } from '@/shared/classNames';

interface TemplateEditorTopBarProps {
  actions: TemplateEditorAction[];
  isDirty: boolean;
  toolButtonClassName: string;
  activeButtonClassName: string;
}

const ICON_ACTION_IDS: TemplateEditorActionId[] = ['undo', 'redo', 'zoom-out', 'zoom-in', 'fit', 'center'];
const LABELED_ACTION_IDS: TemplateEditorActionId[] = ['grid', 'snap', 'preview', 'command-palette'];

export function TemplateEditorTopBar({
  actions,
  isDirty,
  toolButtonClassName,
  activeButtonClassName,
}: TemplateEditorTopBarProps) {
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const actualSizeAction = actionById.get('actual-size');
  const saveAction = actionById.get('save');

  return (
    <div className="cardforge-editor-topbar flex flex-col border-b border-[#2b2415] bg-[#0b0d11] px-2 py-1.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <div className="cardforge-editor-mark flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#6d5323] bg-[#171207] shadow-[inset_0_0_18px_rgba(213,173,84,0.12)]">
          <PenTool className="h-4 w-4 text-[#d5ad54]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-[#f3ead7]">Template Studio</h2>
          <p className="cardforge-editor-subtitle text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">{isDirty ? 'Unsaved changes' : 'Template workspace'}</p>
        </div>
      </div>
      <div className="cardforge-editor-actions mt-3 flex flex-wrap items-center gap-1 lg:mt-0">
        {ICON_ACTION_IDS.map((actionId) => {
          const action = actionById.get(actionId);
          if (!action) return null;
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={action.onSelect}
                  disabled={action.disabled}
                  aria-label={action.label}
                  className="h-7 w-7 rounded-[4px] text-[#aeb4c0] hover:bg-[#171d29] hover:text-[#f3ead7]"
                >
                  <action.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.description}</TooltipContent>
            </Tooltip>
          );
        })}
        {actualSizeAction ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={actualSizeAction.onSelect}
                aria-label={actualSizeAction.label}
                className="h-7 rounded-[4px] px-2 font-mono text-[10px] text-[#aeb4c0] hover:bg-[#171d29] hover:text-[#f3ead7]"
              >
                {actualSizeAction.shortLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{actualSizeAction.description}</TooltipContent>
          </Tooltip>
        ) : null}
        {LABELED_ACTION_IDS.map((actionId) => {
          const action = actionById.get(actionId);
          if (!action) return null;
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={action.onSelect}
                  disabled={action.disabled}
                  aria-pressed={action.active === undefined ? undefined : action.active}
                  className={cn(toolButtonClassName, action.active && activeButtonClassName, 'gap-1 px-2 text-xs')}
                >
                  <action.icon className="h-4 w-4" /> {action.shortLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.description}</TooltipContent>
            </Tooltip>
          );
        })}
        {saveAction ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={saveAction.onSelect}
                disabled={saveAction.disabled}
                size="sm"
                aria-keyshortcuts="Control+S Meta+S"
                className="h-8 gap-1 rounded-[4px] border border-[#7f6225] bg-[#d5ad54] px-3 text-xs font-semibold text-[#11100c] hover:bg-[#f0ca71]"
              >
                <saveAction.icon className="h-4 w-4" /> {saveAction.shortLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{saveAction.description}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
