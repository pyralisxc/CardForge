"use client";

import { useCallback, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import type { ToastFn } from '@/components/ui/use-toast';
import type { AppearanceStylePreset, FreeformAppearance, FreeformCardElement } from '@/domain/templates';
import {
  hasElementCapability,
  isDividerElement,
  normalizeAppearanceForElement,
} from '@/domain/templates';
import { appearanceToElementRenderFields } from '@/features/card-rendering/client';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { useTemplateAssetLibrary } from '@/features/template-editor/hooks/useTemplateAssetLibrary';
import {
  CONSOLIDATED_ELEMENT_KITS,
  elementKits,
} from '@/features/template-editor/lib/elementKits';
import {
  buildElementPresetElementUpdates,
  createRecipesFromAppearanceStyles,
  isElementPresetApplicable,
  type ElementPresetRecipe,
} from '@/features/template-editor/lib/elementPresetRecipes';
import { buildLayerTree } from '@/features/template-editor/lib/layerTree';
import { resolveElementPlacement } from '@/features/template-editor/lib/elementPlacement';

interface UseTemplateEditorElementsInput {
  appearanceStyles: AppearanceStylePreset[];
  canUploadCustomAssets: boolean;
  controller: TemplateEditorController;
  gridSize: number;
  onSaveAppearanceStyle: (style: AppearanceStylePreset) => string;
  selectElement: (id: string | null) => void;
  toast: ToastFn;
}

export function useTemplateEditorElements({
  appearanceStyles,
  canUploadCustomAssets,
  controller,
  gridSize,
  onSaveAppearanceStyle,
  selectElement,
  toast,
}: UseTemplateEditorElementsInput) {
  const {
    arrangeSelected: arrangeSelectedInController,
    canvas,
    deleteSelected: deleteSelectedInController,
    duplicateSelected: duplicateSelectedInController,
    groupChecked: groupCheckedInController,
    reorderLayer,
    selectedElement,
    ungroupSelected: ungroupSelectedInController,
    updateCanvas,
    updateElement,
    updateTemplate,
  } = controller;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [layerDragId, setLayerDragId] = useState<string | null>(null);
  const [layerDropTarget, setLayerDropTarget] = useState<{
    id: string;
    pos: 'before' | 'after' | 'child';
  } | null>(null);

  const capabilities = {
    canUseAppearanceStudio: Boolean(selectedElement && selectedElement.type !== 'image'),
    canUseBackgroundTexture: hasElementCapability(selectedElement, 'texture'),
    canUseDividerControls: hasElementCapability(selectedElement, 'divider'),
    canUseIconLibrary: hasElementCapability(selectedElement, 'icon'),
    canUseImageSource: hasElementCapability(selectedElement, 'image'),
    canUseShapeControls: hasElementCapability(selectedElement, 'shape'),
    canUseTypography: hasElementCapability(selectedElement, 'typography'),
  };
  const canUseElementBorder = hasElementCapability(selectedElement, 'border')
    && !capabilities.canUseDividerControls;

  const assets = useTemplateAssetLibrary({
    selectedElement,
    canUseBackgroundTexture: capabilities.canUseBackgroundTexture,
    canUploadCustomAssets,
    toast,
  });

  const elementLibrarySections = useMemo(() => {
    const groups: Record<string, typeof elementKits> = {
      Core: [],
      'Element Recipes': [],
      Ornaments: [],
    };
    CONSOLIDATED_ELEMENT_KITS.forEach((item) => groups[item.category].push(item));
    return Object.keys(groups).map((category) => ({
      category,
      items: groups[category].map((item) => ({
        ...item,
        dragKitIndex: CONSOLIDATED_ELEMENT_KITS.findIndex((kit) => kit.label === item.label),
      })),
    }));
  }, []);

  const selectedAppearance = useMemo(
    () => selectedElement ? normalizeAppearanceForElement(selectedElement) : undefined,
    [selectedElement],
  );
  const compatibleAppearanceStyles = useMemo(() => {
    if (!selectedElement) return [];
    const target = isDividerElement(selectedElement) ? 'divider' : selectedElement.type;
    const byId = new Map<string, AppearanceStylePreset>();
    appearanceStyles.forEach((style) => {
      if (style.targets.includes(target) && !byId.has(style.id)) byId.set(style.id, style);
    });
    return Array.from(byId.values());
  }, [appearanceStyles, selectedElement]);

  const selectedElementPresetRecipeGroups = useMemo(() => {
    const empty = {
      border: [] as ElementPresetRecipe[],
      divider: [] as ElementPresetRecipe[],
      icon: [] as ElementPresetRecipe[],
      shapeRole: [] as ElementPresetRecipe[],
    };
    if (!selectedElement) return empty;
    const recipes = createRecipesFromAppearanceStyles(appearanceStyles)
      .filter((preset) => isElementPresetApplicable(preset, selectedElement));
    return {
      border: recipes.filter((preset) => preset.kind === 'borderTreatment'),
      divider: recipes.filter((preset) => preset.kind === 'dividerRecipe'),
      icon: recipes.filter((preset) => preset.kind === 'iconStyle'),
      shapeRole: recipes.filter((preset) => preset.kind === 'shapeRole'),
    };
  }, [appearanceStyles, selectedElement]);

  const updateElementAppearance = useCallback((
    elementId: string,
    updater: (appearance: FreeformAppearance) => FreeformAppearance,
    trackHistory = true,
  ) => {
    const element = canvas.elements.find((item) => item.id === elementId);
    if (!element) return;
    const appearance = updater(normalizeAppearanceForElement(element));
    const nextElement = { ...element, appearance };
    updateElement(
      elementId,
      { appearance, ...appearanceToElementRenderFields(nextElement) },
      trackHistory,
    );
  }, [canvas.elements, updateElement]);

  const applyAppearancePreset = useCallback((style: AppearanceStylePreset) => {
    if (!selectedElement) return;
    const nextElement = { ...selectedElement, appearance: style.appearance };
    updateElement(selectedElement.id, {
      appearance: style.appearance,
      ...appearanceToElementRenderFields(nextElement),
    });
  }, [selectedElement, updateElement]);

  const applyElementPresetRecipe = useCallback((recipe: ElementPresetRecipe) => {
    if (recipe.templateUpdates) {
      updateTemplate(recipe.templateUpdates);
      return;
    }
    if (selectedElement) {
      updateElement(selectedElement.id, buildElementPresetElementUpdates(recipe, selectedElement));
    }
  }, [selectedElement, updateElement, updateTemplate]);

  const groupChecked = useCallback(() => {
    const result = groupCheckedInController(nanoid);
    if (result.changed) selectElement(result.selectedElementId);
  }, [groupCheckedInController, selectElement]);

  const addElement = useCallback((
    type: FreeformCardElement['type'],
    placement?: { x: number; y: number },
    preset: Partial<FreeformCardElement> = {},
  ) => {
    const maxZ = Math.max(0, ...canvas.elements.map((element) => element.zIndex));
    const id = nanoid();
    const fallbackWidth = type === 'text' ? 260 : type === 'icon' ? 72 : 220;
    const fallbackHeight = type === 'text' ? 72 : type === 'icon' ? 72 : type === 'shape' ? 120 : 160;
    const width = preset.width ?? fallbackWidth;
    const height = preset.height ?? fallbackHeight;
    const safePlacement = resolveElementPlacement({
      canvas,
      height,
      presetPosition: preset,
      requestedPlacement: placement,
      width,
    });
    const base: FreeformCardElement = {
      id,
      type,
      name: type === 'text' ? 'Text Layer' : type === 'image' ? 'Image Layer' : type === 'icon' ? 'Icon Layer' : 'Shape Layer',
      x: safePlacement.x,
      y: safePlacement.y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      locked: false,
      content: type === 'text' ? '{{newText:"New Text"}}' : type === 'image' ? 'artworkUrl' : '',
      imageSource: type === 'image' ? 'artworkUrl' : undefined,
      iconName: type === 'icon' ? 'Sparkles' : undefined,
      shapeKind: type === 'shape' ? 'rectangle' : undefined,
      textColor: '#21180d',
      backgroundColor: type === 'shape' ? 'rgba(255,255,255,0.2)' : 'transparent',
      fontFamily: 'font-sans',
      fontSize: type === 'text' ? 'text-base' : 'text-sm',
      fontSizePx: type === 'text' ? 16 : 14,
      fontWeight: type === 'text' ? 'font-semibold' : 'font-normal',
      textAlign: type === 'text' ? 'center' : 'left',
      fontStyle: 'normal',
      padding: type === 'text' ? 'p-2' : 'p-0',
      borderColor: type === 'shape' || type === 'image' ? '#c89f42' : undefined,
      borderWidth: type === 'shape' || type === 'image' ? 'border' : '_none_',
      borderRadius: type === 'shape' || type === 'image' ? 'rounded-md' : 'rounded-none',
      minHeight: '_auto_',
      imageObjectFit: 'cover',
      fillColor: type === 'icon' ? 'transparent' : type === 'shape' ? 'rgba(255,255,255,0.2)' : undefined,
      strokeColor: type === 'icon' || type === 'shape' ? '#fbbf24' : undefined,
      strokeWidth: 2,
    };
    const merged = { ...base, ...preset, id, type, ...safePlacement, zIndex: maxZ + 1 };
    const element = { ...merged, appearance: normalizeAppearanceForElement(merged) };
    updateCanvas({ elements: [...canvas.elements, element] });
    selectElement(id);
  }, [canvas, selectElement, updateCanvas]);

  const duplicateSelected = useCallback(() => {
    const result = duplicateSelectedInController(nanoid, gridSize);
    if (result.changed) selectElement(result.selectedElementId);
  }, [duplicateSelectedInController, gridSize, selectElement]);

  const deleteSelected = useCallback(() => {
    const result = deleteSelectedInController();
    if (!result.changed && (result.reason === 'locked-selection' || result.reason === 'locked-descendant')) {
      toast({
        title: 'Layer locked',
        description: result.reason === 'locked-descendant'
          ? 'Unlock child layers before deleting this group.'
          : 'Unlock this layer before deleting it.',
      });
    }
  }, [deleteSelectedInController, toast]);

  const alignSelected = useCallback((alignment: 'left' | 'center' | 'right') => {
    if (!selectedElement) return;
    const nextX = alignment === 'left'
      ? 32
      : alignment === 'center'
        ? (canvas.width - selectedElement.width) / 2
        : canvas.width - selectedElement.width - 32;
    updateElement(selectedElement.id, { x: Math.round(nextX) });
  }, [canvas.width, selectedElement, updateElement]);

  const flipSelected = useCallback((axis: 'x' | 'y') => {
    if (!selectedElement) return;
    updateElement(
      selectedElement.id,
      axis === 'x' ? { flipX: !selectedElement.flipX } : { flipY: !selectedElement.flipY },
    );
  }, [selectedElement, updateElement]);

  const saveSelectedAppearanceStyle = useCallback(() => {
    if (!selectedElement) return;
    const target = isDividerElement(selectedElement) ? 'divider' : selectedElement.type;
    onSaveAppearanceStyle({
      id: `style-${nanoid()}`,
      name: `${selectedElement.name || 'Element'} Style`,
      kind: target === 'divider' ? 'divider' : target === 'icon' ? 'icon' : 'material',
      targets: [target],
      appearance: normalizeAppearanceForElement(selectedElement),
    });
  }, [onSaveAppearanceStyle, selectedElement]);

  const handleLayerDragOver = useCallback((elementId: string, clientY: number, rect: DOMRect) => {
    if (layerDragId === elementId) return;
    const relativeY = clientY - rect.top;
    const zone = rect.height / 3;
    setLayerDropTarget({
      id: elementId,
      pos: relativeY < zone ? 'before' : relativeY > rect.height - zone ? 'after' : 'child',
    });
  }, [layerDragId]);

  const handleLayerDrop = useCallback(() => {
    const sourceId = layerDragId;
    const target = layerDropTarget;
    setLayerDragId(null);
    setLayerDropTarget(null);
    if (sourceId && target && sourceId !== target.id) {
      reorderLayer(sourceId, target.id, target.pos);
    }
  }, [layerDragId, layerDropTarget, reorderLayer]);

  return {
    ...assets,
    ...capabilities,
    addElement,
    alignSelected,
    applyAppearancePreset,
    applyElementPresetRecipe,
    arrangeSelected: arrangeSelectedInController,
    canUseElementBorder,
    collapsedGroups,
    compatibleAppearanceStyles,
    deleteSelected,
    duplicateSelected,
    elementLibrarySections,
    endLayerDrag: () => {
      setLayerDragId(null);
      setLayerDropTarget(null);
    },
    flipSelected,
    groupChecked,
    handleLayerDragOver,
    handleLayerDrop,
    isGroupElement: selectedElement?.type === 'shape'
      && canvas.elements.some((element) => element.parentId === selectedElement.id),
    layerDropTarget,
    layerTree: buildLayerTree(canvas.elements),
    saveSelectedAppearanceStyle,
    selectedAppearance,
    selectedElementPresetRecipeGroups,
    startLayerDrag: setLayerDragId,
    toggleGroupCollapsed: (elementId: string) => setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(elementId)) next.delete(elementId);
      else next.add(elementId);
      return next;
    }),
    ungroupSelected: ungroupSelectedInController,
    updateElementAppearance,
  };
}

export type TemplateEditorElements = ReturnType<typeof useTemplateEditorElements>;
