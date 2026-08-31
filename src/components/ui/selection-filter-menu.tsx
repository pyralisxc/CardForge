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

export type SelectionFilterOption<T extends string> = {
  label: string;
  value: T;
};

export function SelectionFilterMenu<T extends string>({
  allLabel,
  ariaLabel,
  className,
  compactLabel,
  onChange,
  options,
  value,
}: {
  allLabel: string;
  ariaLabel: string;
  className?: string;
  compactLabel?: string;
  onChange: (value: T | 'all') => void;
  options: SelectionFilterOption<T>[];
  value: T | 'all';
}) {
  const activeLabel = value === 'all'
    ? allLabel
    : options.find((option) => option.value === value)?.label ?? allLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={cn('justify-between gap-2', className)} aria-label={ariaLabel}>
          <ListFilter className="h-4 w-4 shrink-0" aria-hidden="true" />
          {compactLabel ? <span className="truncate sm:hidden">{compactLabel}</span> : null}
          <span className={cn('truncate', compactLabel && 'hidden sm:inline')}>{activeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={value === 'all'} onSelect={() => onChange('all')}>Clear all</DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value === option.value}
            onCheckedChange={() => onChange(value === option.value ? 'all' : option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
