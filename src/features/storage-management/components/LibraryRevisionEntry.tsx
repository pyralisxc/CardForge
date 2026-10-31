"use client";
import { useEffect, useRef, useState } from 'react';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import { AppearanceStudioPanel, createSharedLineageDraft } from '@/features/template-editor/client';
import { AppearanceSurface, appearanceToStyle } from '@/features/card-rendering/client';
import { readReviewPublication, templateReviewBaseSchema, templateReviewReceiptSchema } from '@/features/pipeline/client';
import type { PipelineReviewTarget } from '@/features/pipeline/client';
import { ApiClientError, readApiError, readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { TooltipProvider } from '@/components/ui/tooltip';

type Base = ReturnType<typeof templateReviewBaseSchema.parse>;
export function LibraryRevisionEntry({ target, kind, onDirtyChange, onTemplateDraft, onCloseBlockedChange }: {
  target: PipelineReviewTarget; kind: 'templates' | 'elementPresets'; onDirtyChange: (dirty: boolean) => void;
  onCloseBlockedChange?: (reason: string | null) => void;
  onTemplateDraft: (template: TCGCardTemplate) => void;
}) {
  const [base, setBase] = useState<Base | null>(null);
  const [style, setStyle] = useState<AppearanceStylePreset | null>(null);
  const [template, setTemplate] = useState<TCGCardTemplate | null>(null);
  const [error, setError] = useState(''); const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false); const [changed, setChanged] = useState(false);
  const [locked, setLocked] = useState(false);
  const uncertain = useRef(false);
  const attempt = useRef<{ submissionKey: string; expectedBase: Base; style: AppearanceStylePreset } | null>(null);
  const endpoint = `/api/owner/pipeline/${kind === 'templates' ? 'template' : 'style'}-revisions`;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!target.assetId || target.status !== 'published') throw new Error('Select a published catalog base before creating a revision.');
        await readReviewPublication(target, controller.signal);
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
  const blockClose = () => {
    setLocked(true); onDirtyChange(true);
    onCloseBlockedChange?.('This submission is pending or unconfirmed. Keep this tool open and check its outcome or retry the same saved attempt.');
  };
  const acceptReceipt = (value: unknown) => {
    const saved = templateReviewReceiptSchema.parse(value);
    if (saved.assetId !== target.assetId) throw new Error('The revision receipt does not match this artifact.');
    setReceipt(`Revision ${saved.revisionNumber} submitted for review. Published content is unchanged.`);
    uncertain.current = false; setLocked(false); onCloseBlockedChange?.(null); onDirtyChange(false);
  };
  const checkOutcome = async () => {
    if (!attempt.current || busy || !target.assetId) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams({ assetId: target.assetId, submissionKey: attempt.current.submissionKey })}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'The submission receipt is unavailable. Keep this attempt.'));
      const result = await response.json() as { receipt: unknown };
      if (result.receipt) acceptReceipt(result.receipt);
      else setError('No receipt is visible yet. This does not prove the pending attempt failed. Keep this tool open and retry the same saved attempt.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The receipt is unavailable. Keep this attempt.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!base || !style || busy || receipt) return;
    attempt.current ??= { submissionKey: crypto.randomUUID(), expectedBase: base, style: structuredClone(style) };
    blockClose(); setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.current) });
      if (!response.ok) throw await readApiError(response, 'The outcome is unavailable. Retry this same saved attempt.');
      acceptReceipt(await response.json());
    } catch (failure) {
      const rejected = failure instanceof ApiClientError && (failure.status === 400 || failure.status === 409);
      if (rejected && !uncertain.current) { setLocked(false); onCloseBlockedChange?.(null); }
      else uncertain.current = true;
      setError(failure instanceof Error ? failure.message : 'The outcome is unavailable. Retry this same saved attempt.');
    } finally { setBusy(false); }
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
      <AppearanceSurface aria-label="Revision appearance preview" style={{ ...appearanceToStyle(style.appearance), width: 200, height: 150, maxWidth: '100%' }} />
      <fieldset disabled={busy || Boolean(attempt.current) || Boolean(receipt)}>
        <AppearanceStudioPanel element={{ id: 'revision-preview', type: 'shape', name: style.name, x: 0, y: 0, width: 200, height: 150, zIndex: 1 }} selectedAppearance={style.appearance}
          compatibleAppearanceStyles={[]} compatibleTextureAssets={[]} elementStylePresets={[]} canUseImageSource={false} canUseDividerControls={false}
          canUseBackgroundTexture controlClassName="w-full" buttonClassName="" canUploadCustomAssets={false} onHandleAssetUpload={() => {}}
          onApplyAppearancePreset={() => {}} onUpdateAppearance={update => { if (busy || attempt.current || receipt) return; setStyle(current => current ? { ...current, appearance: update(current.appearance) } : current); setChanged(true); onDirtyChange(true); }}
          personalItems={[]} onAddFromProvider={async () => { throw new Error('Provider imports are not part of this revision entry.'); }} onMaterializePersonal={async () => { throw new Error('Provider imports are not part of this revision entry.'); }} />
      </fieldset>
      {locked && !busy ? <button type="button" onClick={() => void checkOutcome()}>Check submission outcome</button> : null}
      {receipt ? <p role="status">{receipt}</p> : <button type="button" disabled={busy || !changed} onClick={() => void submit()}>{busy ? 'Submitting…' : attempt.current ? 'Confirm same submission attempt' : 'Submit revision for review'}</button>}
    </TooltipProvider> : null}
  </section>;
}
