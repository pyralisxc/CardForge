import type { Metadata } from 'next';

import { AccountProfilePage } from '@/features/account/components/AccountProfilePage';
import { isClerkServerConfigPresent } from '@/lib/clerkConfig';

export const metadata: Metadata = {
  title: 'My Forge | CardForge Account',
  description: 'Manage CardForge account access, local asset library status, clean export entitlement, and role-specific forge links.',
};

export default function AccountPage() {
  return <AccountProfilePage initialAuthConfigured={isClerkServerConfigPresent()} />;
}
