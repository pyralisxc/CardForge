import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCardTitle } from '@/domain/cards';
import { useProjectStore } from '../store/workspaceStore';

const refusalMessages = {
  'not-found': 'This recovery is no longer available in the current workspace. Current work was kept.',
  'newer-removal': 'Undo the newer removal in this Set first. Current work and recovery were kept.',
  'template-unavailable': 'A required Template is unavailable. Restore that Template before retrying. Current work and recovery were kept.',
  conflict: 'An Artifact already uses a removed identity. Current work and recovery were kept.',
};

export function CardRemovalUndo({ setId, setName, returnFocusRef }: {
  setId: string;
  setName: string;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const entry = useProjectStore((state) => state.cardRemovalRecoveries.findLast((item) => item.setId === setId));
  const depth = useProjectStore((state) => state.cardRemovalRecoveries.filter((item) => item.setId === setId).length);
  const undoRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const focusWithin = useRef(false);
  const pendingFocus = useRef<'undo' | 'dismiss' | null>(null);
  const [feedback, setFeedback] = useState<{ forId: string | undefined; message: string } | null>(null);
  const descriptionId = useId();

  useLayoutEffect(() => {
    const action = pendingFocus.current;
    pendingFocus.current = null;
    if (!action && !(focusWithin.current && !entry)) return;
    const target = entry ? (action === 'dismiss' ? dismissRef.current : undoRef.current) : returnFocusRef.current;
    focusWithin.current = Boolean(entry);
    target?.focus({ preventScroll: true });
  }, [entry, returnFocusRef]);

  const report = (message: string) => {
    const next = useProjectStore.getState().cardRemovalRecoveries.findLast((item) => item.setId === setId);
    setFeedback({ forId: next?.id, message });
  };
  const names = entry?.cards.slice(0, 3).map((card) => getCardTitle(card, entry.order.indexOf(card.uniqueId)).slice(0, 80)).join(', ');
  const summary = entry ? `Removed ${entry.cards.length} card${entry.cards.length === 1 ? '' : 's'} from ${setName}: ${names}${entry.cards.length > 3 ? ` and ${entry.cards.length - 3} more` : ''}.` : '';
  const message = feedback?.forId === entry?.id ? feedback?.message ?? '' : '';

  return <>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message} {summary} {entry ? 'Undo latest removal is available in this browser session.' : ''}
    </span>
    {entry ? <div
      role="group"
      aria-label="Card removal recovery"
      data-card-removal-recovery={entry.id}
      className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-[var(--cf-surface-inset)] px-3 py-2"
      onFocusCapture={() => { focusWithin.current = true; }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) focusWithin.current = false; }}
    >
      <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-40 break-words text-sm">
        <p id={descriptionId}>{summary}</p>
        <p className="text-xs text-[var(--cf-text-muted)]">This session · latest of {depth} removal{depth === 1 ? '' : 's'}</p>
        {message ? <p className="mt-1">{message}</p> : null}
      </div>
      <Button ref={undoRef} type="button" size="sm" variant="outline" aria-label={`Undo latest removal from ${setName}`} aria-describedby={descriptionId} onClick={() => {
        pendingFocus.current = 'undo';
        const result = useProjectStore.getState().undoCardRemoval(entry.id);
        if (result.ok) report(`Restored ${result.count} card${result.count === 1 ? '' : 's'} to this Set’s browser working copy.`);
        else { pendingFocus.current = null; report(refusalMessages[result.reason]); }
      }}>Undo</Button>
      <Button ref={dismissRef} type="button" size="sm" variant="ghost" aria-label={`Dismiss latest removal recovery from ${setName}`} onClick={() => {
        pendingFocus.current = 'dismiss';
        useProjectStore.getState().dismissCardRemoval(entry.id);
        report('Dismissed this recovery. Current cards were not changed.');
      }}>Dismiss</Button>
    </div> : null}
  </>;
}
