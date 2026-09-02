"use client";

import type { ComponentProps } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  StudioOutputPanel,
  StudioPipelineSubmission,
  StudioSaveMoveDialog,
} from './StudioLazyWorkspaces';

export type StudioContextTool = 'output' | 'pipeline' | null;

export function StudioContextTools({
  activeSetName,
  activeSetId,
  openTool,
  onOpenToolChange,
  canSubmitToPipeline,
  saveMoveOpen,
  onSaveMoveOpenChange,
  outputPanelProps,
  saveMoveDialogProps,
}: {
  activeSetName: string;
  activeSetId: string;
  openTool: StudioContextTool;
  onOpenToolChange: (tool: StudioContextTool) => void;
  canSubmitToPipeline: boolean;
  saveMoveOpen: boolean;
  onSaveMoveOpenChange: (open: boolean) => void;
  outputPanelProps: ComponentProps<typeof StudioOutputPanel>;
  saveMoveDialogProps: Omit<ComponentProps<typeof StudioSaveMoveDialog>, 'open' | 'onOpenChange'>;
}) {
  return (
    <>
      <Sheet open={openTool === 'output'} onOpenChange={(open) => { if (!open) onOpenToolChange(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto border-[var(--cf-border)] bg-[var(--cf-canvas)] p-0 text-[var(--cf-text)] sm:max-w-3xl">
          <SheetHeader className="border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] px-5 py-4 pr-16 text-left">
            <SheetTitle className="font-serif text-xl text-[var(--cf-text-strong)]">Output {activeSetName}</SheetTitle>
            <SheetDescription className="text-[var(--cf-text-muted)]">Print, export, and share the active Set without leaving its work surface.</SheetDescription>
          </SheetHeader>
          <div className="p-4 md:p-5"><StudioOutputPanel {...outputPanelProps} /></div>
        </SheetContent>
      </Sheet>

      <Sheet open={openTool === 'pipeline'} onOpenChange={(open) => { if (!open) onOpenToolChange(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto border-[var(--cf-border)] bg-[var(--cf-canvas)] p-0 text-[var(--cf-text)] sm:max-w-4xl">
          <SheetHeader className="border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] px-5 py-4 pr-16 text-left">
            <SheetTitle className="font-serif text-xl text-[var(--cf-text-strong)]">Send {activeSetName} to Pipeline</SheetTitle>
            <SheetDescription className="text-[var(--cf-text-muted)]">Classify and submit this portable Set through the same contributor review path used by Library.</SheetDescription>
          </SheetHeader>
          <div className="p-3 md:p-5">
            {canSubmitToPipeline ? <StudioPipelineSubmission compact initialSubmitSetId={activeSetId} /> : null}
          </div>
        </SheetContent>
      </Sheet>

      {saveMoveOpen ? <StudioSaveMoveDialog open={saveMoveOpen} onOpenChange={onSaveMoveOpenChange} {...saveMoveDialogProps} /> : null}
    </>
  );
}
