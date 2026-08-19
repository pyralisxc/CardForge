"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { AnalyticsProvider } from '@/features/analytics/client';
import type { AnalyticsConsentPresentation } from '@/features/experience-settings/client';

const PRIVATE_PATH_PREFIXES = ['/owner', '/developer/cockpit'] as const;

export function ScopedAnalyticsProvider({
  presentation,
}: {
  presentation: AnalyticsConsentPresentation;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  return createPortal(<AnalyticsProvider presentation={presentation} />, document.body);
}
