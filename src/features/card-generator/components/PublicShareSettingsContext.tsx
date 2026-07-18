"use client";

import { createContext, type ReactNode, useContext } from 'react';

import { createPublicShareSettings, type PublicShareSettings } from '../model/publicShareSettings';

const defaultSettings = createPublicShareSettings(
  'Check out CardForge Studio—a friendly way to design one card and build the whole set.',
  'https://cardforges.com',
);

const PublicShareSettingsContext = createContext<PublicShareSettings>(defaultSettings);

export function PublicShareSettingsProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings: PublicShareSettings;
}) {
  return (
    <PublicShareSettingsContext.Provider value={settings}>
      {children}
    </PublicShareSettingsContext.Provider>
  );
}

export const usePublicShareSettings = (): PublicShareSettings => (
  useContext(PublicShareSettingsContext)
);
