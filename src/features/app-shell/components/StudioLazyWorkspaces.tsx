"use client";

import dynamic from 'next/dynamic';

const WorkspaceLoadingState = () => (
  <div data-testid="studio-loading" className="min-h-[60vh] rounded border border-[var(--cf-border)] bg-[#090807] text-[var(--cf-text)]" role="status" aria-live="polite">
    <div className="grid min-h-[60vh] gap-0 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="hidden border-r border-[#2f2417] bg-[#0d1118] p-5 lg:block">
        <div className="h-4 w-28 rounded bg-[var(--cf-accent)]/25" />
        <div className="mt-5 space-y-3">
          <div className="h-20 rounded border border-[#2f3a47] bg-[#111827]" />
          <div className="h-20 rounded border border-[#2f3a47] bg-[#111827]" />
          <div className="h-20 rounded border border-[#2f3a47] bg-[#111827]" />
        </div>
      </aside>
      <section className="flex items-center justify-center bg-[linear-gradient(90deg,rgba(216,179,101,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(216,179,101,0.08)_1px,transparent_1px)] bg-[size:32px_32px] p-8">
        <div className="grid max-w-sm justify-items-center gap-4 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--cf-accent-strong)] border-t-transparent" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent-strong)]">Preparing Studio</p>
            <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Loading your Templates and card set.</p>
          </div>
        </div>
      </section>
      <aside className="hidden border-l border-[#2f2417] bg-[#11161f] p-5 lg:block">
        <div className="h-4 w-24 rounded bg-[var(--cf-accent)]/25" />
        <div className="mt-5 space-y-3">
          <div className="h-24 rounded border border-[#2f3a47] bg-[#0d1118]" />
          <div className="h-28 rounded border border-[#2f3a47] bg-[#0d1118]" />
          <div className="h-16 rounded border border-[#2f3a47] bg-[#0d1118]" />
        </div>
      </aside>
    </div>
  </div>
);

export const CardTemplateMaker = dynamic(
  () => import('@/features/template-editor/client')
    .then((module) => module.loadCardTemplateMaker())
    .then((module) => module.CardTemplateMaker),
  { ssr: false, loading: WorkspaceLoadingState },
);

export const GenerationWorkspace = dynamic(
  () => import('@/features/card-generator/client')
    .then((module) => module.loadGenerationWorkspace())
    .then((module) => module.GenerationWorkspace),
  { ssr: false, loading: WorkspaceLoadingState },
);

export const StudioSetDesk = dynamic(
  () => import('@/features/card-generator/client')
    .then((module) => module.loadStudioSetDesk())
    .then((module) => module.StudioSetDesk),
  { ssr: false, loading: WorkspaceLoadingState },
);

export const StudioOutputPanel = dynamic(
  () => import('@/features/card-generator/client')
    .then((module) => module.loadExportControlsPanel())
    .then((module) => module.ExportControlsPanel),
  { ssr: false, loading: WorkspaceLoadingState },
);

export const StudioPipelineSubmission = dynamic(
  () => import('@/features/pipeline/client')
    .then((module) => module.PipelineContributionPanel),
  { ssr: false, loading: WorkspaceLoadingState },
);

export const StudioSaveMoveDialog = dynamic(
  () => import('@/features/project/client')
    .then((module) => module.StudioSaveMoveDialog),
  { ssr: false },
);

export const EditCardDialog = dynamic(
  () => import('@/features/card-generator/client')
    .then((module) => module.loadEditCardDialog())
    .then((module) => module.EditCardDialog),
  { ssr: false },
);
