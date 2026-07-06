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
    <label className="grid gap-1 text-xs text-[#c7b288]">
      {label}
      <input
        aria-label={ariaLabel}
        className="h-10 border border-[#3c2c1b] bg-[#15100a] px-3 text-[#ffe7ad] placeholder:text-[#6f5b3a]"
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
    <label className="grid gap-2 text-sm text-[#c7b288]">
      <span className="flex items-center justify-between gap-2">
        {label}
        <FieldHelp text={help} />
      </span>
      <input
        className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
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
      className="h-10 w-full min-w-24 border border-[#5f4526] bg-[#0c0b09] px-3 text-[#ffe7ad]"
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
    <div className="mt-4 border border-[#342719] bg-[#15100a] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#a98a55]">Owner vote weight</p>
          <p className="mt-2 text-xs leading-5 text-[#c7b288]">
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
              'rounded-none border-[#5f4526] bg-transparent text-[#f8e3b0] hover:border-[#d8b365] hover:bg-[#2a1b0d]',
              value === weight ? 'border-[#d8b365] bg-[#2a1b0d] text-[#fff1c7]' : '',
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
    <label className="flex items-center justify-between gap-4 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">
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
    <div className="border border-[#4a3823] bg-[#100c08] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#d9c28f]">{body}</p>
    </div>
  );
}
