"use client";

import { createContext, useContext, type ReactNode } from 'react';

import { DEFAULT_FOUNDER_PROFILE, type FounderProfile } from '../model/founderProfile';

const FounderProfileContext = createContext<FounderProfile>(DEFAULT_FOUNDER_PROFILE);

export function FounderProfileProvider({ profile, children }: { profile: FounderProfile; children: ReactNode }) {
  return <FounderProfileContext.Provider value={profile}>{children}</FounderProfileContext.Provider>;
}

export const useFounderProfile = (): FounderProfile => useContext(FounderProfileContext);
