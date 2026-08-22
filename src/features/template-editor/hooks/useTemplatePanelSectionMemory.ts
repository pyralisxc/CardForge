"use client";

import { useCallback, useRef, useState } from 'react';

export interface TemplatePanelSectionMemory {
  activeSectionId: string;
  pinnedSectionIds: string[];
}

interface UseTemplatePanelSectionMemoryInput {
  contextKey: string;
  sectionIds: string[];
  defaultSectionId: string;
  maxContexts?: number;
}

export function normalizeTemplatePanelSectionMemory(
  memory: TemplatePanelSectionMemory | undefined,
  sectionIds: string[],
  defaultSectionId: string,
): TemplatePanelSectionMemory {
  if (sectionIds.length === 0) {
    return { activeSectionId: '', pinnedSectionIds: [] };
  }

  const available = new Set(sectionIds);
  const fallback = available.has(defaultSectionId) ? defaultSectionId : sectionIds[0]!;
  return {
    activeSectionId: memory && available.has(memory.activeSectionId) ? memory.activeSectionId : fallback,
    pinnedSectionIds: memory?.pinnedSectionIds.filter((sectionId) => available.has(sectionId)) ?? [],
  };
}

export function touchRecentTemplatePanelContext(
  recentContextKeys: string[],
  contextKey: string,
  maxContexts = 10,
) {
  return [contextKey, ...recentContextKeys.filter((key) => key !== contextKey)].slice(0, Math.max(1, maxContexts));
}

export function useTemplatePanelSectionMemory({
  contextKey,
  sectionIds,
  defaultSectionId,
  maxContexts = 10,
}: UseTemplatePanelSectionMemoryInput) {
  const [memoryByContext, setMemoryByContext] = useState<Record<string, TemplatePanelSectionMemory>>({});
  const recentContextKeysRef = useRef<string[]>([]);
  const currentMemory = normalizeTemplatePanelSectionMemory(
    memoryByContext[contextKey],
    sectionIds,
    defaultSectionId,
  );

  const updateCurrentMemory = useCallback((
    updater: (memory: TemplatePanelSectionMemory) => TemplatePanelSectionMemory,
  ) => {
    setMemoryByContext((currentStore) => {
      const normalized = normalizeTemplatePanelSectionMemory(
        currentStore[contextKey],
        sectionIds,
        defaultSectionId,
      );
      const nextMemory = normalizeTemplatePanelSectionMemory(
        updater(normalized),
        sectionIds,
        defaultSectionId,
      );
      const recentContextKeys = touchRecentTemplatePanelContext(
        recentContextKeysRef.current,
        contextKey,
        maxContexts,
      );
      recentContextKeysRef.current = recentContextKeys;
      const retainedKeys = new Set(recentContextKeys);
      const nextStore = { ...currentStore, [contextKey]: nextMemory };
      for (const key of Object.keys(nextStore)) {
        if (!retainedKeys.has(key)) delete nextStore[key];
      }
      return nextStore;
    });
  }, [contextKey, defaultSectionId, maxContexts, sectionIds]);

  const setActiveSection = useCallback((sectionId: string) => {
    if (!sectionIds.includes(sectionId)) return;
    updateCurrentMemory((memory) => ({ ...memory, activeSectionId: sectionId }));
  }, [sectionIds, updateCurrentMemory]);

  const togglePinnedSection = useCallback((sectionId: string) => {
    if (!sectionIds.includes(sectionId)) return;
    updateCurrentMemory((memory) => ({
      ...memory,
      pinnedSectionIds: memory.pinnedSectionIds.includes(sectionId)
        ? memory.pinnedSectionIds.filter((id) => id !== sectionId)
        : [...memory.pinnedSectionIds, sectionId],
    }));
  }, [sectionIds, updateCurrentMemory]);

  return {
    activeSectionId: currentMemory.activeSectionId,
    pinnedSectionIds: currentMemory.pinnedSectionIds,
    setActiveSection,
    togglePinnedSection,
  };
}
