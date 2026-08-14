"use client";

import { createContext, useContext, type ReactNode } from 'react';

import {
  createSiteContentMap,
  DEFAULT_SITE_CONTENT_BLOCKS,
  type SiteContentMap,
} from '../model/siteContent';

const PublicSiteContentContext = createContext<SiteContentMap>(
  createSiteContentMap(DEFAULT_SITE_CONTENT_BLOCKS),
);

export function SiteContentProvider({
  children,
  content,
}: {
  children: ReactNode;
  content: SiteContentMap;
}) {
  return (
    <PublicSiteContentContext.Provider value={content}>
      {children}
    </PublicSiteContentContext.Provider>
  );
}

export const useSiteContent = (): SiteContentMap => useContext(PublicSiteContentContext);
