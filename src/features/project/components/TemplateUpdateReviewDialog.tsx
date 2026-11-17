"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Layers, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import type { SetUpdateDecision } from '@/domain/cards/setUpdateReview';
import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { commitSetTemplateUpdateReview, type OpenTemplateUpdateReview } from '../client/setTemplateUpdateReview';
import { previewTemplateUpdateReview, type TemplateUpdateChange } from '../model/templateUpdateReview';
import type { TemplatePreviewRenderer } from './templatePreviewRenderer';

const decisions = [['keep', 'Keep mine'], ['use', 'Use update'], ['defer', 'Defer']] as const;
const displayValue = (value: unknown): string => {
  if (value === undefined) return 'Not present';
  if (typeof value === 'string') return value || '(empty)';
  return JSON.stringify(value, null, 2);
};
const words = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
const elementId = (change?: TemplateUpdateChange) => {
  const segment = change?.path.find((part) => typeof part === 'object' && 'by' in part && part.by === 'id');
  return segment && typeof segment === 'object' && 'by' in segment ? segment.value : undefined;
};
const groupName = (change: TemplateUpdateChange, review: OpenTemplateUpdateReview) => {
  const id = elementId(change);
  if (!id) return change.group;
  return review.current.freeformCanvas?.elements.find((element) => element.id === id)?.name
    || review.incoming.freeformCanvas?.elements.find((element) => element.id === id)?.name || 'Design element';
};
const propertyName = (change: TemplateUpdateChange) => {
  const last = change.path.at(-1);
  if (typeof last !== 'string') return last && 'order' in last ? 'Order' : change.before === undefined ? 'Added element or field' : 'Removed element or field';
  const names: Record<string, string> = { x: 'Horizontal position', y: 'Vertical position', name: 'Name', parentId: 'Parent layer', content: 'Text' };
  return names[last] ?? words(last);
};

export function TemplateUpdateReviewDialog({ review, cards = [], renderPreview, onClose }: {
  review: OpenTemplateUpdateReview; cards?: DisplayCard[]; renderPreview: TemplatePreviewRenderer; onClose: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, SetUpdateDecision>>(() => ({ ...review.initialChoices }));
  const [activeGroup, setActiveGroup] = useState<string | null>(review.changes[0]?.group ?? null);
  const [view, setView] = useState<'source' | 'result'>('source');
  const [samples] = useState(() => structuredClone(cards.filter((card) => (
    card.template.id === review.current.id || card.backingTemplate?.id === review.current.id
  ))));
  const [sampleId, setSampleId] = useState(samples[0]?.uniqueId ?? '');
  const [previewWidth, setPreviewWidth] = useState(150);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const previewContainer = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const { toast } = useToast();
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const node = previewContainer.current;
    if (!node) return;
    const measure = () => setPreviewWidth(Math.max(64, Math.min(230, (node.clientWidth - 32) / 2)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof review.changes>();
    for (const change of review.changes) grouped.set(change.group, [...(grouped.get(change.group) ?? []), change]);
    return [...grouped];
  }, [review]);
  const preview = useMemo(() => {
    try { return { template: previewTemplateUpdateReview(review, choices).template, error: null }; }
    catch (cause) { return { template: null, error: cause instanceof Error ? cause.message : 'These choices cannot form a valid design.' }; }
  }, [review, choices]);
  const deferred = review.changes.filter((change) => (choices[change.key] ?? 'defer') === 'defer').length;
  const used = review.changes.filter((change) => choices[change.key] === 'use').length;
  const kept = review.changes.length - deferred - used;
  const selectedChanges = groups.find(([group]) => group === activeGroup)?.[1];
  const highlightedElementId = elementId(selectedChanges?.[0]);
  const sample = samples.find((card) => card.uniqueId === sampleId);
  const back = review.current.templateUsage === 'back-preset';
  const previewCard = (template: TCGCardTemplate, suffix: string): DisplayCard => ({
    ...(sample ?? { data: review.current.templatePreviewData ?? {} }),
    template: back ? sample?.template ?? review.current : template,
    ...(back ? { backingTemplate: template, backingData: sample?.backingData ?? review.current.templatePreviewData ?? {} } : {}),
    uniqueId: `review-${id}-${suffix}`,
  });
  const choose = (changes: TemplateUpdateChange[], decision: SetUpdateDecision) => {
    setChoices((current) => ({ ...current, ...Object.fromEntries(changes.map((change) => [change.key, decision])) }));
    setView('result'); setError(null);
  };
  const applyReview = async () => {
    if (request.current || preview.error) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError(null);
    try {
      const result = await commitSetTemplateUpdateReview(review, choices, controller.signal);
      toast({ title: result.changesTemplate ? 'Update applied to this Set' : 'Review decisions recorded',
        description: `${result.outcome === 'deferred' ? 'Deferred changes remain in Updates. ' : ''}Save or download the Set to keep these changes elsewhere.` });
      onClose();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The review could not be recorded. Your existing work was kept.');
    } finally { request.current = null; setBusy(false); }
  };
  const close = () => { request.current?.abort(); onClose(); };
  const rightTemplate = view === 'source' ? review.incoming : preview.template;
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="border-b px-5 py-4 pr-12 text-left">
        <DialogTitle>Review Update · {review.current.name}</DialogTitle>
        <DialogDescription>Try changes on your design. Nothing changes in your Set until you apply your choices.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,1fr)]">
        <section className="min-w-0 space-y-4 bg-muted/20 p-4 sm:p-5" aria-label="Visual design comparison">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{back ? 'Back design' : 'Front design'}</span>
            <div className="flex rounded-md border p-1" aria-label="Compare with">
              <Button size="sm" variant={view === 'source' ? 'secondary' : 'ghost'} aria-pressed={view === 'source'} onClick={() => setView('source')}>Source update</Button>
              <Button size="sm" variant={view === 'result' ? 'secondary' : 'ghost'} aria-pressed={view === 'result'} onClick={() => setView('result')}>Your result</Button>
            </div>
          </div>
          <div ref={previewContainer} className="grid grid-cols-2 items-start gap-4">
            {[{ title: 'Yours', template: review.current, suffix: 'current' }, { title: view === 'source' ? 'Source update' : 'Your result · not applied', template: rightTemplate, suffix: view }].map((item) => <figure key={item.suffix} className="min-w-0 space-y-3">
              <figcaption className="text-center text-xs font-medium">{item.title}</figcaption>
              <div className="flex min-h-40 justify-center rounded-lg border bg-background/60 py-3">
                {item.template ? renderPreview(previewCard(item.template, item.suffix), back ? 'back' : 'front', previewWidth, highlightedElementId)
                  : <p className="px-3 py-8 text-center text-sm text-muted-foreground">Resolve the incompatible choices to see your result.</p>}
              </div>
            </figure>)}
          </div>
          {samples.length > 1 ? <label className="block text-xs text-muted-foreground">Preview using
            <select className="mt-1 w-full rounded border bg-background p-2 text-sm text-foreground" value={sampleId} onChange={(event) => setSampleId(event.target.value)}>
              {samples.map((card, index) => <option key={card.uniqueId} value={card.uniqueId}>{String(card.data.cardName || card.data.title || card.data.name || `Artifact ${index + 1}`)}</option>)}
            </select>
          </label> : <p className="text-xs text-muted-foreground">{sample ? 'Both designs use the same Artifact values.' : 'Template sample. No Artifact uses this design yet.'}</p>}
          {selectedChanges ? <p className="flex items-center gap-2 text-sm"><Layers className="h-4 w-4 shrink-0" aria-hidden="true" />{groupName(selectedChanges[0], review)}{highlightedElementId ? <span className="text-xs text-muted-foreground">· outlined where visible</span> : null}</p> : null}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">About this comparison</summary>
            <p className="mt-2">Comparing with “{review.incoming.name}”. This related revision may be earlier or parallel work, not necessarily a newer release. Only available snapshots are shown. Keep mine completes a decision; Defer leaves it for later.</p>
            {review.expectedReview ? <p className="mt-2">Recorded Keep mine choices are reused only for matching source content. Previously applied changes stay recorded; later local edits need a new choice.</p> : null}
          </details>
        </section>
        <section className="min-w-0 space-y-3 border-t p-4 sm:p-5 lg:border-l lg:border-t-0" aria-label="Choose changes">
          <div className="flex items-center justify-between gap-3"><h3 className="font-medium">Choose what to bring in</h3><span className="text-xs text-muted-foreground">{review.changes.length} {review.changes.length === 1 ? 'change' : 'changes'}</span></div>
          {groups.map(([group, changes], index) => {
            const active = activeGroup === group;
            const choiceSet = new Set(changes.map((change) => choices[change.key] ?? 'defer'));
            const groupChoice = choiceSet.size === 1 ? [...choiceSet][0] : null;
            return <div key={group} className={`overflow-hidden rounded-lg border ${active ? 'border-primary/60 bg-muted/20' : ''}`}>
              <button type="button" className="flex w-full items-center justify-between gap-2 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-expanded={active} aria-controls={`${id}-group-${index}`} onClick={() => setActiveGroup(active ? null : group)}>
                <span className="min-w-0"><span className="block break-words text-sm font-medium">{groupName(changes[0], review)}</span><span className="text-xs text-muted-foreground">{changes.length} {changes.length === 1 ? 'property' : 'properties'} · {groupChoice === 'keep' ? 'Keep mine' : groupChoice === 'use' ? 'Use update' : groupChoice === 'defer' ? 'Deferred' : 'Mixed choices'}</span></span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${active ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <div id={`${id}-group-${index}`} hidden={!active} className="space-y-3 border-t p-3">
                <fieldset disabled={busy}><legend className="sr-only">Choose for all properties in {groupName(changes[0], review)}</legend>
                  <div className="grid grid-cols-3 gap-1">{decisions.map(([decision, label]) => <Button key={decision} size="sm" variant={groupChoice === decision ? 'secondary' : 'outline'} aria-pressed={groupChoice === decision} onClick={() => choose(changes, decision)}>{label}</Button>)}</div>
                </fieldset>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Review individual properties</summary>
                  <div className="mt-3 space-y-4">{changes.map((change) => <fieldset key={change.key} disabled={busy} className="min-w-0 border-t pt-2">
                    <legend className="text-sm font-medium capitalize">{propertyName(change)}</legend>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 text-xs">
                      <div><span className="text-muted-foreground">Yours</span><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all">{displayValue(change.before)}</pre></div>
                      <ArrowRight className="mt-5 h-3 w-3" aria-hidden="true" />
                      <div><span className="text-muted-foreground">Source update</span><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all">{displayValue(change.after)}</pre></div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">{decisions.map(([decision, label]) => <label key={decision} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs">
                      <input type="radio" name={`${id}-decision-${change.key}`} checked={(choices[change.key] ?? 'defer') === decision} onChange={() => choose([change], decision)} />{label}
                    </label>)}</div>
                  </fieldset>)}</div>
                </details>
              </div>
            </div>;
          })}
          {!groups.length ? <p className="text-sm text-muted-foreground">No content differences remain. You can mark this revision reviewed.</p> : null}
        </section>
      </div>
      <div className="space-y-3 border-t bg-background px-5 py-4">
        {error || preview.error ? <p role="alert" className="text-sm text-destructive">{error ?? preview.error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p role="status" className="text-sm">{used} to use · {kept} to keep · {deferred} deferred</p><p className="mt-1 text-xs text-muted-foreground">Applies to this Set in this browser. Saving elsewhere is separate.</p></div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close}>{busy ? 'Cancel' : 'Close without applying'}</Button>
            <Button disabled={busy || Boolean(preview.error)} onClick={() => void applyReview()}>{busy ? 'Applying…' : used ? 'Apply choices' : deferred ? 'Record choices' : 'Mark reviewed'}</Button>
          </DialogFooter>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
