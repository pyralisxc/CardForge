import { type ReactNode } from 'react';

import type { BusinessIdentity } from '@/features/business-identity/client';
import { PublicSiteFooter } from './PublicSiteFooter';
import { PublicSiteHeader } from './PublicSiteHeader';

export interface PublicSiteShellProps {
  accountSlot?: ReactNode;
  businessIdentity: BusinessIdentity;
  children: ReactNode;
  currentPath?: string;
  mainClassName?: string;
}

export function PublicSiteShell({
  accountSlot,
  businessIdentity,
  children,
  currentPath,
  mainClassName,
}: PublicSiteShellProps) {
  return (
    <div className="cardforge-public min-h-screen">
      <a href="#main-content" className="cardforge-public-skip-link">
        Skip to main content
      </a>
      <PublicSiteHeader
        accountSlot={accountSlot}
        businessIdentity={businessIdentity}
        currentPath={currentPath}
      />
      <main id="main-content" tabIndex={-1} className={mainClassName}>
        {children}
      </main>
      <PublicSiteFooter businessIdentity={businessIdentity} />
    </div>
  );
}
