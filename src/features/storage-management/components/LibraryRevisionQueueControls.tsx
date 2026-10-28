"use client";

import { PIPELINE_STATUSES, PIPELINE_TYPES, getPipelineStatusLabel, getPipelineTypeLabel } from '@/features/pipeline/client';
import type { useLibraryRevisionQueue } from '../hooks/useLibraryRevisionQueue';

export function LibraryRevisionQueueControls({ revisions, onModeChange, queue, disabled = false }: {
  disabled?: boolean; revisions: boolean; onModeChange: (value: boolean) => void; queue: ReturnType<typeof useLibraryRevisionQueue>;
}) {
  return <fieldset disabled={disabled} className="flex min-w-0 flex-wrap items-center gap-3 py-3" aria-label="Pipeline discovery">
    <label>Show <select className="max-w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2 text-sm text-[var(--cf-accent-text)]" aria-label="Pipeline discovery mode" value={revisions ? 'revisions' : 'lineages'} onChange={event => onModeChange(event.target.value === 'revisions')}>
      <option value="lineages">Lineages</option><option value="revisions">All revisions · Owner</option>
    </select></label>
    {revisions ? <>
      <label>Type <select className="max-w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2 text-sm text-[var(--cf-accent-text)]" aria-label="Revision type" value={queue.assetType} onChange={event => queue.setAssetType(event.target.value)}>
        <option value="all">All types</option>{PIPELINE_TYPES.map(type => <option key={type} value={type}>{getPipelineTypeLabel(type)}</option>)}
      </select></label>
      <label>Status <select className="max-w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2 text-sm text-[var(--cf-accent-text)]" aria-label="Revision status" value={queue.status} onChange={event => queue.setStatus(event.target.value)}>
        <option value="all">All statuses</option>{PIPELINE_STATUSES.map(status => <option key={status} value={status}>{getPipelineStatusLabel(status)}</option>)}
      </select></label>
      <span role="status">{queue.loading ? 'Loading revisions…' : `${queue.total} matching revisions · Page ${queue.page} of ${Math.max(1, Math.ceil(queue.total / queue.pageSize))}`}</span>
      <button type="button" disabled={queue.loading || queue.page <= 1} onClick={() => queue.setPage(queue.page - 1)}>Previous revisions</button>
      <button type="button" disabled={queue.loading || queue.page * queue.pageSize >= queue.total} onClick={() => queue.setPage(queue.page + 1)}>Next revisions</button>
    </> : null}
  </fieldset>;
}
