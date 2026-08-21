"use client";

import { useEffect, useState } from 'react';
import { Save, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';
import type { FounderProfile, FounderProfileInput } from '@/features/public-site/client';

const toInput = ({ updatedAt: _updatedAt, ...profile }: FounderProfile): FounderProfileInput => profile;

const inputClassName = 'border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm leading-6 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';

export function OwnerFounderProfilePanel({
  consolePayload,
  onConsoleChange,
}: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [profile, setProfile] = useState(consolePayload.founderProfile);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setProfile(consolePayload.founderProfile);
  }, [consolePayload]);

  const setField = <K extends keyof FounderProfile>(key: K, value: FounderProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({
        kind: 'founderProfile',
        founderProfile: toInput(profile),
      }, 'Unable to save the Cameron profile.');
      onConsoleChange(next);
      toast({ title: 'Cameron profile published', description: 'Founder copy and social links are live without a deploy.' });
    } catch (error) {
      toast({ title: 'Cameron profile not saved', description: error instanceof Error ? error.message : 'Unable to save the Cameron profile.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-6">
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <div>
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Cameron profile</h2>
          <p className="mt-1 text-sm text-[#a98a7a]">Edit the founder story, support introduction, and public social links. Portrait controls now live in Site Media.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Hero welcome" value={profile.heroEyebrow} maxLength={80} onChange={(value) => setField('heroEyebrow', value)} />
            <TextField label="Hero headline" value={profile.heroHeadline} maxLength={120} onChange={(value) => setField('heroHeadline', value)} />
          </div>
          <TextArea label="Introduction" value={profile.introduction} maxLength={1200} onChange={(value) => setField('introduction', value)} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Road heading" value={profile.roadHeading} maxLength={120} onChange={(value) => setField('roadHeading', value)} />
            <TextField label="Current work heading" value={profile.currentHeading} maxLength={120} onChange={(value) => setField('currentHeading', value)} />
            <TextArea label="Road story" value={profile.roadBody} maxLength={1200} onChange={(value) => setField('roadBody', value)} />
            <TextArea label="Current work" value={profile.currentBody} maxLength={1200} onChange={(value) => setField('currentBody', value)} />
          </div>

          <fieldset className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
            <legend className="px-2 text-sm font-semibold text-[var(--cf-accent-text)]">Current priorities</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {profile.priorities.map((priority, index) => (
                <TextField
                  key={index}
                  label={`Priority ${index + 1}`}
                  value={priority}
                  maxLength={200}
                  onChange={(value) => setField('priorities', profile.priorities.map((item, itemIndex) => itemIndex === index ? value : item))}
                />
              ))}
            </div>
          </fieldset>

          <TextField label="Support heading" value={profile.supportHeading} maxLength={120} onChange={(value) => setField('supportHeading', value)} />
          <TextArea label="Support introduction" value={profile.supportIntroduction} maxLength={1200} onChange={(value) => setField('supportIntroduction', value)} />
          <TextArea label="What support helps fund" value={profile.supportUseSummary} maxLength={1200} onChange={(value) => setField('supportUseSummary', value)} />

          <div className="grid gap-3 md:grid-cols-3">
            <TextField label="Facebook HTTPS URL" value={profile.facebookUrl ?? ''} maxLength={500} onChange={(value) => setField('facebookUrl', value || null)} />
            <TextField label="Instagram HTTPS URL" value={profile.instagramUrl ?? ''} maxLength={500} onChange={(value) => setField('instagramUrl', value || null)} />
            <TextField label="Discord HTTPS URL" value={profile.discordUrl ?? ''} maxLength={500} onChange={(value) => setField('discordUrl', value || null)} />
          </div>

          <Button className="w-fit bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" disabled={isSaving} onClick={saveProfile}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? 'Publishing profile...' : 'Save Cameron profile'}
          </Button>
        </div>

      </div>
    </section>
  );
}

function TextField({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
      <span className="flex justify-between gap-2"><span>{label}</span><span className="text-xs text-[var(--cf-text-subtle)]">{value.length}/{maxLength}</span></span>
      <input className={inputClassName} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
      <span className="flex justify-between gap-2"><span>{label}</span><span className="text-xs text-[var(--cf-text-subtle)]">{value.length}/{maxLength}</span></span>
      <textarea className={`${inputClassName} min-h-28`} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
