"use client";

import { X } from 'lucide-react';

import type { ContentTaxonomyOption } from '@/features/developer-assets/lib/contentTaxonomy';

export function ControlledTaxonomySelect({
  label,
  selectedIds,
  options,
  onChange,
  emptyLabel = 'No classification selected.',
}: {
  label: string;
  selectedIds: string[];
  options: readonly ContentTaxonomyOption[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
}) {
  const selected = [...new Set(selectedIds.filter((id) => options.some((option) => option.id === id)))];
  const available = options.filter((option) => !selected.includes(option.id));

  return (
    <div className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
      <span>{label}</span>
      <select
        className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]"
        value=""
        onChange={(event) => {
          if (!event.target.value) return;
          onChange([...selected, event.target.value]);
        }}
      >
        <option value="">Add from CardForge taxonomy…</option>
        {available.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1 normal-case tracking-normal">
          {selected.map((id) => {
            const option = options.find((candidate) => candidate.id === id);
            if (!option) return null;
            return (
              <button
                key={id}
                type="button"
                className="inline-flex items-center gap-1 border border-[#5f4526] bg-[#15100a] px-2 py-1 text-[11px] text-[#ffe7ad]"
                title={option.description}
                onClick={() => onChange(selected.filter((candidate) => candidate !== id))}
              >
                {option.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <span className="pt-1 text-[10px] normal-case tracking-normal text-[#7f715c]">{emptyLabel}</span>
      )}
    </div>
  );
}
