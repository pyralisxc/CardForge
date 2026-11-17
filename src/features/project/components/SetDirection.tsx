"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { normalizeSetPlan, type CardSet, type SetPlan } from '@/domain/cards';
import { applyCardSetPlan } from '../client/projectWorkspaceDocument';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import styles from './SetDirection.module.css';

interface SetDirectionLifecycleOptions {
  id: string;
  active?: boolean;
  dirty?: boolean;
  closeBlocked?: boolean;
  onClose: () => void;
  onDirtyCloseRequest?: () => void;
  panelRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLElement | null>;
}

interface SetDirectionLifecycleResult {
  closeFromControl: () => void;
  closeConfirmed: () => void;
  navigationPrompt: ReactNode;
}

export type SetDirectionLifecycleHook = (options: SetDirectionLifecycleOptions) => SetDirectionLifecycleResult;

interface ContextDraft {
  setId: string;
  setName: string;
  scope: ReturnType<typeof getProjectPersistenceScope>;
  original: SetPlan | undefined;
  context: string;
  brief: string;
  originalBrief: string;
}

export function SetDirection({ set, useLifecycle }: { set: CardSet; useLifecycle: SetDirectionLifecycleHook }) {
  const [draft, setDraft] = useState<ContextDraft | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const operation = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const layerId = useId();
  const contextId = useId();
  const briefId = useId();
  const { toast } = useToast();
  const dirty = Boolean(draft && (draft.context !== (draft.original?.context ?? '') || draft.brief !== draft.originalBrief));

  useEffect(() => () => operation.current?.abort(), []);
  const { closeFromControl, closeConfirmed, navigationPrompt } = useLifecycle({
    id: layerId, active: Boolean(draft), dirty, closeBlocked: busy,
    onClose: () => setDraft(null), onDirtyCloseRequest: () => { if (!busy) setDiscardOpen(true); },
    panelRef: panel, closeButtonRef: trigger,
  });

  const open = () => {
    let original: SetPlan | undefined;
    try { original = set.plan ? structuredClone(normalizeSetPlan(set.plan)) : undefined; }
    catch (failure) { toast({ title: 'Set direction unavailable', description: failure instanceof Error ? failure.message : 'This direction cannot be edited safely.', variant: 'destructive' }); return; }
    const brief = original?.brief ? JSON.stringify(original.brief, null, 2) : '';
    setDraft({ setId: set.id, setName: set.name, scope: getProjectPersistenceScope(), original, context: original?.context ?? '', brief, originalBrief: brief });
    setError(null);
  };
  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    operation.current = controller;
    try {
      const plan: SetPlan = { ...draft.original, version: 1, context: draft.context };
      if (draft.brief.trim()) plan.brief = JSON.parse(draft.brief);
      else delete plan.brief;
      await applyCardSetPlan({ setId: draft.setId, expectedScope: draft.scope, expectedPlan: draft.original, plan, signal: controller.signal });
      closeConfirmed();
      toast({ title: 'Set direction applied', description: 'The browser working copy was updated. Check the Set’s location status for folder or Drive save confirmation.' });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof SyntaxError ? 'The creation brief is not valid JSON. Your draft is still here; correct it before applying.' : failure instanceof Error ? failure.message : 'The context could not be applied. Your draft is still here.');
    } finally {
      operation.current = null;
      setBusy(false);
    }
  };

  return <>
    <Button ref={trigger} type="button" size="sm" variant="ghost" onClick={open} aria-label="Edit Set direction" title="Edit Set direction" className="shrink-0 gap-1.5"><FileText className="h-4 w-4" aria-hidden="true" /><span>Direction</span></Button>
    <Dialog open={Boolean(draft)} onOpenChange={(next) => { if (!next) closeFromControl(); }}>
      <DialogContent ref={panel} className={styles.dialog} onCloseAutoFocus={(event) => { if (trigger.current?.isConnected) { event.preventDefault(); trigger.current.focus(); } }}>
        <DialogHeader><DialogTitle>Direction · {draft?.setName}</DialogTitle><DialogDescription>Keep the creative intent and guidelines with this Set. Direction travels with its copies, backups and .cardforge files; review it before sharing or publishing.</DialogDescription></DialogHeader>
        {draft ? <form className={styles.form} onSubmit={apply}>
          <div className={styles.body}>
            <div className={styles.field}><Label htmlFor={contextId}>Creative direction</Label><Textarea id={contextId} value={draft.context} onChange={(event) => setDraft({ ...draft, context: event.target.value })} placeholder="Describe this Set, its tone, requirements, or decisions to keep with the work." rows={10} disabled={busy} /></div>
            <details className={styles.brief}><summary>Creation brief · advanced</summary><p>A structured authoring brief, including planned assets. This is not a manufacturing configuration. Leave it empty when no structured brief is needed.</p><Label htmlFor={briefId}>Creation brief (JSON)</Label><Textarea id={briefId} value={draft.brief} onChange={(event) => setDraft({ ...draft, brief: event.target.value })} rows={10} spellCheck={false} disabled={busy} className="font-mono text-xs" /></details>
            {error ? <p role="alert" className={styles.error}>{error}</p> : null}
            <p className={styles.note}>Apply updates this browser working copy. Folder and Drive saving follows this Set’s existing location settings; Apply is not a provider-save confirmation.</p>
          </div>
          <div className={styles.actions}><Button type="button" variant="outline" onClick={closeFromControl} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !dirty}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : null}{busy ? 'Applying…' : 'Apply direction'}</Button></div>
        </form> : null}
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unapplied direction?</AlertDialogTitle><AlertDialogDescription>The Set has not been changed. Keep editing to apply this draft, or discard these edits.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => { setDiscardOpen(false); closeConfirmed(); }}>Discard edits</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    {navigationPrompt}
  </>;
}
