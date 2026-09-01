"use client";

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { getSafeLocalReturnPath } from './clerk';

export const useSafeCurrentReturnPath = (fallback = '/account'): string => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hash, setHash] = useState('');

  useEffect(() => {
    const readHash = () => setHash(window.location.hash);
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const query = searchParams.toString();
  return getSafeLocalReturnPath(`${pathname}${query ? `?${query}` : ''}${hash}`, fallback);
};
