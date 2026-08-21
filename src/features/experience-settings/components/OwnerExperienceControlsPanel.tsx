"use client";

import { useEffect, useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardForgeSurface } from '@/components/ui/cardforge-presentation';
import { useToast } from '@/components/ui/use-toast';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import type { ExperienceSettings } from '../model/experienceSettings';

type OwnerExperienceControlsPanelProps = {
  settings: ExperienceSettings;
  onSettingsChange: (settings: ExperienceSettings) => void;
};

const selectClassName = 'w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';
const fieldClassName = 'grid gap-2 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4 text-sm text-[var(--cf-text-muted)]';

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
      setDraft(result.settings);
      onSettingsChange(result.settings);
      toast({
        title: 'Experience controls saved',
        description: result.activityRecorded === false
          ? 'The settings changed, but owner change history was unavailable.'
          : 'New visits and refreshed workspaces now use the updated experience and presentation settings.',
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

  const unchanged = JSON.stringify(draft) === JSON.stringify(settings);

  return (
    <CardForgeSurface as="section" className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <SlidersHorizontal className="mt-1 h-5 w-5 text-[var(--cf-accent-strong)]" aria-hidden="true" />
        <div>
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Experience controls</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
            Change safe launch and presentation values without changing page ownership. CardForge validates the available visual profiles so contrast, focus, and editor legibility remain code-reviewed.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className={fieldClassName}>
          <span className="font-medium text-[var(--cf-accent-text)]">Portable project files</span>
          <select
            className={selectClassName}
            value={draft.projectFileAccess}
            onChange={(event) => setDraft((current) => ({ ...current, projectFileAccess: event.target.value as ExperienceSettings['projectFileAccess'] }))}
          >
            <option value="creator_pass">Require Creator Pass</option>
            <option value="free">Available on the free plan</option>
          </select>
          <span className="leading-6 text-[var(--cf-text-subtle)]">Controls CardForge project files only. Watermark-free exports remain Creator Pass features.</span>
        </label>

        <label className={fieldClassName}>
          <span className="font-medium text-[var(--cf-accent-text)]">Analytics consent presentation</span>
          <select
            className={selectClassName}
            value={draft.analyticsConsentPresentation}
            onChange={(event) => setDraft((current) => ({ ...current, analyticsConsentPresentation: event.target.value as ExperienceSettings['analyticsConsentPresentation'] }))}
          >
            <option value="required_popup">Required choice popup</option>
            <option value="popup">Current popup</option>
            <option value="banner">Quiet banner</option>
          </select>
          <span className="leading-6 text-[var(--cf-text-subtle)]">Every presentation offers Accept, Accept once, and Decline. Existing visitor choices remain respected.</span>
        </label>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">CardForge presentation</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
          These curated settings feed the one semantic CardForge token system used by the public site, account surfaces, operational consoles, Studio, Generator, and Template editor roles.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className={fieldClassName}>
          <span className="font-medium text-[var(--cf-accent-text)]">Presentation palette</span>
          <select className={selectClassName} value={draft.presentationPalette} onChange={(event) => setDraft((current) => ({ ...current, presentationPalette: event.target.value as ExperienceSettings['presentationPalette'] }))}>
            <option value="forge">Forge — warm obsidian</option>
            <option value="obsidian">Obsidian — neutral dark</option>
            <option value="slate">Slate — cool graphite</option>
          </select>
        </label>

        <label className={fieldClassName}>
          <span className="font-medium text-[var(--cf-accent-text)]">Accent character</span>
          <select className={selectClassName} value={draft.presentationAccent} onChange={(event) => setDraft((current) => ({ ...current, presentationAccent: event.target.value as ExperienceSettings['presentationAccent'] }))}>
            <option value="brass">Brass</option>
            <option value="ember">Ember</option>
            <option value="arcane">Arcane</option>
          </select>
        </label>

        <label className={fieldClassName}>
          <span className="font-medium text-[var(--cf-accent-text)]">Corner character</span>
          <select className={selectClassName} value={draft.presentationCorners} onChange={(event) => setDraft((current) => ({ ...current, presentationCorners: event.target.value as ExperienceSettings['presentationCorners'] }))}>
            <option value="square">Square</option>
            <option value="subtle">Subtle</option>
            <option value="soft">Soft</option>
          </select>
        </label>

        <label className={fieldClassName}>
          <span className="font-medium text-[var(--cf-accent-text)]">Contrast</span>
          <select className={selectClassName} value={draft.presentationContrast} onChange={(event) => setDraft((current) => ({ ...current, presentationContrast: event.target.value as ExperienceSettings['presentationContrast'] }))}>
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <CardForgeSurface tone="raised" className="border-[var(--cf-border-strong)] p-4 text-sm leading-6 text-[var(--cf-text-muted)]">
        The default Forge + Brass + Subtle + Standard combination preserves the current CardForge presentation. Raw CSS and arbitrary colors remain code-owned so owner customization cannot bypass accessibility safeguards.
      </CardForgeSurface>

      <Button
        type="button"
        className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:brightness-110"
        disabled={isSaving || unchanged}
        onClick={save}
      >
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving experience controls...' : 'Save experience controls'}
      </Button>
    </CardForgeSurface>
  );
}
