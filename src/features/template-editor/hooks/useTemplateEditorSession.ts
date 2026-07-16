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
import {
  clearTemplateEditorDraft,
  readTemplateEditorDraft,
  writeTemplateEditorDraft,
} from '@/features/template-editor/lib/templateEditorDraftPersistence';
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
  const [recoveredDraft, setRecoveredDraft] = useState<TCGCardTemplate | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [fontOptions, setFontOptions] = useState<CardFontOption[]>(CARD_FONT_OPTIONS);
  const persistenceInitializedRef = useRef(false);
  const lastPersistedTemplateJsonRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readTemplateEditorDraft().then((draft) => {
      if (cancelled) return;
      setRecoveredDraft(draft);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    return resolveTemplateEditorInitialTemplate({ recoveredDraft, selectedTemplateId, templates });
  }, [recoveredDraft, selectedTemplateId, templates]);

  const controller = useTemplateEditorController(initialTemplate);

  useEffect(() => {
    const templateJson = JSON.stringify(reconstructMinimalTemplate(controller.currentTemplate));
    const action = resolveDraftPersistenceAction({
      currentTemplateJson: templateJson,
      initialized: persistenceInitializedRef.current,
      isActive,
      isHydrated,
      lastTemplateJson: lastPersistedTemplateJsonRef.current,
    });
    if (action === 'skip') return;
    if (action === 'initialize') {
      persistenceInitializedRef.current = true;
      lastPersistedTemplateJsonRef.current = templateJson;
      return;
    }
    void writeTemplateEditorDraft(controller.currentTemplate);
    lastPersistedTemplateJsonRef.current = templateJson;
  }, [controller.currentTemplate, isActive, isHydrated]);

  const beginDraft = useCallback((template: TCGCardTemplate) => {
    setRecoveredDraft(template);
    controller.resetTemplate(template);
  }, [controller]);

  const acceptTemplate = useCallback((template: TCGCardTemplate) => {
    void clearTemplateEditorDraft();
    lastPersistedTemplateJsonRef.current = JSON.stringify(reconstructMinimalTemplate(template));
    setRecoveredDraft(null);
    controller.resetTemplate(template);
  }, [controller]);

  return {
    acceptTemplate,
    availableFonts: cardFontOptionsToSelectOptions(fontOptions),
    beginDraft,
    controller,
    developerFontFaceCss: createDeveloperFontFaceCss(fontOptions),
    isHydrated,
  };
}
