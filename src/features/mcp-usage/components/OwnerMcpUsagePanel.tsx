"use client";

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { McpAllowance, McpOwnerUsageDashboard } from '@/features/mcp-usage/lib/mcpUsage';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

const bytesToMegabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));
const megabytesToBytes = (megabytes: number) => Math.round(megabytes * 1024 * 1024);
const formatBytes = (bytes: number) => {
  if (bytes < 1024 ** 2) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};
const formatDuration = (milliseconds: number) => milliseconds >= 60_000
  ? `${(milliseconds / 60_000).toFixed(1)} min`
  : `${(milliseconds / 1_000).toFixed(1)} sec`;

function AllowanceEditor({ allowance, onSaved }: { allowance: McpAllowance; onSaved: (dashboard: McpOwnerUsageDashboard) => void }) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(allowance.displayName);
  const [description, setDescription] = useState(allowance.description);
  const [featureSummary, setFeatureSummary] = useState(allowance.featureSummary);
  const [ctaLabel, setCtaLabel] = useState(allowance.ctaLabel);
  const [priceLabel, setPriceLabel] = useState(allowance.priceLabel);
  const [priceNote, setPriceNote] = useState(allowance.priceNote);
  const [isVisible, setIsVisible] = useState(allowance.isVisible);
  const [monthlyActionLimit, setMonthlyActionLimit] = useState<number | ''>(allowance.monthlyActionLimit);
  const [dailySafetyLimit, setDailySafetyLimit] = useState<number | ''>(allowance.dailySafetyLimit);
  const [storageMegabytes, setStorageMegabytes] = useState<number | ''>(bytesToMegabytes(allowance.onlineStorageLimitBytes));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (typeof monthlyActionLimit !== 'number' || typeof dailySafetyLimit !== 'number' || typeof storageMegabytes !== 'number') return;
    setSaving(true);
    try {
      const response = await fetch('/api/owner/mcp-usage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: allowance.planKey,
          displayName,
          description,
          featureSummary,
          ctaLabel,
          priceLabel,
          priceNote,
          isVisible,
          monthlyActionLimit,
          dailySafetyLimit,
          onlineStorageLimitBytes: megabytesToBytes(storageMegabytes),
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update allowance.'));
      const body = await response.json() as { dashboard: McpOwnerUsageDashboard };
      onSaved(body.dashboard);
      toast({ title: `${allowance.displayName} plan updated`, description: 'Plan presentation is live on the next relevant page visit; numeric capacity remains observation-only.' });
    } catch (error) {
      toast({ title: 'Allowance update failed', description: error instanceof Error ? error.message : 'Unable to update allowance.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="border border-[#3c2c1b] bg-[#100c08] p-4">
      <div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-[#ffe7ad]">{displayName || allowance.planKey}</h4><span className="text-xs uppercase tracking-[0.12em] text-[#8f7b57]">{allowance.planKey}</span></div>
      {allowance.planKey === 'enterprise' ? <p className="mt-2 text-xs leading-5 text-[#a98a75]">Business Solutions is always inquiry-led. These fields control how that invitation appears; they never create a self-serve business entitlement.</p> : null}
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs text-[#c7b288]">Plan name<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="grid gap-1 text-xs text-[#c7b288]">Plan description<textarea className="min-h-24 resize-y border border-[#5f4526] bg-[#15100a] p-3 text-[#fff1c7]" maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="grid gap-1 text-xs text-[#c7b288]">Feature lines <span className="text-[#8f7b57]">One feature per line</span><textarea className="min-h-28 resize-y border border-[#5f4526] bg-[#15100a] p-3 text-[#fff1c7]" maxLength={1200} value={featureSummary} onChange={(event) => setFeatureSummary(event.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-[#c7b288]">Price label<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" maxLength={40} value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} /></label>
          <label className="grid gap-1 text-xs text-[#c7b288]">Price note<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" maxLength={80} value={priceNote} onChange={(event) => setPriceNote(event.target.value)} /></label>
        </div>
        <label className="grid gap-1 text-xs text-[#c7b288]">Action label<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" maxLength={80} value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} /></label>
        <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#15100a] p-3 text-sm text-[#ffe7ad]">Show this choice<input type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} /></label>
        <p className="text-xs leading-5 text-[#8f7b57]">ChatGPT plugin access is included for signed-in personal accounts. Action and private plugin workspace values below are observation targets, not enforced quotas.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs text-[#c7b288]">Monthly actions<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" type="number" min="0" max="1000000" value={monthlyActionLimit} onChange={(event) => setMonthlyActionLimit(event.target.value === '' ? '' : event.target.valueAsNumber)} /></label>
        <label className="grid gap-1 text-xs text-[#c7b288]">Daily safety target<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" type="number" min="0" max="100000" value={dailySafetyLimit} onChange={(event) => setDailySafetyLimit(event.target.value === '' ? '' : event.target.valueAsNumber)} /></label>
        <label className="grid gap-1 text-xs text-[#c7b288]">Online storage (MB)<input className="min-h-11 border border-[#5f4526] bg-[#15100a] px-3 text-[#fff1c7]" type="number" min="0" max="104857600" value={storageMegabytes} onChange={(event) => setStorageMegabytes(event.target.value === '' ? '' : event.target.valueAsNumber)} /></label>
      </div>
      <Button type="button" size="sm" className="mt-4" disabled={saving || !displayName.trim() || !description.trim() || !featureSummary.trim() || !priceLabel.trim() || !priceNote.trim() || !ctaLabel.trim() || [monthlyActionLimit, dailySafetyLimit, storageMegabytes].some((value) => typeof value !== 'number' || !Number.isFinite(value))} onClick={() => void save()}>{saving ? 'Saving…' : 'Save plan'}</Button>
    </article>
  );
}

export function OwnerMcpUsagePanel() {
  const [dashboard, setDashboard] = useState<McpOwnerUsageDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/owner/mcp-usage', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load MCP usage.'));
      setDashboard(await response.json() as McpOwnerUsageDashboard);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load MCP usage.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <section className="border border-[#7d3d32] bg-[#1b0d09] p-5 text-sm text-[#ffd0c6]"><p>{error}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void load()}>Retry</Button></section>;
  if (!dashboard) return <section className="min-h-48 animate-pulse border border-[#5f4526] bg-[#15100a] p-5 text-sm text-[#c7b288]" role="status">Loading MCP usage…</section>;

  const metrics = [
    ['Assisted actions', dashboard.summary.monthlyActionUnits.toLocaleString()],
    ['Tool calls', dashboard.summary.toolCalls.toLocaleString()],
    ['Active accounts', dashboard.summary.activeUsers.toLocaleString()],
    ['Failures', dashboard.summary.failedCalls.toLocaleString()],
    ['Request data', formatBytes(dashboard.summary.requestBytes)],
    ['Response data', formatBytes(dashboard.summary.responseBytes)],
    ['Tool runtime', formatDuration(dashboard.summary.durationMs)],
    ['Private documents', dashboard.summary.documentCount.toLocaleString()],
    ['Document data', formatBytes(dashboard.summary.documentBytes)],
  ] as const;
  return (
    <section className="space-y-4" aria-labelledby="owner-mcp-usage-heading">
      <div className="border border-[#5f4526] bg-[#15100a] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[#d8b365]">MCP capacity</p><h3 id="owner-mcp-usage-heading" className="mt-1 font-serif text-2xl text-[#fff1c7]">Plans, usage, and online storage</h3></div><span className="border border-[#5f7f54] px-2 py-1 text-xs text-[#bde3a8]">Signed-in access</span></div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#c7b288]">This is the source of truth for plan names, prices, descriptions, visible choices, action labels, and capacity targets. CardForge records daily totals without prompts or card content in the usage table. ChatGPT plugin access follows account sign-in; capacity values remain measurement-only and create no overage charge.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="border border-[#3c2c1b] bg-[#100c08] p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[#8f7b57]">{label}</span><strong className="mt-1 block text-xl text-[#ffe7ad]">{value}</strong></div>)}</div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">{dashboard.allowances.map((allowance) => <AllowanceEditor key={allowance.planKey} allowance={allowance} onSaved={setDashboard} />)}</div>
    </section>
  );
}
