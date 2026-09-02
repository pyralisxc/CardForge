"use client";

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PipelineContentHealth } from '../lib/pipelineContentHealth';

export function PipelineContentHealthPanel({ health, canRepair, onOpenObject }: { health: PipelineContentHealth; canRepair: boolean; onOpenObject: (objectId: string) => void }) {
  return <details className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)]">
    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm"><span className="inline-flex items-center gap-2 font-semibold text-[var(--cf-text-strong)]">{health.issues.length ? <AlertTriangle className="h-4 w-4 text-[var(--cf-warning)]" /> : <CheckCircle2 className="h-4 w-4 text-[var(--cf-success)]" />}Content Health</span><span className="text-xs text-[var(--cf-text-subtle)]">{health.checkedCount} published · {health.errors} errors · {health.warnings} warnings</span></summary>
    <div className="grid gap-2 border-t border-[var(--cf-border-subtle)] p-3">
      {health.issues.slice(0, 30).map((issue, index) => <article key={`${issue.code}:${issue.objectId}:${index}`} className="flex flex-wrap items-start justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3 text-xs"><div><p className={issue.severity === 'error' ? 'font-semibold text-[var(--cf-danger)]' : 'font-semibold text-[var(--cf-warning)]'}>{issue.objectName} · {issue.code.replaceAll('-', ' ')}</p><p className="mt-1 text-[var(--cf-text-muted)]">{issue.message} {issue.repair}</p></div>{canRepair && issue.objectId ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenObject(issue.objectId!)}>Open object</Button> : null}</article>)}
      {!health.issues.length ? <p className="text-sm text-[var(--cf-text-muted)]">All projected published objects have lineage, source, route, taxonomy, package, and preview health for the checks available here.</p> : null}
      {health.issues.length > 30 ? <p className="text-xs text-[var(--cf-text-subtle)]">Showing the first 30 issues. Repair and refresh to continue.</p> : null}
    </div>
  </details>;
}
