"use client";

import { useEffect, useState } from 'react';
import { Cloud, Sparkles } from 'lucide-react';

import type { McpAccountUsageSummary } from '@/features/mcp-usage/lib/mcpUsage';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const UsageBar = ({ value, limit }: { value: number; limit: number }) => {
  const percentage = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  return <div className="mt-2 h-2 overflow-hidden bg-[#2a2117]" aria-label={`${percentage}% used`}><div className="h-full bg-[var(--cf-accent)]" style={{ width: `${percentage}%` }} /></div>;
};

export function AccountMcpUsageSection() {
  const [usage, setUsage] = useState<McpAccountUsageSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setFailed(false);
    void fetch('/api/account/mcp-usage', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load usage.');
        return response.json() as Promise<McpAccountUsageSummary>;
      })
      .then((payload) => { if (mounted) setUsage(payload); })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [requestKey]);

  return (
    <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5" aria-labelledby="account-usage-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cf-accent)]">Plan &amp; usage</p>
          <h2 id="account-usage-heading" className="mt-1 font-serif text-2xl text-[var(--cf-text-strong)]">ChatGPT plugin and private workspace</h2>
        </div>
        <span className="border border-[var(--cf-success-border)] px-2 py-1 text-xs text-[var(--cf-success)]">Measurement only</span>
      </div>
      {failed ? (
        <div className="mt-4 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-4 text-sm text-[var(--cf-warning)]" role="alert">
          <p>Current assisted-work usage is temporarily unavailable. This does not limit local Studio work or change your plan.</p>
          <button
            type="button"
            className="mt-3 border border-current px-3 py-1.5 font-semibold"
            onClick={() => setRequestKey((current) => current + 1)}
          >
            Retry usage check
          </button>
        </div>
      ) : !usage ? <p className="mt-4 text-sm text-[var(--cf-text-muted)]" role="status">Loading current usage…</p> : (
        <>
          <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">CardForge’s ChatGPT plugin is included with your signed-in {usage.allowance.displayName} account. The capacity numbers below are planning targets while CardForge measures real usage; they are not enforced yet.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold text-[var(--cf-accent-text)]"><Sparkles className="h-4 w-4" />ChatGPT plugin actions</span><span className="text-sm text-[var(--cf-text-muted)]">{usage.monthlyActionUnits} / {usage.allowance.monthlyActionLimit}</span></div>
              <UsageBar value={usage.monthlyActionUnits} limit={usage.allowance.monthlyActionLimit} />
              <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">Today: {usage.dailyActionUnits} / {usage.allowance.dailySafetyLimit} planning target. Only successful creation actions through the ChatGPT plugin count; reads, previews, failures, and retries do not.</p>
            </div>
            <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold text-[var(--cf-accent-text)]"><Cloud className="h-4 w-4" />Private ChatGPT plugin workspace</span><span className="text-sm text-[var(--cf-text-muted)]">{formatBytes(usage.documentBytes)} / {formatBytes(usage.allowance.onlineStorageLimitBytes)}</span></div>
              <UsageBar value={usage.documentBytes} limit={usage.allowance.onlineStorageLimitBytes} />
              <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">{usage.documentCount} private ChatGPT plugin working document{usage.documentCount === 1 ? '' : 's'}. Normal Studio projects still remain in this browser.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
