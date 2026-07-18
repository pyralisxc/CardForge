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
import { loadEditorFonts } from '@/features/template-editor/services/editorBootstrap';

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

interface ResolveDraftPersistenceActionInput {
  currentTemplateJson: string;
  initialized: boolean;
  isActive: boolean;
  isHydrated: boolean;
  lastTemplateJson: string | null;
}

export const resolveDraftPersistenceAction = ({
  currentTemplateJson,
  initialized,
  isActive,
  isHydrated,
  lastTemplateJson,
}: ResolveDraftPersistenceActionInput): 'skip' | 'initialize' | 'write' => {
  if (!isActive || !isHydrated) return 'skip';
  if (!initialized) return 'initialize';
  return lastTemplateJson === currentTemplateJson ? 'skip' : 'write';
};

export function useTemplateEditorSession({
  isActive,
  selectedTemplateId,
  templates,
}: UseTemplateEditorSessionInput) {
  const [fontOptions, setFontOptions] = useState<CardFontOption[]>(CARD_FONT_OPTIONS);
  const savedTemplateJsonRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadEditorFonts()
      .then((payload) => {
        if (mounted) setFontOptions(mergeCardFontOptions(CARD_FONT_OPTIONS, payload.fonts ?? []));
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

  const controller = useTemplateEditorController(initialTemplate);


  useEffect(() => {
    savedTemplateJsonRef.current = JSON.stringify(reconstructMinimalTemplate(initialTemplate));
  }, [initialTemplate]);

  const beginDraft = useCallback((template: TCGCardTemplate) => {
    savedTemplateJsonRef.current = JSON.stringify(reconstructMinimalTemplate(template));
    controller.resetTemplate(template);
  }, [controller]);

  const acceptTemplate = useCallback((template: TCGCardTemplate) => {
    savedTemplateJsonRef.current = JSON.stringify(reconstructMinimalTemplate(template));
    controller.resetTemplate(template);
  }, [controller]);

  return {
    acceptTemplate,
    availableFonts: cardFontOptionsToSelectOptions(fontOptions),
    beginDraft,
    controller,
    developerFontFaceCss: createDeveloperFontFaceCss(fontOptions),
    isDirty: savedTemplateJsonRef.current !== JSON.stringify(reconstructMinimalTemplate(controller.currentTemplate)),
    isHydrated: true,
  };
}
