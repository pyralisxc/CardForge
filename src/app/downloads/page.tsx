import Link from 'next/link';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { ContributorPublicAuthSlot } from '@/features/contributor-access/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { ConfiguredPublicSiteShell } from '@/features/public-site/server';
import { PluginDownloadLinks } from '@/features/plugin-distribution/client';
import { isClerkServerConfigPresent } from '@/infrastructure/auth/clerk';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'CardForge Studio plugin downloads',
  description: 'Download a complete CardForge Studio plugin for Production or authorized Preview testing.',
  path: '/downloads',
});

export default async function DownloadsPage() {
  const identity = await getCachedBusinessIdentity();
  return <CardForgeAppProviders>
    <ConfiguredPublicSiteShell businessIdentity={identity} currentPath="/downloads"
      accountSlot={isClerkServerConfigPresent() ? <ContributorPublicAuthSlot /> : undefined}>
      <section className="border-b border-[var(--public-border)] bg-[var(--public-obsidian)] px-5 py-12 text-[var(--public-ivory)] md:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <p className="font-semibold text-[var(--public-brass)]">CardForge Studio</p>
          <h1 className="font-[var(--public-font-display)] text-4xl font-semibold">Plugin downloads</h1>
          <p className="max-w-3xl text-[var(--public-muted-text)]">Get the complete Studio plugin for a supported host. Production is public; Preview is reserved for active Contributors and Owners. Downloading never installs a plugin or grants account access.</p>
          <nav aria-label="Download page navigation" className="flex gap-6">
            <Link href="/" className="font-semibold text-[var(--public-brass)]">Return home</Link>
            <Link href="/account" className="font-semibold text-[var(--public-brass)]">Open your Desk</Link>
          </nav>
          <PluginDownloadLinks scope="studio" />
        </div>
      </section>
    </ConfiguredPublicSiteShell>
  </CardForgeAppProviders>;
}
