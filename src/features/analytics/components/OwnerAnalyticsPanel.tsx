"use client";

import { Activity, BarChart3, Copy, ExternalLink, MousePointer2, RefreshCw, Route, Search, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { buildOrganicCampaignUrl, type AnalyticsMetricRow, type OwnerAnalyticsSnapshot } from '../model';
import { useOwnerAnalytics } from '../hooks/useOwnerAnalytics';

const tabClassName = 'rounded-none border border-transparent px-3 py-2 text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-hover)] data-[state=active]:text-[var(--cf-accent-text)]';
const inputClassName = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';

const formatNumber = (value: number) => new Intl.NumberFormat().format(Math.round(value));
const formatPercent = (value: number) => `${(value * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`;
const formatPosition = (value: number) => value > 0 ? value.toFixed(1) : '—';
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';

function MetricTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4"><span className="text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">{label}</span><strong className="mt-2 block font-serif text-2xl text-[var(--cf-accent-text)]">{value}</strong>{note ? <span className="mt-1 block text-xs text-[var(--cf-text-subtle)]">{note}</span> : null}</div>;
}

function RankedList({ title, rows, empty, available, source = 'Google' }: { title: string; rows: AnalyticsMetricRow[]; empty: string; available: boolean; source?: string }) {
  const maximum = Math.max(...rows.map(({ value }) => value), 1);
  return (
    <section className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
      <h3 className="font-serif text-lg text-[var(--cf-text-strong)]">{title}</h3>
      {!available ? <p className="mt-3 text-sm text-[var(--cf-warning)]">This {source} report is temporarily unavailable.</p> : rows.length === 0 ? <p className="mt-3 text-sm text-[var(--cf-text-subtle)]">{empty}</p> : <ol className="mt-4 space-y-3">{rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-[#d9c6a1]">{row.label}</span><span className="text-[var(--cf-accent-text)]">{formatNumber(row.value)}</span></div>
          <div className="mt-1 h-1.5 bg-[#2a2015]"><div className="h-full bg-[var(--cf-accent)]" style={{ width: `${Math.max(3, row.value / maximum * 100)}%` }} /></div>
        </li>
      ))}</ol>}
    </section>
  );
}

function ConfigurationNotice({ snapshot }: { snapshot: OwnerAnalyticsSnapshot }) {
  const { configuration } = snapshot;
  const isLive = configuration.collectionEnabled
    && configuration.reportingConfigured
    && configuration.searchConsoleConfigured
    && configuration.interactionCollectionConfigured
    && configuration.interactionReportingConfigured;
  return (
    <section className={`border p-4 ${isLive ? 'border-[#557a45] bg-[#10190d]' : 'border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)]'}`}>
      <h3 className="font-serif text-lg text-[var(--cf-text-strong)]">{isLive ? 'Consent-gated analytics is live' : 'Analytics setup incomplete'}</h3>
      <p className="mt-2 text-sm leading-6 text-[#d8be8d]">{isLive
        ? 'Google acquisition and search reporting plus anonymous PostHog interaction reporting are active. Browser measurement still loads only after a visitor chooses Accept or Accept once; PostHog receives selected events, never page recordings.'
        : 'Collection remains gated until the privacy publication, public measurement flag, and read-only Google and PostHog reporting configuration are all ready.'}</p>
      {configuration.missing.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{configuration.missing.map((name) => <code key={name} className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-2 py-1 text-xs text-[var(--cf-warning)]">{name}</code>)}</div> : null}
    </section>
  );
}

function InteractionView({ snapshot }: { snapshot: OwnerAnalyticsSnapshot }) {
  const formatEventName = (value: string) => value.replaceAll('_', ' ').replace(/^./u, (letter) => letter.toUpperCase());
  return <div className="space-y-4">
    <div className="grid gap-3 sm:max-w-md">
      <MetricTile label="Interacting now" value={snapshot.availability.interactionLive ? formatNumber(snapshot.interactions.activeVisitors) : '—'} note="Anonymous visitors · previous 5 minutes" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <RankedList title="Actions · previous 24 hours" rows={snapshot.interactions.events} empty="No consented interactions have arrived yet." available={snapshot.availability.interactionEvents} source="PostHog" />
      <RankedList title="Active paths · previous 24 hours" rows={snapshot.interactions.paths} empty="No consented page activity has arrived yet." available={snapshot.availability.interactionPaths} source="PostHog" />
    </div>
    <section className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-serif text-lg text-[var(--cf-text-strong)]">Recent interaction stream</h3><p className="mt-1 text-sm text-[var(--cf-text-subtle)]">Allow-listed action, path, and non-sensitive context only. No names, emails, card content, or visitor identifiers.</p></div><span className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">Previous 30 minutes</span></div>
      {!snapshot.availability.interactionRecent ? <p className="mt-4 text-sm text-[var(--cf-warning)]">The PostHog recent-activity report is temporarily unavailable.</p> : snapshot.interactions.recentEvents.length === 0 ? <p className="mt-4 text-sm text-[var(--cf-text-subtle)]">No consented interactions are in the live window.</p> : <ol className="mt-4 divide-y divide-[#352716] border border-[#352716] bg-[var(--cf-canvas)]">{snapshot.interactions.recentEvents.map((event, index) => <li key={`${event.occurredAt}:${event.eventName}:${index}`} className="grid gap-1 px-3 py-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"><time className="text-xs text-[var(--cf-text-subtle)]" dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time><strong className="text-[var(--cf-accent-text)]">{formatEventName(event.eventName)}</strong><span className="min-w-0 truncate text-[var(--cf-text-muted)]" title={`${event.path}${event.detail ? ` · ${event.detail}` : ''}`}>{event.path}{event.detail ? ` · ${event.detail}` : ''}</span></li>)}</ol>}
    </section>
  </div>;
}

function LiveView({ snapshot }: { snapshot: OwnerAnalyticsSnapshot }) {
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricTile label="Active now" value={snapshot.availability.realtime ? formatNumber(snapshot.realtime.activeUsers) : '—'} note={snapshot.availability.realtime ? 'Previous 30 minutes' : 'Report unavailable'} />
      <MetricTile label={`${snapshot.rangeDays}-day users`} value={snapshot.availability.overview ? formatNumber(snapshot.overview.users) : '—'} />
      <MetricTile label="Sessions" value={snapshot.availability.overview ? formatNumber(snapshot.overview.sessions) : '—'} />
      <MetricTile label="Page views" value={snapshot.availability.overview ? formatNumber(snapshot.overview.pageViews) : '—'} />
      <MetricTile label="Conversions" value={snapshot.availability.overview ? formatNumber(snapshot.overview.keyEvents) : '—'} note="GA4 key events" />
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <RankedList title="Pages active now" rows={snapshot.realtime.pages} empty="No visitors are active right now." available={snapshot.availability.realtimePages} />
      <RankedList title="Events active now" rows={snapshot.realtime.events} empty="No consented events have arrived in the realtime window." available={snapshot.availability.realtimeEvents} />
      <RankedList title="Devices active now" rows={snapshot.realtime.devices} empty="No active devices are available." available={snapshot.availability.realtimeDevices} />
    </div>
  </div>;
}

function CampaignLinkBuilder({ publicAppUrl }: { publicAppUrl: string }) {
  const { toast } = useToast();
  const [destinationUrl, setDestinationUrl] = useState(publicAppUrl);
  const [source, setSource] = useState('threads');
  const [campaign, setCampaign] = useState('creator_launch');
  const [content, setContent] = useState('feature_preview_01');
  const result = useMemo(() => {
    try {
      return { link: buildOrganicCampaignUrl({ destinationUrl, source, campaign, content }), error: null };
    } catch (error) {
      return { link: '', error: error instanceof Error ? error.message : 'Unable to build link.' };
    }
  }, [campaign, content, destinationUrl, source]);
  const copy = async () => {
    if (!result.link) return;
    await navigator.clipboard.writeText(result.link);
    toast({ title: 'Tracked link copied', description: 'Paste it into the matching organic post.' });
  };
  return (
    <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4">
      <div className="flex items-center gap-2"><Route className="h-5 w-5 text-[var(--cf-accent)]" /><div><h3 className="font-serif text-lg text-[var(--cf-text-strong)]">Organic tracking link</h3><p className="text-sm text-[var(--cf-text-subtle)]">Give every Facebook or Threads post a stable campaign identity.</p></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">Destination<input className={`${inputClassName} mt-2 normal-case`} value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} /></label>
        <label className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">Source<input className={`${inputClassName} mt-2 normal-case`} value={source} onChange={(event) => setSource(event.target.value)} placeholder="threads or facebook" /></label>
        <label className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">Campaign<input className={`${inputClassName} mt-2 normal-case`} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="creator_launch" /></label>
        <label className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">Post label<input className={`${inputClassName} mt-2 normal-case`} value={content} onChange={(event) => setContent(event.target.value)} placeholder="group_post_01" /></label>
      </div>
      <div className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3"><p className="break-all text-sm text-[#d9c6a1]">{result.error ?? result.link}</p></div>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={copy} disabled={!result.link}><Copy className="mr-2 h-4 w-4" />Copy link</Button>{result.link ? <Button asChild variant="outline"><a href={result.link} target="_blank" rel="noreferrer">Open destination <ExternalLink className="ml-2 h-4 w-4" /></a></Button> : null}</div>
    </section>
  );
}

function CampaignView({ snapshot, publicAppUrl }: { snapshot: OwnerAnalyticsSnapshot; publicAppUrl: string }) {
  return <div className="space-y-4"><CampaignLinkBuilder publicAppUrl={publicAppUrl} /><section className="overflow-x-auto border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4"><h3 className="font-serif text-lg text-[var(--cf-text-strong)]">Organic campaign results</h3>{!snapshot.availability.campaigns ? <p className="mt-3 text-sm text-[var(--cf-warning)]">The GA4 campaign report is temporarily unavailable.</p> : snapshot.campaigns.length === 0 ? <p className="mt-3 text-sm text-[var(--cf-text-subtle)]">Tracked organic visits will appear here after collection is enabled and links are shared.</p> : <table className="mt-4 min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]"><tr><th className="pb-2 pr-4">Source</th><th className="pb-2 pr-4">Campaign</th><th className="pb-2 pr-4">Post</th><th className="pb-2 pr-4">Sessions</th><th className="pb-2 pr-4">Users</th><th className="pb-2">Conversions</th></tr></thead><tbody>{snapshot.campaigns.map((row) => <tr key={`${row.source}:${row.campaign}:${row.content}`} className="border-t border-[#352716] text-[#d9c6a1]"><td className="py-3 pr-4">{row.source}</td><td className="py-3 pr-4">{row.campaign}</td><td className="py-3 pr-4">{row.content}</td><td className="py-3 pr-4">{formatNumber(row.sessions)}</td><td className="py-3 pr-4">{formatNumber(row.users)}</td><td className="py-3">{formatNumber(row.keyEvents)}</td></tr>)}</tbody></table>}</section></div>;
}

function JourneyView({ snapshot }: { snapshot: OwnerAnalyticsSnapshot }) {
  const first = Math.max(snapshot.journey[0]?.users ?? 0, 1);
  return <section className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4"><h3 className="font-serif text-lg text-[var(--cf-text-strong)]">Creator activity</h3><p className="mt-1 text-sm text-[var(--cf-text-subtle)]">Independent adoption signals across the last {snapshot.rangeDays} days. These are not an ordered cohort funnel.</p>{!snapshot.availability.journey ? <p className="mt-4 text-sm text-[var(--cf-warning)]">The GA4 journey report is temporarily unavailable.</p> : <ol className="mt-5 space-y-3">{snapshot.journey.map((step, index) => <li key={step.eventName} className="grid gap-3 border border-[#352716] bg-[var(--cf-canvas)] p-3 sm:grid-cols-[2rem_1fr_auto_auto] sm:items-center"><span className="grid h-8 w-8 place-items-center border border-[var(--cf-border-strong)] text-sm text-[var(--cf-accent-text)]">{index + 1}</span><div><strong className="text-[var(--cf-text)]">{step.label}</strong><div className="mt-2 h-1.5 bg-[#2a2015]"><div className="h-full bg-[var(--cf-accent)]" style={{ width: `${Math.max(step.users > 0 ? 3 : 0, step.users / first * 100)}%` }} /></div></div><span className="text-sm text-[#d9c6a1]">{formatNumber(step.users)} users</span><span className="text-sm text-[var(--cf-text-subtle)]">{formatNumber(step.events)} events</span></li>)}</ol>}</section>;
}

function SearchView({ snapshot }: { snapshot: OwnerAnalyticsSnapshot }) {
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricTile label="Google clicks" value={snapshot.availability.search ? formatNumber(snapshot.search.clicks) : '—'} /><MetricTile label="Impressions" value={snapshot.availability.search ? formatNumber(snapshot.search.impressions) : '—'} /><MetricTile label="CTR" value={snapshot.availability.search ? formatPercent(snapshot.search.ctr) : '—'} /><MetricTile label="Average position" value={snapshot.availability.search ? formatPosition(snapshot.search.position) : '—'} /></div>{snapshot.search.sitemap ? <section className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-serif text-lg text-[var(--cf-text-strong)]">Sitemap · {snapshot.search.sitemap.status}</h3><p className="mt-1 text-sm text-[var(--cf-text-subtle)]">Last read {formatDate(snapshot.search.sitemap.lastDownloaded)} · {snapshot.search.sitemap.errors} errors · {snapshot.search.sitemap.warnings} warnings</p></div><Button asChild variant="outline"><a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Open Search Console <ExternalLink className="ml-2 h-4 w-4" /></a></Button></div></section> : !snapshot.availability.sitemap ? <p className="border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3 text-sm text-[var(--cf-warning)]">The sitemap report is temporarily unavailable.</p> : null}<div className="grid gap-4 lg:grid-cols-2"><SearchTable title="Search queries" rows={snapshot.search.queries} available={snapshot.availability.searchQueries} /><SearchTable title="Search pages" rows={snapshot.search.pages} available={snapshot.availability.searchPages} /></div></div>;
}

function SearchTable({ title, rows, available }: { title: string; rows: OwnerAnalyticsSnapshot['search']['queries']; available: boolean }) {
  return <section className="overflow-x-auto border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4"><h3 className="font-serif text-lg text-[var(--cf-text-strong)]">{title}</h3>{!available ? <p className="mt-3 text-sm text-[var(--cf-warning)]">This Search Console report is temporarily unavailable.</p> : rows.length === 0 ? <p className="mt-3 text-sm text-[var(--cf-text-subtle)]">Search Console has no data for this date range yet.</p> : <table className="mt-4 min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]"><tr><th className="pb-2 pr-4">Result</th><th className="pb-2 pr-4">Clicks</th><th className="pb-2 pr-4">Impressions</th><th className="pb-2">Position</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label} className="border-t border-[#352716] text-[#d9c6a1]"><td className="max-w-xs truncate py-3 pr-4" title={row.label}>{row.label}</td><td className="py-3 pr-4">{formatNumber(row.clicks)}</td><td className="py-3 pr-4">{formatNumber(row.impressions)}</td><td className="py-3">{formatPosition(row.position)}</td></tr>)}</tbody></table>}</section>;
}

export function OwnerAnalyticsPanel({ publicAppUrl }: { publicAppUrl: string }) {
  const { error, isLoading, refresh, snapshot } = useOwnerAnalytics();
  if (!snapshot && isLoading) return <div className="min-h-72 animate-pulse border border-[var(--cf-border)] bg-[var(--cf-surface)]" />;
  if (!snapshot) return <section className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-5 text-[var(--cf-danger)]"><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">Analytics unavailable</h2><p className="mt-2 text-sm">{error ?? 'Unable to load analytics.'}</p><Button type="button" className="mt-4" onClick={() => void refresh()}>Try again</Button></section>;
  return (
    <div className="space-y-4">
      <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><BarChart3 className="h-6 w-6 text-[var(--cf-accent)]" /><div><p className="text-xs uppercase tracking-[0.18em] text-[var(--cf-text-subtle)]">Owner-only measurement</p><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Organic Analytics</h2><p className="mt-1 text-sm text-[var(--cf-text-muted)]">Review consented visitor activity, organic campaign results, creator actions, and Google Search performance.</p></div></div><div className="text-right"><Button type="button" variant="outline" onClick={() => void refresh()} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button><p className="mt-2 text-xs text-[var(--cf-text-subtle)]">Updated {formatDate(snapshot.capturedAt)} · auto-refreshes every minute</p></div></div>{error ? <p className="mt-3 border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]">{error}</p> : null}{snapshot.warnings.map((warning) => <p key={warning} className="mt-3 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3 text-sm text-[var(--cf-warning)]">{warning}</p>)}</section>
      <ConfigurationNotice snapshot={snapshot} />
      <Tabs defaultValue="live" className="space-y-4"><TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2"><TabsTrigger value="live" className={tabClassName}><Activity className="mr-2 h-4 w-4" />Live</TabsTrigger><TabsTrigger value="interactions" className={tabClassName}><MousePointer2 className="mr-2 h-4 w-4" />Interactions</TabsTrigger><TabsTrigger value="campaigns" className={tabClassName}><Share2 className="mr-2 h-4 w-4" />Campaigns</TabsTrigger><TabsTrigger value="journey" className={tabClassName}><Route className="mr-2 h-4 w-4" />Creator activity</TabsTrigger><TabsTrigger value="search" className={tabClassName}><Search className="mr-2 h-4 w-4" />Search</TabsTrigger></TabsList><TabsContent value="live" className="mt-0"><LiveView snapshot={snapshot} /></TabsContent><TabsContent value="interactions" className="mt-0"><InteractionView snapshot={snapshot} /></TabsContent><TabsContent value="campaigns" className="mt-0"><CampaignView snapshot={snapshot} publicAppUrl={publicAppUrl} /></TabsContent><TabsContent value="journey" className="mt-0"><JourneyView snapshot={snapshot} /></TabsContent><TabsContent value="search" className="mt-0"><SearchView snapshot={snapshot} /></TabsContent></Tabs>
    </div>
  );
}
