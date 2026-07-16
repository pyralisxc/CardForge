"use client";

import { useState } from 'react';
import { Mail, Save, Search, UserCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { OwnerBillingPanel } from '@/features/billing/client/owner';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import {
  getOwnerApiErrorMessage,
  type OwnerConsoleResponse,
  type OwnerManagedAccount,
} from '@/features/owner/model/ownerConsoleClient';
import { formatOwnerDateTime, OwnerMetricTile } from './OwnerPanelPrimitives';

export function OwnerOperationsPanel({ payload }: { payload: OwnerConsoleResponse }) {
  const { toast } = useToast();
  const [accountSearchEmail, setAccountSearchEmail] = useState('');
  const [managedAccount, setManagedAccount] = useState<OwnerManagedAccount | null>(null);
  const [managedAccountDraft, setManagedAccountDraft] = useState({ access: 'free' as OwnerManagedAccount['access'], owner: false, note: '' });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isManagingAccount, setIsManagingAccount] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const contactRequests: OwnerConsolePayload['contactRequests'] = payload.console.contactRequests;

  const sendTestEmail = async () => {
    setIsSendingTestEmail(true);
    try {
      const response = await fetch('/api/owner/email/test', { method: 'POST' });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to send test email.'));
      const body = await response.json() as { to?: string };
      toast({ title: 'Test email sent', description: `Sent to ${body.to ?? payload.console.settings.supportEmail}.` });
    } catch (error) {
      toast({ title: 'Test email failed', description: error instanceof Error ? error.message : 'Unable to send test email.', variant: 'destructive' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const lookupAccount = async () => {
    setIsManagingAccount(true);
    setAccountError(null);
    try {
      const response = await fetch('/api/owner/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accountSearchEmail }),
      });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to find account.'));
      const account = ((await response.json()) as { account: OwnerManagedAccount }).account;
      setManagedAccount(account);
      setManagedAccountDraft({ access: account.access, owner: account.isOwner, note: account.note });
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Unable to find account.');
      setManagedAccount(null);
    } finally {
      setIsManagingAccount(false);
    }
  };

  const saveManagedAccount = async () => {
    if (!managedAccount) return;
    setIsManagingAccount(true);
    setAccountError(null);
    try {
      const response = await fetch('/api/owner/accounts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: managedAccount.id, role: managedAccountDraft }),
      });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to update account.'));
      const account = ((await response.json()) as { account: OwnerManagedAccount }).account;
      setManagedAccount(account);
      setManagedAccountDraft({ access: account.access, owner: account.isOwner, note: account.note });
      toast({ title: 'Account updated', description: `${account.email ?? account.id} now has ${account.access} access.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update account.';
      setAccountError(message);
      toast({ title: 'Account not updated', description: message, variant: 'destructive' });
    } finally {
      setIsManagingAccount(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 text-[#e2aa4a]"><Mail className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Email operations</h2></div>
          <Button onClick={sendTestEmail} disabled={isSendingTestEmail || !payload.integrationStatus.email.resendConfigured} className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"><Mail className="mr-2 h-4 w-4" />{isSendingTestEmail ? 'Sending...' : 'Send test email'}</Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <OwnerMetricTile label="Requests" value={String(contactRequests.length)} />
          <OwnerMetricTile label="Developer" value={String(contactRequests.filter((request) => request.kind === 'developer').length)} />
          <OwnerMetricTile label="Email route" value={payload.integrationStatus.email.resendConfigured ? 'Resend ready' : 'Mailto only'} />
        </div>
        <div className="mt-5 space-y-3">
          {contactRequests.length === 0 ? <p className="border border-[#4a3823] bg-[#100c08] p-4 text-sm text-[#c7b288]">No support or developer requests have been recorded yet.</p> : contactRequests.slice(0, 6).map((request) => (
            <article key={request.id} className="border border-[#4a3823] bg-[#100c08] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-[#ffe7ad]">{request.subject}</p><span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{request.kind} / {request.status}</span></div>
              <p className="mt-2 text-sm text-[#d9c28f]">{request.name} / {request.email}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#c7b288]">{request.message}</p>
              <p className="mt-2 text-xs text-[#8f7b57]">{formatOwnerDateTime(request.createdAt)}</p>
            </article>
          ))}
        </div>
      </section>

      <OwnerBillingPanel />

      <section className="border border-[#6d4f2b] bg-[#15100a] p-6 xl:col-span-2">
        <div className="flex items-center gap-3 text-[#e2aa4a]"><UserCog className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Account controls</h2></div>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <input className="min-w-0 flex-1 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]" placeholder="user@example.com" value={accountSearchEmail} onChange={(event) => setAccountSearchEmail(event.target.value)} />
          <Button onClick={lookupAccount} disabled={isManagingAccount} className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"><Search className="mr-2 h-4 w-4" />Lookup</Button>
        </div>
        {accountError ? <p className="mt-3 text-sm text-[#f0bd75]">{accountError}</p> : null}
        {managedAccount ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="border border-[#4a3823] bg-[#100c08] p-4 text-sm leading-6 text-[#c7b288]">
              <p className="text-lg font-semibold text-[#ffe7ad]">{managedAccount.email ?? managedAccount.id}</p><p>Name: {managedAccount.name || 'Not set'}</p><p>Current access: {managedAccount.access}</p><p>Owner: {managedAccount.isOwner ? 'Yes' : 'No'}</p><p>Stripe customer: {managedAccount.stripeCustomerId ?? 'None'}</p><p>Stripe subscription: {managedAccount.stripeSubscriptionId ?? 'None'}</p>
            </div>
            <div className="border border-[#4a3823] bg-[#100c08] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[#c7b288]">Access<select className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={managedAccountDraft.access} onChange={(event) => setManagedAccountDraft((current) => ({ ...current, access: event.target.value as OwnerManagedAccount['access'] }))}><option value="free">Free</option><option value="paid">Creator Pass</option><option value="dev">Developer</option></select></label>
                <label className="flex items-center gap-3 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#c7b288] md:mt-7"><input type="checkbox" checked={managedAccountDraft.owner} onChange={(event) => setManagedAccountDraft((current) => ({ ...current, owner: event.target.checked }))} />Owner access</label>
              </div>
              <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">Owner note<textarea rows={3} className="resize-y border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={managedAccountDraft.note} onChange={(event) => setManagedAccountDraft((current) => ({ ...current, note: event.target.value }))} /></label>
              <Button onClick={saveManagedAccount} disabled={isManagingAccount} className="mt-4 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"><Save className="mr-2 h-4 w-4" />Save account access</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
