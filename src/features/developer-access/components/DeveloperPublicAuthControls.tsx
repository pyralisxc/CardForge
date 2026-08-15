"use client";

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Code2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PublicAuthControls } from '@/features/account/client/auth';
import { useAccountEntitlement } from '@/features/account/client/entitlement';

export function DeveloperPublicAuthControls() {
  const { isLoaded, isSignedIn, user } = useUser();
  const reconciledUserRef = useRef<string | null>(null);
  const {
    accessMode,
    accountUserId,
    isLoadingEntitlement,
    isSignedIn: isAccountSignedIn,
    refreshEntitlement,
  } = useAccountEntitlement({ initialAuthConfigured: true });
  const userId = isLoaded && isSignedIn ? user?.id ?? null : null;
  const accountSessionConfirmed = Boolean(
    userId
    && isAccountSignedIn
    && accountUserId === userId,
  );
  useEffect(() => {
    if (!userId) {
      reconciledUserRef.current = null;
      return;
    }
    if (
      isLoadingEntitlement
      || accountSessionConfirmed
      || reconciledUserRef.current === userId
    ) return;
    reconciledUserRef.current = userId;
    const reconciliationTimer = window.setTimeout(() => {
      void refreshEntitlement({ force: true });
    }, 1000);
    return () => window.clearTimeout(reconciliationTimer);
  }, [
    isLoadingEntitlement,
    refreshEntitlement,
    accountSessionConfirmed,
    userId,
  ]);

  const developerShortcut = accountSessionConfirmed && accessMode === 'dev' ? (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="gap-2 border-[#8a642f] bg-transparent text-[#f0c568] hover:bg-[#241a0f] hover:text-[#ffe7ad]"
    >
      <Link href="/developer/cockpit" prefetch={false}>
        <Code2 className="h-4 w-4" aria-hidden="true" /> Developer
      </Link>
    </Button>
  ) : undefined;

  return <PublicAuthControls signedInAccessory={developerShortcut} />;
}
