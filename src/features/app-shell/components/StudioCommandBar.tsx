"use client";

import { ArrowLeft, FileOutput, Pencil, Save, UploadCloud, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { StudioView } from '@/features/project/client';

export function StudioCommandBar({
  activeSetName,
  studioView,
  cardCount,
  canSubmitToPipeline,
  onShowDesk,
  onShowTemplate,
  onShowGenerate,
  onOpenSave,
  onOpenOutput,
  onOpenPipeline,
}: {
  activeSetName: string;
  studioView: StudioView;
  cardCount: number;
  canSubmitToPipeline: boolean;
  onShowDesk: () => void;
  onShowTemplate: () => void;
  onShowGenerate: () => void;
  onOpenSave: () => void;
  onOpenOutput: () => void;
  onOpenPipeline: () => void;
}) {
  return (
    <div className="cardforge-studio-workspace-nav shrink-0 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] no-print">
      <div className="container mx-auto flex min-h-12 max-w-full flex-wrap items-center gap-2 px-3 py-1.5 md:px-6 lg:px-8">
        <button type="button" onClick={onShowDesk} className="mr-auto flex min-w-0 items-center gap-2 text-left" aria-current={studioView === 'desk' ? 'page' : undefined}>
          {studioView !== 'desk' ? <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--cf-accent-strong)]" aria-hidden="true" /> : null}
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">{studioView === 'desk' ? 'Studio Set Desk' : 'Back to Set Desk'}</span>
            <strong className="block truncate text-sm text-[var(--cf-text-strong)]">{activeSetName}</strong>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1" aria-label="Tools for the active Set">
          <Button type="button" size="sm" variant={studioView === 'template' ? 'default' : 'ghost'} onClick={onShowTemplate}><Pencil aria-hidden="true" />Edit Template</Button>
          <Button type="button" size="sm" variant={studioView === 'generate' ? 'default' : 'ghost'} onClick={onShowGenerate}><WandSparkles aria-hidden="true" />Generate</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenSave}><Save aria-hidden="true" />Save / move</Button>
          <Button type="button" size="sm" variant="ghost" disabled={!cardCount} onClick={onOpenOutput}><FileOutput aria-hidden="true" />Output</Button>
          {canSubmitToPipeline ? <Button type="button" size="sm" variant="ghost" onClick={onOpenPipeline}><UploadCloud aria-hidden="true" />Pipeline</Button> : null}
        </div>
      </div>
    </div>
  );
}
