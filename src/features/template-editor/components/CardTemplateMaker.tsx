"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { AppearanceStylePreset, FreeformAppearance, FreeformCardElement, FreeformCanvas, TCGCardTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AVAILABLE_FONTS,
  PADDING_OPTIONS,
} from '@/lib/constants';
import { replacePlaceholdersLocal } from '@/lib/textBindings';
import { cn, toTitleCase } from '@/lib/utils';
import { appearanceToElementRenderFields, normalizeAppearanceForElement } from '@/lib/appearance';
import { CARD_FRAME_KITS, getFrameKitForTemplate } from '@/lib/cardFrameKits';
import { hasElementCapability, isDividerElement, SHAPE_PRIMITIVE_OPTIONS } from '@/lib/elementCapabilities';
import {
  BLANK_SHAPE_PRIMITIVES,
  BORDER_PRESET_RECIPES,
  DIVIDER_PRESET_RECIPES,
  ICON_STYLE_PRESET_RECIPES,
  SHAPE_ROLE_PRESET_RECIPES,
  TEXT_FRAME_PRESET_RECIPES,
  buildElementPresetElementUpdates,
  createFrameKitPresetRecipes,
  createRecipesFromAppearanceStyles,
  isElementPresetApplicable,
  mergeElementPresetRecipes,
  type ElementPresetRecipe,
} from '@/lib/elementPresetRecipes';
import { useAppStore } from '@/store/appStore';
import { createDefaultFreeformCanvas, getDefaultGridSizeForCanvas, reconstructFreeformCanvas, reconstructMinimalTemplate, scaleCanvasToSize } from '@/lib/templateModel';
import { useToast } from '@/hooks/use-toast';
import {
  elementKits,
  CONSOLIDATED_ELEMENT_KITS,
} from '@/features/template-editor/lib/elementKits';
import { ELEMENT_STYLE_PRESETS } from '@/features/template-editor/lib/elementStylePresets';
import { PREDEFINED_FRAME_VISUAL_PROPERTIES } from '@/features/template-editor/lib/frameVisualPresets';
import { ICON_OPTIONS } from '@/features/template-editor/lib/iconOptions';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';
import { buildCustomDimensionTemplateUpdate } from '@/features/template-editor/lib/makerDimensions';
import {
  escapeTemplateText,
  unescapeTemplateText,
} from '@/lib/textBindings';
import { withNextStep } from '@/lib/userFacingErrors';
import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import { inferTextElementContentModel } from '@/lib/textElementContracts';
import { TemplateEditorTopBar } from '@/features/template-editor/components/TemplateEditorTopBar';
import { TemplateLibraryPanel } from '@/features/template-editor/components/TemplateLibraryPanel';
import { ElementLibraryPanel } from '@/features/template-editor/components/ElementLibraryPanel';
import { TemplateEditorInspectorPanel } from '@/features/template-editor/components/TemplateEditorInspectorPanel';
import { TemplateSettingsPanel } from '@/features/template-editor/components/TemplateSettingsPanel';
import { TemplateCanvasStage } from '@/features/template-editor/components/TemplateCanvasStage';
import { TemplateEditableElement } from '@/features/template-editor/components/TemplateEditableElement';
import { InspectorFlowSection } from '@/features/template-editor/components/InspectorFlowSection';
import { ElementTransformPanel } from '@/features/template-editor/components/ElementTransformPanel';
import { AppearanceStudioPanel } from '@/features/template-editor/components/AppearanceStudioPanel';
import { ElementAlignmentPanel } from '@/features/template-editor/components/ElementAlignmentPanel';
import { ElementContentPanel } from '@/features/template-editor/components/ElementContentPanel';
import { IconInspectorPanel } from '@/features/template-editor/components/IconInspectorPanel';
import { ShapeInspectorPanel } from '@/features/template-editor/components/ShapeInspectorPanel';
import { DividerStudioPanel } from '@/features/template-editor/components/DividerStudioPanel';
import { TypographyInspectorPanel } from '@/features/template-editor/components/TypographyInspectorPanel';
import { ImageInspectorPanel } from '@/features/template-editor/components/ImageInspectorPanel';
import { BorderInspectorPanel } from '@/features/template-editor/components/BorderInspectorPanel';
import { LayerTreePanel } from '@/features/template-editor/components/LayerTreePanel';
import { useCanvasPointerInteractions } from '@/features/template-editor/hooks/useCanvasPointerInteractions';
import { useTemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { useTemplateAssetLibrary } from '@/features/template-editor/hooks/useTemplateAssetLibrary';
import { buildLayerTree } from '@/features/template-editor/lib/layerTree';
import {
  getNextScopedVariableKey as buildNextScopedVariableKey,
  hasScopedVariableKeyConflict,
  normalizeTemplateVariableKey,
  removeScopedTextElementVariableContract,
  renameScopedTextElementVariable,
  upsertTemplateFieldContract,
  type FieldContract,
} from '@/features/template-editor/lib/templateVariableContracts';

interface CardTemplateMakerProps {
  canUseProjectFiles: boolean;
  onSaveTemplate: (template: TCGCardTemplate) => string;
  templates: TCGCardTemplate[];
  defaultTemplates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  onCloneTemplate: (templateId: string) => string | null;
  onExportProject: () => void;
  onImportProject: () => void;
  onLoadProject: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartCheckout: () => void;
  appearanceStyles: AppearanceStylePreset[];
  onSaveAppearanceStyle: (style: AppearanceStylePreset) => string;
  onDeleteAppearanceStyle: (styleId: string) => void;
  selectedTemplateIdForEditing: string | null;
  onSelectTemplateForEditing: (templateId: string | null) => void;
  canUploadCustomAssets: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  projectFileGateMessage?: string | null;
}

const DEFAULT_BACK_TEMPLATE_ID = 'default-obsidian-neon-card-back';
const STAGE_RULER_WIDTH = 28;
const STAGE_CANVAS_GUTTER = 32;
const STAGE_SCROLL_PADDING = 24;

type MobileMakerPanel = 'canvas' | 'library' | 'inspector';

const MOBILE_MAKER_PANELS: Array<{ value: MobileMakerPanel; label: string }> = [
  { value: 'canvas', label: 'Canvas' },
  { value: 'library', label: 'Templates' },
  { value: 'inspector', label: 'Inspector' },
];

export function CardTemplateMaker({
  canUseProjectFiles,
  onSaveTemplate,
  templates,
  defaultTemplates,
  backFaceTemplates,
  userTemplates,
  onDeleteTemplate,
  onCloneTemplate,
  onExportProject,
  onImportProject,
  onLoadProject,
  onStartCheckout,
  appearanceStyles,
  onSaveAppearanceStyle,
  onDeleteAppearanceStyle,
  selectedTemplateIdForEditing,
  onSelectTemplateForEditing,
  canUploadCustomAssets,
  fileInputRef,
  isCheckoutStarting,
  projectFileGateMessage,
}: CardTemplateMakerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement | null>(null);
  const borderImageInputRef = useRef<HTMLInputElement | null>(null);
  const variableKeyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variableCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const freeformTemplates = templates;
  const initialTemplate = useMemo(() => {
    const selected = templates.find(template => template.id === selectedTemplateIdForEditing);
    return reconstructMinimalTemplate(selected || freeformTemplates[0] || makeNewFreeformTemplate());
  }, [freeformTemplates, selectedTemplateIdForEditing, templates]);

  const {
    activeFace,
    canvas,
    checkedLayerIds,
    clearCheckedLayers,
    commitTemplate,
    createBackFace: createBackFaceInController,
    currentTemplate,
    deleteSelected: deleteSelectedInController,
    duplicateSelected: duplicateSelectedInController,
    future,
    groupChecked: groupCheckedInController,
    history,
    moveSelectionByDelta,
    recordTemplateHistory,
    redo,
    reorderLayer,
    resetTemplate,
    selectedElement,
    selectedElementId,
    selectElement: selectElementInController,
    setActiveFace,
    setSelectedElementId,
    toggleCheckedLayer,
    undo,
    ungroupSelected: ungroupSelectedInController,
    updateCanvas,
    updateElement,
    updateTemplate,
    arrangeSelected: arrangeSelectedInController,
  } = useTemplateEditorController(initialTemplate);
  const [activeInspectorTab, setActiveInspectorTab] = useState<string>('element');
  const [activeVariableKey, setActiveVariableKey] = useState<string | null>(null);
  const frameKitsForCurrentTemplate = useMemo(() => {
    const recommendedKit = getFrameKitForTemplate(currentTemplate.id);
    return recommendedKit
      ? [recommendedKit, ...CARD_FRAME_KITS.filter((kit) => kit.id !== recommendedKit.id)]
      : CARD_FRAME_KITS;
  }, [currentTemplate.id]);

  const frameKitRecipesForCurrentTemplate = useMemo(
    () => createFrameKitPresetRecipes(frameKitsForCurrentTemplate),
    [frameKitsForCurrentTemplate]
  );

  const selectElement = useCallback((id: string | null) => {
    selectElementInController(id);
    if (id !== null) {
      setActiveInspectorTab('element');
      requestAnimationFrame(() => {
        canvasRef.current?.focus();
      });
    }
  }, [selectElementInController]);
  const [zoom, setZoom] = useState(0.62);
  const [autoFitCanvas, setAutoFitCanvas] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<MobileMakerPanel>('canvas');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [customWidthValue, setCustomWidthValue] = useState('');
  const [customHeightValue, setCustomHeightValue] = useState('');
  const [customUnit, setCustomUnit] = useState('mm');
  // Layers panel state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [layerDragId, setLayerDragId] = useState<string | null>(null);
  const [layerDropTarget, setLayerDropTarget] = useState<{ id: string; pos: 'before' | 'after' | 'child' } | null>(null);
  const sortedElements = useMemo(() => [...(canvas.elements || [])].sort((a, b) => b.zIndex - a.zIndex), [canvas.elements]);
  const gridSize = canvas.gridSize || 20;
  const selectedElementIsDivider = isDividerElement(selectedElement);
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useAppStore((state) => state.setRichTextHighlightColor);
  const canUseBackgroundTexture = hasElementCapability(selectedElement, 'texture');
  const canUseTypography = hasElementCapability(selectedElement, 'typography');
  const canUseIconLibrary = hasElementCapability(selectedElement, 'icon');
  const canUseShapeControls = hasElementCapability(selectedElement, 'shape');
  const canUseDividerControls = hasElementCapability(selectedElement, 'divider');
  const canUseImageSource = hasElementCapability(selectedElement, 'image');
  const canUseElementBorder = hasElementCapability(selectedElement, 'border') && !canUseDividerControls;
  const canUseAppearanceStudio = Boolean(selectedElement && selectedElement.type !== 'image');
  const {
    assetSearch,
    compatibleDividerAssets,
    compatibleIconAssets,
    compatibleImageAssets,
    compatibleTextureAssets,
    handleAssetUpload,
    setAssetSearch,
  } = useTemplateAssetLibrary({
    selectedElement,
    canUseBackgroundTexture,
    canUploadCustomAssets,
    toast,
  });
  const groupedElementKits = useMemo(() => {
    const groups: Record<string, typeof elementKits> = {
      Core: [],
      'Element Recipes': [],
      Ornaments: [],
    };
    CONSOLIDATED_ELEMENT_KITS.forEach(item => groups[item.category].push(item));
    return groups;
  }, []);
  const elementLibrarySections = useMemo(() => (
    Object.keys(groupedElementKits).map((category) => ({
      category,
      items: groupedElementKits[category].map((item) => ({
        ...item,
        dragKitIndex: CONSOLIDATED_ELEMENT_KITS.findIndex((kit) => kit.label === item.label),
      })),
    }))
  ), [groupedElementKits]);
  const selectedAppearance = useMemo(
    () => selectedElement ? normalizeAppearanceForElement(selectedElement) : undefined,
    [selectedElement]
  );
  const compatibleAppearanceStyles = useMemo(() => {
    if (!selectedElement) return [];
    const elementTarget = isDividerElement(selectedElement) ? 'divider' : selectedElement.type;
    const byId = new Map<string, AppearanceStylePreset>();
    appearanceStyles.forEach(style => {
      if (style.targets.includes(elementTarget) && !byId.has(style.id)) {
        byId.set(style.id, style);
      }
    });
    return Array.from(byId.values());
  }, [appearanceStyles, selectedElement]);
  const registryElementPresetRecipes = useMemo(
    () => createRecipesFromAppearanceStyles(appearanceStyles),
    [appearanceStyles]
  );
  const selectedElementPresetRecipeGroups = useMemo(() => {
    if (!selectedElement) {
      return {
        border: [] as ElementPresetRecipe[],
        divider: [] as ElementPresetRecipe[],
        icon: [] as ElementPresetRecipe[],
        shapeRole: [] as ElementPresetRecipe[],
        textFrame: [] as ElementPresetRecipe[],
      };
    }
    const applicableRegistryRecipes = registryElementPresetRecipes.filter((preset) => isElementPresetApplicable(preset, selectedElement));
    return {
      border: mergeElementPresetRecipes(
        BORDER_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'borderTreatment'),
      ),
      divider: mergeElementPresetRecipes(
        DIVIDER_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'dividerRecipe'),
      ),
      icon: mergeElementPresetRecipes(
        ICON_STYLE_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'iconStyle'),
      ),
      shapeRole: mergeElementPresetRecipes(
        SHAPE_ROLE_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'shapeRole'),
      ),
      textFrame: mergeElementPresetRecipes(
        TEXT_FRAME_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'textFrame'),
      ),
    };
  }, [registryElementPresetRecipes, selectedElement]);
  const templateFieldDefinitions = useMemo(() => extractTemplateFieldDefinitions(currentTemplate), [currentTemplate]);
  const textTemplateFields = useMemo(() => templateFieldDefinitions.filter(field => !field.isImage), [templateFieldDefinitions]);
  const selectedElementTemplateFields = useMemo(
    () => selectedElement?.type === 'text'
      ? textTemplateFields.filter((field) => field.sourceElementId === selectedElement.id)
      : [],
    [selectedElement, textTemplateFields]
  );
  useEffect(() => {
    setActiveVariableKey(null);
  }, [selectedElement?.id]);

  useEffect(() => {
    if (!autoFitCanvas || !stageRef.current) return;
    const updateFit = () => {
      const width = stageRef.current?.clientWidth || 0;
      const height = stageRef.current?.clientHeight || 0;
      if (!width || !height) return;
      const chromeWidth = STAGE_RULER_WIDTH + STAGE_CANVAS_GUTTER * 2 + STAGE_SCROLL_PADDING;
      const chromeHeight = STAGE_RULER_WIDTH + STAGE_CANVAS_GUTTER * 2 + STAGE_SCROLL_PADDING;
      const widthFit = (width - chromeWidth) / canvas.width;
      const heightFit = (height - chromeHeight) / canvas.height;
      const fitted = width < 1024 ? Math.min(widthFit, 0.76) : Math.min(widthFit, heightFit, 0.76);
      setZoom(clamp(Math.round(fitted * 100) / 100, 0.16, 0.76));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [autoFitCanvas, canvas.height, canvas.width]);

  // Layer tree helpers
  const layerTree = useMemo(() => buildLayerTree(canvas.elements), [canvas.elements]);

  const createBackFace = useCallback(() => {
    const sourceCanvas = currentTemplate.freeformCanvas || createDefaultFreeformCanvas();
    const presetTemplate = templates.find((template) => template.id === DEFAULT_BACK_TEMPLATE_ID);
    const presetCanvas = presetTemplate?.freeformCanvas || createDefaultFreeformCanvas({
      elements: [],
    });
    const nextBackCanvas = scaleCanvasToSize(presetCanvas, sourceCanvas.width, sourceCanvas.height);
    createBackFaceInController(nextBackCanvas);
    toast({
      title: 'Back face added',
      description: 'The optional back face starts from the dark fantasy default back template and can now be edited.',
    });
  }, [createBackFaceInController, currentTemplate.freeformCanvas, templates, toast]);

  // Group / ungroup
  const livePreviewData = useMemo(() => ({
    cardName: 'Astral Relic',
    cost: '3',
    rulesText: 'When Astral Relic enters play, draw a card. If you control an icon, gain 2 focus.',
    artworkUrl: 'https://placehold.co/600x400.png?text=Astral+Relic',
    ...(currentTemplate.templatePreviewData || {}),
  }), [currentTemplate.templatePreviewData]);

  const updateElementAppearance = useCallback((elementId: string, updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory = true) => {
    const element = canvas.elements.find(item => item.id === elementId);
    if (!element) return;
    const appearance = updater(normalizeAppearanceForElement(element));
    const nextElement = { ...element, appearance };
    updateElement(elementId, { appearance, ...appearanceToElementRenderFields(nextElement) }, trackHistory);
  }, [canvas.elements, updateElement]);

  const upsertFieldContract = useCallback((
    key: string,
    updates: Partial<FieldContract>
  ) => {
    commitTemplate((template) => upsertTemplateFieldContract(template, key, updates), false);
  }, [commitTemplate]);

  const focusVariableCard = useCallback((key: string) => {
    setActiveVariableKey(key);
    requestAnimationFrame(() => {
      variableCardRefs.current[key]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      variableKeyInputRefs.current[key]?.focus();
      variableKeyInputRefs.current[key]?.select();
    });
  }, []);

  const renameSelectedElementVariable = useCallback((oldKey: string, nextKeyRaw: string) => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const nextKey = normalizeTemplateVariableKey(nextKeyRaw);
    if (!nextKey || oldKey === nextKey) return;

    if (hasScopedVariableKeyConflict(currentTemplate.fieldContracts, selectedElement.id, oldKey, nextKey)) {
      toast({
        title: 'Variable name already used',
        description: `This element already has a variable named "${nextKey}". Choose a different name.`,
        variant: 'destructive',
      });
      focusVariableCard(oldKey);
      return;
    }

    commitTemplate((template) => renameScopedTextElementVariable({
      template,
      activeFace,
      fallbackCanvas: canvas,
      selectedElementId: selectedElement.id,
      oldKey,
      nextKey,
    }), false);

    focusVariableCard(nextKey);
  }, [activeFace, canvas, commitTemplate, currentTemplate.fieldContracts, focusVariableCard, selectedElement, toast]);

  const removeSelectedElementVariableContract = useCallback((key: string) => {
    if (!selectedElement) return;
    commitTemplate((template) => removeScopedTextElementVariableContract(template, selectedElement.id, key), false);
    setActiveVariableKey(null);
  }, [commitTemplate, selectedElement]);

  const getNextScopedVariableKey = useCallback((existingKey?: string) => {
    return buildNextScopedVariableKey(currentTemplate.fieldContracts, selectedElement, existingKey);
  }, [currentTemplate.fieldContracts, selectedElement]);

  const createEditorVariableFromSelection = useCallback((selectedText: string, existingKey?: string): string | undefined => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const cleanSelectedText = selectedText.trim();
    if (!cleanSelectedText) {
      toast({
        title: 'Select text first',
        description: 'Highlight the text you want to turn into a variable, then use the variable button.',
      });
      return;
    }

    const nextKey = getNextScopedVariableKey(existingKey);
    if (!nextKey) return;

    const inferredType = inferTextElementContentModel(currentTemplate, selectedElement);
    upsertFieldContract(nextKey, {
      key: nextKey,
      elementId: selectedElement.id,
      label: toTitleCase(nextKey),
      type: inferredType === 'structuredRows' ? 'structuredRows' : 'text',
      required: false,
      multiline: cleanSelectedText.includes('\n'),
      defaultValue: cleanSelectedText,
      example: cleanSelectedText,
    });
    toast({
      title: 'Variable created',
      description: `"${nextKey}" was added to this text element. You can adjust its rich text behavior below.`,
    });
    focusVariableCard(nextKey);
    return nextKey;
  }, [currentTemplate, focusVariableCard, getNextScopedVariableKey, selectedElement, toast, upsertFieldContract]);

  const applyAppearancePreset = useCallback((style: AppearanceStylePreset) => {
    if (!selectedElement) return;
    const nextElement = { ...selectedElement, appearance: style.appearance };
    updateElement(selectedElement.id, { appearance: style.appearance, ...appearanceToElementRenderFields(nextElement) });
  }, [selectedElement, updateElement]);

  const applyElementPresetRecipe = useCallback((recipe: ElementPresetRecipe) => {
    if (recipe.templateUpdates) {
      updateTemplate(recipe.templateUpdates);
      return;
    }
    if (!selectedElement) return;

    updateElement(selectedElement.id, buildElementPresetElementUpdates(recipe, selectedElement));
  }, [selectedElement, updateElement, updateTemplate]);

  // Group / ungroup
  const groupChecked = useCallback(() => {
    const result = groupCheckedInController(nanoid);
    if (!result.changed) return;
    selectElement(result.selectedElementId);
  }, [groupCheckedInController, selectElement]);

  const ungroupSelected = useCallback(() => {
    ungroupSelectedInController();
  }, [ungroupSelectedInController]);

  const isGroupElement = selectedElement?.type === 'shape' &&
    canvas.elements.some(e => e.parentId === selectedElement?.id);

  const saveSelectedAppearanceStyle = useCallback(() => {
    if (!selectedElement) return;
    onSaveAppearanceStyle({
      id: `style-${nanoid()}`,
      name: `${selectedElement.name || 'Element'} Style`,
      kind: isDividerElement(selectedElement) ? 'divider' : selectedElement.type === 'icon' ? 'icon' : 'material',
      targets: [isDividerElement(selectedElement) ? 'divider' : selectedElement.type],
      appearance: normalizeAppearanceForElement(selectedElement),
    });
  }, [onSaveAppearanceStyle, selectedElement]);

  const addElement = useCallback((type: FreeformCardElement['type'], placement?: { x: number; y: number }, preset: Partial<FreeformCardElement> = {}) => {
    const maxZ = Math.max(0, ...canvas.elements.map(element => element.zIndex));
    const id = nanoid();
    const base: FreeformCardElement = {
      id,
      type,
      name: type === 'text' ? 'Text Layer' : type === 'image' ? 'Image Layer' : type === 'icon' ? 'Icon Layer' : 'Shape Layer',
      x: placement?.x ?? 82,
      y: placement?.y ?? 82,
      width: type === 'text' ? 260 : type === 'icon' ? 72 : 220,
      height: type === 'text' ? 72 : type === 'icon' ? 72 : type === 'shape' ? 120 : 160,
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
    const mergedElement: FreeformCardElement = {
      ...base,
      ...preset,
      id,
      type,
      x: placement?.x ?? preset.x ?? 82,
      y: placement?.y ?? preset.y ?? 82,
      zIndex: maxZ + 1,
    };
    const newElement: FreeformCardElement = {
      ...mergedElement,
      appearance: normalizeAppearanceForElement(mergedElement),
    };
    updateCanvas({ elements: [...canvas.elements, newElement] });
    selectElement(id);
  }, [canvas.elements, selectElement, updateCanvas]);

  const duplicateSelected = useCallback(() => {
    const result = duplicateSelectedInController(nanoid, gridSize);
    if (!result.changed) return;
    selectElement(result.selectedElementId);
  }, [duplicateSelectedInController, gridSize, selectElement]);

  const handleLayerDragOver = useCallback((elementId: string, clientY: number, rect: DOMRect) => {
    if (layerDragId === elementId) return;
    const relY = clientY - rect.top;
    const zone = rect.height / 3;
    if (relY < zone) setLayerDropTarget({ id: elementId, pos: 'before' });
    else if (relY > rect.height - zone) setLayerDropTarget({ id: elementId, pos: 'after' });
    else setLayerDropTarget({ id: elementId, pos: 'child' });
  }, [layerDragId]);

  const handleLayerDrop = useCallback(() => {
    const srcId = layerDragId;
    const tgt = layerDropTarget;
    setLayerDragId(null);
    setLayerDropTarget(null);
    if (!srcId || !tgt || srcId === tgt.id) return;
    reorderLayer(srcId, tgt.id, tgt.pos);
  }, [layerDragId, layerDropTarget, reorderLayer]);

  const deleteSelected = useCallback(() => {
    const result = deleteSelectedInController();
    if (!result.changed) {
      if (result.reason === 'locked-selection' || result.reason === 'locked-descendant') {
        toast({
          title: 'Layer locked',
          description: result.reason === 'locked-descendant'
            ? 'Unlock child layers before deleting this group.'
            : 'Unlock this layer before deleting it.',
        });
      }
      return;
    }
  }, [deleteSelectedInController, toast]);

  const arrangeSelected = useCallback((direction: 'front' | 'back' | 'up' | 'down') => {
    arrangeSelectedInController(direction);
  }, [arrangeSelectedInController]);

  const alignSelected = useCallback((alignment: 'left' | 'center' | 'right') => {
    if (!selectedElement) return;
    const nextX = alignment === 'left' ? 32 : alignment === 'center' ? (canvas.width - selectedElement.width) / 2 : canvas.width - selectedElement.width - 32;
    updateElement(selectedElement.id, { x: Math.round(nextX) });
  }, [canvas.width, selectedElement, updateElement]);

  const snapValue = useCallback((value: number) => snapToGrid ? Math.round(value / gridSize) * gridSize : Math.round(value), [gridSize, snapToGrid]);
  const {
    clearDepthSelection,
    getCanvasPoint,
    handleElementPointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizePointerDown,
  } = useCanvasPointerInteractions({
    canvas,
    canvasRef,
    currentTemplate,
    previewMode,
    recordTemplateHistory,
    selectedElementId,
    selectElement,
    snapValue,
    updateCanvas,
    zoom,
  });

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/cardforge-element') as FreeformCardElement['type'];
    if (!type) return;
    const kitIndex = Number(event.dataTransfer.getData('application/cardforge-kit-index'));
    const serializedPreset = event.dataTransfer.getData('application/cardforge-preset');
    const preset = serializedPreset
      ? JSON.parse(serializedPreset) as Partial<FreeformCardElement>
      : Number.isFinite(kitIndex) ? CONSOLIDATED_ELEMENT_KITS[kitIndex]?.preset : undefined;
    const point = getCanvasPoint(event);
    addElement(type, { x: snapValue(point.x), y: snapValue(point.y) }, preset);
  }, [addElement, getCanvasPoint, snapValue]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedElement) return;
    const step = event.shiftKey ? gridSize : 1;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      moveSelectionByDelta(dx, dy);
    }
  }, [deleteSelected, gridSize, moveSelectionByDelta, selectedElement]);

  const handleSave = useCallback(() => {
    if (!currentTemplate.name?.trim() || currentTemplate.name === 'New Card Template') {
      toast({
        title: 'Template name is required',
        description: withNextStep('Template name must be set before saving.', 'Enter a template name in Template Settings, then save again.'),
        variant: 'destructive',
      });
      return;
    }
    const parts = currentTemplate.aspectRatio.split(':').map(Number);
    if (parts.length !== 2 || parts.some(part => !part || part <= 0 || Number.isNaN(part))) {
      toast({
        title: 'Aspect ratio format is invalid',
        description: withNextStep('Aspect Ratio must use W:H with positive numbers (example: 63:88).', 'Correct the Aspect Ratio field, then save again.'),
        variant: 'destructive',
      });
      return;
    }
    const savedId = onSaveTemplate({
      ...currentTemplate,
      freeformCanvas: reconstructFreeformCanvas(currentTemplate.freeformCanvas),
      backCanvas: currentTemplate.backCanvas ? reconstructFreeformCanvas(currentTemplate.backCanvas) : undefined,
    });
    onSelectTemplateForEditing(savedId);
  }, [currentTemplate, onSaveTemplate, onSelectTemplateForEditing, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        || target.isContentEditable
        || Boolean(target.closest('[contenteditable="true"], .ProseMirror, [role="textbox"]'))
      );
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
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
      if (event.key.toLowerCase() === 'g') setShowGrid(value => !value);
      if (event.key.toLowerCase() === 'p') setPreviewMode(value => !value);
      if (event.key === '+' || event.key === '=') {
        setAutoFitCanvas(false);
        setZoom(value => clamp(Math.round((value + 0.08) * 100) / 100, 0.28, 1.2));
      }
      if (event.key === '-' || event.key === '_') {
        setAutoFitCanvas(false);
        setZoom(value => clamp(Math.round((value - 0.08) * 100) / 100, 0.28, 1.2));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected, duplicateSelected, handleSave, redo, selectedElementId, undo]);

  const handleNewTemplate = useCallback(() => {
    const fresh = makeNewFreeformTemplate();
    resetTemplate(fresh);
    onSelectTemplateForEditing(null);
  }, [onSelectTemplateForEditing, resetTemplate]);

  const openTemplate = useCallback((template: TCGCardTemplate) => {
    if (!template.id) return;
    onSelectTemplateForEditing(template.id);
    resetTemplate(template);
  }, [onSelectTemplateForEditing, resetTemplate]);

  const handleClone = useCallback(() => {
    if (!currentTemplate.id) return;
    const newId = onCloneTemplate(currentTemplate.id);
    if (newId) onSelectTemplateForEditing(newId);
  }, [currentTemplate.id, onCloneTemplate, onSelectTemplateForEditing]);

  const handleApplyFrameStyle = useCallback((frameStyle: string) => {
    updateTemplate({
      ...(PREDEFINED_FRAME_VISUAL_PROPERTIES[frameStyle] || {}),
      frameStyle,
    });
  }, [updateTemplate]);

  const handleApplyCustomDimensions = useCallback(() => {
    const update = buildCustomDimensionTemplateUpdate({
      widthValue: customWidthValue,
      heightValue: customHeightValue,
      unit: customUnit,
      template: currentTemplate,
    });

    if (!update) {
      toast({
        title: 'Dimensions are invalid',
        description: withNextStep('Width and height must be positive numbers.', 'Update Width and Height values, then apply dimensions again.'),
        variant: 'destructive',
      });
      return;
    }

    updateTemplate(update);
  }, [currentTemplate, customHeightValue, customUnit, customWidthValue, toast, updateTemplate]);

  const resetGridToTemplateDefault = useCallback(() => {
    const nextGridSize = getDefaultGridSizeForCanvas(canvas.width, canvas.height);
    updateCanvas({ gridSize: nextGridSize });
  }, [canvas.height, canvas.width, updateCanvas]);

  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      apply(loadEvent.target?.result as string);
      toast({ title: 'Image Uploaded', description: `${file.name} loaded.` });
    };
    reader.onerror = () => toast({ title: 'Upload Error', description: 'Failed to read the selected image.', variant: 'destructive' });
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [toast]);

  const renderEditableElement = useCallback((element: FreeformCardElement) => (
    <TemplateEditableElement
      key={element.id}
      currentTemplate={currentTemplate}
      element={element}
      livePreviewData={livePreviewData}
      previewMode={previewMode}
      richTextHighlightColor={richTextHighlightColor}
      selected={selectedElementId === element.id}
      zoom={zoom}
      onElementPointerDown={handleElementPointerDown}
      onResizePointerDown={handleResizePointerDown}
    />
  ), [currentTemplate, handleElementPointerDown, handleResizePointerDown, livePreviewData, previewMode, richTextHighlightColor, selectedElementId, zoom]);

  const canvasFrameStyle: React.CSSProperties = {
    width: canvas.width,
    height: canvas.height,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
  };

  const canvasStyle: React.CSSProperties = {
    ...canvasFrameStyle,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: currentTemplate.baseBackgroundColor || '#ffffff',
    color: currentTemplate.baseTextColor || '#000000',
    borderColor: currentTemplate.cardBorderColor || 'hsl(var(--border))',
    borderWidth: currentTemplate.cardBorderWidth || '4px',
    borderStyle: currentTemplate.cardBorderStyle && currentTemplate.cardBorderStyle !== '_default_' ? currentTemplate.cardBorderStyle : 'solid',
    borderRadius: currentTemplate.cardBorderRadius || '0.5rem',
    backgroundImage: currentTemplate.cardBackgroundImageUrl ? `url(${replacePlaceholdersLocal(currentTemplate.cardBackgroundImageUrl, livePreviewData, false)})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
  };

  return (
    <TooltipProvider>
      <div
        className={cn('cardforge-maker-shell min-h-[calc(100vh-145px)] overflow-hidden rounded-[10px] border', makerTheme.shell)}
        data-mobile-panel={mobilePanel}
      >
        <TemplateEditorTopBar
          activeFace={activeFace}
          hasBackFace={Boolean(currentTemplate.backCanvas)}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          showGrid={showGrid}
          snapToGrid={snapToGrid}
          previewMode={previewMode}
          onUndo={undo}
          onRedo={redo}
          onZoomOut={() => {
            setAutoFitCanvas(false);
            setZoom(value => clamp(Math.round((value - 0.08) * 100) / 100, 0.28, 1.2));
          }}
          onZoomIn={() => {
            setAutoFitCanvas(false);
            setZoom(value => clamp(Math.round((value + 0.08) * 100) / 100, 0.28, 1.2));
          }}
          onFitToScreen={() => setAutoFitCanvas(true)}
          onCreateBackFace={createBackFace}
          onSetActiveFace={setActiveFace}
          onToggleGrid={() => setShowGrid(value => !value)}
          onToggleSnapToGrid={() => setSnapToGrid(value => !value)}
          onTogglePreviewMode={() => setPreviewMode(value => !value)}
          onSave={handleSave}
          toolButtonClassName={makerTheme.toolButton}
          activeButtonClassName={makerTheme.activeButton}
        />

        <div className="cardforge-maker-mobile-switcher no-print border-b border-[#252b35] bg-[#080c12] p-2 lg:hidden" role="group" aria-label="Layout Studio surface">
          {MOBILE_MAKER_PANELS.map((panel) => (
            <Button
              key={panel.value}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={mobilePanel === panel.value}
              className={cn(
                'h-10 flex-1 rounded-[4px] border border-[#2d3340] text-xs font-semibold text-[#c8b07f]',
                mobilePanel === panel.value && 'border-[#d5ad54] bg-[#24180e] text-[#fff1c7]'
              )}
              onClick={() => setMobilePanel(panel.value)}
            >
              {panel.label}
            </Button>
          ))}
        </div>

        <div className="cardforge-maker-grid grid min-h-[calc(100vh-205px)] min-w-0 grid-cols-1 lg:grid-cols-[240px_minmax(320px,1fr)_300px] xl:grid-cols-[280px_minmax(420px,1fr)_330px] 2xl:grid-cols-[300px_minmax(520px,1fr)_360px]">
          <aside className="cardforge-maker-side cardforge-maker-library min-w-0 border-b border-[#252b35] bg-[#0d1117] lg:border-b-0 lg:border-r">
            <ScrollArea className="cardforge-maker-scroll h-[calc(100vh-205px)] min-h-[760px]">
              <div className="space-y-3 p-2">
                <TemplateLibraryPanel
                  canUseProjectFiles={canUseProjectFiles}
                  currentTemplateId={currentTemplate.id}
                  defaultTemplates={defaultTemplates}
                  backFaceTemplates={backFaceTemplates}
                  fileInputRef={fileInputRef}
                  isCheckoutStarting={isCheckoutStarting}
                  projectFileGateMessage={projectFileGateMessage}
                  userTemplates={userTemplates}
                  onCreateNew={handleNewTemplate}
                  onClone={handleClone}
                  onDelete={() => currentTemplate.id && onDeleteTemplate(currentTemplate.id)}
                  onExportProject={onExportProject}
                  onImportProject={onImportProject}
                  onLoadProject={onLoadProject}
                  onStartCheckout={onStartCheckout}
                  onSelectTemplateId={(templateId) => {
                    const template = templates.find((candidate) => candidate.id === templateId);
                    if (template) openTemplate(template);
                    else onSelectTemplateForEditing(templateId);
                  }}
                  onOpenTemplate={openTemplate}
                  panelClassName={makerTheme.panel}
                  controlClassName={makerTheme.control}
                  buttonClassName={makerTheme.button}
                />

                <ElementLibraryPanel
                  sections={elementLibrarySections}
                  onAddElement={(type, preset) => {
                    addElement(type, undefined, preset);
                    setMobilePanel('canvas');
                  }}
                  panelClassName={makerTheme.panel}
                />

                <LayerTreePanel
                  panelClassName={makerTheme.panel}
                  elementsCount={canvas.elements.length}
                  layerTree={layerTree}
                  checkedLayerIds={checkedLayerIds}
                  collapsedGroups={collapsedGroups}
                  selectedElementId={selectedElementId}
                  layerDropTarget={layerDropTarget}
                  canUngroupSelected={isGroupElement}
                  onGroupChecked={groupChecked}
                  onUngroupSelected={ungroupSelected}
                  onClearChecked={clearCheckedLayers}
                  onSelectElement={selectElement}
                  onToggleGroupCollapsed={(elementId) => {
                    setCollapsedGroups(prev => {
                      const next = new Set(prev);
                      if (next.has(elementId)) next.delete(elementId);
                      else next.add(elementId);
                      return next;
                    });
                  }}
                  onToggleChecked={toggleCheckedLayer}
                  onDragStart={setLayerDragId}
                  onDragEnd={() => {
                    setLayerDragId(null);
                    setLayerDropTarget(null);
                  }}
                  onDragOver={handleLayerDragOver}
                  onDrop={handleLayerDrop}
                  onToggleVisibility={(element) => updateElement(element.id, { visible: element.visible === false ? true : false })}
                  onToggleLock={(element) => updateElement(element.id, { locked: !element.locked })}
                  onDuplicateSelected={duplicateSelected}
                  onDeleteSelected={deleteSelected}
                />
              </div>
            </ScrollArea>
          </aside>

          <TemplateCanvasStage
            activeFace={activeFace}
            canvas={canvas}
            canvasFrameStyle={canvasFrameStyle}
            canvasRef={canvasRef}
            canvasStyle={canvasStyle}
            currentTemplate={currentTemplate}
            gridSize={gridSize}
            livePreviewData={livePreviewData}
            previewMode={previewMode}
            selectedElement={selectedElement}
            showGrid={showGrid}
            stageRef={stageRef}
            zoom={zoom}
            onCanvasKeyDown={handleCanvasKeyDown}
            onClearDepthSelection={clearDepthSelection}
            onDeselectCanvas={() => setSelectedElementId(null)}
            onDrop={handleDrop}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            renderEditableElement={renderEditableElement}
          />

          <aside className="cardforge-maker-side cardforge-maker-inspector min-w-0 border-t border-[#252b35] bg-[#0d1117] lg:border-l lg:border-t-0">
            <ScrollArea className="cardforge-maker-scroll h-[calc(100vh-205px)] min-h-[760px]">
              <div className="space-y-3 p-2">
                <TemplateEditorInspectorPanel
                  activeTab={activeInspectorTab}
                  onActiveTabChange={setActiveInspectorTab}
                  panelClassName={makerTheme.panel}
                  hasSelectedElement={Boolean(selectedElement)}
                  selectedElementType={selectedElement?.type}
                  templateContent={
                    <TemplateSettingsPanel
                      currentTemplate={currentTemplate}
                      customWidthValue={customWidthValue}
                      customHeightValue={customHeightValue}
                      customUnit={customUnit}
                      gridSize={gridSize}
                      frameKitRecipes={frameKitRecipesForCurrentTemplate}
                      backgroundImageInputRef={bgImageInputRef}
                      borderImageInputRef={borderImageInputRef}
                      controlClassName={makerTheme.control}
                      buttonClassName={makerTheme.button}
                      onCustomWidthValueChange={setCustomWidthValue}
                      onCustomHeightValueChange={setCustomHeightValue}
                      onCustomUnitChange={setCustomUnit}
                      onApplyCustomDimensions={handleApplyCustomDimensions}
                      onResetGridToTemplateDefault={resetGridToTemplateDefault}
                      onApplyFrameStyle={handleApplyFrameStyle}
                      onApplyElementPresetRecipe={applyElementPresetRecipe}
                      onFileUpload={handleFileUpload}
                      onUpdateCanvas={updateCanvas}
                      onUpdateTemplate={updateTemplate}
                    />
                  }
                  elementContent={selectedElement ? (
                    <>
                        {(canUseTypography || canUseImageSource) && (
                          <InspectorFlowSection
                            title={canUseImageSource ? 'Image Source' : 'Source & Content'}
                            description={canUseImageSource
                              ? 'Choose the selected image or overlay source. Frame, crop, and edge controls stay in later sections.'
                              : 'Write the selected text and define which fields the generator will ask users to fill.'}
                          >
                            <ElementContentPanel
                              element={selectedElement}
                              currentTemplate={currentTemplate}
                              selectedElementTemplateFields={selectedElementTemplateFields}
                              activeVariableKey={activeVariableKey}
                              richTextHighlightColor={richTextHighlightColor}
                              variableKeyInputRefs={variableKeyInputRefs}
                              variableCardRefs={variableCardRefs}
                              onSetActiveVariableKey={setActiveVariableKey}
                              onSetRichTextHighlightColor={setRichTextHighlightColorAction}
                              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              onCreateEditorVariableFromSelection={createEditorVariableFromSelection}
                              onFocusVariableCard={focusVariableCard}
                              onRemoveSelectedElementVariableContract={removeSelectedElementVariableContract}
                              onRenameSelectedElementVariable={renameSelectedElementVariable}
                              onUpsertFieldContract={upsertFieldContract}
                            />
                            {canUseImageSource && (
                              <ImageInspectorPanel
                                element={selectedElement}
                                imageAssets={compatibleImageAssets}
                                assetSearch={assetSearch}
                                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                                onHandleFileUpload={handleFileUpload}
                                onAssetSearchChange={setAssetSearch}
                              />
                            )}
                          </InspectorFlowSection>
                        )}

                        {canUseIconLibrary && (
                          <InspectorFlowSection
                            title="Source & Symbol"
                            description="Pick a built-in icon, upload a symbol, or choose a reviewed icon asset before styling the glyph."
                          >
                            <IconInspectorPanel
                              element={selectedElement}
                              iconOptions={ICON_OPTIONS}
                              iconAssets={compatibleIconAssets}
                              assetSearch={assetSearch}
                              canUploadCustomAssets={canUploadCustomAssets}
                              symbolStylePresets={selectedElementPresetRecipeGroups.icon}
                              controlClassName={makerTheme.control}
                              buttonClassName={makerTheme.button}
                              onApplyPreset={applyElementPresetRecipe}
                              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              onHandleFileUpload={handleFileUpload}
                              onHandleAssetUpload={handleAssetUpload}
                              onAssetSearchChange={setAssetSearch}
                            />
                          </InspectorFlowSection>
                        )}

                        {(canUseShapeControls || canUseDividerControls) && (
                          <InspectorFlowSection
                            title={canUseDividerControls ? 'Divider Builder' : 'Shape Builder'}
                            description={canUseDividerControls
                              ? 'Build the divider rail itself; material and edge controls stay below.'
                              : 'Choose the primitive geometry or apply a reviewed shape role recipe.'}
                          >
                            {canUseShapeControls && (
                              <ShapeInspectorPanel
                                element={selectedElement}
                                primitiveOptions={SHAPE_PRIMITIVE_OPTIONS}
                                blankPrimitives={BLANK_SHAPE_PRIMITIVES}
                                rolePresets={selectedElementPresetRecipeGroups.shapeRole}
                                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              />
                            )}

                            {canUseDividerControls && (
                              <DividerStudioPanel
                                element={selectedElement}
                                selectedAppearance={selectedAppearance}
                                dividerPresets={selectedElementPresetRecipeGroups.divider}
                                onApplyPreset={applyElementPresetRecipe}
                                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                                onUpdateAppearance={(updater, trackHistory) => updateElementAppearance(selectedElement.id, updater, trackHistory)}
                              />
                            )}
                          </InspectorFlowSection>
                        )}

                        {canUseTypography && (
                          <InspectorFlowSection
                            title="Text Style"
                            description="Control characters, typography, field behavior, and reviewed text-frame recipes for this text element."
                          >
                            <TypographyInspectorPanel
                              element={selectedElement}
                              currentTemplate={currentTemplate}
                              availableFonts={AVAILABLE_FONTS}
                              paddingOptions={PADDING_OPTIONS}
                              framePresets={selectedElementPresetRecipeGroups.textFrame}
                              controlClassName={makerTheme.control}
                              onApplyPreset={applyElementPresetRecipe}
                              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              onUpsertFieldContract={upsertFieldContract}
                            />
                          </InspectorFlowSection>
                        )}

                        {canUseAppearanceStudio && (
                          <InspectorFlowSection
                            title="Material & Effects"
                            description="Change fill, texture, gradient, glow, and surface treatment without moving the element."
                          >
                            <AppearanceStudioPanel
                              element={selectedElement}
                              selectedAppearance={selectedAppearance}
                              compatibleAppearanceStyles={compatibleAppearanceStyles}
                              compatibleTextureAssets={compatibleTextureAssets}
                              compatibleDividerAssets={compatibleDividerAssets}
                              elementStylePresets={ELEMENT_STYLE_PRESETS}
                              canUseImageSource={canUseImageSource}
                              canUseDividerControls={canUseDividerControls}
                              canUseBackgroundTexture={canUseBackgroundTexture}
                              controlClassName={makerTheme.control}
                              buttonClassName={makerTheme.button}
                              assetSearch={assetSearch}
                              canUploadCustomAssets={canUploadCustomAssets}
                              onAssetSearchChange={setAssetSearch}
                              onHandleAssetUpload={handleAssetUpload}
                              onSaveStyle={saveSelectedAppearanceStyle}
                              onApplyAppearancePreset={applyAppearancePreset}
                              onUpdateAppearance={(updater, trackHistory) => updateElementAppearance(selectedElement.id, updater, trackHistory)}
                            />
                          </InspectorFlowSection>
                        )}

                        {canUseElementBorder && (
                          <InspectorFlowSection
                            title="Frame & Edge"
                            description="Control the selected element container: text box edge, image frame, icon backplate, or shape stroke."
                          >
                            <BorderInspectorPanel
                              element={selectedElement}
                              selectedAppearance={selectedAppearance}
                              borderPresets={selectedElementPresetRecipeGroups.border}
                              onApplyPreset={applyElementPresetRecipe}
                              onUpdateAppearance={(updater, trackHistory) => updateElementAppearance(selectedElement.id, updater, trackHistory)}
                            />
                          </InspectorFlowSection>
                        )}

                        <InspectorFlowSection
                          title="Align To Canvas & Layer"
                          description="Move, size, rotate, lock, duplicate, delete, and align the selected element against the card canvas."
                        >
                          <ElementTransformPanel
                            element={selectedElement}
                            controlClassName={makerTheme.control}
                            buttonClassName={makerTheme.button}
                            onDuplicate={duplicateSelected}
                            onDelete={deleteSelected}
                            onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                          />
                          <ElementAlignmentPanel
                            buttonClassName={makerTheme.button}
                            onAlign={alignSelected}
                            onArrange={arrangeSelected}
                          />
                        </InspectorFlowSection>
                    </>
                  ) : null}
                />
              </div>
            </ScrollArea>
          </aside>
        </div>
        <div id="maker-shortcuts-help" role="note" aria-label="Keyboard shortcuts" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#252b35] bg-[#080b10] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#757d8c]">
          <span className="text-[#d5ad54]">Shortcuts</span>
          <span>Ctrl+S Save</span>
          <span>Ctrl+Z Undo</span>
          <span>Ctrl+D Duplicate</span>
          <span>Del Remove</span>
          <span>G Grid</span>
          <span>P Preview</span>
          <span>+/- Zoom</span>
          <span>Esc Deselect</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

