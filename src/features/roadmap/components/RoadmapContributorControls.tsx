"use client";

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Database, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { RoadmapItemType, RoadmapStatus } from '@/features/roadmap/model/roadmap';
import {
  isRoadmapContributorFormComplete,
  type RoadmapContributorFormState,
} from '@/features/roadmap/components/RoadmapContributorControlsModel';

interface RoadmapContributorControlsProps {
  form: RoadmapContributorFormState;
  isContributor: boolean;
  isOwner: boolean;
  isSaving: boolean;
  onChange: Dispatch<SetStateAction<RoadmapContributorFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function RoadmapContributorControls({
  form,
  isContributor,
  isOwner,
  isSaving,
  onChange,
  onSubmit,
}: RoadmapContributorControlsProps) {
  if (!isContributor) return null;

  return (
    <form className="mt-6 border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-4" onSubmit={onSubmit}>
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
        <Database className="h-5 w-5" />
        <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Roadmap publishing controls</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
        {isOwner
          ? 'Expense checkpoints require the provider, plan, monthly cost, official pricing page, and verification date. Shipped progress carries no invented expense.'
          : 'Publish shipped Chronicle progress here. Verified financial checkpoints remain owner-only.'}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
          value={form.title}
          placeholder="Timeline title"
          aria-label="Timeline title"
          maxLength={200}
          onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
        />
        <input
          className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
          value={form.visibleMonth}
          placeholder="YYYY-MM"
          aria-label="Visible month"
          pattern="\d{4}-\d{2}"
          onChange={(event) => onChange((current) => ({ ...current, visibleMonth: event.target.value }))}
        />
        <select
          className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
          value={form.itemType}
          onChange={(event) => onChange((current) => ({
            ...current,
            itemType: event.target.value as Exclude<RoadmapItemType, 'feature'>,
          }))}
        >
          {isOwner ? <option value="roi_checkpoint">Planned service upgrade</option> : null}
          <option value="shipped_update">Shipped product update</option>
        </select>
        <select
          className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
          value={form.status}
          onChange={(event) => onChange((current) => ({
            ...current,
            status: event.target.value as RoadmapStatus,
          }))}
        >
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="testing">Testing</option>
          <option value="shipped">Shipped</option>
        </select>
        <input
          className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
          value={form.monthlyCostDollars}
          placeholder="New monthly operating cost dollars"
          aria-label="New monthly operating cost in dollars"
          inputMode="numeric"
          disabled={form.itemType !== 'roi_checkpoint'}
          onChange={(event) => onChange((current) => ({ ...current, monthlyCostDollars: event.target.value }))}
        />
        {form.itemType === 'roi_checkpoint' ? (
          <>
            <input
              className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
              value={form.expenseProvider}
              placeholder="Provider, e.g. Supabase"
              aria-label="Expense provider"
              maxLength={80}
              onChange={(event) => onChange((current) => ({ ...current, expenseProvider: event.target.value }))}
            />
            <input
              className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
              value={form.expensePlan}
              placeholder="Plan, e.g. Pro"
              aria-label="Provider plan"
              maxLength={80}
              onChange={(event) => onChange((current) => ({ ...current, expensePlan: event.target.value }))}
            />
            <input
              className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)] md:col-span-2"
              value={form.expenseSourceUrl}
              placeholder="Official HTTPS pricing URL"
              aria-label="Official pricing URL"
              type="url"
              onChange={(event) => onChange((current) => ({ ...current, expenseSourceUrl: event.target.value }))}
            />
            <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
              Pricing verified
              <input
                className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]"
                value={form.expenseVerifiedAt}
                type="date"
                onChange={(event) => onChange((current) => ({ ...current, expenseVerifiedAt: event.target.value }))}
              />
            </label>
          </>
        ) : null}
        <textarea
          className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)] md:col-span-2"
          value={form.description}
          placeholder="What this unlocks for users and why the cost is worth it"
          maxLength={420}
          onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
        />
      </div>
      <Button
        type="submit"
        className="mt-4 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"
        disabled={isSaving || !isRoadmapContributorFormComplete(form)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add roadmap item
      </Button>
    </form>
  );
}
