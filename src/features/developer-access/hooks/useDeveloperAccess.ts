"use client";

import { useEffect, useState } from 'react';

import {
  EMPTY_DEVELOPER_ACCESS_PROJECTION,
  type DeveloperAccessProjection,
} from '@/features/developer-access/model';

export const useDeveloperAccess = (): DeveloperAccessProjection & { isLoading: boolean } => {
  const [projection, setProjection] = useState<DeveloperAccessProjection>(EMPTY_DEVELOPER_ACCESS_PROJECTION);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/developer-access', { cache: 'no-store' })
      .then(async (response) => response.ok
        ? await response.json() as DeveloperAccessProjection
        : EMPTY_DEVELOPER_ACCESS_PROJECTION)
      .then((value) => {
        if (!cancelled) setProjection(value);
      })
      .catch(() => {
        if (!cancelled) setProjection(EMPTY_DEVELOPER_ACCESS_PROJECTION);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...projection, isLoading };
};
