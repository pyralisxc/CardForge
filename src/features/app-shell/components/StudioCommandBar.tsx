"use client";

import Link from 'next/link';
import { ArrowLeft, FileOutput, LibraryBig, Pencil, Save, UploadCloud, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AccountControls } from '@/features/account/client/auth';
import type { StudioReturnTarget } from '@/features/app-shell/lib/studioNavigation';
import type { BrowserStorageSaveStatus, StudioView } from '@/features/project/client';

export function StudioCommandBar({
  activeSetName,
  returnTarget,
  studioView,
  cardCount,
  canSubmitToPipeline,
  authConfigured,
  isLoadingAccount,
  isSignedIn,
  modeLabel,
  saveStatus,
  onRefreshEntitlement,
  onShowTemplate,
  onShowGenerate,
  onOpenSave,
  onOpenOutput,
  onOpenPipeline,
}: {
  activeSetName: string;
  returnTarget: StudioReturnTarget;
  studioView: StudioView;
  cardCount: number;
  canSubmitToPipeline: boolean;
  authConfigured: boolean;
  isLoadingAccount: boolean;
  isSignedIn: boolean;
  modeLabel: string;
  saveStatus: BrowserStorageSaveStatus;
  onRefreshEntitlement: () => void;
  onShowTemplate: () => void;
  onShowGenerate: () => void;
  onOpenSave: () => void;
  onOpenOutput: () => void;
  onOpenPipeline: () => void;
}) {
  const saveLabel = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'failed'
      ? 'Save failed'
      : 'Saved on this device';

  return (
    <header className="cardforge-studio-workspace-nav shrink-0 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] no-print">
      <div className="grid min-h-14 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-2 py-1.5 sm:flex sm:gap-2 sm:px-3 lg:px-5">
        <Link href={returnTarget.href} prefetch={false} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 border-r border-[var(--cf-border-subtle)] pr-2 text-sm font-semibold text-[var(--cf-text-muted)] hover:text-[var(--cf-text-strong)] sm:pr-3" aria-label={returnTarget.ariaLabel}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{returnTarget.label}</span>
        </Link>
        <div className="min-w-0 max-w-52 truncate px-1 sm:min-w-36 sm:shrink sm:px-2">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Studio</span>
          <strong className="block truncate text-sm text-[var(--cf-text-strong)]">{activeSetName}</strong>
        </div>
        <div className="shrink-0 sm:order-last"><AccountControls authConfigured={authConfigured} isLoadingAccount={isLoadingAccount} isSignedIn={isSignedIn} modeLabel={modeLabel} onRefreshEntitlement={onRefreshEntitlement} /></div>
        <nav className="row-start-2 flex shrink-0 items-center gap-1 sm:row-auto sm:border-l sm:border-[var(--cf-border-subtle)] sm:pl-2" aria-label="Studio tools">
          <Button type="button" size="sm" variant={studioView === 'template' ? 'default' : 'ghost'} onClick={onShowTemplate} aria-label="Design" aria-pressed={studioView === 'template'}><Pencil aria-hidden="true" /><span className="hidden md:inline">Design</span></Button>
          <Button type="button" size="sm" variant={studioView === 'generate' ? 'default' : 'ghost'} onClick={onShowGenerate} aria-label="Generate" aria-pressed={studioView === 'generate'}><WandSparkles aria-hidden="true" /><span className="hidden md:inline">Generate</span></Button>
        </nav>
        <div className="col-span-2 row-start-2 ml-auto flex shrink-0 items-center gap-1 sm:col-auto sm:row-auto" aria-label="Actions for the active work">
          <Button type="button" size="sm" variant="ghost" onClick={onOpenSave} aria-label="Save or move active work"><Save aria-hidden="true" /><span className="hidden lg:inline">Save</span></Button>
          <Button type="button" size="sm" variant="ghost" disabled={!cardCount} onClick={onOpenOutput} aria-label="Configure output"><FileOutput aria-hidden="true" /><span className="hidden lg:inline">Output</span></Button>
          {canSubmitToPipeline ? <Button type="button" size="sm" variant="ghost" onClick={onOpenPipeline} aria-label="Send active work to Pipeline"><UploadCloud aria-hidden="true" /><span className="hidden xl:inline">Pipeline</span></Button> : null}
          <Link href="/account?section=library" prefetch={false} className="inline-flex h-9 w-9 items-center justify-center text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]" aria-label="Open Library"><LibraryBig className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <span className={`hidden shrink-0 text-xs xl:inline ${saveStatus === 'failed' ? 'text-[var(--cf-danger)]' : saveStatus === 'saving' ? 'text-[var(--cf-warning)]' : 'text-[var(--cf-success)]'}`} role="status" aria-live="polite">{saveLabel}</span>
      </div>
    </header>
  );
}
