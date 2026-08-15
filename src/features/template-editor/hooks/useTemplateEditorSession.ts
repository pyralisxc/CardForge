"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CARD_FONT_OPTIONS,
  cardFontOptionsToSelectOptions,
  createDeveloperFontFaceCss,
  mergeCardFontOptions,
  type CardFontOption,
} from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { reconstructMinimalTemplate } from '@/domain/templates';
import { useTemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';
import { loadCardForgeCatalog } from '@/features/developer-assets/client/catalog';

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
  selectedTemplateId,
  templates,
}: UseTemplateEditorSessionInput) {
  const [fontOptions, setFontOptions] = useState<CardFontOption[]>(CARD_FONT_OPTIONS);
  const [savedTemplateJson, setSavedTemplateJson] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadCardForgeCatalog()
      .then((payload) => {
        if (mounted) setFontOptions(mergeCardFontOptions(CARD_FONT_OPTIONS, payload.fonts.fonts ?? []));
      })
      .catch(() => {
        if (mounted) setFontOptions(CARD_FONT_OPTIONS);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const initialTemplate = useMemo(() => {
    return resolveTemplateEditorInitialTemplate({ recoveredDraft: null, selectedTemplateId, templates });
  }, [selectedTemplateId, templates]);
  const initialTemplateRef = useRef(initialTemplate);
  initialTemplateRef.current = initialTemplate;

  const controller = useTemplateEditorController(initialTemplate);


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
    developerFontFaceCss: createDeveloperFontFaceCss(fontOptions),
    isDirty: savedTemplateJson !== null && savedTemplateJson !== JSON.stringify(reconstructMinimalTemplate(controller.currentTemplate)),
    isHydrated: true,
  };
}
