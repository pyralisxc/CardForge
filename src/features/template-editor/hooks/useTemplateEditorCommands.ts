"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

import type { ToastFn } from '@/components/ui/use-toast';
import type { TCGCardTemplate, TemplateUsage } from '@/domain/templates';
import {
  getDefaultGridSizeForCanvas,
  reconstructFreeformCanvas,
} from '@/domain/templates';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { CARD_FRAME_KITS, getFrameKitForTemplate } from '@/features/template-editor/lib/cardFrameKits';
import { createFrameKitPresetRecipes } from '@/features/template-editor/lib/elementPresetRecipes';
import { PREDEFINED_FRAME_VISUAL_PROPERTIES } from '@/features/template-editor/lib/frameVisualPresets';
import { buildCustomDimensionTemplateUpdate } from '@/features/template-editor/lib/makerDimensions';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';
import { CANVAS_ZOOM } from '@/features/template-editor/lib/canvasViewportConfig';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { withNextStep } from '@/shared/userFacingErrors';

interface UseTemplateEditorCommandsInput {
  acceptTemplate: (template: TCGCardTemplate) => void;
  beginDraft: (template: TCGCardTemplate) => void;
  controller: TemplateEditorController;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  isActive: boolean;
  onCloneTemplate: (templateId: string) => string | null;
  onSaveTemplate: (template: TCGCardTemplate) => string;
  onSelectTemplate: (templateId: string | null) => void;
  setAutoFitCanvas: Dispatch<SetStateAction<boolean>>;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  setShowGrid: Dispatch<SetStateAction<boolean>>;
  setZoom: Dispatch<SetStateAction<number>>;
  toast: ToastFn;
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
  toast,
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
  const [customUnit, setCustomUnit] = useState('mm');

  const frameKitRecipes = useMemo(() => {
    const recommended = getFrameKitForTemplate(currentTemplate.id);
    const kits = recommended
      ? [recommended, ...CARD_FRAME_KITS.filter((kit) => kit.id !== recommended.id)]
      : CARD_FRAME_KITS;
    return createFrameKitPresetRecipes(kits);
  }, [currentTemplate.id]);

  const saveTemplate = useCallback(() => {
    if (!currentTemplate.name?.trim() || currentTemplate.name === 'New Card Template') {
      toast({
        title: 'Template name is required',
        description: withNextStep(
          'Template name must be set before saving.',
          'Enter a template name in Template Settings, then save again.',
        ),
        variant: 'destructive',
      });
      return;
    }
    const parts = currentTemplate.aspectRatio.split(':').map(Number);
    if (parts.length !== 2 || parts.some((part) => !part || part <= 0 || Number.isNaN(part))) {
      toast({
        title: 'Aspect ratio format is invalid',
        description: withNextStep(
          'Aspect Ratio must use W:H with positive numbers (example: 63:88).',
          'Correct the Aspect Ratio field, then save again.',
        ),
        variant: 'destructive',
      });
      return;
    }
    const savedId = onSaveTemplate({
      ...currentTemplate,
      freeformCanvas: reconstructFreeformCanvas(currentTemplate.freeformCanvas),
    });
    acceptTemplate(currentTemplate);
    onSelectTemplate(savedId);
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
        saveTemplate();
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

  const createNewTemplate = useCallback((usage: TemplateUsage = 'standard') => {
    const template = {
      ...makeNewFreeformTemplate(
        usage === 'back-preset' ? 'New Card Back' : 'New Front Template',
        usage,
      ),
      id: `draft-${nanoid()}`,
    };
    beginDraft(template);
    onSelectTemplate(template.id);
  }, [beginDraft, onSelectTemplate]);

  const openTemplate = useCallback((template: TCGCardTemplate) => {
    if (!template.id) return;
    acceptTemplate(template);
    onSelectTemplate(template.id);
  }, [acceptTemplate, onSelectTemplate]);

  const cloneTemplate = useCallback(() => {
    if (!currentTemplate.id) return;
    const newId = onCloneTemplate(currentTemplate.id);
    if (newId) onSelectTemplate(newId);
  }, [currentTemplate.id, onCloneTemplate, onSelectTemplate]);

  const applyFrameStyle = useCallback((frameStyle: string) => {
    updateTemplate({ ...(PREDEFINED_FRAME_VISUAL_PROPERTIES[frameStyle] ?? {}), frameStyle });
  }, [updateTemplate]);

  const applyCustomDimensions = useCallback(() => {
    const update = buildCustomDimensionTemplateUpdate({
      widthValue: customWidthValue,
      heightValue: customHeightValue,
      unit: customUnit,
      template: currentTemplate,
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
  }, [currentTemplate, customHeightValue, customUnit, customWidthValue, toast, updateTemplate]);

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
    resetGridToTemplateDefault,
    saveTemplate,
    setCommandPaletteOpen,
    setCustomHeightValue,
    setCustomUnit,
    setCustomWidthValue,
  };
}

export type TemplateEditorCommands = ReturnType<typeof useTemplateEditorCommands>;
