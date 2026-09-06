"use client";

import { ListFilter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/classNames';

export type MultiSelectionFilterOption<T extends string> = { label: string; value: T };

/** A real checkbox filter: selections accumulate instead of replacing each other. */
export function MultiSelectionFilterMenu<T extends string>({
  allLabel,
  ariaLabel,
  className,
  compactLabel,
  onChange,
  options,
  values,
}: {
  allLabel: string;
  ariaLabel: string;
  className?: string;
  compactLabel?: string;
  onChange: (values: T[]) => void;
  options: MultiSelectionFilterOption<T>[];
  values: readonly T[];
}) {
  const valueSet = new Set(values);
  const selectedLabels = options.filter((option) => valueSet.has(option.value)).map((option) => option.label);
  const label = selectedLabels.length === 0 ? allLabel : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;
  const toggle = (value: T) => onChange(valueSet.has(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value]);

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" className={cn('justify-between gap-2', className)} aria-label={ariaLabel}>
        <ListFilter className="h-4 w-4 shrink-0" aria-hidden="true" />
        {compactLabel ? <span className="truncate sm:hidden">{compactLabel}</span> : null}
        <span className={cn('truncate', compactLabel && 'hidden sm:inline')}>{label}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem disabled={values.length === 0} onSelect={() => onChange([])}>Clear all</DropdownMenuItem>
      <DropdownMenuSeparator />
      {options.map((option) => <DropdownMenuCheckboxItem
        key={option.value}
        checked={valueSet.has(option.value)}
        onCheckedChange={() => toggle(option.value)}
      >{option.label}</DropdownMenuCheckboxItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
