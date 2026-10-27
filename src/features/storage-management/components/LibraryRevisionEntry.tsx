"use client";
import { useEffect, useRef, useState } from 'react';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import { AppearanceStudioPanel, createSharedLineageDraft } from '@/features/template-editor/client';
import { appearanceToStyle } from '@/features/card-rendering/client';
import { templateReviewBaseSchema, templateReviewReceiptSchema } from '@/features/pipeline/client';
import type { PipelineReviewTarget } from '@/features/pipeline/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { TooltipProvider } from '@/components/ui/tooltip';

type Base = ReturnType<typeof templateReviewBaseSchema.parse>;
export function LibraryRevisionEntry({ target, kind, onDirtyChange, onTemplateDraft }: {
  target: PipelineReviewTarget; kind: 'templates' | 'elementPresets'; onDirtyChange: (dirty: boolean) => void;
  onTemplateDraft: (template: TCGCardTemplate) => void;
}) {
  const [base, setBase] = useState<Base | null>(null);
  const [style, setStyle] = useState<AppearanceStylePreset | null>(null);
  const [template, setTemplate] = useState<TCGCardTemplate | null>(null);
  const [error, setError] = useState(''); const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false); const [changed, setChanged] = useState(false);
  const attempt = useRef<{ submissionKey: string; expectedBase: Base; style: AppearanceStylePreset } | null>(null);
  const endpoint = `/api/owner/pipeline/${kind === 'templates' ? 'template' : 'style'}-revisions`;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${endpoint}?assetId=${encodeURIComponent(target.assetId)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(await readApiErrorMessage(response, 'The selected published base is unavailable.'));
        const value = await response.json(); const pins = templateReviewBaseSchema.parse(value.expectedBase);
        if (pins.assetId !== target.assetId || pins.lineageId !== target.lineageId || pins.parentSubmissionId !== target.submissionId
          || target.status !== 'published' || (target.revisionNumber !== null && pins.baseRevisionNumber !== target.revisionNumber)) {
          throw new Error('This selection is not the current published base. Return to Library and explicitly select the current revision.');
        }
        if (controller.signal.aborted) return;
        if (kind === 'templates') {
          if (value.template?.id !== target.assetId) throw new Error('The exact Template source is unavailable.');
          setTemplate(value.template);
        } else {
          if (value.style?.id !== target.assetId || !value.style.appearance) throw new Error('The exact style source is unavailable.');
          setStyle(value.style);
        }
        setBase(pins);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The published base is unavailable.'); }
    })();
    return () => controller.abort();
  }, [endpoint, kind, target]);
  const submit = async () => {
    if (!base || !style || busy || receipt) return;
    attempt.current ??= { submissionKey: crypto.randomUUID(), expectedBase: base, style: structuredClone(style) };
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.current) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'The outcome is unavailable. Retry this same saved attempt.'));
      const saved = templateReviewReceiptSchema.parse(await response.json());
      if (saved.assetId !== target.assetId) throw new Error('The revision receipt does not match this artifact.');
      setReceipt(`Revision ${saved.revisionNumber} submitted for review. Published content is unchanged.`); onDirtyChange(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The outcome is unavailable. Retry this same saved attempt.'); }
    finally { setBusy(false); }
  };
  return <section className="grid gap-4" aria-label="Revise selected published artifact">
    <p>Base: {target.assetId} · revision {base?.baseRevisionNumber ?? target.revisionNumber ?? 'legacy'}. Submit creates a separate candidate; approval and publication are separate actions.</p>
    {error ? <p role="alert">{error}</p> : null}
    {!base && !error ? <p>Verifying selected published base…</p> : null}
    {base && template ? <button type="button" onClick={() => {
      const draft = createSharedLineageDraft(template, template, () => crypto.randomUUID());
      draft.id = `template-review-${crypto.randomUUID()}`; draft.templatePipelineContext = { schemaVersion: 1, expectedBase: base };
      onTemplateDraft(draft);
    }}>Prepare local review draft in Design</button> : null}
    {base && style ? <TooltipProvider>
      <div aria-label="Revision appearance preview" style={{ ...appearanceToStyle(style.appearance), width: 200, height: 150, maxWidth: '100%' }} />
      <fieldset disabled={busy || Boolean(attempt.current) || Boolean(receipt)}>
        <AppearanceStudioPanel element={{ id: 'revision-preview', type: 'shape', name: style.name, x: 0, y: 0, width: 200, height: 150, zIndex: 1 }} selectedAppearance={style.appearance}
          compatibleAppearanceStyles={[]} compatibleTextureAssets={[]} elementStylePresets={[]} canUseImageSource={false} canUseDividerControls={false}
          canUseBackgroundTexture controlClassName="w-full" buttonClassName="" canUploadCustomAssets={false} onHandleAssetUpload={() => {}}
          onApplyAppearancePreset={() => {}} onUpdateAppearance={update => { if (busy || attempt.current || receipt) return; setStyle(current => current ? { ...current, appearance: update(current.appearance) } : current); setChanged(true); onDirtyChange(true); }}
          personalItems={[]} onAddFromProvider={async () => { throw new Error('Provider imports are not part of this revision entry.'); }} onMaterializePersonal={async () => { throw new Error('Provider imports are not part of this revision entry.'); }} />
      </fieldset>
      {receipt ? <p role="status">{receipt}</p> : <button type="button" disabled={busy || !changed} onClick={() => void submit()}>{busy ? 'Submitting…' : attempt.current ? 'Confirm same submission attempt' : 'Submit revision for review'}</button>}
    </TooltipProvider> : null}
  </section>;
}
