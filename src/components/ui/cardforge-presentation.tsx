"use client";

import type { ElementType, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/shared/classNames';

export type CardForgeSurfaceTone = 'default' | 'inset' | 'raised';

export function CardForgeSurface({
  as: Component = 'div',
  children,
  className,
  tone = 'default',
  ...props
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  tone?: CardForgeSurfaceTone;
  [key: string]: unknown;
}) {
  return (
    <Component
      className={cn('cardforge-surface border', className)}
      data-tone={tone}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardForgeSectionIntro({
  eyebrow,
  title,
  body,
  className,
  titleAs: Title = 'h2',
}: {
  eyebrow: string;
  title: string;
  body: string;
  className?: string;
  titleAs?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <CardForgeSurface className={cn('p-5', className)}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{eyebrow}</p>
      <Title className="mt-1 font-serif text-2xl text-[var(--cf-text-strong)]">{title}</Title>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">{body}</p>
    </CardForgeSurface>
  );
}

const statusToneClass = {
  neutral: 'border-[var(--cf-border)] text-[var(--cf-text-muted)]',
  accent: 'border-[var(--cf-accent)] text-[var(--cf-accent-text)]',
  success: 'border-[var(--cf-success-border)] text-[var(--cf-success)]',
  warning: 'border-[var(--cf-warning-border)] text-[var(--cf-warning)]',
  danger: 'border-[var(--cf-danger-border)] text-[var(--cf-danger)]',
} as const;

export function CardForgeStatusBadge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof statusToneClass;
}) {
  return (
    <span className={cn('inline-flex border px-3 py-2 text-xs', statusToneClass[tone], className)}>
      {children}
    </span>
  );
}

export type CardForgeWorkspaceOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function CardForgeWorkspaceNavigation({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<CardForgeWorkspaceOption>;
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="grid gap-1 text-xs text-[var(--cf-text-muted)] sm:hidden">
        {label}
        <select
          aria-label={label}
          className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-sm text-[var(--cf-accent-text)]"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
          ))}
        </select>
      </label>
      <TabsList className="hidden h-auto flex-wrap justify-start gap-2 rounded-none border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 sm:flex">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="min-h-11 rounded-none border border-transparent px-4 py-2 text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-raised)] data-[state=active]:text-[var(--cf-accent-text)]"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}

export function CardForgeWorkspaceState({
  state,
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
}: {
  state: 'idle' | 'loading' | 'error';
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  const error = state === 'error';
  return (
    <CardForgeSurface
      className={cn(
        'min-h-48 p-5 text-sm',
        state === 'loading' && 'animate-pulse',
        error ? 'border-[var(--cf-danger-border)] text-[var(--cf-danger)]' : 'text-[var(--cf-text-muted)]',
        className,
      )}
      role={error ? 'alert' : 'status'}
    >
      <p>{message}</p>
      {error && onRetry ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </CardForgeSurface>
  );
}
