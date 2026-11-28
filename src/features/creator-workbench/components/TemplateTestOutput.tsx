'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CardFace } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import { compatibleDuplexTemplateTrim } from '@/domain/rendering';
import { useProjectLibraryWorkspace } from '@/features/project/client/libraryWorkspace';
import { openTemplateTestSet } from '@/features/project/client/workspace';

/** Opens a saved Template through the normal Set and Output lifecycle. */
export function TemplateTestOutput({ card, face, label, disabled = false, onOpened }: {
  card: DisplayCard;
  face: CardFace;
  label: string;
  disabled?: boolean;
  onOpened: (setId: string) => void;
}) {
  const { templates } = useProjectLibraryWorkspace();
  const fronts = templates.filter(template => Boolean(template.id) && template.templateUsage !== 'back-preset' && compatibleDuplexTemplateTrim(template, card.template));
  const [frontId, setFrontId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const isDisabled = useRef(disabled); isDisabled.current = disabled;
  const opened = useRef(onOpened); opened.current = onOpened;
  useEffect(() => () => request.current?.abort(), []);
  const front = fronts.find(template => template.id === frontId);
  const open = async () => {
    if (disabled || busy || (face === 'back' && !front)) return;
    const controller = new AbortController(); request.current = controller;
    setMessage(''); setBusy(true);
    let setId: string;
    try {
      setId = await openTemplateTestSet({ template: card.template, data: card.data, face, front,
        name: `${card.template.name} — ${label} test copy`, signal: controller.signal,
        assertCurrent: () => { if (isDisabled.current) throw new Error('Finish the current review changes before opening a test Set.'); } });
    } catch (error) {
      if (!controller.signal.aborted) { setMessage(error instanceof Error ? error.message : 'The test Set could not be saved.'); setBusy(false); }
      return;
    }
    if (controller.signal.aborted) return;
    try { opened.current(setId); }
    catch { setMessage('The test Set was saved in this browser. Open it from Desk to use Output.'); setBusy(false); }
  };
  return <div className="grid w-full max-w-xs gap-2 text-left">
    <p className="text-xs text-muted-foreground">Copy the displayed saved Template into an independent test Set in this browser, then open normal Output. The source and your existing Sets stay unchanged.</p>
    {face === 'back' ? <div className="grid gap-1">
      <p className="text-xs font-medium">Choose a front for this back</p>
      <div role="group" aria-label="Front Template for this back" className="grid max-h-40 gap-1 overflow-y-auto">
        {fronts.map(template => <Button key={template.id!} type="button" size="sm" variant={frontId === template.id ? 'default' : 'outline'} aria-pressed={frontId === template.id} disabled={busy || disabled} onClick={() => setFrontId(template.id!)}>{template.name}</Button>)}
      </div>
      {!fronts.length ? <p className="text-xs text-muted-foreground">Save a matching-size front Template in your browser workspace first.</p> : null}
    </div> : null}
    <Button type="button" size="sm" variant="outline" disabled={disabled || busy || (face === 'back' && !front)} onClick={() => void open()}>{busy ? 'Saving test Set…' : 'Open test copy in Output'}</Button>
    {message ? <p role="alert" className="text-xs">{message}</p> : null}
  </div>;
}
