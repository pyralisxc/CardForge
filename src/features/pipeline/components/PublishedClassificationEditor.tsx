"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { readApiError } from '@/infrastructure/http/clientResponses';
import { CARDFORGE_SPECIALTY_OPTIONS, CARDFORGE_USE_CASE_OPTIONS } from '../lib/contentTaxonomy';
import { ControlledTaxonomySelect } from './ControlledTaxonomySelect';

interface ClassificationSnapshot {
  assetId: string; name: string; assetType: string;
  expectedSubmissionId: string; expectedLineageId: string; expectedRevision: number;
  expectedSpecialtyTags: string[]; expectedUseCaseTags: string[];
}

export function PublishedClassificationEditor({ assetId, onClose, onSaved }: {
  assetId: string; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<ClassificationSnapshot | null>(null);
  const [specialtyTags, setSpecialtyTags] = useState<string[]>([]);
  const [useCaseTags, setUseCaseTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setSnapshot(null); setError(null);
    void fetch(`/api/owner/pipeline/classification?assetId=${encodeURIComponent(assetId)}`, { cache: 'no-store', signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw await readApiError(response, 'Classification could not be loaded.');
        return response.json() as Promise<ClassificationSnapshot>;
      }).then((value) => {
        if (abort.signal.aborted) return;
        setSnapshot(value); setSpecialtyTags(value.expectedSpecialtyTags); setUseCaseTags(value.expectedUseCaseTags);
      }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Classification could not be loaded.'); });
    return () => abort.abort();
  }, [assetId, reload]);
  const save = async () => {
    if (!snapshot) return;
    setBusy(true); setError(null);
    try {
      const { name: _name, assetType: _assetType, ...identity } = snapshot;
      const response = await fetch('/api/owner/pipeline/classification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, specialtyTags, useCaseTags }) });
      if (!response.ok) throw await readApiError(response, 'Classification could not be saved.');
      await onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Classification could not be saved.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Published classification" className="grid gap-3 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4">
    <h3 className="font-semibold">Classify {snapshot?.name ?? 'published content'}</h3>
    <p className="text-sm text-[var(--cf-text-muted)]">Choose how people discover this content. General reusable resources may leave use case empty. Templates and Sets require a use case.</p>
    {snapshot ? <fieldset disabled={busy} className="grid gap-3">
      <ControlledTaxonomySelect label="Published specialty" selectedIds={specialtyTags} options={CARDFORGE_SPECIALTY_OPTIONS} onChange={setSpecialtyTags} />
      <ControlledTaxonomySelect label="Published use case" selectedIds={useCaseTags} options={CARDFORGE_USE_CASE_OPTIONS} onChange={setUseCaseTags} />
    </fieldset> : !error ? <p role="status">Loading current classification…</p> : null}
    {error ? <p role="alert" className="text-sm text-[var(--cf-danger)]">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || !snapshot || !specialtyTags.length} onClick={() => void save()}>{busy ? 'Saving…' : 'Save classification'}</Button>
      {error ? <Button type="button" variant="outline" disabled={busy} onClick={() => setReload((value) => value + 1)}>Reload current values</Button> : null}
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    </div>
  </section>;
}
