"use client";

import { useSyncExternalStore } from 'react';

import {
  getBrowserWorkspaceSaveStatus,
  subscribeToBrowserWorkspaceSaveStatus,
} from '@/features/project/persistence/indexedDbStorage';
import type { BrowserStorageSaveStatus } from '@/features/project/persistence/indexedDbStorage';

const getServerSnapshot = (): BrowserStorageSaveStatus => 'saved';

export function useBrowserWorkspaceSaveStatus(): BrowserStorageSaveStatus {
  return useSyncExternalStore(
    subscribeToBrowserWorkspaceSaveStatus,
    getBrowserWorkspaceSaveStatus,
    getServerSnapshot,
  );
}
