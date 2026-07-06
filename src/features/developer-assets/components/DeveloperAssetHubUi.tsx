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
          className="grid h-6 w-6 shrink-0 place-items-center border border-[#5f4526] text-[#d7b469] hover:border-[#d8b365] hover:text-[#fff1c7]"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[#6d4f2b] bg-[#15100a] text-[#f7ead0]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
        <FieldHelp text={help} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p>
    </div>
  );
}

export function ProgramRule({ label, value, body }: { label: string; value: number; body: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#c7b288]">{body}</p>
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
    ? 'border-[#5f7f54] bg-[#10180e]'
    : tone === 'warning'
      ? 'border-[#8a642f] bg-[#1b1309]'
      : 'border-[#5f4526] bg-[#100c08]';

  return (
    <div className={`p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{eyebrow}</p>
      <h3 className="mt-2 font-serif text-lg text-[#fff1c7]">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-[#c7b288]">{body}</p>
    </div>
  );
}

export function PipelineMetric({ label, value, body }: { label: string; value: string | number; body: string }) {
  return (
    <div className="grid gap-1 border-b border-[#2b2116] pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.14em] text-[#a98a55]">{label}</span>
        <span className="font-semibold text-[#ffe7ad]">{value}</span>
      </div>
      <p className="text-xs leading-5 text-[#a98a55]">{body}</p>
    </div>
  );
}

export function GlossaryPanel({ title, items }: { title: string; items: Array<{ label: string; body: string }> }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <h3 className="font-serif text-lg text-[#fff1c7]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="border border-[#3c2c1b] bg-[#0c0b09] p-3">
            <p className="text-sm font-medium text-[#ffe7ad]">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#a98a55]">{item.body}</p>
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
    <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
      {label}
      <select
        className="min-h-10 border border-[#5f4526] bg-[#100c08] px-3 text-sm normal-case tracking-normal text-[#ffe7ad]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
