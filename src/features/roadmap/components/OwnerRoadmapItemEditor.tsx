'use client';

import { useState, type FormEvent } from 'react';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { RoadmapAdminItem, RoadmapItem } from '@/features/roadmap/model/roadmap';

export function OwnerRoadmapItemEditor({ item, onSaved }: { item: RoadmapItem; onSaved: (item: RoadmapAdminItem) => void }) {
  const [open, setOpen] = useState(false);
  const draftFrom = (value: RoadmapItem) => ({ title: value.title, description: value.description ?? '', visibleMonth: value.visibleMonth,
    monthlyCost: value.monthlyCostCents === null ? '' : (value.monthlyCostCents / 100).toFixed(2),
    expenseProvider: value.expenseProvider ?? '', expensePlan: value.expensePlan ?? '', expenseSourceUrl: value.expenseSourceUrl ?? '', expenseVerifiedAt: value.expenseVerifiedAt ?? '', expenseState: value.expenseState ?? '' });
  const [draft, setDraft] = useState(() => draftFrom(item));
  const [revision, setRevision] = useState(item.updatedAt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const update = (name: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [name]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage('');
    try {
      const dollars = Number(draft.monthlyCost);
      if (item.itemType === 'roi_checkpoint' && (!/^\d+(\.\d{1,2})?$/.test(draft.monthlyCost) || !Number.isSafeInteger(Math.round(dollars * 100)))) throw new Error('Enter a valid monthly cost in dollars and cents.');
      const response = await fetch('/api/roadmap/items/' + encodeURIComponent(item.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        itemId: item.id, expectedUpdatedAt: revision, itemType: item.itemType, title: draft.title, description: draft.description, visibleMonth: draft.visibleMonth,
        ...(item.itemType === 'roi_checkpoint' ? { monthlyCostCents: Math.round(dollars * 100), expenseProvider: draft.expenseProvider, expensePlan: draft.expensePlan, expenseSourceUrl: draft.expenseSourceUrl, expenseVerifiedAt: draft.expenseVerifiedAt, expenseState: draft.expenseState || null } : {}),
      }) }).catch(() => { setOutcomeUnknown(true); throw new Error('The save outcome is unknown. Reload the Roadmap before trying again.'); });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save Roadmap details.'));
      const result = await response.json().catch(() => { setOutcomeUnknown(true); throw new Error('The save outcome is unknown. Reload the Roadmap before trying again.'); }) as { publication?: { value: RoadmapAdminItem; receipt: { committed: boolean; message: string } } };
      if (!result.publication?.receipt.committed) { setOutcomeUnknown(true); throw new Error('The save outcome is unknown. Reload the Roadmap before trying again.'); }
      setRevision(result.publication.value.updatedAt);
      onSaved(result.publication.value);
      setMessage(result.publication.receipt.message);
      setOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save Roadmap details.'); }
    finally { setSaving(false); }
  };
  if (!open) return <div className="mt-2"><button type="button" disabled={outcomeUnknown} className="underline text-xs disabled:opacity-50" onClick={() => { setDraft(draftFrom(item)); setRevision(item.updatedAt); setMessage(''); setOpen(true); }}>Edit {item.itemType === 'roi_checkpoint' ? 'cost details' : 'details'}</button>{message ? <p role="status" className="text-xs">{message}</p> : null}</div>;
  const field = 'w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2 text-sm';
  return <form onSubmit={save} className="mt-3 grid gap-2 border-t border-[var(--cf-border)] pt-3">
    <label className="text-xs">Title<input className={field} value={draft.title} onChange={e => update('title', e.target.value)} required /></label>
    <label className="text-xs">Description<textarea className={field} value={draft.description} maxLength={420} onChange={e => update('description', e.target.value)} /></label>
    <label className="text-xs">Month<input className={field} type="month" value={draft.visibleMonth} onChange={e => update('visibleMonth', e.target.value)} required /></label>
    {item.itemType === 'roi_checkpoint' ? <>
      <label className="text-xs">Expense status<select className={field} value={draft.expenseState} onChange={e => update('expenseState', e.target.value)}><option value="">Not classified</option><option value="current">Current recurring expense</option><option value="planned">Planned expense</option></select></label>
      <label className="text-xs">Monthly cost (USD)<input className={field} inputMode="decimal" value={draft.monthlyCost} onChange={e => update('monthlyCost', e.target.value)} required /></label>
      <label className="text-xs">Provider<input className={field} value={draft.expenseProvider} maxLength={80} onChange={e => update('expenseProvider', e.target.value)} required /></label>
      <label className="text-xs">Plan<input className={field} value={draft.expensePlan} maxLength={80} onChange={e => update('expensePlan', e.target.value)} required /></label>
      <label className="text-xs">Official pricing URL<input className={field} type="url" value={draft.expenseSourceUrl} onChange={e => update('expenseSourceUrl', e.target.value)} required /></label>
      <label className="text-xs">Price verified on<input className={field} type="date" value={draft.expenseVerifiedAt} onChange={e => update('expenseVerifiedAt', e.target.value)} required /></label>
    </> : null}
    {message ? <p role="status" className="text-xs">{message}</p> : null}
    <div className="flex gap-3 text-xs"><button type="submit" disabled={saving || outcomeUnknown} className="underline disabled:opacity-50">{saving ? 'Saving…' : 'Save details'}</button><button type="button" disabled={saving} onClick={() => setOpen(false)} className="underline">Cancel</button></div>
  </form>;
}
