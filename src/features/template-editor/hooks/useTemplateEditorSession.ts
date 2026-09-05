"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CARD_FONT_OPTIONS,
  cardFontOptionsToSelectOptions,
  createPipelineFontFaceCss,
  mergeCardFontOptions,
  type CardFontOption,
} from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { reconstructMinimalTemplate } from '@/domain/templates';
import { useTemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';
import { loadCardForgeStudioBootstrap } from '@/features/pipeline/client/catalog';
import { mapProjectFontsToCardFontOptions, PROJECT_FONT_LIBRARY_CHANGE_EVENT, readProjectFonts } from '@/features/project/client/assets';
import { useProjectBinaryAssetValue } from '@/features/project/client/binary-assets';

interface UseTemplateEditorSessionInput {
  isActive: boolean;
  selectedTemplateId: string | null;
  templates: TCGCardTemplate[];
}

interface ResolveInitialTemplateInput {
  recoveredDraft: TCGCardTemplate | null;
  selectedTemplateId: string | null;
  templates: TCGCardTemplate[];
}

export const resolveTemplateEditorInitialTemplate = ({
  recoveredDraft,
  selectedTemplateId,
  templates,
}: ResolveInitialTemplateInput): TCGCardTemplate => {
  if (recoveredDraft) return recoveredDraft;
  const selected = templates.find((template) => template.id === selectedTemplateId);
  return reconstructMinimalTemplate(selected ?? templates[0] ?? makeNewFreeformTemplate());
};

export function useTemplateEditorSession({
  isActive,
  selectedTemplateId,
  templates,
}: UseTemplateEditorSessionInput) {
  const [fontOptions, setFontOptions] = useState<CardFontOption[]>(CARD_FONT_OPTIONS);
  const [fontFailure, setFontFailure] = useState<string | null>(null);
  const [fontLoadAttempt, setFontLoadAttempt] = useState(0);
  const [savedTemplateJson, setSavedTemplateJson] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) return;
    let mounted = true;

    const loadFonts = async () => {
      try {
        const [bootstrapResult, projectFonts] = await Promise.all([
          loadCardForgeStudioBootstrap(),
          readProjectFonts(),
        ]);
        if (!mounted) return;
        setFontOptions(mergeCardFontOptions(
          mergeCardFontOptions(CARD_FONT_OPTIONS, bootstrapResult.fonts.fonts),
          mapProjectFontsToCardFontOptions(projectFonts),
        ));
        setFontFailure(null);
      } catch {
        if (mounted) setFontFailure('Some fonts could not be loaded. Your font choices are unchanged; previews may use fallback fonts until you retry.');
      }
    };

    void loadFonts();
    const onFontsChanged = () => { void loadFonts(); };
    window.addEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, onFontsChanged);
    return () => {
      mounted = false;
      window.removeEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, onFontsChanged);
    };
  }, [isActive, fontLoadAttempt]);

  const initialTemplate = useMemo(() => {
    return resolveTemplateEditorInitialTemplate({ recoveredDraft: null, selectedTemplateId, templates });
  }, [selectedTemplateId, templates]);
  const initialTemplateRef = useRef(initialTemplate);
  initialTemplateRef.current = initialTemplate;

  const controller = useTemplateEditorController(initialTemplate);
  const contributorFontFaceCss = useProjectBinaryAssetValue(createPipelineFontFaceCss(fontOptions));

  useEffect(() => {
    setSavedTemplateJson(JSON.stringify(reconstructMinimalTemplate(initialTemplateRef.current)));
  }, [initialTemplate.id]);

  const beginDraft = useCallback((template: TCGCardTemplate) => {
    setSavedTemplateJson(JSON.stringify(reconstructMinimalTemplate(template)));
    controller.resetTemplate(template);
  }, [controller]);

  const acceptTemplate = useCallback((template: TCGCardTemplate) => {
    setSavedTemplateJson(JSON.stringify(reconstructMinimalTemplate(template)));
    controller.resetTemplate(template);
  }, [controller]);

  return {
    acceptTemplate,
    availableFonts: cardFontOptionsToSelectOptions(fontOptions),
    beginDraft,
    controller,
    contributorFontFaceCss,
    fontFailure,
    retryFonts: () => setFontLoadAttempt((attempt) => attempt + 1),
    isDirty: savedTemplateJson !== null && savedTemplateJson !== JSON.stringify(reconstructMinimalTemplate(controller.currentTemplate)),
    isHydrated: true,
  };
}
