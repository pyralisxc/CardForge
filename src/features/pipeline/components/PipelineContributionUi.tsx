"use client";

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function FieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--cf-border)] text-[var(--cf-accent)] hover:border-[var(--cf-accent)] hover:text-[var(--cf-text-strong)]"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="min-w-0 bg-[var(--cf-surface-inset)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.62rem] uppercase leading-4 tracking-[0.14em] text-[var(--cf-text-subtle)]">{label}</p>
        <FieldHelp text={help} />
      </div>
      <p className="mt-1 text-xl font-semibold text-[var(--cf-accent-text)]">{value}</p>
    </div>
  );
}

export function ProgramRule({ label, value, body }: { label: string; value: number; body: string }) {
  return (
    <div className="border-b border-[var(--cf-border)] pb-3 last:border-b-0 md:border-b-0 md:border-r md:pb-0 md:pr-3 md:last:border-r-0">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--cf-accent-text)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">{body}</p>
    </div>
  );
}

export function GuidanceCard({
  eyebrow,
  title,
  body,
  tone = 'neutral',
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone?: 'neutral' | 'ready' | 'warning';
}) {
  const toneClass = tone === 'ready'
    ? 'border-[var(--cf-success-border)] bg-[#10180e]'
    : tone === 'warning'
      ? 'border-[#8a642f] bg-[#1b1309]'
      : 'border-[var(--cf-border)] bg-[var(--cf-surface-inset)]';

  return (
    <div className={`p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{eyebrow}</p>
      <h3 className="mt-2 font-serif text-lg text-[var(--cf-text-strong)]">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-[var(--cf-text-muted)]">{body}</p>
    </div>
  );
}

export function PipelineMetric({ label, value, body }: { label: string; value: string | number; body: string }) {
  return (
    <div className="grid gap-1 border-b border-[#2b2116] pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">{label}</span>
        <span className="font-semibold text-[var(--cf-accent-text)]">{value}</span>
      </div>
      <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">{body}</p>
    </div>
  );
}

export function GlossaryPanel({ title, items }: { title: string; items: Array<{ label: string; body: string }> }) {
  return (
    <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
      <h3 className="font-serif text-lg text-[var(--cf-text-strong)]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3">
            <p className="text-sm font-medium text-[var(--cf-accent-text)]">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QueueSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
      {label}
      <select
        className="min-h-10 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-sm normal-case tracking-normal text-[var(--cf-accent-text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
