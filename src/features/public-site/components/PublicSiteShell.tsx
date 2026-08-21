import { type ReactNode } from 'react';

import type { BusinessIdentity } from '@/features/business-identity/client';
import type { PublicSiteConfiguration } from '@/features/public-site/model/siteConfiguration';
import { PublicSiteFooter } from './PublicSiteFooter';
import { PublicSiteHeader } from './PublicSiteHeader';

export interface PublicSiteShellProps {
  accountSlot?: ReactNode;
  businessIdentity: BusinessIdentity;
  children: ReactNode;
  currentPath?: string;
  mainClassName?: string;
  siteConfiguration: PublicSiteConfiguration;
}

export function PublicSiteShell({
  accountSlot,
  businessIdentity,
  children,
  currentPath,
  mainClassName,
  siteConfiguration,
}: PublicSiteShellProps) {
  return (
    <div className="cardforge-public min-h-screen">
      <a href="#main-content" className="cardforge-public-skip-link">
        Skip to main content
      </a>
      {siteConfiguration.announcementEnabled ? (
        <div role="status" className="border-b border-[var(--public-brass)] bg-[var(--cf-surface-hover)] px-5 py-2 text-center text-sm font-semibold text-[var(--public-ivory)]">
          {siteConfiguration.announcementMessage}
        </div>
      ) : null}
      <PublicSiteHeader
        accountSlot={accountSlot}
        businessIdentity={businessIdentity}
        currentPath={currentPath}
        siteConfiguration={siteConfiguration}
      />
      <main id="main-content" tabIndex={-1} className={mainClassName}>
        {children}
      </main>
      <PublicSiteFooter businessIdentity={businessIdentity} />
    </div>
  );
}
