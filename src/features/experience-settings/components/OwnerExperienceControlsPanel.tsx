"use client";

import { useEffect, useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import type { ExperienceSettings } from '../model/experienceSettings';

type OwnerExperienceControlsPanelProps = {
  settings: ExperienceSettings;
  onSettingsChange: (settings: ExperienceSettings) => void;
};

const selectClassName = 'w-full border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]';

export function OwnerExperienceControlsPanel({
  settings,
  onSettingsChange,
}: OwnerExperienceControlsPanelProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const save = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/experience-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Unable to save experience controls.'));
      }
      const result = await response.json() as { settings: ExperienceSettings; activityRecorded?: boolean };
      onSettingsChange(result.settings);
      toast({
        title: 'Experience controls saved',
        description: result.activityRecorded === false ? 'The policy changed, but owner change history was unavailable.' : 'New visits and refreshed Studio sessions now use the updated policy.',
        variant: result.activityRecorded === false ? 'destructive' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Experience controls not saved',
        description: error instanceof Error ? error.message : 'Unable to save experience controls.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5 border border-[#5f4526] bg-[#15100a] p-6">
      <div className="flex items-start gap-3">
        <SlidersHorizontal className="mt-1 h-5 w-5 text-[#e4aa43]" aria-hidden="true" />
        <div>
          <h2 className="font-serif text-2xl text-[#fff1c7]">Experience controls</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
            Change launch behavior without a code deployment. CardForge remains the policy owner; Stripe still owns Creator Pass billing and Google still owns consented analytics records.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 border border-[#3c2c1b] bg-[#100c08] p-4 text-sm text-[#c7b288]">
          <span className="font-medium text-[#ffe7ad]">Portable project files</span>
          <select
            className={selectClassName}
            value={draft.projectFileAccess}
            onChange={(event) => setDraft((current) => ({
              ...current,
              projectFileAccess: event.target.value as ExperienceSettings['projectFileAccess'],
            }))}
          >
            <option value="creator_pass">Require Creator Pass</option>
            <option value="free">Available on the free plan</option>
          </select>
          <span className="leading-6 text-[#a98a75]">
            Controls opening and downloading CardForge project files only. Watermark-free PNG, PDF, ZIP, and Tabletop Simulator exports remain Creator Pass features.
          </span>
        </label>

        <label className="grid gap-2 border border-[#3c2c1b] bg-[#100c08] p-4 text-sm text-[#c7b288]">
          <span className="font-medium text-[#ffe7ad]">Analytics consent presentation</span>
          <select
            className={selectClassName}
            value={draft.analyticsConsentPresentation}
            onChange={(event) => setDraft((current) => ({
              ...current,
              analyticsConsentPresentation: event.target.value as ExperienceSettings['analyticsConsentPresentation'],
            }))}
          >
            <option value="required_popup">Required choice popup</option>
            <option value="popup">Current popup</option>
            <option value="banner">Quiet banner</option>
          </select>
          <span className="leading-6 text-[#a98a75]">
            Every presentation offers Accept, Accept once, and Decline. Required choice blocks the page until the visitor decides; it never makes analytics mandatory.
          </span>
        </label>
      </div>

      <div className="border border-[#6d4f2b] bg-[#1b1209] p-4 text-sm leading-6 text-[#d8c29a]">
        Launch default: project files require Creator Pass and analytics uses a required choice popup. Existing visitor choices are respected when the presentation changes.
      </div>

      <Button
        type="button"
        className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
        disabled={isSaving || (
          draft.projectFileAccess === settings.projectFileAccess
          && draft.analyticsConsentPresentation === settings.analyticsConsentPresentation
        )}
        onClick={save}
      >
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving experience controls...' : 'Save experience controls'}
      </Button>
    </section>
  );
}
