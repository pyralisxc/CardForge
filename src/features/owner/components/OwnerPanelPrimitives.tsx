import { Info } from 'lucide-react';

import { CardForgeSurface } from '@/components/ui/cardforge-presentation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function OwnerMetricTile({ label, value }: { label: string; value: string }) {
  return (
    <CardForgeSurface tone="inset" className="border-[var(--cf-border-subtle)] p-3">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{label}</span>
      <span className="mt-2 block text-lg font-semibold text-[var(--cf-accent-text)]">{value}</span>
    </CardForgeSurface>
  );
}

export function OwnerFieldHelp({ text, label }: { text: string; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 place-items-center border border-[var(--cf-border)] text-[var(--cf-accent)] hover:border-[var(--cf-accent)] hover:text-[var(--cf-text-strong)]"
          aria-label={label ?? `More information: ${text.slice(0, 80)}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">{text}</TooltipContent>
    </Tooltip>
  );
}

export const formatOwnerBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

export const formatOwnerDateTime = (value: string | null): string => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};