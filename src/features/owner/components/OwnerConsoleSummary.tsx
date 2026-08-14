"use client";

import { useState } from 'react';
import { ExternalLink, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsoleResponse } from '@/features/owner/model/ownerConsoleClient';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export function OwnerConsoleSummary({ payload }: { payload: OwnerConsoleResponse }) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const sendTestEmail = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/owner/email/test', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to send test email.'));
      const body = await response.json() as { to?: string };
      toast({ title: 'Test email sent', description: `Sent to ${body.to ?? payload.console.businessIdentity.supportEmail}.` });
    } catch (error) {
      toast({ title: 'Test email failed', description: error instanceof Error ? error.message : 'Unable to send test email.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };
  const billingReady = payload.integrationStatus.billing.productAccessConfigured
    && payload.integrationStatus.billing.supportConfigured
    && payload.integrationStatus.billing.webhookConfigured;
  const creatorPassReady = payload.integrationStatus.billing.productAccessConfigured
    && payload.integrationStatus.billing.webhookConfigured;
  const emailReady = payload.integrationStatus.email.resendConfigured
    && payload.integrationStatus.email.fromConfigured
    && payload.integrationStatus.email.replyToConfigured;
  const status = [
    ['Auth', payload.integrationStatus.authConfigured ? 'Clerk' : 'Setup', payload.integrationStatus.authConfigured],
    ['Database', payload.integrationStatus.supabase.configured && payload.console.configured ? 'Supabase' : 'Setup', payload.integrationStatus.supabase.configured && payload.console.configured],
    ['Billing', billingReady ? 'Stripe' : (creatorPassReady ? 'Creator Pass' : 'Setup'), billingReady],
    ['Email', emailReady ? 'Resend' : (payload.integrationStatus.email.resendConfigured ? 'Setup' : 'Mailto'), emailReady],
    ['Domain', payload.integrationStatus.site.usingLocalFallback ? 'Local' : 'Configured', !payload.integrationStatus.site.usingLocalFallback],
    ['Publisher', payload.integrationStatus.canonicalOwnerConfigured ? 'Canonical' : 'Setup', payload.integrationStatus.canonicalOwnerConfigured],
    ['Analytics', payload.integrationStatus.analytics.reportingConfigured ? (payload.integrationStatus.analytics.collectionEnabled ? 'Live' : 'Reports') : 'Setup', payload.integrationStatus.analytics.reportingConfigured],
  ] as const;
  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-[#a98a55]">Owner control plane</p><h1 className="font-serif text-2xl text-[#fff1c7] md:text-3xl">CardForge Owner Console</h1></div><div className="flex flex-wrap gap-2 text-xs text-[#c7b288]"><span className="border border-[#3c2c1b] bg-[#100c08] px-3 py-2">{payload.ownerAccess.email ?? 'Owner session'}</span><a className="border border-[#3c2c1b] bg-[#100c08] px-3 py-2 text-[#ffe7ad]" href={payload.integrationStatus.site.publicAppUrl} target="_blank" rel="noreferrer">Open production <ExternalLink className="ml-1 inline h-3.5 w-3.5" /></a></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{status.map(([label, value, ready]) => <div key={label} className="flex min-h-14 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] px-3 py-2"><div><span className="block text-[10px] uppercase tracking-[0.14em] text-[#8f7b57]">{label}</span><span className="block text-sm font-semibold text-[#ffe7ad]">{value}</span></div><span className={`h-2.5 w-2.5 ${ready ? 'bg-[#8fca72]' : 'bg-[#e2aa4a]'}`} /></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={sendTestEmail} disabled={isSending}><Mail className="mr-2 h-4 w-4" />{isSending ? 'Sending...' : 'Test email'}</Button>{[{ label: 'Sitemap', href: payload.integrationStatus.site.sitemapUrl }, { label: 'Robots', href: payload.integrationStatus.site.robotsUrl }].map((link) => <Button key={link.href} asChild size="sm" variant="outline"><a href={link.href} target="_blank" rel="noreferrer">{link.label} <ExternalLink className="h-4 w-4" /></a></Button>)}</div>
    </section>
  );
}
