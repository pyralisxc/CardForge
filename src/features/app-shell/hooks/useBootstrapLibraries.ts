"use client";

import { useCallback, useEffect, useState } from 'react';

import { loadCardForgeStudioBootstrap } from '@/features/developer-assets/client/catalog';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';

interface UseBootstrapLibrariesInput {
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  setDefaultTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[], preferredTemplateId?: string | null) => void;
  mergeUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
}

export function useBootstrapLibraries({
  setAppearanceStylesFromFiles,
  setDefaultTemplatesFromFiles,
  mergeUserTemplatesFromFiles,
}: UseBootstrapLibrariesInput) {
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateLibraryFailed, setTemplateLibraryFailed] = useState(false);
  const [styleLibraryFailed, setStyleLibraryFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const retryLibraries = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStudioLibraries = async () => {
      setIsLoadingTemplates(true);
      try {
        const payload = await loadCardForgeStudioBootstrap();
        if (cancelled) return;

        if (!Array.isArray(payload.templates.defaults) || !Array.isArray(payload.templates.userTemplates)) {
          throw new Error('Template library response is incomplete.');
        }
        if (!Array.isArray(payload.styles.styles)) {
          throw new Error('Style library response is incomplete.');
        }

        setTemplateLibraryFailed(false);
        setStyleLibraryFailed(false);
        setDefaultTemplatesFromFiles(
          payload.templates.defaults,
          payload.studioDefaults?.defaultTemplateId ?? null,
        );
        mergeUserTemplatesFromFiles(payload.templates.userTemplates);
        setAppearanceStylesFromFiles(payload.styles.styles);
      } catch (error) {
        console.warn('Unable to load Studio libraries:', error);
        if (!cancelled) {
          setTemplateLibraryFailed(true);
          setStyleLibraryFailed(true);
        }
      } finally {
        if (!cancelled) setIsLoadingTemplates(false);
      }
    };

    void loadStudioLibraries();
    return () => {
      cancelled = true;
    };
  }, [
    mergeUserTemplatesFromFiles,
    reloadToken,
    setAppearanceStylesFromFiles,
    setDefaultTemplatesFromFiles,
  ]);

  return {
    isLoadingTemplates,
    retryLibraries,
    styleLibraryFailed,
    templateLibraryFailed,
  };
}
