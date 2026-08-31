"use client";

import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Rocket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  OwnerBusinessIdentityPanel,
  type BusinessIdentityInput,
} from '@/features/business-identity/client';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';
import { formatOwnerBytes, OwnerFieldHelp, OwnerMetricTile } from './OwnerPanelPrimitives';

type OwnerReadinessPayload = Pick<OwnerConsolePayload, 'businessIdentity' | 'roadmapItems' | 'databaseMetrics'>;

const roadmapStatusLabels: Record<OwnerConsolePayload['roadmapItems'][number]['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  testing: 'Testing',
  shipped: 'Completed',
  archived_negative_signal: 'Archived',
};

export function OwnerReadinessPanel({
  consolePayload,
  onConsoleChange,
  view = 'all',
  compactRoadmap = false,
  onOpenRoadmap,
}: {
  consolePayload: OwnerReadinessPayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
  view?: 'all' | 'identity' | 'health' | 'roadmap';
  compactRoadmap?: boolean;
  onOpenRoadmap?: () => void;
}) {
  const { toast } = useToast();
  const [roadmapItems, setRoadmapItems] = useState(consolePayload.roadmapItems);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    setRoadmapItems(consolePayload.roadmapItems);
  }, [consolePayload.roadmapItems]);

  const saveBusinessIdentity = async (
    businessIdentity: BusinessIdentityInput,
    expectedIdentityVersion: number,
  ) => {
    const next = await updateOwnerConsole({
      kind: 'businessIdentity',
      businessIdentity,
      expectedIdentityVersion,
    }, 'Unable to save business identity.');
    onConsoleChange(next);
  };

  const updateRoadmapStatus = async (itemId: string, status: OwnerConsolePayload['roadmapItems'][number]['status']) => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({ kind: 'roadmapStatus', roadmapItem: { itemId, status } }, 'Unable to update roadmap checkpoint.');
      onConsoleChange(next);
      setRoadmapItems(next.roadmapItems);
      toast({ title: status === 'shipped' ? 'Checkpoint completed' : 'Checkpoint updated', description: 'The public roadmap now reflects the new status.' });
    } catch (error) {
      toast({ title: 'Roadmap not updated', description: error instanceof Error ? error.message : 'Unable to update roadmap checkpoint.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const metrics = consolePayload.databaseMetrics;
  const officialFeatureCount = roadmapItems.filter((item) => item.itemType === 'feature').length;
  const officialCheckpointCount = roadmapItems.length - officialFeatureCount;
  const activeRoadmapItems = roadmapItems.filter((item) => (
    item.status !== 'shipped' && item.status !== 'archived_negative_signal'
  ));
  const visibleRoadmapItems = compactRoadmap ? activeRoadmapItems.slice(0, 3) : roadmapItems;
  const renderRoadmapItem = (item: OwnerConsolePayload['roadmapItems'][number]) => (
    <div key={item.id} className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div><p className="font-medium text-[var(--cf-accent-text)]">{item.title}</p><p className="mt-1 text-xs text-[var(--cf-text-subtle)]">{roadmapStatusLabels[item.status]} / {item.itemType.replace('_', ' ')} / {item.visibleMonth}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">{item.description}</p> : null}</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'planned')}>Plan</Button>
        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'in_progress')}>Start</Button>
        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'testing')}>Test</Button>
        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'shipped')}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Complete</Button>
      </div>
    </div>
  );
  return (
    <div className="grid gap-6">
      {view === 'all' || view === 'identity' ? <OwnerBusinessIdentityPanel
        businessIdentity={consolePayload.businessIdentity}
        onSave={saveBusinessIdentity}
      /> : null}

      {view === 'all' || view === 'health' ? <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Database className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Data footprint</h2></div>
          <OwnerFieldHelp label="How data-footprint metrics are calculated" text="Database size comes from Postgres. Storage size comes from Supabase Storage metadata. Browser-local uploads do not count here." />
        </div>
        {metrics ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <OwnerMetricTile label="Database" value={formatOwnerBytes(metrics.databaseSizeBytes)} />
            <OwnerMetricTile label="CardForge tables" value={formatOwnerBytes(metrics.cardforgeTableSizeBytes)} />
            <OwnerMetricTile label="Storage objects" value={formatOwnerBytes(metrics.storageSizeBytes)} />
            <OwnerMetricTile label="Registry assets" value={String(metrics.assetRegistryCount)} />
            <OwnerMetricTile label="Pipeline submissions" value={String(metrics.contributorSubmissionCount)} />
          </div>
        ) : <p className="mt-5 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 text-sm text-[var(--cf-text-muted)]">Database footprint metrics are not available yet.</p>}
      </section> : null}

      {view === 'all' || view === 'roadmap' ? <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Rocket className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">{compactRoadmap ? 'Action center' : 'Roadmap operations'}</h2></div>{compactRoadmap ? <p className="mt-2 text-sm text-[var(--cf-text-muted)]">The next active public roadmap records are ready for an owner decision.</p> : null}</div>
          <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-4 py-3 text-sm text-[var(--cf-accent-text)]">{compactRoadmap ? `${activeRoadmapItems.length} active` : `${officialFeatureCount} goals / ${officialCheckpointCount} checkpoints`}</div>
        </div>
        <div className="mt-5 space-y-3">
          {visibleRoadmapItems.length === 0 ? <p className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 text-sm text-[var(--cf-text-muted)]">{compactRoadmap ? 'No active roadmap decisions need attention.' : 'No owner roadmap rows are active yet.'}</p> : visibleRoadmapItems.map(renderRoadmapItem)}
        </div>
        {compactRoadmap && onOpenRoadmap ? <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={onOpenRoadmap}>Manage all {roadmapItems.length} roadmap records</Button> : null}
      </section> : null}
    </div>
  );
}
