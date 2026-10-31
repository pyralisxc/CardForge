"use client";

import { useRef, type RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function EnvironmentSearch({ id, label, value, onChange, inputRef, disabled = false }: {
  id?: string; label: string; value: string; onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement>; disabled?: boolean;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  return <div className="relative min-w-0 w-full">
    <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-subtle)] max-sm:hidden" />
    <Input id={id} ref={ref} type="search" aria-label={label} placeholder={label} disabled={disabled} value={value} onChange={event => onChange(event.target.value)} className="h-11 min-w-0 w-full pl-8 pr-11 max-sm:pl-2 [&::-webkit-search-cancel-button]:appearance-none" />
    {value ? <button type="button" aria-label={`Clear ${label.toLowerCase()}`} disabled={disabled} onClick={() => { onChange(''); ref.current?.focus(); }} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[var(--cf-text-muted)]"><X aria-hidden="true" size={16} /></button> : null}
  </div>;
}
