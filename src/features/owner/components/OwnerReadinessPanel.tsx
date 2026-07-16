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

const roadmapStatusLabels: Record<OwnerConsolePayload['roadmapItems'][number]['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  testing: 'Testing',
  shipped: 'Completed',
  archived_negative_signal: 'Archived',
};

export function OwnerReadinessPanel({ consolePayload, onConsoleChange }: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [roadmapItems, setRoadmapItems] = useState(consolePayload.roadmapItems);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    setRoadmapItems(consolePayload.roadmapItems);
  }, [consolePayload]);

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
  return (
    <div className="grid gap-6">
      <OwnerBusinessIdentityPanel
        businessIdentity={consolePayload.businessIdentity}
        onSave={saveBusinessIdentity}
      />

      <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><Database className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Data footprint</h2></div>
          <OwnerFieldHelp text="Database size comes from Postgres. Storage size comes from Supabase Storage metadata. Browser-local uploads do not count here." />
        </div>
        {metrics ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <OwnerMetricTile label="Database" value={formatOwnerBytes(metrics.databaseSizeBytes)} />
            <OwnerMetricTile label="CardForge tables" value={formatOwnerBytes(metrics.cardforgeTableSizeBytes)} />
            <OwnerMetricTile label="Storage objects" value={formatOwnerBytes(metrics.storageSizeBytes)} />
            <OwnerMetricTile label="Registry assets" value={String(metrics.assetRegistryCount)} />
            <OwnerMetricTile label="Dev submissions" value={String(metrics.developerSubmissionCount)} />
            <OwnerMetricTile label="Promo users" value={String(metrics.founderBetaClaimCount)} />
          </div>
        ) : <p className="mt-5 border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">Database footprint metrics are not available yet.</p>}
      </section>

      <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><Rocket className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Roadmap operations</h2></div>
          <div className="border border-[#5f4526] bg-[#100c08] px-4 py-3 text-sm text-[#ffe7ad]">{officialFeatureCount} goals / {officialCheckpointCount} checkpoints</div>
        </div>
        <div className="mt-5 space-y-3">
          {roadmapItems.length === 0 ? <p className="border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">No owner roadmap rows are active yet.</p> : roadmapItems.map((item) => (
            <div key={item.id} className="grid gap-3 border border-[#4a3823] bg-[#100c08] p-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="font-medium text-[#ffe7ad]">{item.title}</p><p className="mt-1 text-xs text-[#a98a55]">{roadmapStatusLabels[item.status]} / {item.itemType.replace('_', ' ')} / {item.visibleMonth}</p>{item.description ? <p className="mt-1 text-xs leading-5 text-[#c7b288]">{item.description}</p> : null}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'planned')}>Plan</Button>
                <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'in_progress')}>Start</Button>
                <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'testing')}>Test</Button>
                <Button size="sm" variant="outline" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'shipped')}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Complete</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
