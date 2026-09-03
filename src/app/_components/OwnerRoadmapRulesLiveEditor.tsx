"use client";

import { useState } from 'react';
import { Save, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { RoadmapSettings } from '@/features/roadmap/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

const fields: Array<{ key: keyof RoadmapSettings; label: string }> = [
  { key: 'maxActiveUserRoadmapItems', label: 'Active suggestions cap' },
  { key: 'maxRoadmapSuggestionLength', label: 'Suggestion length' },
  { key: 'roadmapNegativeSignalMinTotalVotes', label: 'Archive vote floor' },
  { key: 'roadmapNegativeSignalMinDownvotePercent', label: 'Archive downvote %' },
  { key: 'roadmapEstimatedTaxPercent', label: 'Estimated tax %' },
  { key: 'roadmapOperatingReservePercent', label: 'Operating reserve %' },
];

export function OwnerRoadmapRulesLiveEditor({ initialSettings }: { initialSettings: RoadmapSettings }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/owner/operations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'siteMechanics', siteMechanics: settings }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save roadmap rules.'));
      toast({ title: 'Roadmap rules saved', description: 'Voting and public roadmap rules are updated.' });
    } catch (error) {
      toast({ title: 'Roadmap rules not saved', description: error instanceof Error ? error.message : 'Unable to save roadmap rules.', variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
    <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Settings2 className="h-5 w-5" /><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Roadmap rules</h2></div>
    <div className="mt-6 grid gap-3 md:grid-cols-3">{fields.map((field) => <label key={field.key} className="grid gap-2 text-sm text-[var(--cf-text-muted)]"><span>{field.label}</span><input className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" inputMode="numeric" value={settings[field.key]} onChange={(event) => setSettings((current) => ({ ...current, [field.key]: Number(event.target.value) || 0 }))} /></label>)}</div>
    <Button className="mt-5" disabled={saving} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save roadmap rules'}</Button>
  </section>;
}
