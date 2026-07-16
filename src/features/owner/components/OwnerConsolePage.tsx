"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Database, ExternalLink, FileText, Gift, Info, KeyRound, Mail, Rocket, Save, Search, Settings2, UserCog, Users } from 'lucide-react';

import { PublicSiteHeader } from '@/features/app-shell/client/publicSite';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { OwnerDeveloperProgramPanel } from '@/features/developer-assets/client/owner';
import { OwnerBillingPanel } from '@/features/owner/components/OwnerBillingPanel';
import type {
  FounderBetaCampaign,
  FounderBetaClaim,
  OwnerConsolePayload,
  OwnerDatabaseMetrics,
} from '@/features/owner/lib/ownerConsole';
import type { ContactRequest } from '@/features/contact/client/requests';
import {
  DEFAULT_LEGAL_DOCUMENTS,
  type LegalDocument,
  type LegalDocumentSlug,
} from '@/features/legal/client/documents';
import {
  DEFAULT_SITE_CONTENT_BLOCKS,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from '@/features/public-site/client/content';
import type { SiteOperatorSettings } from '@/features/public-site/client/operator';
import {
  DEFAULT_ROADMAP_SETTINGS,
  type RoadmapAdminItem,
  type RoadmapSettings,
} from '@/features/roadmap/client/admin';

interface OwnerConsoleResponse {
  ownerAccess: {
    isOwner: boolean;
    source: string;
    email: string | null;
  };
  integrationStatus: {
    site: {
      publicAppUrl: string;
      configuredPublicAppUrl: string | null;
      usingLocalFallback: boolean;
      sitemapUrl: string;
      robotsUrl: string;
    };
    authConfigured: boolean;
    billing: {
      checkoutConfigured: boolean;
      webhookConfigured: boolean;
      missing: string[];
    };
    supabase: {
      configured: boolean;
      missing: string[];
    };
    ownerAllowlistConfigured: boolean;
    email: {
      contactMode: 'mailto' | 'ready_for_server_delivery';
      resendConfigured: boolean;
      fromConfigured: boolean;
      replyToConfigured: boolean;
      missing: string[];
    };
    links: Array<{ label: string; href: string }>;
  };
  console: OwnerConsolePayload;
}

interface OwnerManagedAccount {
  id: string;
  email: string | null;
  name: string;
  access: 'free' | 'paid' | 'dev';
  isOwner: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  note: string;
}

const emptySettings: SiteOperatorSettings = {
  businessName: '',
  ownerName: '',
  supportEmail: '',
  supportPhone: '',
  websiteUrl: '',
};

const emptyFounderBetaCampaign: FounderBetaCampaign = {
  id: 'founder_beta',
  enabled: false,
  publicSlotCap: 25,
  releaseSlotCap: 25,
  claimedSlots: 0,
  accessDays: 90,
  autoGrant: true,
  waitlistEnabled: true,
  campaignTitle: '',
  landingMessage: '',
  accountBadgeLabel: '',
  exportGateMessage: '',
  stripeCouponId: '',
  stripePromotionCode: '',
  updatedAt: null,
};

const emptySiteMechanics: RoadmapSettings = DEFAULT_ROADMAP_SETTINGS;

const roadmapStatusLabels: Record<RoadmapAdminItem['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  testing: 'Testing',
  shipped: 'Completed',
  archived_negative_signal: 'Archived',
};

const legalDocumentPathBySlug: Record<LegalDocumentSlug, string> = {
  privacy: '/privacy',
  terms: '/terms',
  refund: '/refund',
  contact: '/contact',
  'developer-terms': '/developer-terms',
  'creator-pool': '/creator-pool',
};

const siteContentGroupLabels: Record<SiteContentBlock['group'], string> = {
  landing: 'Landing page',
  about: 'About page',
  access: 'Access page',
};

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

const getApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#4a3823] bg-[#100c08] p-3">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">{label}</span>
      <span className="mt-2 block text-lg font-semibold text-[#ffe7ad]">{value}</span>
    </div>
  );
}

function CompactStatusTile({ label, value, ready = true }: { label: string; value: string; ready?: boolean }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] px-3 py-2">
      <div className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8f7b57]">{label}</span>
        <span className="block truncate text-sm font-semibold text-[#ffe7ad]">{value}</span>
      </div>
      <span className={`h-2.5 w-2.5 shrink-0 ${ready ? 'bg-[#8fca72]' : 'bg-[#e2aa4a]'}`} />
    </div>
  );
}

const formatDateTime = (value: string | null): string => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

function FieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 place-items-center border border-[#5f4526] text-[#d7b469] hover:border-[#d8b365] hover:text-[#fff1c7]"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[#6d4f2b] bg-[#15100a] text-[#f7ead0]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function MechanicsNumberField({
  label,
  value,
  help,
  onChange,
}: {
  label: string;
  value: number;
  help: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-[#c7b288]">
      <span className="flex items-center justify-between gap-2">
        {label}
        <FieldHelp text={help} />
      </span>
      <input
        className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

export function OwnerConsolePage() {
  const { toast } = useToast();
  const [payload, setPayload] = useState<OwnerConsoleResponse | null>(null);
  const [settings, setSettings] = useState<SiteOperatorSettings>(emptySettings);
  const [siteMechanics, setSiteMechanics] = useState<RoadmapSettings>(emptySiteMechanics);
  const [siteContentBlocks, setSiteContentBlocks] = useState<SiteContentBlock[]>(DEFAULT_SITE_CONTENT_BLOCKS);
  const [founderBetaCampaign, setFounderBetaCampaign] = useState<FounderBetaCampaign>(emptyFounderBetaCampaign);
  const [founderBetaClaims, setFounderBetaClaims] = useState<FounderBetaClaim[]>([]);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapAdminItem[]>([]);
  const [databaseMetrics, setDatabaseMetrics] = useState<OwnerDatabaseMetrics | null>(null);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [accountSearchEmail, setAccountSearchEmail] = useState('');
  const [managedAccount, setManagedAccount] = useState<OwnerManagedAccount | null>(null);
  const [managedAccountDraft, setManagedAccountDraft] = useState({ access: 'free' as OwnerManagedAccount['access'], owner: false, note: '' });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isManagingAccount, setIsManagingAccount] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [activeLegalSlug, setActiveLegalSlug] = useState<LegalDocumentSlug>('privacy');
  const [legalDrafts, setLegalDrafts] = useState<Record<LegalDocumentSlug, LegalDocument>>(
    Object.fromEntries(DEFAULT_LEGAL_DOCUMENTS.map((document) => [document.slug, document])) as Record<LegalDocumentSlug, LegalDocument>,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastOwnerSaveAt, setLastOwnerSaveAt] = useState<string | null>(null);

  const siteContentGroups = useMemo(() => {
    return (['landing', 'about', 'access'] as Array<SiteContentBlock['group']>).map((group) => ({
      group,
      blocks: siteContentBlocks.filter((block) => block.group === group),
    }));
  }, [siteContentBlocks]);

  const legalDraftList = useMemo(
    () => DEFAULT_LEGAL_DOCUMENTS.map((defaultDocument) => legalDrafts[defaultDocument.slug]).filter(Boolean),
    [legalDrafts],
  );
  const activeLegalDocument = useMemo(() => legalDrafts[activeLegalSlug] ?? null, [activeLegalSlug, legalDrafts]);
  const activeFounderBetaClaims = useMemo(
    () => founderBetaClaims.filter((claim) => claim.status === 'active'),
    [founderBetaClaims],
  );
  const remainingReleaseSlots = Math.max(0, founderBetaCampaign.releaseSlotCap - activeFounderBetaClaims.length);
  const remainingPublicSlots = Math.max(0, founderBetaCampaign.publicSlotCap - activeFounderBetaClaims.length);
  const nextWaveSlots = Math.max(0, founderBetaCampaign.publicSlotCap - founderBetaCampaign.releaseSlotCap);
  const officialFeatureCount = roadmapItems.filter((item) => item.itemType === 'feature').length;
  const officialCheckpointCount = roadmapItems.filter((item) => item.itemType !== 'feature').length;
  const lastOwnerSaveLabel = lastOwnerSaveAt
    ? new Date(lastOwnerSaveAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'No owner edits saved in this session';

  const syncConsoleState = useCallback((consolePayload: OwnerConsolePayload) => {
    setSettings(consolePayload.settings);
    setSiteMechanics(consolePayload.siteMechanics);
    setSiteContentBlocks(consolePayload.siteContentBlocks);
    setFounderBetaCampaign(consolePayload.founderBetaCampaign);
    setFounderBetaClaims(consolePayload.founderBetaClaims);
    setRoadmapItems(consolePayload.roadmapItems);
    setDatabaseMetrics(consolePayload.databaseMetrics);
    setContactRequests(consolePayload.contactRequests);
    setLegalDrafts(Object.fromEntries(consolePayload.legalDocuments.map((document) => [document.slug, document])) as Record<LegalDocumentSlug, LegalDocument>);
  }, []);

  useEffect(() => {
    let mounted = true;
    const slowLoadTimer = window.setTimeout(() => {
      if (mounted) setIsSlowLoad(true);
    }, 2500);

    const load = async () => {
      setIsLoading(true);
      setIsSlowLoad(false);
      setLoadError(null);
      try {
        const response = await fetch('/api/owner/console', { cache: 'no-store' });
        if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to load owner console.'));
        const nextPayload = await response.json() as OwnerConsoleResponse;
        if (!mounted) return;
        setPayload(nextPayload);
        syncConsoleState(nextPayload.console);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load owner console.';
        if (!mounted) return;
        setLoadError(message);
        toast({
          title: 'Owner console unavailable',
          description: message,
          variant: 'destructive',
        });
      } finally {
        window.clearTimeout(slowLoadTimer);
        if (mounted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
      window.clearTimeout(slowLoadTimer);
    };
  }, [reloadToken, syncConsoleState, toast]);

  const sendTestEmail = async () => {
    setIsSendingTestEmail(true);
    try {
      const response = await fetch('/api/owner/email/test', { method: 'POST' });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to send test email.'));
      const body = await response.json() as { to?: string };
      toast({ title: 'Test email sent', description: `Sent to ${body.to ?? settings.supportEmail}.` });
    } catch (error) {
      toast({
        title: 'Test email failed',
        description: error instanceof Error ? error.message : 'Unable to send test email.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const lookupAccount = async () => {
    setIsManagingAccount(true);
    setAccountError(null);
    try {
      const response = await fetch('/api/owner/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountSearchEmail }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to find account.'));
      const body = await response.json() as { account: OwnerManagedAccount };
      setManagedAccount(body.account);
      setManagedAccountDraft({ access: body.account.access, owner: body.account.isOwner, note: body.account.note });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to find account.';
      setAccountError(message);
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: managedAccount.id, role: managedAccountDraft }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to update account.'));
      const body = await response.json() as { account: OwnerManagedAccount };
      setManagedAccount(body.account);
      setManagedAccountDraft({ access: body.account.access, owner: body.account.isOwner, note: body.account.note });
      toast({ title: 'Account updated', description: `${body.account.email ?? body.account.id} now has ${body.account.access} access.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update account.';
      setAccountError(message);
      toast({ title: 'Account not updated', description: message, variant: 'destructive' });
    } finally {
      setIsManagingAccount(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'settings', settings }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save owner settings.'));
      const body = await response.json() as { console: OwnerConsolePayload };
      syncConsoleState(body.console);
      setLastOwnerSaveAt(new Date().toISOString());
      toast({ title: 'Owner profile saved', description: 'Business and support details are updated.' });
    } catch (error) {
      toast({
        title: 'Settings not saved',
        description: error instanceof Error ? error.message : 'Unable to save owner settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveLegalDocument = async () => {
    if (!activeLegalDocument) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'legal', legalDocument: activeLegalDocument }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save legal document.'));
      const body = await response.json() as { console: OwnerConsolePayload };
      syncConsoleState(body.console);
      setLastOwnerSaveAt(new Date().toISOString());
      toast({ title: 'Legal page published', description: `${activeLegalDocument.title} is updated.` });
    } catch (error) {
      toast({
        title: 'Legal page not saved',
        description: error instanceof Error ? error.message : 'Unable to save legal document.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSiteMechanics = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'siteMechanics', siteMechanics }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save site mechanics.'));
      const body = await response.json() as { console: OwnerConsolePayload };
      syncConsoleState(body.console);
      setLastOwnerSaveAt(new Date().toISOString());
      toast({ title: 'Site mechanics saved', description: 'Feature voting and public board rules are updated.' });
    } catch (error) {
      toast({
        title: 'Site mechanics not saved',
        description: error instanceof Error ? error.message : 'Unable to save site mechanics.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSiteContentBlockDraft = (slug: SiteContentBlockSlug, body: string) => {
    setSiteContentBlocks((current) => current.map((block) => (
      block.slug === slug ? { ...block, body } : block
    )));
  };

  const saveSiteContentBlock = async (block: SiteContentBlock) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'siteContent', siteContentBlock: { slug: block.slug, body: block.body } }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save site copy.'));
      const body = await response.json() as { console: OwnerConsolePayload };
      syncConsoleState(body.console);
      setLastOwnerSaveAt(new Date().toISOString());
      toast({ title: 'Site copy published', description: `${block.label} is live without a deploy.` });
    } catch (error) {
      toast({
        title: 'Site copy not saved',
        description: error instanceof Error ? error.message : 'Unable to save site copy.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveFounderBetaCampaign = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'founderBeta', founderBetaCampaign }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save Founder Beta campaign.'));
      const body = await response.json() as { console: OwnerConsolePayload };
      syncConsoleState(body.console);
      setLastOwnerSaveAt(new Date().toISOString());
      toast({ title: 'Founder Beta saved', description: 'Promo slots, copy, and grant behavior are updated.' });
    } catch (error) {
      toast({
        title: 'Founder Beta not saved',
        description: error instanceof Error ? error.message : 'Unable to save Founder Beta campaign.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateRoadmapStatus = async (itemId: string, status: RoadmapAdminItem['status']) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/owner/console', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'roadmapStatus', roadmapItem: { itemId, status } }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to update roadmap checkpoint.'));
      const body = await response.json() as { console: OwnerConsolePayload };
      syncConsoleState(body.console);
      setLastOwnerSaveAt(new Date().toISOString());
      toast({
        title: status === 'shipped' ? 'Checkpoint completed' : 'Checkpoint updated',
        description: 'The public roadmap now reflects the new status.',
      });
    } catch (error) {
      toast({
        title: 'Roadmap not updated',
        description: error instanceof Error ? error.message : 'Unable to update roadmap checkpoint.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!payload && isLoading) {
    return (
      <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
        <PublicSiteHeader currentPath="/owner" showOwnerLink title="Owner Forge" />
        <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
          <div className="border border-[#6d4f2b] bg-[#15100a] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#a98a55]">Owner console</p>
                <h1 className="font-serif text-2xl text-[#fff1c7]">Loading workstation</h1>
              </div>
              <div className="h-2 w-32 animate-pulse bg-[#4a3823]" />
            </div>
            {isSlowLoad ? (
              <p className="mt-4 border border-[#8c6436] bg-[#1b1209] p-3 text-sm leading-6 text-[#f0bd75]">
                This is taking longer than expected. The console should recover automatically; if it does not, refresh after the current request finishes.
              </p>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <TooltipProvider>
    <main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
      <PublicSiteHeader currentPath="/owner" showOwnerLink title="Owner Forge" />

      <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        {!payload ? (
          <div className="border border-[#7d3d32] bg-[#1b0d09] p-6 text-[#ffd0c6]">
            <h1 className="font-serif text-3xl text-[#fff1c7]">Owner console unavailable</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6">
              {loadError ?? 'Owner access is required. Sign in with the owner account or set trusted owner metadata.'}
            </p>
            <Button
              type="button"
              className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Retry owner console
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="border border-[#6d4f2b] bg-[#15100a] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#a98a55]">Owner workstation</p>
                  <h1 className="font-serif text-2xl text-[#fff1c7] md:text-3xl">CardForge Command</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#c7b288]">
                  <span className="border border-[#3c2c1b] bg-[#100c08] px-3 py-2">{payload.ownerAccess.email ?? 'Owner session'}</span>
                  <a className="border border-[#3c2c1b] bg-[#100c08] px-3 py-2 text-[#ffe7ad] hover:border-[#d8b365]" href={payload.integrationStatus.site.publicAppUrl} target="_blank" rel="noreferrer">
                    {payload.integrationStatus.site.publicAppUrl}
                  </a>
                  <span className="border border-[#3c2c1b] bg-[#100c08] px-3 py-2">{lastOwnerSaveLabel}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <CompactStatusTile label="Auth" value={payload.integrationStatus.authConfigured ? 'Clerk' : 'Setup'} ready={payload.integrationStatus.authConfigured} />
                <CompactStatusTile label="Database" value={payload.integrationStatus.supabase.configured && payload.console.configured ? 'Supabase' : 'Setup'} ready={payload.integrationStatus.supabase.configured && payload.console.configured} />
                <CompactStatusTile label="Billing" value={payload.integrationStatus.billing.checkoutConfigured && payload.integrationStatus.billing.webhookConfigured ? 'Stripe' : 'Setup'} ready={payload.integrationStatus.billing.checkoutConfigured && payload.integrationStatus.billing.webhookConfigured} />
                <CompactStatusTile label="Email" value={payload.integrationStatus.email.resendConfigured ? 'Resend' : 'Mailto'} ready={payload.integrationStatus.email.resendConfigured} />
                <CompactStatusTile label="Domain" value={payload.integrationStatus.site.usingLocalFallback ? 'Local' : 'Live'} ready={!payload.integrationStatus.site.usingLocalFallback} />
                <CompactStatusTile label="Owner" value={payload.integrationStatus.ownerAllowlistConfigured ? 'Allowed' : 'Setup'} ready={payload.integrationStatus.ownerAllowlistConfigured} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" onClick={sendTestEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Test email
                </Button>
                <Button asChild size="sm" variant="outline" className="border-[#3c2c1b] bg-[#100c08] text-[#d9c28f] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                  <a href={payload.integrationStatus.site.sitemapUrl} target="_blank" rel="noreferrer">Sitemap <ExternalLink className="h-4 w-4" /></a>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-[#3c2c1b] bg-[#100c08] text-[#d9c28f] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                  <a href={payload.integrationStatus.site.robotsUrl} target="_blank" rel="noreferrer">Robots <ExternalLink className="h-4 w-4" /></a>
                </Button>
                {payload.integrationStatus.links.map((link) => (
                  <Button key={link.href} asChild size="sm" variant="outline" className="border-[#3c2c1b] bg-[#100c08] text-[#d9c28f] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                    <a href={link.href} target="_blank" rel="noreferrer">{link.label} <ExternalLink className="h-4 w-4" /></a>
                  </Button>
                ))}
              </div>
            </section>

            <Tabs defaultValue="operations" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
                <TabsTrigger value="readiness" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Launch Readiness</TabsTrigger>
                <TabsTrigger value="operations" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Operations</TabsTrigger>
                <TabsTrigger value="copy" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Site Copy</TabsTrigger>
                <TabsTrigger value="site" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Site Mechanics</TabsTrigger>
                <TabsTrigger value="access" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Access & Promos</TabsTrigger>
                <TabsTrigger value="developer" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Contributor Program</TabsTrigger>
                <TabsTrigger value="legal" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Legal & Secrets</TabsTrigger>
              </TabsList>

              <TabsContent value="readiness" className="mt-0">
            <div className="grid gap-6">
              <section className="border border-[#5f4526] bg-[#15100a] p-6">
                <h2 className="font-serif text-2xl text-[#fff1c7]">Business profile</h2>
                <div className="mt-5 grid gap-3">
                  {(Object.keys(settings) as Array<keyof SiteOperatorSettings>).map((key) => (
                    <label key={key} className="grid gap-2 text-sm text-[#c7b288]">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}
                      <input
                        className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                        value={settings[key]}
                        onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving business profile...' : 'Save business profile'}
                </Button>
              </section>
            </div>

            <section className="mt-6 border border-[#6d4f2b] bg-[#15100a] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3 text-[#e2aa4a]">
                    <Database className="h-5 w-5" />
                    <h2 className="font-serif text-2xl text-[#fff1c7]">Data footprint</h2>
                  </div>
                </div>
                <FieldHelp text="Database size comes from Postgres. Storage size comes from Supabase Storage object metadata when that schema is available. Local browser uploads do not count here." />
              </div>
              {databaseMetrics ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <MetricTile label="Database" value={formatBytes(databaseMetrics.databaseSizeBytes)} />
                  <MetricTile label="CardForge tables" value={formatBytes(databaseMetrics.cardforgeTableSizeBytes)} />
                  <MetricTile label="Storage objects" value={formatBytes(databaseMetrics.storageSizeBytes)} />
                  <MetricTile label="Registry assets" value={String(databaseMetrics.assetRegistryCount)} />
                  <MetricTile label="Dev submissions" value={String(databaseMetrics.developerSubmissionCount)} />
                  <MetricTile label="Promo users" value={String(databaseMetrics.founderBetaClaimCount)} />
                </div>
              ) : (
                <p className="mt-5 border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">
                  Database footprint metrics are not available yet. Check Supabase if this stays empty after new assets, votes, or promo claims land.
                </p>
              )}
            </section>

            <section className="mt-6 border border-[#6d4f2b] bg-[#15100a] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3 text-[#e2aa4a]">
                    <Rocket className="h-5 w-5" />
                    <h2 className="font-serif text-2xl text-[#fff1c7]">Roadmap operations</h2>
                  </div>
                </div>
                <div className="grid grid-cols-2 border border-[#5f4526] bg-[#100c08] text-center">
                  <div className="border-r border-[#5f4526] px-4 py-3">
                    <span className="block text-lg font-semibold text-[#ffe7ad]">{officialFeatureCount}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">feature goals</span>
                  </div>
                  <div className="px-4 py-3">
                    <span className="block text-lg font-semibold text-[#ffe7ad]">{officialCheckpointCount}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">checkpoints</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {roadmapItems.length === 0 ? (
                  <p className="border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">
                    No owner roadmap rows are active yet. Add public roadmap goals before using this lane for launch tracking.
                  </p>
                ) : roadmapItems.map((item) => (
                  <div key={item.id} className="grid gap-3 border border-[#4a3823] bg-[#100c08] p-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[#ffe7ad]">{item.title}</p>
                        <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
                          {roadmapStatusLabels[item.status]}
                        </span>
                        <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
                          {item.itemType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-[#a98a55]">{item.visibleMonth}</span>
                      </div>
                      {item.description ? (
                        <p className="mt-1 text-xs leading-5 text-[#c7b288]">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="border-[#5f4526] bg-transparent text-[#c7b288]" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'planned')}>Plan</Button>
                      <Button size="sm" variant="outline" className="border-[#8a642f] bg-transparent text-[#f0c568]" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'in_progress')}>Start</Button>
                      <Button size="sm" variant="outline" className="border-[#35445a] bg-transparent text-[#b9d5ff]" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'testing')}>Test</Button>
                      <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" disabled={isSaving} onClick={() => updateRoadmapStatus(item.id, 'shipped')}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
              </TabsContent>

              <TabsContent value="operations" className="mt-0">
                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-3 text-[#e2aa4a]">
                          <Mail className="h-5 w-5" />
                          <h2 className="font-serif text-2xl text-[#fff1c7]">Email operations</h2>
                        </div>
                      </div>
                      <Button onClick={sendTestEmail} disabled={isSendingTestEmail || !payload.integrationStatus.email.resendConfigured} className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                        <Mail className="mr-2 h-4 w-4" />
                        {isSendingTestEmail ? 'Sending...' : 'Send test email'}
                      </Button>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <MetricTile label="Requests" value={String(contactRequests.length)} />
                      <MetricTile label="Developer" value={String(contactRequests.filter((request) => request.kind === 'developer').length)} />
                      <MetricTile label="Email route" value={payload.integrationStatus.email.resendConfigured ? 'Resend ready' : 'Mailto only'} />
                    </div>
                    <div className="mt-5 space-y-3">
                      {contactRequests.length === 0 ? (
                        <p className="border border-[#4a3823] bg-[#100c08] p-4 text-sm text-[#c7b288]">
                          No support or developer requests have been recorded yet. New routed requests will appear here after they are sent.
                        </p>
                      ) : contactRequests.slice(0, 6).map((request) => (
                        <article key={request.id} className="border border-[#4a3823] bg-[#100c08] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#ffe7ad]">{request.subject}</p>
                            <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{request.kind} / {request.status}</span>
                          </div>
                          <p className="mt-2 text-sm text-[#d9c28f]">{request.name} / {request.email}</p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#c7b288]">{request.message}</p>
                          <p className="mt-2 text-xs text-[#8f7b57]">{formatDateTime(request.createdAt)}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <OwnerBillingPanel />

                  <section className="border border-[#6d4f2b] bg-[#15100a] p-6 xl:col-span-2">
                    <div className="flex items-center gap-3 text-[#e2aa4a]">
                      <UserCog className="h-5 w-5" />
                      <h2 className="font-serif text-2xl text-[#fff1c7]">Account controls</h2>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 md:flex-row">
                      <input
                        className="min-w-0 flex-1 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                        placeholder="user@example.com"
                        value={accountSearchEmail}
                        onChange={(event) => setAccountSearchEmail(event.target.value)}
                      />
                      <Button onClick={lookupAccount} disabled={isManagingAccount} className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                        <Search className="mr-2 h-4 w-4" />
                        Lookup
                      </Button>
                    </div>
                    {accountError ? <p className="mt-3 text-sm text-[#f0bd75]">{accountError}</p> : null}
                    {managedAccount ? (
                      <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="border border-[#4a3823] bg-[#100c08] p-4 text-sm leading-6 text-[#c7b288]">
                          <p className="text-lg font-semibold text-[#ffe7ad]">{managedAccount.email ?? managedAccount.id}</p>
                          <p>Name: {managedAccount.name || 'Not set'}</p>
                          <p>Current access: {managedAccount.access}</p>
                          <p>Owner: {managedAccount.isOwner ? 'Yes' : 'No'}</p>
                          <p>Stripe customer: {managedAccount.stripeCustomerId ?? 'None'}</p>
                          <p>Stripe subscription: {managedAccount.stripeSubscriptionId ?? 'None'}</p>
                        </div>
                        <div className="border border-[#4a3823] bg-[#100c08] p-4">
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="grid gap-2 text-sm text-[#c7b288]">
                              Access
                              <select
                                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                                value={managedAccountDraft.access}
                                onChange={(event) => setManagedAccountDraft((current) => ({ ...current, access: event.target.value as OwnerManagedAccount['access'] }))}
                              >
                                <option value="free">Free</option>
                                <option value="paid">Creator Pass</option>
                                <option value="dev">Developer</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-3 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#c7b288] md:mt-7">
                              <input
                                type="checkbox"
                                checked={managedAccountDraft.owner}
                                onChange={(event) => setManagedAccountDraft((current) => ({ ...current, owner: event.target.checked }))}
                              />
                              Owner access
                            </label>
                          </div>
                          <label className="mt-3 grid gap-2 text-sm text-[#c7b288]">
                            Owner note
                            <textarea
                              rows={3}
                              className="resize-y border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                              value={managedAccountDraft.note}
                              onChange={(event) => setManagedAccountDraft((current) => ({ ...current, note: event.target.value }))}
                            />
                          </label>
                          <Button onClick={saveManagedAccount} disabled={isManagingAccount} className="mt-4 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]">
                            <Save className="mr-2 h-4 w-4" />
                            Save account access
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>
              </TabsContent>

              <TabsContent value="copy" className="mt-0">
            <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3 text-[#e2aa4a]">
                    <FileText className="h-5 w-5" />
                    <h2 className="font-serif text-2xl text-[#fff1c7]">Public site copy</h2>
                  </div>
                </div>
                <div className="border border-[#7d5a2e] bg-[#100c08] px-4 py-3 text-xs uppercase tracking-[0.14em] text-[#ffe7ad]">
                  Known blocks only
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {siteContentGroups.map(({ group, blocks }) => (
                  <div key={group} className="border border-[#4a3823] bg-[#100c08] p-4">
                    <h3 className="font-serif text-xl text-[#ffe7ad]">{siteContentGroupLabels[group]}</h3>
                    <div className="mt-4 grid gap-3">
                      {blocks.map((block) => (
                        <div key={block.slug} className="border border-[#3a2d1d] bg-[#0c0b09] p-3">
                          <label className="grid gap-2 text-sm text-[#c7b288]">
                            <span className="flex flex-wrap items-center justify-between gap-2">
                              {block.label}
                              <span className="text-xs text-[#8f7b57]">{block.body.length}/800</span>
                            </span>
                            <textarea
                              className="min-h-24 border border-[#5f4526] bg-[#100c08] p-3 text-sm leading-6 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                              maxLength={800}
                              value={block.body}
                              onChange={(event) => updateSiteContentBlockDraft(block.slug, event.target.value)}
                            />
                          </label>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs text-[#8f7b57]">
                              {block.updatedAt ? `Last saved ${new Date(block.updatedAt).toLocaleDateString()}` : 'Using bundled default'}
                            </span>
                            <Button size="sm" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={() => saveSiteContentBlock(block)}>
                              <Save className="mr-2 h-4 w-4" />
                              {isSaving ? 'Publishing...' : 'Publish block'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
              </TabsContent>

              <TabsContent value="site" className="mt-0">
            <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3 text-[#e2aa4a]">
                    <Settings2 className="h-5 w-5" />
                    <h2 className="font-serif text-2xl text-[#fff1c7]">Site mechanics</h2>
                  </div>
                </div>
                <div className="border border-[#7d5a2e] bg-[#100c08] px-4 py-3 text-xs uppercase tracking-[0.14em] text-[#ffe7ad]">
                  Feature voting
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <MechanicsNumberField
                  label="Active suggestions cap"
                  value={siteMechanics.maxActiveUserRoadmapItems}
                  help="Maximum user-created feature requests kept open on the public board before new suggestions are blocked."
                  onChange={(value) => setSiteMechanics((current) => ({ ...current, maxActiveUserRoadmapItems: value }))}
                />
                <MechanicsNumberField
                  label="Suggestion length"
                  value={siteMechanics.maxRoadmapSuggestionLength}
                  help="Maximum characters accepted for public feature suggestions."
                  onChange={(value) => setSiteMechanics((current) => ({ ...current, maxRoadmapSuggestionLength: value }))}
                />
                <MechanicsNumberField
                  label="Archive vote floor"
                  value={siteMechanics.roadmapNegativeSignalMinTotalVotes}
                  help="Minimum total votes required before a user-created feature can be auto-archived for negative signal."
                  onChange={(value) => setSiteMechanics((current) => ({ ...current, roadmapNegativeSignalMinTotalVotes: value }))}
                />
                <MechanicsNumberField
                  label="Archive downvote %"
                  value={siteMechanics.roadmapNegativeSignalMinDownvotePercent}
                  help="Downvote percentage that moves a user-created feature request into the archived-negative-signal state."
                  onChange={(value) => setSiteMechanics((current) => ({ ...current, roadmapNegativeSignalMinDownvotePercent: value }))}
                />
              </div>

              <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveSiteMechanics}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving site mechanics...' : 'Save site mechanics'}
              </Button>
            </section>
              </TabsContent>

              <TabsContent value="access" className="mt-0">
            <section className="border border-[#6d4f2b] bg-[#15100a] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3 text-[#e2aa4a]">
                    <Gift className="h-5 w-5" />
                    <h2 className="font-serif text-2xl text-[#fff1c7]">Marketing and promos</h2>
                  </div>
                </div>
                <div className="border border-[#7d5a2e] bg-[#100c08] px-4 py-3 text-sm text-[#ffe7ad]">
                  {activeFounderBetaClaims.length}/{founderBetaCampaign.releaseSlotCap} wave slots claimed
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="border border-[#4a3823] bg-[#100c08] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Current wave left</p>
                  <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{remainingReleaseSlots}</p>
                </div>
                <div className="border border-[#4a3823] bg-[#100c08] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Public cap left</p>
                  <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{remainingPublicSlots}</p>
                </div>
                <div className="border border-[#4a3823] bg-[#100c08] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Next wave available</p>
                  <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{nextWaveSlots}</p>
                </div>
                <div className="border border-[#4a3823] bg-[#100c08] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Active promo users</p>
                  <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{activeFounderBetaClaims.length}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <label className="grid gap-2 text-sm text-[#c7b288]">
                  Public slot cap
                  <input
                    className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                    inputMode="numeric"
                    value={founderBetaCampaign.publicSlotCap}
                    onChange={(event) => setFounderBetaCampaign((current) => ({
                      ...current,
                      publicSlotCap: Number(event.target.value) || 0,
                      releaseSlotCap: Math.min(current.releaseSlotCap, Number(event.target.value) || 0),
                    }))}
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#c7b288]">
                  Current release cap
                  <input
                    className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                    inputMode="numeric"
                    value={founderBetaCampaign.releaseSlotCap}
                    onChange={(event) => setFounderBetaCampaign((current) => ({
                      ...current,
                      releaseSlotCap: Number(event.target.value) || 0,
                    }))}
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#c7b288]">
                  Access days
                  <input
                    className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                    inputMode="numeric"
                    value={founderBetaCampaign.accessDays}
                    onChange={(event) => setFounderBetaCampaign((current) => ({
                      ...current,
                      accessDays: Number(event.target.value) || 0,
                    }))}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {([
                  ['enabled', 'Campaign active'],
                  ['autoGrant', 'Auto-grant on claim'],
                  ['waitlistEnabled', 'Waitlist after full'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-4 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">
                    {label}
                    <input
                      type="checkbox"
                      checked={founderBetaCampaign[key]}
                      onChange={(event) => setFounderBetaCampaign((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {([
                  ['campaignTitle', 'Campaign title'],
                  ['accountBadgeLabel', 'Account badge label'],
                  ['stripeCouponId', 'Stripe coupon ID'],
                  ['stripePromotionCode', 'Stripe promotion code'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="grid gap-2 text-sm text-[#c7b288]">
                    {label}
                    <input
                      className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                      value={founderBetaCampaign[key]}
                      onChange={(event) => setFounderBetaCampaign((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-[#c7b288]">
                  Landing page message
                  <textarea
                    className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                    value={founderBetaCampaign.landingMessage}
                    onChange={(event) => setFounderBetaCampaign((current) => ({ ...current, landingMessage: event.target.value }))}
                  />
                </label>
                <label className="grid gap-2 text-sm text-[#c7b288]">
                  Export gate message
                  <textarea
                    className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                    value={founderBetaCampaign.exportGateMessage}
                    onChange={(event) => setFounderBetaCampaign((current) => ({ ...current, exportGateMessage: event.target.value }))}
                  />
                </label>
              </div>

              <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveFounderBetaCampaign}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving Founder Beta...' : 'Save Founder Beta promo'}
              </Button>

              <div className="mt-7 border border-[#5f4526] bg-[#100c08] p-4">
                <div className="flex items-center gap-3 text-[#e2aa4a]">
                  <Users className="h-5 w-5" />
                  <h3 className="font-serif text-xl text-[#fff1c7]">Active promo users</h3>
                </div>
                <div className="mt-4 space-y-2">
                  {founderBetaClaims.length === 0 ? (
                    <p className="text-sm text-[#c7b288]">No Founder Beta claims yet. Claims will appear here after signed-in users claim access.</p>
                  ) : founderBetaClaims.map((claim) => (
                    <div key={claim.id} className="grid gap-2 border border-[#3a2d1d] bg-[#0c0b09] p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                      <span className="text-[#ffe7ad]">{claim.email ?? 'No email captured'}</span>
                      <span className={claim.status === 'active' ? 'text-[#bde3a8]' : 'text-[#f0bd75]'}>
                        {claim.status}
                      </span>
                      <span className="text-xs text-[#a98a55]">
                        Expires {new Date(claim.accessExpiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
              </TabsContent>

              <TabsContent value="developer" className="mt-0">
            <OwnerDeveloperProgramPanel />
              </TabsContent>

              <TabsContent value="legal" className="mt-0 space-y-5">
            <section className="border border-[#5f4526] bg-[#15100a] p-6">
              <div className="flex items-center gap-3 text-[#e2aa4a]">
                <FileText className="h-5 w-5" />
                <h2 className="font-serif text-2xl text-[#fff1c7]">Legal center</h2>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_1fr]">
                <div className="grid gap-2 content-start">
                  {legalDraftList.map((document) => (
                    <button
                      key={document.slug}
                      type="button"
                      className={`border px-3 py-3 text-left text-sm ${
                        activeLegalSlug === document.slug
                          ? 'border-[#e6b85c] bg-[#2b1d0e] text-[#ffe7ad]'
                          : 'border-[#5f4526] bg-[#100c08] text-[#c7b288]'
                      }`}
                      onClick={() => setActiveLegalSlug(document.slug)}
                    >
                      {document.title}
                    </button>
                  ))}
                </div>
                {activeLegalDocument ? (
                  <div className="grid gap-3">
                    <input
                      className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                      value={activeLegalDocument.title}
                      onChange={(event) => setLegalDrafts((current) => ({
                        ...current,
                        [activeLegalSlug]: { ...activeLegalDocument, title: event.target.value },
                      }))}
                    />
                    <textarea
                      className="min-h-[22rem] border border-[#5f4526] bg-[#0c0b09] p-3 text-sm leading-6 text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                      value={activeLegalDocument.body}
                      onChange={(event) => setLegalDrafts((current) => ({
                        ...current,
                        [activeLegalSlug]: { ...activeLegalDocument, body: event.target.value },
                      }))}
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveLegalDocument}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? 'Publishing legal page...' : 'Publish legal page'}
                      </Button>
                      <Button asChild variant="outline" className="border-[#755632] bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
                        <Link href={legalDocumentPathBySlug[activeLegalDocument.slug]}>View public page</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="border border-[#5f4526] bg-[#15100a] p-6">
              <div className="flex items-center gap-3 text-[#e2aa4a]">
                <KeyRound className="h-5 w-5" />
                <h2 className="font-serif text-2xl text-[#fff1c7]">API keys and secrets</h2>
              </div>
              <p className="mt-3 text-sm text-[#c7b288]">Provider-owned. No raw secrets are exposed here.</p>
            </section>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </section>
    </main>
    </TooltipProvider>
  );
}
