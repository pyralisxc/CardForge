"use client";

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Code2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PublicAuthControls } from '@/features/account/client/auth';
import { useAccountEntitlement } from '@/features/account/client/entitlement';
import { useDeveloperAccess } from '@/features/developer-access/hooks/useDeveloperAccess';
import type { DeveloperAccessSessionState } from '@/features/developer-access/model';

export function DeveloperPublicAuthControls({
  initialDeveloperAccess,
}: {
  initialDeveloperAccess: DeveloperAccessSessionState;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const reconciledUserRef = useRef<string | null>(null);
  const {
    accountUserId,
    isLoadingEntitlement,
    isSignedIn: isAccountSignedIn,
    refreshEntitlement,
  } = useAccountEntitlement({ initialAuthConfigured: true });
  const userId = isLoaded && isSignedIn ? user?.id ?? null : null;
  const serverSessionMatches = Boolean(userId && initialDeveloperAccess.sessionKey === userId);
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
  const developerAccess = useDeveloperAccess(
    serverSessionMatches || accountSessionConfirmed ? userId : null,
    initialDeveloperAccess,
  );

  const developerShortcut = developerAccess.hasCockpitAccess ? (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="gap-2 border-[#8a642f] bg-transparent text-[#f0c568] hover:bg-[#241a0f] hover:text-[#ffe7ad]"
    >
      <Link href={developerAccess.cockpitHref} prefetch={false}>
        <Code2 className="h-4 w-4" aria-hidden="true" /> Developer
      </Link>
    </Button>
  ) : undefined;

  return <PublicAuthControls signedInAccessory={developerShortcut} />;
}
