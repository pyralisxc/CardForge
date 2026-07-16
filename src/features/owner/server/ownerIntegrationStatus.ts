import { isClerkAuthConfigured } from '@/features/account/server';
import { getBillingConfigStatus } from '@/features/billing/server';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';
import { getConfiguredPublicAppUrl, getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export const getOwnerIntegrationStatus = () => {
  const publicAppUrl = getPublicAppUrl();
  const configuredPublicAppUrl = getConfiguredPublicAppUrl();
  return {
    site: { publicAppUrl, configuredPublicAppUrl, usingLocalFallback: !configuredPublicAppUrl, sitemapUrl: `${publicAppUrl}/sitemap.xml`, robotsUrl: `${publicAppUrl}/robots.txt` },
    authConfigured: isClerkAuthConfigured(),
    billing: getBillingConfigStatus(),
    supabase: getSupabaseServerConfigStatus(),
    ownerAllowlistConfigured: Boolean(process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS),
    email: {
      contactMode: process.env.RESEND_API_KEY ? 'ready_for_server_delivery' as const : 'mailto' as const,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      fromConfigured: Boolean(process.env.CARDFORGE_EMAIL_FROM),
      replyToConfigured: Boolean(process.env.CARDFORGE_EMAIL_REPLY_TO),
      missing: [!process.env.RESEND_API_KEY ? 'RESEND_API_KEY' : null, !process.env.CARDFORGE_EMAIL_FROM ? 'CARDFORGE_EMAIL_FROM' : null, !process.env.CARDFORGE_EMAIL_REPLY_TO ? 'CARDFORGE_EMAIL_REPLY_TO' : null].filter((value): value is string => Boolean(value)),
    },
    links: [
      { label: 'Clerk Dashboard', href: 'https://dashboard.clerk.com/' },
      { label: 'Supabase Project', href: 'https://supabase.com/dashboard/project/mpmmhjjhdxjedbmuctiv' },
      { label: 'Stripe Dashboard', href: 'https://dashboard.stripe.com/' },
      { label: 'Resend Dashboard', href: 'https://resend.com/domains' },
      { label: 'Vercel Dashboard', href: 'https://vercel.com/dashboard' },
      { label: 'OpenAI Platform', href: 'https://platform.openai.com/' },
    ],
  };
};
