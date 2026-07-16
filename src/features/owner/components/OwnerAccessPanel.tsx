"use client";

import { useEffect, useMemo, useState } from 'react';
import { Gift, Save, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';

export function OwnerAccessPanel({ consolePayload, onConsoleChange }: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState(consolePayload.founderBetaCampaign);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setCampaign(consolePayload.founderBetaCampaign), [consolePayload]);
  const claims = consolePayload.founderBetaClaims;
  const activeClaims = useMemo(() => claims.filter((claim) => claim.status === 'active'), [claims]);
  const remainingReleaseSlots = Math.max(0, campaign.releaseSlotCap - activeClaims.length);
  const remainingPublicSlots = Math.max(0, campaign.publicSlotCap - activeClaims.length);
  const nextWaveSlots = Math.max(0, campaign.publicSlotCap - campaign.releaseSlotCap);

  const save = async () => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({ kind: 'founderBeta', founderBetaCampaign: campaign }, 'Unable to save Founder Beta campaign.');
      onConsoleChange(next);
      toast({ title: 'Founder Beta saved', description: 'Promo slots, copy, and grant behavior are updated.' });
    } catch (error) {
      toast({ title: 'Founder Beta not saved', description: error instanceof Error ? error.message : 'Unable to save Founder Beta campaign.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3 text-[#e2aa4a]"><Gift className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Marketing and promos</h2></div><div className="border border-[#7d5a2e] bg-[#100c08] px-4 py-3 text-sm text-[#ffe7ad]">{activeClaims.length}/{campaign.releaseSlotCap} wave slots claimed</div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[['Current wave left', remainingReleaseSlots], ['Public cap left', remainingPublicSlots], ['Next wave available', nextWaveSlots], ['Active promo users', activeClaims.length]].map(([label, value]) => <div key={label} className="border border-[#4a3823] bg-[#100c08] p-4"><p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p></div>)}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <NumberField label="Public slot cap" value={campaign.publicSlotCap} onChange={(value) => setCampaign((current) => ({ ...current, publicSlotCap: value, releaseSlotCap: Math.min(current.releaseSlotCap, value) }))} />
        <NumberField label="Current release cap" value={campaign.releaseSlotCap} onChange={(value) => setCampaign((current) => ({ ...current, releaseSlotCap: value }))} />
        <NumberField label="Access days" value={campaign.accessDays} onChange={(value) => setCampaign((current) => ({ ...current, accessDays: value }))} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {([['enabled', 'Campaign active'], ['autoGrant', 'Auto-grant on claim'], ['waitlistEnabled', 'Waitlist after full']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">{label}<input type="checkbox" checked={campaign[key]} onChange={(event) => setCampaign((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {([['campaignTitle', 'Campaign title'], ['accountBadgeLabel', 'Account badge label'], ['stripeCouponId', 'Stripe coupon ID'], ['stripePromotionCode', 'Stripe promotion code']] as const).map(([key, label]) => <label key={key} className="grid gap-2 text-sm text-[#c7b288]">{label}<input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={campaign[key]} onChange={(event) => setCampaign((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        <label className="grid gap-2 text-sm text-[#c7b288]">Landing page message<textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={campaign.landingMessage} onChange={(event) => setCampaign((current) => ({ ...current, landingMessage: event.target.value }))} /></label>
        <label className="grid gap-2 text-sm text-[#c7b288]">Export gate message<textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={campaign.exportGateMessage} onChange={(event) => setCampaign((current) => ({ ...current, exportGateMessage: event.target.value }))} /></label>
      </div>
      <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={save}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Saving Founder Beta...' : 'Save Founder Beta promo'}</Button>
      <div className="mt-7 border border-[#5f4526] bg-[#100c08] p-4">
        <div className="flex items-center gap-3 text-[#e2aa4a]"><Users className="h-5 w-5" /><h3 className="font-serif text-xl text-[#fff1c7]">Active promo users</h3></div>
        <div className="mt-4 space-y-2">{claims.length === 0 ? <p className="text-sm text-[#c7b288]">No Founder Beta claims yet.</p> : claims.map((claim) => <div key={claim.id} className="grid gap-2 border border-[#3a2d1d] bg-[#0c0b09] p-3 text-sm md:grid-cols-[1fr_auto_auto]"><span className="text-[#ffe7ad]">{claim.email ?? 'No email captured'}</span><span className={claim.status === 'active' ? 'text-[#bde3a8]' : 'text-[#f0bd75]'}>{claim.status}</span><span className="text-xs text-[#a98a55]">Expires {new Date(claim.accessExpiresAt).toLocaleDateString()}</span></div>)}</div>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-sm text-[#c7b288]">{label}<input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" inputMode="numeric" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>;
}
