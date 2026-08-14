import { isClerkAuthConfigured } from '@/features/account/server';
import { getBillingConfigStatus } from '@/features/billing/server';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import { getConfiguredPublicAppUrl, getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { getAnalyticsConfigurationStatus } from '@/features/analytics/server';
import type { OwnerConnectedService } from '@/features/owner/lib/ownerConsole';
import { getBufferConfiguration } from '@/features/social-publishing/server';

const buildConnectedServices = ({
  analytics,
  analyticsProjectIdentityVerified,
  authConfigured,
  billing,
  configuredPublicAppUrl,
  emailDeliveryReady,
  emailProviderConfigured,
  supabaseConfigured,
}: {
  analytics: ReturnType<typeof getAnalyticsConfigurationStatus>;
  analyticsProjectIdentityVerified: boolean;
  authConfigured: boolean;
  billing: ReturnType<typeof getBillingConfigStatus>;
  configuredPublicAppUrl: string | null;
  emailDeliveryReady: boolean;
  emailProviderConfigured: boolean;
  supabaseConfigured: boolean;
}): OwnerConnectedService[] => {
  const buffer = getBufferConfiguration();
  const creatorPassReady = billing.productAccessConfigured && billing.webhookConfigured;
  const billingReady = creatorPassReady && billing.supportConfigured;
  const googleReportingIdentityReady = analytics.reportingConfigured && analyticsProjectIdentityVerified;
  const googleAnalyticsReady = analytics.measurementIdConfigured && googleReportingIdentityReady;
  const postHogReady = analytics.interactionCollectionConfigured && analytics.interactionReportingConfigured;

  return [
    {
      id: 'vercel',
      name: 'Vercel',
      category: 'Hosting & domain',
      identifier: 'pyralis-projects/card-forge',
      status: configuredPublicAppUrl ? 'ready' : 'attention',
      statusLabel: configuredPublicAppUrl ? 'Production URL configured' : 'Needs production URL',
      purpose: 'Deploys main, serves cardforges.com, and owns production environment configuration.',
      ownership: 'Vercel owns deployments and runtime settings; GitHub main owns the deployed code.',
      removalImpact: 'The public site, APIs, and production environment stop serving.',
      dashboardUrl: 'https://vercel.com/pyralis-projects/card-forge',
    },
    {
      id: 'clerk',
      name: 'Clerk',
      category: 'Authentication',
      identifier: 'CardForge Studio / production',
      status: authConfigured ? 'ready' : 'attention',
      statusLabel: authConfigured ? 'Authentication ready' : 'Needs configuration',
      purpose: 'Owns user identity, sessions, linked Google accounts, and trusted private access metadata.',
      ownership: 'Clerk owns identity records; CardForge interprets private role and entitlement metadata.',
      removalImpact: 'Sign-in and protected account, developer, and owner access stop working.',
      dashboardUrl: 'https://dashboard.clerk.com/apps/app_3E5x4ZR97Ova0xeYdbEuAwZN3NN/instances/ins_3GVR7AEctqBma6sg1j5K05r66lN',
    },
    {
      id: 'google-authentication',
      name: 'Google Cloud — Authentication',
      category: 'Authentication',
      identifier: 'cardforge-authentication',
      status: 'reference',
      statusLabel: 'Provider-managed',
      purpose: 'Owns the production Google OAuth client connected to Clerk.',
      ownership: 'Google owns OAuth consent and credentials; Clerk owns the resulting CardForge session.',
      removalImpact: 'Google sign-in fails with a deleted-client authorization error.',
      dashboardUrl: 'https://console.cloud.google.com/auth/overview?project=cardforge-authentication',
    },
    {
      id: 'supabase',
      name: 'Supabase',
      category: 'Database & media',
      identifier: 'mpmmhjjhdxjedbmuctiv',
      status: supabaseConfigured ? 'ready' : 'attention',
      statusLabel: supabaseConfigured ? 'Database ready' : 'Needs configuration',
      purpose: 'Owns shared CardForge records, approved media, asset pipeline state, and durable operational history.',
      ownership: 'Supabase owns shared data and storage; browser-local creator projects remain outside it.',
      removalImpact: 'Shared libraries, owner settings, pipeline history, billing records, and public media fail.',
      dashboardUrl: 'https://supabase.com/dashboard/project/mpmmhjjhdxjedbmuctiv',
    },
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'Payments',
      identifier: 'CardForge production account',
      status: billingReady ? 'ready' : 'attention',
      statusLabel: billingReady ? 'Billing ready' : (creatorPassReady ? 'Creator Pass only' : 'Needs configuration'),
      purpose: 'Owns Creator Pass checkout, support payments, subscriptions, webhooks, and customer billing history.',
      ownership: 'Stripe is authoritative for money; CardForge projects access from verified provider events.',
      removalImpact: 'New checkout, billing portal access, and subscription reconciliation stop working.',
      dashboardUrl: 'https://dashboard.stripe.com/',
    },
    {
      id: 'resend',
      name: 'Resend',
      category: 'Email',
      identifier: 'cardforges.com',
      status: emailDeliveryReady ? 'ready' : 'attention',
      statusLabel: emailDeliveryReady ? 'Delivery ready' : (emailProviderConfigured ? 'Delivery settings incomplete' : 'Mailto fallback'),
      purpose: 'Sends transactional support and account email from the CardForge domain.',
      ownership: 'Resend owns delivery; CardForge owns message intent, recipients, and support history.',
      removalImpact: 'Server-delivered email falls back or fails; saved contact requests remain in CardForge.',
      dashboardUrl: 'https://resend.com/domains',
    },
    {
      id: 'google-analytics-cloud',
      name: 'Google Cloud — Analytics',
      category: 'Measurement',
      identifier: 'cardforge-analytics',
      status: googleReportingIdentityReady && analytics.searchConsoleConfigured ? 'ready' : 'attention',
      statusLabel: googleReportingIdentityReady && analytics.searchConsoleConfigured
        ? 'Reporting access ready'
        : (analytics.reportingConfigured && !analyticsProjectIdentityVerified ? 'Service identity mismatch' : 'Needs reporting access'),
      purpose: 'Owns the least-privilege service account used for GA4 and Search Console owner reports.',
      ownership: 'Google Cloud owns the service identity; Analytics and Search Console own their records.',
      removalImpact: 'Owner reports lose Google data access; browser collection and Google indexing continue independently.',
      dashboardUrl: 'https://console.cloud.google.com/home/dashboard?project=cardforge-analytics',
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      category: 'Measurement',
      identifier: 'Property 549585753',
      status: googleAnalyticsReady ? (analytics.collectionEnabled ? 'ready' : 'disabled') : 'attention',
      statusLabel: googleAnalyticsReady ? (analytics.collectionEnabled ? 'Consented collection ready' : 'Reporting only') : 'Needs configuration',
      purpose: 'Owns consented acquisition, campaign, and product-adoption measurement.',
      ownership: 'Google owns measurement records; CardForge sends only approved events after consent.',
      removalImpact: 'Acquisition and adoption reporting disappears; the site continues operating.',
      dashboardUrl: 'https://analytics.google.com/analytics/web/#/a404377235p549585753',
    },
    {
      id: 'search-console',
      name: 'Google Search Console',
      category: 'Search discovery',
      identifier: 'sc-domain:cardforges.com',
      status: analytics.searchConsoleConfigured && analyticsProjectIdentityVerified ? 'ready' : 'attention',
      statusLabel: analytics.searchConsoleConfigured && analyticsProjectIdentityVerified
        ? 'Reporting ready'
        : (analytics.searchConsoleConfigured ? 'Service identity mismatch' : 'Needs reporting access'),
      purpose: 'Owns Google indexing, sitemap status, search queries, impressions, clicks, and position data.',
      ownership: 'Search Console owns discovery records independently of optional browser analytics.',
      removalImpact: 'CardForge loses search diagnostics and owner reports; Google may still index public pages.',
      dashboardUrl: 'https://search.google.com/search-console?resource_id=sc-domain%3Acardforges.com',
    },
    {
      id: 'posthog',
      name: 'PostHog',
      category: 'Product interactions',
      identifier: 'Project 555175',
      status: postHogReady ? (analytics.collectionEnabled ? 'ready' : 'disabled') : 'attention',
      statusLabel: postHogReady ? (analytics.collectionEnabled ? 'Consented events ready' : 'Collection disabled') : 'Needs configuration',
      purpose: 'Owns anonymous allow-listed interaction events used by the Owner Analytics screen.',
      ownership: 'PostHog owns event records; CardForge disables replay, autocapture, profiles, and private-page collection.',
      removalImpact: 'Interaction reporting disappears; core product behavior and GA4 remain available.',
      dashboardUrl: 'https://us.posthog.com/project/555175',
    },
    {
      id: 'buffer',
      name: 'Buffer',
      category: 'Social publishing',
      identifier: buffer.organizationId ?? 'Not connected',
      status: buffer.configured ? (buffer.publishingEnabled ? 'ready' : 'disabled') : 'attention',
      statusLabel: buffer.configured ? (buffer.publishingEnabled ? 'Publishing enabled' : 'Connected, publishing disabled') : 'Not connected',
      purpose: 'May own channel connections, scheduling, retries, and delivery after the owner rollout gate is enabled.',
      ownership: 'CardForge owns campaign media and approval history; Buffer owns only provider delivery.',
      removalImpact: 'Provider scheduling stops; CardForge campaign packages and media remain intact.',
      dashboardUrl: 'https://publish.buffer.com/',
    },
    {
      id: 'github',
      name: 'GitHub',
      category: 'Source & releases',
      identifier: 'pyralisxc/CardForge',
      status: 'reference',
      statusLabel: 'Source of truth',
      purpose: 'Owns code history, pull requests, reviews, checks, and release traceability.',
      ownership: 'GitHub owns development history; CardForge and Supabase own runtime content and media history.',
      removalImpact: 'Development history, collaboration, and automated verification are lost; the deployed site does not immediately stop.',
      dashboardUrl: 'https://github.com/pyralisxc/CardForge',
    },
  ];
};

export const getOwnerIntegrationStatus = () => {
  const publicAppUrl = getPublicAppUrl();
  const configuredPublicAppUrl = getConfiguredPublicAppUrl();
  const analytics = getAnalyticsConfigurationStatus();
  const authConfigured = isClerkAuthConfigured();
  const billing = getBillingConfigStatus();
  const supabase = getSupabaseServerConfigStatus();
  const emailProviderConfigured = Boolean(process.env.RESEND_API_KEY);
  const emailDeliveryReady = emailProviderConfigured
    && Boolean(process.env.CARDFORGE_EMAIL_FROM)
    && Boolean(process.env.CARDFORGE_EMAIL_REPLY_TO);
  const analyticsProjectIdentityVerified = (process.env.CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim().toLowerCase() ?? '')
    .endsWith('@cardforge-analytics.iam.gserviceaccount.com');
  return {
    site: { publicAppUrl, configuredPublicAppUrl, usingLocalFallback: !configuredPublicAppUrl, sitemapUrl: `${publicAppUrl}/sitemap.xml`, robotsUrl: `${publicAppUrl}/robots.txt` },
    authConfigured,
    billing,
    supabase,
    ownerAllowlistConfigured: Boolean(process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS),
    analytics,
    email: {
      contactMode: process.env.RESEND_API_KEY ? 'ready_for_server_delivery' as const : 'mailto' as const,
      resendConfigured: emailProviderConfigured,
      fromConfigured: Boolean(process.env.CARDFORGE_EMAIL_FROM),
      replyToConfigured: Boolean(process.env.CARDFORGE_EMAIL_REPLY_TO),
      missing: [!process.env.RESEND_API_KEY ? 'RESEND_API_KEY' : null, !process.env.CARDFORGE_EMAIL_FROM ? 'CARDFORGE_EMAIL_FROM' : null, !process.env.CARDFORGE_EMAIL_REPLY_TO ? 'CARDFORGE_EMAIL_REPLY_TO' : null].filter((value): value is string => Boolean(value)),
    },
    connectedServices: buildConnectedServices({
      analytics,
      analyticsProjectIdentityVerified,
      authConfigured,
      billing,
      configuredPublicAppUrl,
      emailDeliveryReady,
      emailProviderConfigured,
      supabaseConfigured: supabase.configured,
    }),
  };
};
