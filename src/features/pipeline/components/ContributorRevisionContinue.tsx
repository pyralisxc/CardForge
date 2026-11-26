'use client';

import { useState, type ReactNode } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import type { z } from 'zod/v4';
import { contributorTemplateRevisionBase } from '../lib/contributorDraftContract';

type RevisionBase = z.infer<typeof contributorTemplateRevisionBase>;

/** Select the saved working copy deliberately; the owner of the handoff retains its exact attempt. */
export function ContributorRevisionContinue({ templates, revisionBase, onContinue, renderRecovery }: {
  templates: TCGCardTemplate[];
  revisionBase: RevisionBase;
  onContinue: (template: TCGCardTemplate, revisionBase: RevisionBase) => Promise<void>;
  renderRecovery?: (templateId: string, busy: boolean, onReadyChange: (ready: boolean) => void) => ReactNode;
}) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryReady, setRecoveryReady] = useState(false);
  const personal = templates.filter((template) => template.id && template.templateSource !== 'default');
  const chosen = personal.find((template) => template.id === selected);
  const submit = async () => {
    if (!chosen || busy) return;
    setBusy(true); setError('');
    try { await onContinue(chosen, revisionBase); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The saved work could not be continued.'); }
    finally { setBusy(false); }
  };
  if (!personal.length) return <p>Save a personal Template in Design before continuing this reviewed revision.</p>;
  return <section aria-label="Continue reviewed Template" className="space-y-2">
    <label className="block">Saved Template
      <select className="block w-full" value={selected} onChange={(event) => { setRecoveryReady(false); setSelected(event.target.value); }} disabled={busy}>
        <option value="">Choose your saved Template</option>
        {personal.map((template) => <option key={template.id!} value={template.id!}>{template.name}</option>)}
      </select>
    </label>
    <p>This creates a Pipeline draft on the reviewed revision’s lineage. Your saved Template stays in Design.</p>
    <button type="button" disabled={!chosen || busy || (Boolean(renderRecovery) && !recoveryReady)} onClick={() => void submit()}>{busy ? 'Continuing…' : 'Continue saved Template'}</button>
    {chosen?.id ? renderRecovery?.(chosen.id, busy, setRecoveryReady) : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
