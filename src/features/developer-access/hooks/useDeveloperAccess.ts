"use client";

import { useEffect, useState } from 'react';

import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  type DeveloperAccessProjection,
} from '@/features/developer-access/model';
import { CARDFORGE_AUTH_READY_EVENT } from '@/infrastructure/auth/browserSession';

export const useDeveloperAccess = (): DeveloperAccessProjection & { isLoading: boolean } => {
  const [projection, setProjection] = useState<DeveloperAccessProjection>(EMPTY_DEVELOPER_ACCESS_PROJECTION);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requestNumber = 0;

    const load = () => {
      const currentRequest = ++requestNumber;
      void fetch('/api/developer-access', { cache: 'no-store' })
        .then(async (response) => response.ok
          ? await response.json() as DeveloperAccessProjection
          : EMPTY_DEVELOPER_ACCESS_PROJECTION)
        .then((value) => {
          if (!cancelled && currentRequest === requestNumber) setProjection(value);
        })
        .catch(() => {
          if (!cancelled && currentRequest === requestNumber) {
            setProjection(EMPTY_DEVELOPER_ACCESS_PROJECTION);
          }
        })
        .finally(() => {
          if (!cancelled && currentRequest === requestNumber) setIsLoading(false);
        });
    };

    load();
    window.addEventListener(CARDFORGE_AUTH_READY_EVENT, load);

    return () => {
      cancelled = true;
      window.removeEventListener(CARDFORGE_AUTH_READY_EVENT, load);
    };
  }, []);

  return { ...projection, isLoading };
};
