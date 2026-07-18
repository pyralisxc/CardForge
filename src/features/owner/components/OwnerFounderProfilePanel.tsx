"use client";

import { useEffect, useRef, useState } from 'react';
import { ImageUp, Save, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { getOwnerApiErrorMessage, updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';
import type { FounderProfile, FounderProfileInput } from '@/features/public-site/client';

const toInput = ({ updatedAt: _updatedAt, ...profile }: FounderProfile): FounderProfileInput => profile;

const inputClassName = 'border border-[#5f4526] bg-[#0c0b09] p-3 text-sm leading-6 text-[#ffe7ad] outline-none focus:border-[#d8b365]';

export function OwnerFounderProfilePanel({
  consolePayload,
  onConsoleChange,
}: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [profile, setProfile] = useState(consolePayload.founderProfile);
  const [portraitUrl, setPortraitUrl] = useState(consolePayload.founderPortraitUrl);
  const [portrait, setPortrait] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(consolePayload.founderProfile);
    setPortraitUrl(consolePayload.founderPortraitUrl);
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

  const uploadPortrait = async () => {
    if (!portrait) {
      toast({ title: 'Choose a portrait', description: 'Select a JPEG, PNG, or WebP image first.', variant: 'destructive' });
      return;
    }
    if (portrait.size > 8 * 1024 * 1024) {
      toast({ title: 'Portrait is too large', description: 'Choose an image that is 8 MB or smaller.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const body = new FormData();
      body.set('portrait', portrait);
      const response = await fetch('/api/owner/founder-profile/portrait', { method: 'POST', body });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to upload the portrait.'));
      const result = await response.json() as { console: OwnerConsolePayload; portraitUrl: string | null };
      onConsoleChange(result.console);
      setPortraitUrl(result.portraitUrl);
      setPortrait(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: 'Portrait published', description: 'The processed portrait is now live on the Cameron page.' });
    } catch (error) {
      toast({ title: 'Portrait not uploaded', description: error instanceof Error ? error.message : 'Unable to upload the portrait.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <div>
          <h2 className="font-serif text-2xl text-[#fff1c7]">Cameron profile</h2>
          <p className="mt-1 text-sm text-[#a98a7a]">Edit the founder story, support introduction, portrait, and public social links.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
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

          <fieldset className="border border-[#4a3823] bg-[#100c08] p-4">
            <legend className="px-2 text-sm font-semibold text-[#ffe7ad]">Current priorities</legend>
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

          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Support heading" value={profile.supportHeading} maxLength={120} onChange={(value) => setField('supportHeading', value)} />
            <TextField label="Portrait alt text" value={profile.portraitAlt} maxLength={200} onChange={(value) => setField('portraitAlt', value)} />
          </div>
          <TextArea label="Support introduction" value={profile.supportIntroduction} maxLength={1200} onChange={(value) => setField('supportIntroduction', value)} />
          <TextArea label="What support helps fund" value={profile.supportUseSummary} maxLength={1200} onChange={(value) => setField('supportUseSummary', value)} />

          <div className="grid gap-3 md:grid-cols-3">
            <TextField label="Facebook HTTPS URL" value={profile.facebookUrl ?? ''} maxLength={500} onChange={(value) => setField('facebookUrl', value || null)} />
            <TextField label="Instagram HTTPS URL" value={profile.instagramUrl ?? ''} maxLength={500} onChange={(value) => setField('instagramUrl', value || null)} />
            <TextField label="Discord HTTPS URL" value={profile.discordUrl ?? ''} maxLength={500} onChange={(value) => setField('discordUrl', value || null)} />
          </div>

          <Button className="w-fit bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveProfile}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? 'Publishing profile...' : 'Save Cameron profile'}
          </Button>
        </div>

        <aside className="h-fit border border-[#4a3823] bg-[#100c08] p-4">
          <div
            role="img"
            aria-label={profile.portraitAlt}
            className="grid aspect-[4/5] place-items-center overflow-hidden border border-[#6d4f2b] bg-[#21170d] bg-cover bg-center font-serif text-5xl text-[#ffe7ad]"
            style={portraitUrl ? { backgroundImage: `url(${portraitUrl})` } : undefined}
          >
            {portraitUrl ? null : 'CL'}
          </div>
          <label className="mt-4 grid gap-2 text-sm text-[#c7b288]">
            Portrait image
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={`${inputClassName} file:mr-3 file:border-0 file:bg-[#e4aa43] file:px-3 file:py-2 file:font-semibold file:text-[#140f0a]`}
              onChange={(event) => setPortrait(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-[#8f7b57]">JPEG, PNG, or WebP up to 8 MB. CardForge auto-rotates, scales down when needed, and publishes a clean WebP.</p>
          <Button className="mt-4 w-full" variant="outline" disabled={isUploading} onClick={uploadPortrait}>
            <ImageUp className="mr-2 h-4 w-4" aria-hidden="true" />
            {isUploading ? 'Uploading portrait...' : 'Upload portrait'}
          </Button>
        </aside>
      </div>
    </section>
  );
}

function TextField({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm text-[#c7b288]">
      <span className="flex justify-between gap-2"><span>{label}</span><span className="text-xs text-[#8f7b57]">{value.length}/{maxLength}</span></span>
      <input className={inputClassName} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm text-[#c7b288]">
      <span className="flex justify-between gap-2"><span>{label}</span><span className="text-xs text-[#8f7b57]">{value.length}/{maxLength}</span></span>
      <textarea className={`${inputClassName} min-h-28`} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
