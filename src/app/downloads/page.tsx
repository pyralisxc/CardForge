import Link from 'next/link';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { ConfiguredPublicSiteShell } from '@/features/public-site/server';
import { PluginDownloadLinks } from '@/features/plugin-distribution/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'CardForge plugin downloads',
  description: 'Download CardForge Studio and authorized Owner plugin releases and retained history.',
  path: '/downloads',
});

export default async function DownloadsPage() {
  const identity = await getCachedBusinessIdentity();
  // Owner markup must fail closed on identity failure while public Studio stays usable.
  const owner = await getCurrentCardforgeUserAccess().then(access => Boolean(access.user && access.ownerAccess.isOwner)).catch(() => false);
  return <CardForgeAppProviders>
    <ConfiguredPublicSiteShell businessIdentity={identity} currentPath="/downloads"
      accountSlot={isClerkServerConfigPresent() ? <ContributorPublicAuthSlot /> : undefined}>
      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-12 text-[var(--public-ivory)] md:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <p className="font-semibold text-[var(--public-brass)]">CardForge Studio</p>
          <h1 className="font-[var(--public-font-display)] text-4xl font-semibold">Plugin downloads</h1>
          <p className="max-w-3xl text-[var(--public-muted-text)]">Download Studio for a supported host, and Owner when signed in as CardForge Owner. Studio Production is public; Studio Preview retains its existing access policy. Downloading never installs a plugin or grants permissions.</p>
          <nav aria-label="Download page navigation" className="flex gap-6">
            <Link href="/" className="font-semibold text-[var(--public-brass)]">Return home</Link>
            <Link href="/account" className="font-semibold text-[var(--public-brass)]">Open your Desk</Link>
          </nav>
          <PluginDownloadLinks scope="studio" />
          {owner ? <div className="border-t border-[var(--public-border)] pt-8"><PluginDownloadLinks scope="owner" /></div> : null}
        </div>
      </section>
    </ConfiguredPublicSiteShell>
  </CardForgeAppProviders>;
}
