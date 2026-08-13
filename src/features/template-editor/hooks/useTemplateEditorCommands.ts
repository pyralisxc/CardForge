"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

import type { ToastFn } from '@/components/ui/use-toast';
import {
  getTemplateCardMeasurement,
  type CardFormatId,
  type CardMeasurementUnit,
  type TemplateCardFormatSource,
} from '@/domain/card-formats';
import type { TCGCardTemplate, TemplateUsage } from '@/domain/templates';
import {
  getDefaultGridSizeForCanvas,
  reconstructFreeformCanvas,
  reconstructMinimalTemplate,
} from '@/domain/templates';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { createFrameKitPresetRecipes } from '@/features/template-editor/lib/elementPresetRecipes';
import { PREDEFINED_FRAME_VISUAL_PROPERTIES } from '@/features/template-editor/lib/frameVisualPresets';
import {
  buildCardFormatTemplateUpdate,
  buildCustomDimensionTemplateUpdate,
  type CanvasResizeStrategy,
} from '@/features/template-editor/lib/makerDimensions';
import {
  makeNewFreeformTemplate,
  type NewCardDesignInput,
} from '@/features/template-editor/lib/makerTemplateFactory';
import { CANVAS_ZOOM } from '@/features/template-editor/lib/canvasViewportConfig';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { withNextStep } from '@/shared/userFacingErrors';
import { trackCardForgeEvent } from '@/features/analytics/client';

interface UseTemplateEditorCommandsInput {
  acceptTemplate: (template: TCGCardTemplate) => void;
  beginDraft: (template: TCGCardTemplate) => void;
  controller: TemplateEditorController;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  isActive: boolean;
  onCloneTemplate: (templateId: string) => string | null;
  onSaveTemplate: (template: TCGCardTemplate) => Promise<string>;
  onSelectTemplate: (templateId: string | null) => void;
  setAutoFitCanvas: Dispatch<SetStateAction<boolean>>;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  setShowGrid: Dispatch<SetStateAction<boolean>>;
  setZoom: Dispatch<SetStateAction<number>>;
  requestTemplateChange: (action: () => void) => void;
  toast: ToastFn;
  templates: TCGCardTemplate[];
}

export function useTemplateEditorCommands({
  acceptTemplate,
  beginDraft,
  controller,
  deleteSelected,
  duplicateSelected,
  isActive,
  onCloneTemplate,
  onSaveTemplate,
  onSelectTemplate,
  setAutoFitCanvas,
  setPreviewMode,
  setShowGrid,
  setZoom,
  requestTemplateChange,
  toast,
  templates,
}: UseTemplateEditorCommandsInput) {
  const {
    canvas,
    currentTemplate,
    redo,
    selectedElementId,
    setSelectedElementId,
    undo,
    updateCanvas,
    updateTemplate,
  } = controller;
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const borderImageInputRef = useRef<HTMLInputElement | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [customWidthValue, setCustomWidthValue] = useState('');
  const [customHeightValue, setCustomHeightValue] = useState('');
  const [customUnit, setCustomUnit] = useState<CardMeasurementUnit>('mm');
  const [resizeStrategy, setResizeStrategy] = useState<CanvasResizeStrategy>('fit');
  const [newTemplateRequest, setNewTemplateRequest] = useState<{
    usage: TemplateUsage;
    formatSource: TemplateCardFormatSource;
  } | null>(null);
  const currentMeasurement = getTemplateCardMeasurement({
    id: currentTemplate.id,
    formatId: currentTemplate.formatId,
    trimWidthMm: currentTemplate.trimWidthMm,
    trimHeightMm: currentTemplate.trimHeightMm,
    aspectRatio: currentTemplate.aspectRatio,
    freeformCanvas: {
      width: currentTemplate.freeformCanvas?.width,
      height: currentTemplate.freeformCanvas?.height,
    },
  }, customUnit);
  const currentMeasurementWidth = currentMeasurement.width;
  const currentMeasurementHeight = currentMeasurement.height;

  useEffect(() => {
    setCustomWidthValue(String(currentMeasurementWidth));
    setCustomHeightValue(String(currentMeasurementHeight));
  }, [currentMeasurementHeight, currentMeasurementWidth]);

  const frameKitRecipes = useMemo(() => {
    const recipes = createFrameKitPresetRecipes(templates);
    const recommendedId = `frame-kit-${currentTemplate.id}`;
    return recipes.sort((left, right) => (
      left.id === recommendedId ? -1 : right.id === recommendedId ? 1 : left.label.localeCompare(right.label)
    ));
  }, [currentTemplate.id, templates]);

  const saveTemplate = useCallback(async (templateOverride?: TCGCardTemplate) => {
    const templateToSave = templateOverride?.aspectRatio ? templateOverride : currentTemplate;
    const reservedNames = new Set(['New Card Template', 'New Card Back', 'New Front Template', 'Untitled card design']);
    if (!templateToSave.name?.trim() || reservedNames.has(templateToSave.name.trim())) {
      toast({
        title: 'Card design name is required',
        description: withNextStep(
          'Give this design a meaningful name before saving.',
          'Enter a card design name, then save again.',
        ),
        variant: 'destructive',
      });
      return false;
    }
    const parts = templateToSave.aspectRatio.split(':').map(Number);
    if (parts.length !== 2 || parts.some((part) => !part || part <= 0 || Number.isNaN(part))) {
      toast({
        title: 'Card format is invalid',
        description: withNextStep(
          'The design dimensions must use positive width and height values.',
          'Choose a standard format or apply valid custom dimensions, then save again.',
        ),
        variant: 'destructive',
      });
      return false;
    }
    const savedId = await onSaveTemplate({
      ...templateToSave,
      freeformCanvas: reconstructFreeformCanvas(templateToSave.freeformCanvas),
    });
    acceptTemplate(templateToSave);
    onSelectTemplate(savedId);
    return true;
  }, [acceptTemplate, currentTemplate, onSaveTemplate, onSelectTemplate, toast]);

  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(target && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        || target.isContentEditable
        || target.closest('[contenteditable="true"], .ProseMirror, [role="textbox"]')
      ));
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === 's') {
        event.preventDefault();
        void saveTemplate();
        return;
      }
      if (modifier && key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && key === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (isTyping) return;
      if (event.key === 'Escape') setSelectedElementId(null);
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElementId) {
        event.preventDefault();
        deleteSelected();
      }
      if (key === 'g') setShowGrid((value) => !value);
      if (key === 'p') setPreviewMode((value) => !value);
      if (event.key === '+' || event.key === '=') {
        setAutoFitCanvas(false);
        setZoom((value) => clamp(
          Math.round((value + CANVAS_ZOOM.step) * 100) / 100,
          CANVAS_ZOOM.min,
          CANVAS_ZOOM.max,
        ));
      }
      if (event.key === '-' || event.key === '_') {
        setAutoFitCanvas(false);
        setZoom((value) => clamp(
          Math.round((value - CANVAS_ZOOM.step) * 100) / 100,
          CANVAS_ZOOM.min,
          CANVAS_ZOOM.max,
        ));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected, duplicateSelected, isActive, redo, saveTemplate, selectedElementId, setAutoFitCanvas, setPreviewMode, setSelectedElementId, setShowGrid, setZoom, undo]);

  const requestNewTemplate = useCallback((
    usage: TemplateUsage = 'standard',
    formatSource: TemplateCardFormatSource = currentTemplate,
  ) => {
    requestTemplateChange(() => {
      setNewTemplateRequest({ usage, formatSource });
      trackCardForgeEvent('template_creation_started', {
        side: usage === 'back-preset' ? 'back' : 'front',
        format_id: formatSource.formatId ?? 'custom',
      });
    });
  }, [currentTemplate, requestTemplateChange]);

  const createNewTemplate = useCallback((input: NewCardDesignInput) => {
    if (!newTemplateRequest) return;
    const id = `draft-${nanoid()}`;
    let template: TCGCardTemplate;
    if (input.startingPoint === 'clone') {
      const cloned = reconstructMinimalTemplate({
        ...currentTemplate,
        id,
        name: input.name,
        templateSource: 'user',
        templateUsage: newTemplateRequest.usage,
        templateCategory: newTemplateRequest.usage === 'back-preset' ? 'Card back' : 'Card front',
      });
      template = input.formatId === 'custom'
        ? reconstructMinimalTemplate({ ...cloned, formatId: 'custom' })
        : reconstructMinimalTemplate({
            ...cloned,
            ...buildCardFormatTemplateUpdate({
              formatId: input.formatId,
              resizeStrategy,
              template: cloned,
            }),
          });
    } else {
      template = {
        ...makeNewFreeformTemplate({
          name: input.name,
          templateUsage: newTemplateRequest.usage,
          formatId: input.formatId,
          formatSource: newTemplateRequest.formatSource,
          startingPoint: input.startingPoint,
          brandedBackTemplate: input.startingPoint === 'branded-back'
            ? templates.find((candidate) => (
                candidate.templateUsage === 'back-preset'
                && candidate.formatId === input.formatId
                && candidate.templateRegistryStatus === 'published'
              ))
            : undefined,
        }),
        id,
      };
    }
    beginDraft(template);
    setNewTemplateRequest(null);
    trackCardForgeEvent('template_created', {
      side: newTemplateRequest.usage === 'back-preset' ? 'back' : 'front',
      format_id: input.formatId,
      format_kind: input.formatId === 'custom' ? 'custom' : 'standard',
      starting_point: input.startingPoint,
    });
  }, [beginDraft, currentTemplate, newTemplateRequest, resizeStrategy, templates]);

  const openTemplate = useCallback((template: TCGCardTemplate) => {
    if (!template.id) return;
    requestTemplateChange(() => {
      acceptTemplate(template);
      onSelectTemplate(template.id);
    });
  }, [acceptTemplate, onSelectTemplate, requestTemplateChange]);

  const cloneTemplate = useCallback(() => {
    const templateId = currentTemplate.id;
    if (!templateId) return;
    requestTemplateChange(() => {
      const newId = onCloneTemplate(templateId);
      if (newId) onSelectTemplate(newId);
    });
  }, [currentTemplate.id, onCloneTemplate, onSelectTemplate, requestTemplateChange]);

  const applyFrameStyle = useCallback((frameStyle: string) => {
    updateTemplate({ ...(PREDEFINED_FRAME_VISUAL_PROPERTIES[frameStyle] ?? {}), frameStyle });
  }, [updateTemplate]);

  const applyCustomDimensions = useCallback(() => {
    const update = buildCustomDimensionTemplateUpdate({
      widthValue: customWidthValue,
      heightValue: customHeightValue,
      unit: customUnit,
      template: currentTemplate,
      resizeStrategy,
    });
    if (!update) {
      toast({
        title: 'Dimensions are invalid',
        description: withNextStep(
          'Width and height must be positive numbers.',
          'Update Width and Height values, then apply dimensions again.',
        ),
        variant: 'destructive',
      });
      return;
    }
    updateTemplate(update);
    trackCardForgeEvent('card_format_changed', {
      format_id: 'custom',
      format_kind: 'custom',
      resize_strategy: resizeStrategy,
    });
  }, [currentTemplate, customHeightValue, customUnit, customWidthValue, resizeStrategy, toast, updateTemplate]);

  const applyCardFormat = useCallback((formatId: CardFormatId) => {
    if (formatId === 'custom') {
      updateTemplate({ formatId: 'custom' });
      trackCardForgeEvent('card_format_changed', {
        format_id: 'custom',
        format_kind: 'custom',
        resize_strategy: resizeStrategy,
      });
      return;
    }
    updateTemplate(buildCardFormatTemplateUpdate({ formatId, resizeStrategy, template: currentTemplate }));
    trackCardForgeEvent('card_format_changed', {
      format_id: formatId,
      format_kind: 'standard',
      resize_strategy: resizeStrategy,
    });
  }, [currentTemplate, resizeStrategy, updateTemplate]);

  const resetGridToTemplateDefault = useCallback(() => {
    updateCanvas({ gridSize: getDefaultGridSizeForCanvas(canvas.width, canvas.height) });
  }, [canvas.height, canvas.width, updateCanvas]);

  const handleFileUpload = useCallback((
    event: ChangeEvent<HTMLInputElement>,
    apply: (dataUri: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      apply(loadEvent.target?.result as string);
      toast({ title: 'Image Uploaded', description: `${file.name} loaded.` });
    };
    reader.onerror = () => toast({
      title: 'Upload Error',
      description: 'Failed to read the selected image.',
      variant: 'destructive',
    });
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [toast]);

  return {
    applyCustomDimensions,
    applyCardFormat,
    applyFrameStyle,
    backgroundImageInputRef,
    borderImageInputRef,
    cloneTemplate,
    commandPaletteOpen,
    createNewTemplate,
    customHeightValue,
    customUnit,
    customWidthValue,
    frameKitRecipes,
    handleFileUpload,
    openTemplate,
    newTemplateRequest,
    requestNewTemplate,
    resetGridToTemplateDefault,
    resizeStrategy,
    saveTemplate,
    setCommandPaletteOpen,
    setCustomHeightValue,
    setCustomUnit,
    setCustomWidthValue,
    setNewTemplateRequest,
    setResizeStrategy,
  };
}

export type TemplateEditorCommands = ReturnType<typeof useTemplateEditorCommands>;
