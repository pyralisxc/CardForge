"use client";

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { isPublicAnalyticsReplayPath } from '../client/posthog';

export function AnalyticsReplayBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const replayAllowed = isPublicAnalyticsReplayPath(pathname);

  return (
    <div
      id="cardforge-app-content"
      className={replayAllowed ? undefined : 'ph-no-capture'}
      data-analytics-replay={replayAllowed ? 'public' : 'blocked'}
    >
      {children}
    </div>
  );
}
