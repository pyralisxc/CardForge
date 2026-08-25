import Link from 'next/link';

import { Button } from '@/components/ui/button';

export interface AccountHomeStatus {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
}

export function AccountHomeStatusRow({ status }: { status: AccountHomeStatus }) {
  return (
    <div className="grid gap-1 border-b border-[var(--cf-border-subtle)] py-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{status.label}</p>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--cf-text-strong)]">{status.value}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--cf-text-muted)]">{status.detail}</p>
      </div>
      <Button asChild size="sm" variant="ghost" className="mt-1 w-fit px-0 sm:mt-0 sm:px-3">
        <Link href={status.href}>{status.action}</Link>
      </Button>
    </div>
  );
}
