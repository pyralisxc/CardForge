"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, History, Rocket, Save, Trash2, Users } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_BILLING_HISTORY_LIMIT,
  MAX_BILLING_HISTORY_LIMIT,
  type OwnerBillingHistorySettings,
  type OwnerBillingSnapshot,
} from '@/features/owner/lib/ownerBillingOperations';
import {
  DEFAULT_OWNER_BILLING_TAB,
  getOwnerSubscriptionConnectionLabel,
  sortOwnerSubscriptions,
} from '@/features/owner/lib/ownerBillingPresentation';
import {
  buildBillingReconciliationDescription,
  type BillingReconciliationResult,
} from '@/features/owner/lib/ownerConsole';

type OwnerBillingTab = typeof DEFAULT_OWNER_BILLING_TAB | 'history';

const getApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

const formatMoney = (cents: number | null, currency: string | null): string => {
  if (typeof cents !== 'number' || !currency) return 'n/a';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
};

const formatDateTime = (value: string | null): string => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#4a3823] bg-[#100c08] p-3">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">{label}</span>
      <span className="mt-2 block text-lg font-semibold text-[#ffe7ad]">{value}</span>
    </div>
  );
}

export function OwnerBillingPanel() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<OwnerBillingTab>(DEFAULT_OWNER_BILLING_TAB);
  const [billingSnapshot, setBillingSnapshot] = useState<OwnerBillingSnapshot | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLimitDraft, setHistoryLimitDraft] = useState(DEFAULT_BILLING_HISTORY_LIMIT);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isReconcilingBilling, setIsReconcilingBilling] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const loadBillingSummary = useCallback(async (
    includeHistory = false,
    signal?: AbortSignal,
  ) => {
    setIsLoadingBilling(true);
    setBillingError(null);
    try {
      const response = await fetch(
        `/api/owner/billing/summary${includeHistory ? '?includeHistory=1' : ''}`,
        { cache: 'no-store', signal },
      );
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to load billing summary.'));
      const nextSnapshot = await response.json() as OwnerBillingSnapshot;
      setBillingSnapshot((currentSnapshot) => (
        includeHistory || !currentSnapshot
          ? nextSnapshot
          : {
              ...nextSnapshot,
              recentCheckoutSessions: currentSnapshot.recentCheckoutSessions,
            }
      ));
      setHistoryLimitDraft(nextSnapshot.historySettings.limit);
      if (includeHistory) setHistoryLoaded(true);
    } catch (error) {
      if (signal?.aborted) return;
      setBillingError(error instanceof Error ? error.message : 'Unable to load billing summary.');
    } finally {
      if (!signal?.aborted) setIsLoadingBilling(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBillingSummary(false, controller.signal);
    return () => controller.abort();
  }, [loadBillingSummary]);

  useEffect(() => {
    if (activeTab !== 'history' || historyLoaded) return;
    const controller = new AbortController();
    void loadBillingSummary(true, controller.signal);
    return () => controller.abort();
  }, [activeTab, historyLoaded, loadBillingSummary]);

  const subscriptions = useMemo(
    () => sortOwnerSubscriptions(billingSnapshot?.recentSubscriptions ?? []),
    [billingSnapshot?.recentSubscriptions],
  );
  const activeSubscriberCount = subscriptions.filter((subscription) => (
    subscription.status === 'active' || subscription.status === 'trialing'
  )).length;
  const historySettings = billingSnapshot?.historySettings;

  const handleTabChange = (value: string) => {
    const nextTab: OwnerBillingTab = value === 'history' ? 'history' : DEFAULT_OWNER_BILLING_TAB;
    setActiveTab(nextTab);
  };

  const reconcileBilling = async () => {
    setIsReconcilingBilling(true);
    setBillingError(null);
    try {
      const response = await fetch('/api/owner/billing/reconcile', { method: 'POST' });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to reconcile billing.'));
      const result = await response.json() as BillingReconciliationResult;
      toast({
        title: 'Billing reconciled',
        description: buildBillingReconciliationDescription(result),
      });
      await loadBillingSummary(activeTab === 'history');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reconcile billing.';
      setBillingError(message);
      toast({ title: 'Billing reconciliation failed', description: message, variant: 'destructive' });
    } finally {
      setIsReconcilingBilling(false);
    }
  };

  const saveHistoryLimit = async () => {
    setIsSavingHistory(true);
    setBillingError(null);
    try {
      const response = await fetch('/api/owner/billing/summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyLimit: historyLimitDraft }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save checkout history limit.'));
      const body = await response.json() as { historySettings: OwnerBillingHistorySettings };
      setBillingSnapshot((currentSnapshot) => currentSnapshot
        ? { ...currentSnapshot, historySettings: body.historySettings }
        : currentSnapshot);
      await loadBillingSummary(true);
      toast({ title: 'Checkout history limit saved', description: `CardForge will show up to ${body.historySettings.limit} Stripe checkout sessions.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save checkout history limit.';
      setBillingError(message);
      toast({ title: 'History limit not saved', description: message, variant: 'destructive' });
    } finally {
      setIsSavingHistory(false);
    }
  };

  const clearDisplayedHistory = async () => {
    setIsClearingHistory(true);
    setBillingError(null);
    try {
      const response = await fetch('/api/owner/billing/summary', { method: 'DELETE' });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to clear displayed checkout history.'));
      const body = await response.json() as { historySettings: OwnerBillingHistorySettings };
      setBillingSnapshot((currentSnapshot) => currentSnapshot
        ? {
            ...currentSnapshot,
            historySettings: body.historySettings,
            recentCheckoutSessions: [],
          }
        : currentSnapshot);
      setHistoryLoaded(true);
      toast({
        title: 'Displayed checkout history cleared',
        description: 'Older attempts are hidden in CardForge. Stripe records remain intact.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to clear displayed checkout history.';
      setBillingError(message);
      toast({ title: 'Checkout history not cleared', description: message, variant: 'destructive' });
    } finally {
      setIsClearingHistory(false);
    }
  };

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <CreditCard className="h-5 w-5" />
          <div>
            <h2 className="font-serif text-2xl text-[#fff1c7]">Billing snapshot</h2>
            <p className="mt-1 text-xs leading-5 text-[#a98a55]">Stripe is authoritative; CardForge organizes subscribers and provider history for owner operations.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={reconcileBilling} disabled={isReconcilingBilling || isLoadingBilling} variant="outline" className="border-[#755632] bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isReconcilingBilling ? 'Reconciling...' : 'Reconcile'}
          </Button>
          <Button onClick={() => loadBillingSummary(activeTab === 'history')} disabled={isLoadingBilling || isReconcilingBilling} variant="outline" className="border-[#755632] bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <Rocket className="mr-2 h-4 w-4" />
            {isLoadingBilling ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {billingError ? (
        <p className="mt-4 border border-[#8c6436] bg-[#1b1209] p-3 text-sm text-[#f0bd75]">{billingError}</p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricTile label="Checkout" value={billingSnapshot?.status.checkoutConfigured ? 'Ready' : 'Needs setup'} />
        <MetricTile label="Webhook" value={billingSnapshot?.status.webhookConfigured ? 'Ready' : 'Needs setup'} />
        <MetricTile label="Active subscribers" value={String(activeSubscriberCount)} />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-2 border border-[#4a3823] bg-[#0c0b09] p-1">
          <TabsTrigger value="subscribers" className="gap-2 rounded-none py-3 text-[#a98a55] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">
            <Users className="h-4 w-4" />
            Subscribers
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-none py-3 text-[#a98a55] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">
            <History className="h-4 w-4" />
            Checkout history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="mt-4 space-y-3">
          <div className="border border-[#6d4f2b] bg-[#1a1209] p-4">
            <p className="text-sm font-semibold text-[#ffe7ad]">Actual Stripe subscriptions</p>
            <p className="mt-1 text-xs leading-5 text-[#a98a55]">These are subscription records—not checkout attempts. Active and trialing subscribers appear first.</p>
          </div>
          {subscriptions.map((subscription) => {
            const needsConnection = subscription.mappingStatus === 'stale' || subscription.mappingStatus === 'missing';
            return (
              <article key={subscription.id} className="border border-[#6d4f2b] bg-[#100c08] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[#ffe7ad]">
                      {formatMoney(subscription.amountCents, subscription.currency)}
                      {subscription.interval ? ` / ${subscription.interval}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-[#d9c28f]">{subscription.customerEmail ?? subscription.customerId ?? 'Customer email unavailable'}</p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-[#d8b365]">{subscription.status ?? 'unknown'}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[#8f7b57] md:grid-cols-2">
                  <p className="break-all">Subscription: {subscription.id}</p>
                  <p>{subscription.cancelAtPeriodEnd ? 'Cancels' : 'Period ends'}: {formatDateTime(subscription.currentPeriodEnd)}</p>
                  <p className={`md:col-span-2 ${subscription.mappingStatus === 'connected' ? 'text-[#8fca72]' : 'text-[#f0bd75]'}`}>
                    {getOwnerSubscriptionConnectionLabel(subscription)}
                  </p>
                  {subscription.clerkUserId ? <p className="break-all md:col-span-2">Stored Clerk mapping: {subscription.clerkUserId}</p> : null}
                </div>
                {needsConnection ? (
                  <p className="mt-3 border border-[#755632] bg-[#1b1209] p-3 text-xs leading-5 text-[#f0bd75]">
                    Ask this customer to sign in or register with the Stripe email above, then run Reconcile. They should not purchase again.
                  </p>
                ) : null}
              </article>
            );
          })}
          {billingSnapshot && subscriptions.length === 0 ? (
            <p className="border border-[#4a3823] bg-[#100c08] p-4 text-sm text-[#c7b288]">No Stripe subscriptions found.</p>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          <div className="border border-[#4a3823] bg-[#100c08] p-4">
            <p className="text-sm font-semibold text-[#ffe7ad]">Stripe Checkout history</p>
            <p className="mt-1 text-xs leading-5 text-[#a98a55]">
              This secondary view includes completed, repeated, and abandoned Checkout Sessions. CardForge shows only the last {historySettings?.retentionDays ?? 30} days and never deletes Stripe records.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <label className="grid gap-2 text-xs text-[#c7b288]">
                Maximum displayed sessions (1–{MAX_BILLING_HISTORY_LIMIT})
                <input
                  type="number"
                  min={1}
                  max={MAX_BILLING_HISTORY_LIMIT}
                  value={historyLimitDraft}
                  onChange={(event) => setHistoryLimitDraft(Number(event.target.value))}
                  className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                />
              </label>
              <Button
                onClick={saveHistoryLimit}
                disabled={isSavingHistory || historyLimitDraft < 1 || historyLimitDraft > MAX_BILLING_HISTORY_LIMIT || !Number.isInteger(historyLimitDraft)}
                variant="outline"
                className="border-[#755632] bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingHistory ? 'Saving...' : 'Save limit'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isClearingHistory || !historyLoaded} variant="outline" className="border-[#8c6436] bg-transparent text-[#f0bd75] hover:bg-[#2a1b0d] hover:text-[#ffe7ad]">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear displayed history
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-[#6d4f2b] bg-[#15100a] text-[#f7ead0]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear displayed checkout history?</AlertDialogTitle>
                    <AlertDialogDescription className="leading-6 text-[#c7b288]">
                      CardForge will hide every Checkout Session created before now. Stripe&apos;s financial and billing records remain intact, and new checkout attempts will still appear.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#755632] bg-transparent text-[#f8e3b0]">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearDisplayedHistory} className="bg-[#b96c3e] text-white hover:bg-[#cf8050]">
                      Clear CardForge view
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="mt-3 text-xs text-[#8f7b57]">
              Displaying {billingSnapshot?.recentCheckoutSessions.length ?? 0} of up to {historySettings?.limit ?? DEFAULT_BILLING_HISTORY_LIMIT} sessions since {formatDateTime(historySettings?.effectiveStart ?? null)}.
            </p>
          </div>

          {!historyLoaded && isLoadingBilling ? (
            <p className="border border-[#4a3823] bg-[#100c08] p-4 text-sm text-[#c7b288]">Loading Stripe checkout history...</p>
          ) : null}
          {(billingSnapshot?.recentCheckoutSessions ?? []).map((session) => (
            <article key={session.id} className="border border-[#4a3823] bg-[#100c08] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#ffe7ad]">{formatMoney(session.amountTotalCents, session.currency)}</p>
                <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Checkout {session.paymentStatus ?? session.status ?? 'unknown'}</span>
              </div>
              <p className="mt-2 text-sm text-[#d9c28f]">{session.customerEmail ?? session.clerkUserId ?? session.id}</p>
              <p className="mt-2 text-xs text-[#8f7b57]">{formatDateTime(session.createdAt)} / {session.subscriptionId ?? 'No subscription created'}</p>
            </article>
          ))}
          {historyLoaded && billingSnapshot?.recentCheckoutSessions.length === 0 ? (
            <p className="border border-[#4a3823] bg-[#100c08] p-4 text-sm text-[#c7b288]">No checkout sessions are visible inside the current history window.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
