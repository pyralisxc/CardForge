"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { publishedClassificationResult } from '../lib/publishedClassificationContract';
import { readApiError } from '@/infrastructure/http/clientResponses';
import {
  CARDFORGE_COMPATIBILITY_OPTIONS,
  CARDFORGE_SPECIALTY_OPTIONS,
  CARDFORGE_USE_CASE_OPTIONS,
  CARDFORGE_VARIANT_KIND_OPTIONS,
  getSemanticRoleOptions,
  type PipelineSemanticRole,
  type PipelineTaxonomyAssetType,
  type PipelineVariantKind,
} from '../lib/contentTaxonomy';
import { ControlledTaxonomySelect } from './ControlledTaxonomySelect';

interface ClassificationSnapshot {
  assetId: string; name: string; assetType: string;
  expectedSubmissionId: string; expectedLineageId: string; expectedRevision: number;
  expectedSpecialtyTags: string[]; expectedUseCaseTags: string[];
  expectedSemanticRole: PipelineSemanticRole;
  expectedVisualFamily: string | null;
  expectedVariantKind: PipelineVariantKind;
  expectedVariantLabel: string | null;
  expectedCompatibilityTags: string[];
}

export function PublishedClassificationEditor({ assetId, onClose, onSaved }: {
  assetId: string; onClose: () => void; onSaved: () => Promise<void | boolean>;
}) {
  const [snapshot, setSnapshot] = useState<ClassificationSnapshot | null>(null);
  const [specialtyTags, setSpecialtyTags] = useState<string[]>([]);
  const [useCaseTags, setUseCaseTags] = useState<string[]>([]);
  const [semanticRole, setSemanticRole] = useState<PipelineSemanticRole>('icon');
  const [visualFamily, setVisualFamily] = useState('');
  const [variantKind, setVariantKind] = useState<PipelineVariantKind>('base');
  const [variantLabel, setVariantLabel] = useState('');
  const [compatibilityTags, setCompatibilityTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshIncomplete, setRefreshIncomplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setSnapshot(null); setError(null); setStatus(null); setRefreshIncomplete(false);
    void fetch(`/api/owner/pipeline/classification?assetId=${encodeURIComponent(assetId)}`, { cache: 'no-store', signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw await readApiError(response, 'Classification could not be loaded.');
        return response.json() as Promise<ClassificationSnapshot>;
      }).then((value) => {
        if (abort.signal.aborted) return;
        setSnapshot(value);
        setSpecialtyTags(value.expectedSpecialtyTags);
        setUseCaseTags(value.expectedUseCaseTags);
        setSemanticRole(value.expectedSemanticRole);
        setVisualFamily(value.expectedVisualFamily ?? '');
        setVariantKind(value.expectedVariantKind);
        setVariantLabel(value.expectedVariantLabel ?? '');
        setCompatibilityTags(value.expectedCompatibilityTags);
      }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Classification could not be loaded.'); });
    return () => abort.abort();
  }, [assetId, reload]);
  const save = async () => {
    if (!snapshot) return;
    setBusy(true); setError(null); setStatus(null); setRefreshIncomplete(false);
    let rejected = false;
    try {
      const { name: _name, assetType: _assetType, ...identity } = snapshot;
      const response = await fetch('/api/owner/pipeline/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...identity,
          specialtyTags,
          useCaseTags,
          semanticRole,
          visualFamily: visualFamily.trim() || null,
          variantKind,
          variantLabel: variantLabel.trim() || null,
          compatibilityTags,
        }),
      });
      const parsed = publishedClassificationResult.safeParse(await response.clone().json().catch(() => null));
      if (!parsed.success) {
        rejected = response.status >= 400 && response.status < 500;
        throw await readApiError(response, 'Classification outcome could not be confirmed.');
      }
      const { receipt } = parsed.data;
      if (receipt.assetId !== assetId || receipt.expectedSubmissionId !== snapshot.expectedSubmissionId || receipt.expectedLineageId !== snapshot.expectedLineageId || receipt.expectedRevision !== snapshot.expectedRevision) throw new Error('Exact classification receipt could not be verified.');
      if (receipt.outcome === 'uncertain' || receipt.committed !== true) {
        setError('Classification outcome is unconfirmed. Read exact current values before any further write; do not replay automatically.');
        return;
      }
      const warnings = [...receipt.warnings];
      if (!receipt.refreshComplete && !warnings.length) warnings.push('Classification committed; follow-up refresh is incomplete. Read current values before any further edit.');
      setStatus(`Classification committed. ${warnings.join(' ')} Library refresh is pending.`);
      try { if (await onSaved() === false) warnings.push('Library refresh is incomplete. Read current values rather than repeating the committed classification.'); } catch { warnings.push('Library refresh is incomplete. Read current values rather than repeating the committed classification.'); }
      setStatus(`Classification committed.${warnings.length ? ` ${warnings.join(' ')}` : ''}`);
      setRefreshIncomplete(warnings.length > 0);
      if (!warnings.length) onClose();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Classification outcome could not be confirmed.';
      setError(rejected ? message : `${message} Read exact current values before any further write; do not replay automatically.`);
    }
    finally { setBusy(false); }
  };
  return <section aria-label="Published classification" className="grid gap-3 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-4">
    <h3 className="font-semibold">Classify {snapshot?.name ?? 'published content'}</h3>
    <p className="text-sm text-[var(--cf-text-muted)]">Choose how people discover this content. General reusable resources may leave use case empty. Templates and Sets require a use case.</p>
    {snapshot ? <fieldset disabled={busy} className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
          Semantic role
          <select className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-accent-text)]" value={semanticRole} onChange={(event) => setSemanticRole(event.target.value as PipelineSemanticRole)}>
            {getSemanticRoleOptions(snapshot.assetType as PipelineTaxonomyAssetType).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
          Visual family / pack
          <input className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-accent-text)]" maxLength={80} value={visualFamily} onChange={(event) => setVisualFamily(event.target.value)} placeholder="Optional family name" />
        </label>
        <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
          Family relationship
          <select className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-accent-text)]" value={variantKind} onChange={(event) => setVariantKind(event.target.value as PipelineVariantKind)}>
            {CARDFORGE_VARIANT_KIND_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
          Variant label
          <input className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-accent-text)]" maxLength={80} value={variantLabel} onChange={(event) => setVariantLabel(event.target.value)} placeholder="Optional, e.g. Poker format" />
        </label>
      </div>
      <ControlledTaxonomySelect label="Compatibility" selectedIds={compatibilityTags} options={CARDFORGE_COMPATIBILITY_OPTIONS} onChange={setCompatibilityTags} emptyLabel="Optional compositional traits." />
      <ControlledTaxonomySelect label="Published specialty" selectedIds={specialtyTags} options={CARDFORGE_SPECIALTY_OPTIONS} onChange={setSpecialtyTags} />
      <ControlledTaxonomySelect label="Published use case" selectedIds={useCaseTags} options={CARDFORGE_USE_CASE_OPTIONS} onChange={setUseCaseTags} />
    </fieldset> : !error ? <p role="status">Loading current classification…</p> : null}
    {status ? <p role="status" className="text-sm text-[var(--cf-text-muted)]">{status}</p> : null}
    {error ? <p role="alert" className="text-sm text-[var(--cf-danger)]">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || !snapshot || !specialtyTags.length} onClick={() => void save()}>{busy ? 'Saving…' : 'Save classification'}</Button>
      {error || refreshIncomplete ? <Button type="button" variant="outline" disabled={busy} onClick={() => setReload((value) => value + 1)}>Reload current values</Button> : null}
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    </div>
  </section>;
}