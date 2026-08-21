"use client";

import { Button } from '@/components/ui/button';
import { FieldHelp } from '@/features/developer-assets/components/DeveloperAssetHubUi';

export function ProfileOverrideField({
  label,
  ariaLabel,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
      {label}
      <input
        aria-label={ariaLabel}
        className="h-10 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] px-3 text-[var(--cf-accent-text)] placeholder:text-[#6f5b3a]"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
      />
    </label>
  );
}

export function NumberField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
      <span className="flex items-center justify-between gap-2">
        {label}
        <FieldHelp text={help} />
      </span>
      <input
        className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

export function CompactNumberField({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="h-10 w-full min-w-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]"
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  );
}

export function VoteWeightSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-4 border border-[#342719] bg-[var(--cf-surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">Owner vote weight</p>
          <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">
            1x keeps the owner equal with developers. Raise it only when owner taste should break close calls.
          </p>
        </div>
        <FieldHelp text="This changes owner vote impact during asset grading. It does not change whether contributors can vote on their own work." />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((weight) => (
          <Button
            key={weight}
            type="button"
            size="sm"
            variant="outline"
            className={[
              'rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)] hover:border-[var(--cf-accent)] hover:bg-[var(--cf-surface-hover)]',
              value === weight ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)] text-[var(--cf-text-strong)]' : '',
            ].join(' ')}
            onClick={() => onChange(weight)}
          >
            {weight}x
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ToggleField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-accent-text)]">
      <span className="flex items-center gap-2">
        {label}
        <FieldHelp text={help} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function DecisionCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#d9c28f]">{body}</p>
    </div>
  );
}
