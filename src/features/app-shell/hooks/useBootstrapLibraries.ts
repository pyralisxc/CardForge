"use client";

import { useCallback, useEffect, useState } from 'react';

import { loadCardForgeCatalog } from '@/features/developer-assets/client/catalog';
import type { AppearanceStyleLibrary, AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';

interface UseBootstrapLibrariesInput {
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  setDefaultTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => void;
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

    const loadPipelineTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const payload = (await loadCardForgeCatalog()).templates;
        if (cancelled) return;
        if (!Array.isArray(payload.defaults) || !Array.isArray(payload.userTemplates)) {
          throw new Error('Template library response is incomplete.');
        }
        setTemplateLibraryFailed(false);
        setDefaultTemplatesFromFiles(payload.defaults);
        mergeUserTemplatesFromFiles(payload.userTemplates);
      } catch (error) {
        console.warn('Unable to load pipeline templates:', error);
        if (!cancelled) setTemplateLibraryFailed(true);
      } finally {
        if (!cancelled) setIsLoadingTemplates(false);
      }
    };

    loadPipelineTemplates();
    return () => {
      cancelled = true;
    };
  }, [setDefaultTemplatesFromFiles, mergeUserTemplatesFromFiles, reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const loadPipelineStyles = async () => {
      try {
        const payload = (await loadCardForgeCatalog()).styles as Partial<AppearanceStyleLibrary>;
        if (cancelled) return;
        if (!Array.isArray(payload.styles)) throw new Error('Style library response is incomplete.');
        setStyleLibraryFailed(false);
        setAppearanceStylesFromFiles(payload.styles);
      } catch (error) {
        console.warn('Unable to load pipeline styles:', error);
        if (!cancelled) setStyleLibraryFailed(true);
      }
    };

    loadPipelineStyles();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, setAppearanceStylesFromFiles]);

  return {
    isLoadingTemplates,
    retryLibraries,
    styleLibraryFailed,
    templateLibraryFailed,
  };
}
