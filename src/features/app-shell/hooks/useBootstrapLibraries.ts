"use client";

import { useEffect, useState } from 'react';

import { loadBootstrapStyles, loadBootstrapTemplates } from '@/lib/clientBootstrapData';
import type { AppearanceStyleLibrary, AppearanceStylePreset, TCGCardTemplate } from '@/types';

interface UseBootstrapLibrariesInput {
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  setDefaultTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => void;
  setUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
}

export function useBootstrapLibraries({
  setAppearanceStylesFromFiles,
  setDefaultTemplatesFromFiles,
  setUserTemplatesFromFiles,
}: UseBootstrapLibrariesInput) {
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPipelineTemplates = async () => {
      try {
        const payload = await loadBootstrapTemplates();
        if (cancelled) return;
        setDefaultTemplatesFromFiles(Array.isArray(payload.defaults) ? payload.defaults : []);
        setUserTemplatesFromFiles(Array.isArray(payload.userTemplates) ? payload.userTemplates : []);
      } catch (error) {
        console.warn('Unable to load pipeline templates:', error);
      } finally {
        if (!cancelled) setIsLoadingTemplates(false);
      }
    };

    loadPipelineTemplates();
    return () => {
      cancelled = true;
    };
  }, [setDefaultTemplatesFromFiles, setUserTemplatesFromFiles]);

  useEffect(() => {
    let cancelled = false;

    const loadPipelineStyles = async () => {
      try {
        const payload = await loadBootstrapStyles() as Partial<AppearanceStyleLibrary>;
        if (cancelled || !Array.isArray(payload.styles)) return;
        setAppearanceStylesFromFiles(payload.styles);
      } catch (error) {
        console.warn('Unable to load pipeline styles:', error);
      }
    };

    loadPipelineStyles();
    return () => {
      cancelled = true;
    };
  }, [setAppearanceStylesFromFiles]);

  return { isLoadingTemplates };
}
