"use client";

import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  BoxSelect,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize2,
  MousePointer2,
  PenTool,
  Plus,
  Redo2,
  Save,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import type { AppearanceBorderKind, AppearanceGradientType, AppearanceStylePreset, AppearanceTextureKind, FreeformAppearance, FreeformCardElement, FreeformCanvas, TCGCardTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AVAILABLE_FONTS,
  BORDER_RADIUS_OPTIONS,
  BORDER_WIDTH_OPTIONS,
  CARD_BORDER_STYLES,
  DIMENSION_UNITS,
  FONT_STYLES,
  FONT_WEIGHTS,
  FRAME_STYLES,
  PADDING_OPTIONS,
  TCG_ASPECT_RATIO,
  TEXT_ALIGNS,
} from '@/lib/constants';
import { cn, replacePlaceholdersLocal } from '@/lib/utils';
import { appearanceToLegacyElementFields, appearanceToStyle, normalizeAppearanceForElement } from '@/lib/appearance';
import { CARD_DIVIDER_ASSETS, SEAMLESS_TEXTURE_ASSETS } from '@/lib/cardAssets';
import type { CardAssetOption } from '@/lib/cardAssets';
import { hasElementCapability, isDividerElement, SHAPE_PRIMITIVE_OPTIONS } from '@/lib/elementCapabilities';
import { createDefaultFreeformCanvas, reconstructFreeformCanvas, reconstructMinimalTemplate } from '@/store/appStore';
import { useToast } from '@/hooks/use-toast';
import {
  PREDEFINED_FRAME_VISUAL_PROPERTIES,
  ICON_OPTIONS,
  makerTheme,
  templatePresets,
  elementKits,
  CONSOLIDATED_ELEMENT_KITS,
  ELEMENT_STYLE_PRESETS,
  BORDER_PRESETS,
  SHAPE_PRESETS,
  DIVIDER_PRESETS,
  SYMBOL_STYLE_PRESETS,
  SHAPE_ROLE_PRESETS,
  TEXT_FRAME_PRESETS,
  ColorField,
  RichTextContent,
  RichTextToolbar,
  makeNewFreeformTemplate,
  mmConversion,
  borderWidthClassToPixels,
  radiusClassToPixels,
  clamp,
  textFontSizePx,
  escapeTemplateText,
  unescapeTemplateText,
  parseTextBinding,
  buildTextBinding,
  shapeClipPath,
} from './makerConstants';

interface CardTemplateMaker2Props {
  onSaveTemplate: (template: TCGCardTemplate) => string;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  onCloneTemplate: (templateId: string) => string | null;
  appearanceStyles: AppearanceStylePreset[];
  onSaveAppearanceStyle: (style: AppearanceStylePreset) => string;
  onDeleteAppearanceStyle: (styleId: string) => void;
  selectedTemplateIdForEditing: string | null;
  onSelectTemplateForEditing: (templateId: string | null) => void;
}

type DragState =
  | { mode: 'move'; id: string; startX: number; startY: number; original: FreeformCardElement }
  | { mode: 'resize'; id: string; startX: number; startY: number; original: FreeformCardElement };


export function CardTemplateMaker2({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  onCloneTemplate,
  appearanceStyles,
  onSaveAppearanceStyle,
  onDeleteAppearanceStyle,
  selectedTemplateIdForEditing,
  onSelectTemplateForEditing,
}: CardTemplateMaker2Props) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement | null>(null);
  const borderImageInputRef = useRef<HTMLInputElement | null>(null);
  const elementBgInputRef = useRef<HTMLInputElement | null>(null);
  const elementImageInputRef = useRef<HTMLInputElement | null>(null);
  const iconUploadInputRef = useRef<HTMLInputElement | null>(null);
  const textureAssetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const dividerAssetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const defaultTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [customTextureAssets, setCustomTextureAssets] = useState<CardAssetOption[]>([]);
  const [customDividerAssets, setCustomDividerAssets] = useState<CardAssetOption[]>([]);

  const freeformTemplates = useMemo(() => templates.filter(template => template.layoutMode === 'freeform'), [templates]);
  const initialTemplate = useMemo(() => {
    const selected = templates.find(template => template.id === selectedTemplateIdForEditing && template.layoutMode === 'freeform');
    return reconstructMinimalTemplate(selected || freeformTemplates[0] || makeNewFreeformTemplate());
  }, [freeformTemplates, selectedTemplateIdForEditing, templates]);

  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(initialTemplate);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(initialTemplate.freeformCanvas?.elements[0]?.id || null);
  const [zoom, setZoom] = useState(0.62);
  const [autoFitCanvas, setAutoFitCanvas] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [history, setHistory] = useState<TCGCardTemplate[]>([]);
  const [future, setFuture] = useState<TCGCardTemplate[]>([]);
  const [customWidthValue, setCustomWidthValue] = useState('');
  const [customHeightValue, setCustomHeightValue] = useState('');
  const [customUnit, setCustomUnit] = useState('mm');

  useEffect(() => {
    setCurrentTemplate(initialTemplate);
    setSelectedElementId(initialTemplate.freeformCanvas?.elements[0]?.id || null);
    setHistory([]);
    setFuture([]);
  }, [initialTemplate]);

  useEffect(() => {
    try {
      const textures = JSON.parse(localStorage.getItem('cardforge-maker2-custom-textures') || '[]') as CardAssetOption[];
      const dividers = JSON.parse(localStorage.getItem('cardforge-maker2-custom-dividers') || '[]') as CardAssetOption[];
      setCustomTextureAssets(Array.isArray(textures) ? textures : []);
      setCustomDividerAssets(Array.isArray(dividers) ? dividers : []);
    } catch {
      setCustomTextureAssets([]);
      setCustomDividerAssets([]);
    }
  }, []);

  const canvas = currentTemplate.freeformCanvas || createDefaultFreeformCanvas();
  const sortedElements = useMemo(() => [...(canvas.elements || [])].sort((a, b) => b.zIndex - a.zIndex), [canvas.elements]);
  const groupedElementKits = useMemo(() => {
    const groups: Record<'Core' | 'Card Parts' | 'Ornaments', typeof elementKits> = {
      Core: [],
      'Card Parts': [],
      Ornaments: [],
    };
    CONSOLIDATED_ELEMENT_KITS.forEach(item => groups[item.category].push(item));
    return groups;
  }, []);
  const selectedElement = canvas.elements.find(element => element.id === selectedElementId) || null;
  const gridSize = canvas.gridSize || 20;
  const selectedElementIsDivider = isDividerElement(selectedElement);
  const canUseBackgroundTexture = hasElementCapability(selectedElement, 'texture');
  const canUseTypography = hasElementCapability(selectedElement, 'typography');
  const canUseIconLibrary = hasElementCapability(selectedElement, 'icon');
  const canUseShapeControls = hasElementCapability(selectedElement, 'shape');
  const canUseDividerControls = hasElementCapability(selectedElement, 'divider');
  const canUseImageSource = hasElementCapability(selectedElement, 'image');
  const compatibleAppearanceStyles = useMemo(() => {
    if (!selectedElement) return [];
    const elementTarget = isDividerElement(selectedElement) ? 'divider' : selectedElement.type;
    const byId = new Map<string, AppearanceStylePreset>();
    appearanceStyles.forEach(style => {
      if ((style.targets.includes('element') || style.targets.includes(elementTarget)) && !byId.has(style.id)) {
        byId.set(style.id, style);
      }
    });
    return Array.from(byId.values());
  }, [appearanceStyles, selectedElement]);
  const compatibleTextureAssets = useMemo(() => {
    if (!selectedElement || !canUseBackgroundTexture) return [];
    const target = selectedElement.type === 'shape' ? 'shape' : 'text';
    const search = assetSearch.trim().toLowerCase();
    return [...SEAMLESS_TEXTURE_ASSETS, ...customTextureAssets]
      .filter(asset => asset.allowedTargets.includes(target))
      .filter(asset => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, canUseBackgroundTexture, customTextureAssets, selectedElement]);
  const compatibleDividerAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return [...CARD_DIVIDER_ASSETS, ...customDividerAssets]
      .filter(asset => asset.allowedTargets.includes('divider'))
      .filter(asset => !search || asset.name.toLowerCase().includes(search));
  }, [assetSearch, customDividerAssets]);

  useEffect(() => {
    if (!autoFitCanvas || !stageRef.current) return;
    const updateFit = () => {
      const width = stageRef.current?.clientWidth || 0;
      const height = stageRef.current?.clientHeight || 0;
      if (!width || !height) return;
      const fitted = Math.min((width - 72) / canvas.width, (height - 72) / canvas.height, 0.76);
      setZoom(clamp(Math.round(fitted * 100) / 100, 0.28, 0.76));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [autoFitCanvas, canvas.height, canvas.width]);

  const livePreviewData = useMemo(() => ({
    cardName: 'Astral Relic',
    cost: '3',
    rulesText: 'When Astral Relic enters play, draw a card. If you control an icon, gain 2 focus.',
    artworkUrl: 'https://placehold.co/600x400.png?text=Astral+Relic',
  }), []);

  const commitTemplate = useCallback((updater: (template: TCGCardTemplate) => TCGCardTemplate, trackHistory = true) => {
    setCurrentTemplate(previous => {
      const before = reconstructMinimalTemplate(previous);
      const next = reconstructMinimalTemplate(updater(before));
      if (trackHistory) {
        setHistory(items => [...items.slice(-39), before]);
        setFuture([]);
      }
      return next;
    });
  }, []);

  const updateTemplate = useCallback((updates: Partial<TCGCardTemplate>, trackHistory = true) => {
    commitTemplate(template => ({ ...template, ...updates }), trackHistory);
  }, [commitTemplate]);

  const updateCanvas = useCallback((updates: Partial<FreeformCanvas>, trackHistory = true) => {
    commitTemplate(template => ({
      ...template,
      freeformCanvas: reconstructFreeformCanvas({ ...(template.freeformCanvas || canvas), ...updates }),
    }), trackHistory);
  }, [canvas, commitTemplate]);

  const updateElement = useCallback((elementId: string, updates: Partial<FreeformCardElement>, trackHistory = true) => {
    updateCanvas({
      elements: canvas.elements.map(element => element.id === elementId ? { ...element, ...updates } : element),
    }, trackHistory);
  }, [canvas.elements, updateCanvas]);

  const updateElementAppearance = useCallback((elementId: string, updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory = true) => {
    const element = canvas.elements.find(item => item.id === elementId);
    if (!element) return;
    const appearance = updater(normalizeAppearanceForElement(element));
    const nextElement = { ...element, appearance };
    updateElement(elementId, { appearance, ...appearanceToLegacyElementFields(nextElement) }, trackHistory);
  }, [canvas.elements, updateElement]);

  const applyAppearancePreset = useCallback((style: AppearanceStylePreset) => {
    if (!selectedElement) return;
    const nextElement = { ...selectedElement, appearance: style.appearance };
    updateElement(selectedElement.id, { appearance: style.appearance, ...appearanceToLegacyElementFields(nextElement) });
  }, [selectedElement, updateElement]);

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
    setSelectedElementId(id);
  }, [canvas.elements, updateCanvas]);

  const duplicateSelected = useCallback(() => {
    if (!selectedElement) return;
    const copyElement = {
      ...selectedElement,
      id: nanoid(),
      name: `${selectedElement.name} Copy`,
      x: selectedElement.x + gridSize,
      y: selectedElement.y + gridSize,
      zIndex: Math.max(0, ...canvas.elements.map(element => element.zIndex)) + 1,
      locked: false,
    };
    updateCanvas({ elements: [...canvas.elements, copyElement] });
    setSelectedElementId(copyElement.id);
  }, [canvas.elements, gridSize, selectedElement, updateCanvas]);

  const deleteSelected = useCallback(() => {
    if (!selectedElement) return;
    const nextElements = canvas.elements.filter(element => element.id !== selectedElement.id);
    updateCanvas({ elements: nextElements });
    setSelectedElementId(nextElements[0]?.id || null);
  }, [canvas.elements, selectedElement, updateCanvas]);

  const arrangeSelected = useCallback((direction: 'front' | 'back' | 'up' | 'down') => {
    if (!selectedElement) return;
    const zValues = canvas.elements.map(element => element.zIndex);
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);
    const nextZ = direction === 'front' ? maxZ + 1 : direction === 'back' ? minZ - 1 : direction === 'up' ? selectedElement.zIndex + 1 : selectedElement.zIndex - 1;
    updateElement(selectedElement.id, { zIndex: nextZ });
  }, [canvas.elements, selectedElement, updateElement]);

  const alignSelected = useCallback((alignment: 'left' | 'center' | 'right') => {
    if (!selectedElement) return;
    const nextX = alignment === 'left' ? 32 : alignment === 'center' ? (canvas.width - selectedElement.width) / 2 : canvas.width - selectedElement.width - 32;
    updateElement(selectedElement.id, { x: Math.round(nextX) });
  }, [canvas.width, selectedElement, updateElement]);

  const undo = useCallback(() => {
    setHistory(items => {
      const previous = items[items.length - 1];
      if (!previous) return items;
      setFuture(existing => [currentTemplate, ...existing]);
      setCurrentTemplate(previous);
      return items.slice(0, -1);
    });
  }, [currentTemplate]);

  const redo = useCallback(() => {
    setFuture(items => {
      const next = items[0];
      if (!next) return items;
      setHistory(existing => [...existing, currentTemplate]);
      setCurrentTemplate(next);
      return items.slice(1);
    });
  }, [currentTemplate]);

  const snapValue = useCallback((value: number) => snapToGrid ? Math.round(value / gridSize) * gridSize : Math.round(value), [gridSize, snapToGrid]);

  const getCanvasPoint = useCallback((event: Pick<PointerEvent | ReactPointerEvent, 'clientX' | 'clientY'>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const handleElementPointerDown = useCallback((event: ReactPointerEvent, element: FreeformCardElement) => {
    if (previewMode || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    setHistory(items => [...items.slice(-39), currentTemplate]);
    setFuture([]);
    const point = getCanvasPoint(event);
    dragStateRef.current = { mode: 'move', id: element.id, startX: point.x, startY: point.y, original: element };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [currentTemplate, getCanvasPoint, previewMode]);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent, element: FreeformCardElement) => {
    if (previewMode || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    setHistory(items => [...items.slice(-39), currentTemplate]);
    setFuture([]);
    const point = getCanvasPoint(event);
    dragStateRef.current = { mode: 'resize', id: element.id, startX: point.x, startY: point.y, original: element };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [currentTemplate, getCanvasPoint, previewMode]);

  const handlePointerMove = useCallback((event: ReactPointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const point = getCanvasPoint(event);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    // MIN_VISIBLE: minimum px that must remain on-canvas so elements can always be grabbed back
    const MIN_VISIBLE = 20;
    if (dragState.mode === 'move') {
      updateElement(dragState.id, {
        x: clamp(snapValue(dragState.original.x + deltaX), -(dragState.original.width - MIN_VISIBLE), canvas.width - MIN_VISIBLE),
        y: clamp(snapValue(dragState.original.y + deltaY), -(dragState.original.height - MIN_VISIBLE), canvas.height - MIN_VISIBLE),
      }, false);
    } else {
      updateElement(dragState.id, {
        width: clamp(snapValue(dragState.original.width + deltaX), 20, canvas.width * 2),
        height: clamp(snapValue(dragState.original.height + deltaY), 12, canvas.height * 2),
      }, false);
    }
  }, [canvas.height, canvas.width, getCanvasPoint, snapValue, updateElement]);

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/cardforge-element') as FreeformCardElement['type'];
    if (!type) return;
    const kitIndex = Number(event.dataTransfer.getData('application/cardforge-kit-index'));
    const preset = Number.isFinite(kitIndex) ? CONSOLIDATED_ELEMENT_KITS[kitIndex]?.preset : undefined;
    const point = getCanvasPoint(event);
    addElement(type, { x: snapValue(point.x), y: snapValue(point.y) }, preset);
  }, [addElement, getCanvasPoint, snapValue]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedElement || selectedElement.locked) return;
    const step = event.shiftKey ? gridSize : 1;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      updateElement(selectedElement.id, {
        x: selectedElement.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: selectedElement.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      });
    }
  }, [deleteSelected, gridSize, selectedElement, updateElement]);

  const handleSave = useCallback(() => {
    if (!currentTemplate.name?.trim() || currentTemplate.name === 'New 2.0 Template') {
      toast({ title: 'Validation Error', description: 'Template name must be set.', variant: 'destructive' });
      return;
    }
    const parts = currentTemplate.aspectRatio.split(':').map(Number);
    if (parts.length !== 2 || parts.some(part => !part || part <= 0 || Number.isNaN(part))) {
      toast({ title: 'Validation Error', description: 'Aspect Ratio must be in W:H format with positive numbers.', variant: 'destructive' });
      return;
    }
    const savedId = onSaveTemplate({ ...currentTemplate, layoutMode: 'freeform', freeformCanvas: reconstructFreeformCanvas(currentTemplate.freeformCanvas) });
    onSelectTemplateForEditing(savedId);
  }, [currentTemplate, onSaveTemplate, onSelectTemplateForEditing, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
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
  });

  const handleNewTemplate = useCallback(() => {
    const fresh = makeNewFreeformTemplate();
    setCurrentTemplate(fresh);
    setSelectedElementId(fresh.freeformCanvas?.elements[0]?.id || null);
    onSelectTemplateForEditing(null);
  }, [onSelectTemplateForEditing]);

  const applyTemplatePreset = useCallback((preset: (typeof templatePresets)[number]) => {
    const fileBackedTemplate = 'templateId' in preset
      ? templates.find(template => template.id === preset.templateId && template.layoutMode === 'freeform')
      : null;

    if (fileBackedTemplate?.id) {
      onSelectTemplateForEditing(fileBackedTemplate.id);
      setCurrentTemplate(reconstructMinimalTemplate(fileBackedTemplate));
      setSelectedElementId(fileBackedTemplate.freeformCanvas?.elements[0]?.id || null);
      setHistory([]);
      setFuture([]);
      return;
    }

    const canvasPreset = createDefaultFreeformCanvas();
    const isPurple = preset.id === 'soul-portrait';
    const isQuest = preset.id === 'quest';
    const isConstruct = preset.id === 'construct';
    const updatedCanvas = {
      ...canvasPreset,
      elements: (canvasPreset.elements.map(element => {
        if (element.name === 'Card Frame') {
          return {
            ...element,
            backgroundColor: isPurple ? '#160d25' : isConstruct ? '#11161c' : isQuest ? '#0d1813' : 'rgba(0,0,0,0.18)',
            fillColor: isPurple ? '#160d25' : isConstruct ? '#11161c' : isQuest ? '#0d1813' : 'rgba(0,0,0,0.18)',
            backgroundImageUrl: isPurple
              ? 'repeating-linear-gradient(115deg, rgba(255,255,255,0.08) 0 3px, transparent 3px 16px), radial-gradient(circle at 50% 6%, rgba(213,173,84,0.28), transparent 32%), linear-gradient(180deg, #160d25, #08060c)'
              : isConstruct
                ? 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 10px), linear-gradient(180deg, rgba(213,173,84,0.16), rgba(0,0,0,0.52))'
                : isQuest
                  ? 'radial-gradient(circle at 50% 14%, rgba(79,178,134,0.28), transparent 32%), linear-gradient(180deg, #0d1813, #07100d)'
                  : 'radial-gradient(circle at 50% 10%, rgba(213,173,84,0.22), transparent 32%), linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.38))',
            borderColor: preset.accent,
            strokeColor: preset.accent,
            borderWidth: 'border-4',
          };
        }
        if (element.name === 'Artwork') {
          return {
            ...element,
            backgroundImageUrl: preset.art,
            borderColor: preset.accent,
          };
        }
        if (element.name === 'Card Name' || element.name === 'Rules Text') {
          return {
            ...element,
            backgroundImageUrl: element.name === 'Rules Text'
              ? isPurple
                ? 'linear-gradient(135deg, rgba(122,82,204,0.26), rgba(12,8,20,0.9))'
                : 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.42), transparent 42%), linear-gradient(180deg, rgba(255,250,230,0.96), rgba(214,178,105,0.38))'
              : 'linear-gradient(90deg, rgba(0,0,0,0.58), rgba(213,173,84,0.2), rgba(0,0,0,0.58))',
            backgroundColor: element.name === 'Rules Text' ? (isPurple ? '#171026' : 'rgba(244,226,186,0.94)') : '#17100b',
            textColor: isPurple ? '#f4eaff' : element.name === 'Rules Text' ? '#20140a' : '#f7df9d',
            borderColor: preset.accent,
            borderWidth: element.name === 'Rules Text' ? 'border-4' : 'border-2',
            borderRadius: element.name === 'Rules Text' ? 'rounded-md' : 'rounded-md',
            padding: element.name === 'Rules Text' ? 'p-4' : element.padding,
          };
        }
        return { ...element, borderColor: preset.accent };
      }) as FreeformCardElement[]).concat([
        {
          id: nanoid(),
          type: 'text',
          name: isQuest ? 'Quest Type Line' : 'Type Line',
          x: 64,
          y: 488,
          width: 502,
          height: 36,
          rotation: 0,
          opacity: 1,
          zIndex: 5,
          locked: false,
          content: isQuest ? '{{questType:"QUEST - JOURNEY"}}' : isConstruct ? '{{typeLine:"ARTIFACT - CONSTRUCT"}}' : '{{typeLine:"CREATURE - DRAGON"}}',
          textColor: '#f7df9d',
          backgroundColor: '#17100b',
          backgroundImageUrl: 'linear-gradient(90deg, #090706, rgba(213,173,84,0.18), #090706)',
          fontFamily: 'font-cinzel',
          fontSize: 'text-xs',
          fontWeight: 'font-semibold',
          textAlign: 'left',
          fontStyle: 'normal',
          padding: 'p-2',
          borderColor: preset.accent,
          borderWidth: 'border',
          borderRadius: 'rounded-md',
          minHeight: '_auto_',
          imageObjectFit: 'cover',
          strokeWidth: 0,
        } as FreeformCardElement,
        {
          id: nanoid(),
          type: 'shape',
          name: 'Ornamental Divider',
          x: 94,
          y: 742,
          width: 442,
          height: 16,
          rotation: 0,
          opacity: 1,
          zIndex: 6,
          locked: false,
          content: '',
          shapeKind: 'rectangle',
          textColor: '#111827',
          backgroundColor: preset.accent,
          backgroundImageUrl: isPurple
            ? 'repeating-linear-gradient(120deg, rgba(255,255,255,0.16) 0 5px, transparent 5px 20px), linear-gradient(90deg, transparent, #7a52cc 18%, #d5ad54 50%, #7a52cc 82%, transparent)'
            : 'linear-gradient(90deg, transparent, #7f5d1f 12%, #f5d27b 50%, #7f5d1f 88%, transparent)',
          fontFamily: 'font-sans',
          fontSize: 'text-sm',
          fontWeight: 'font-normal',
          textAlign: 'left',
          fontStyle: 'normal',
          padding: 'p-0',
          borderWidth: '_none_',
          borderRadius: 'rounded-full',
          minHeight: '_auto_',
          imageObjectFit: 'cover',
          fillColor: preset.accent,
          strokeWidth: 0,
        } as FreeformCardElement,
      ]),
    };
    const fresh = reconstructMinimalTemplate({
      ...makeNewFreeformTemplate(preset.name),
      name: preset.name,
      baseBackgroundColor: preset.id === 'soul-portrait' ? '#160d25' : '#f4e4bd',
      baseTextColor: preset.id === 'soul-portrait' ? '#f4eaff' : '#21180d',
      cardBorderColor: preset.accent,
      defaultSectionBorderColor: preset.accent,
      freeformCanvas: updatedCanvas,
    });
    setCurrentTemplate(fresh);
    setSelectedElementId(fresh.freeformCanvas?.elements[0]?.id || null);
    onSelectTemplateForEditing(null);
  }, [onSelectTemplateForEditing, templates]);

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
    const width = parseFloat(customWidthValue);
    const height = parseFloat(customHeightValue);
    if (!width || !height || width <= 0 || height <= 0) {
      toast({ title: 'Invalid Dimensions', description: 'Please enter positive width and height values.', variant: 'destructive' });
      return;
    }
    const factor = mmConversion[customUnit] ?? 1;
    const widthMm = Math.round(width * factor * 100) / 100;
    const heightMm = Math.round(height * factor * 100) / 100;
    updateTemplate({
      aspectRatio: `${widthMm}:${heightMm}`,
      freeformCanvas: reconstructFreeformCanvas({ ...canvas, width: Math.round(widthMm * 10), height: Math.round(heightMm * 10) }),
    });
  }, [canvas, customHeightValue, customUnit, customWidthValue, toast, updateTemplate]);

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

  const handleAssetUpload = useCallback((event: ChangeEvent<HTMLInputElement>, kind: 'texture' | 'divider') => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUri = loadEvent.target?.result as string;
      const asset: CardAssetOption = {
        id: `custom-${kind}-${nanoid()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: dataUri,
        kind,
        tileMode: kind === 'texture' ? 'repeat' : 'stretch',
        seamless: kind === 'texture',
        allowedTargets: kind === 'texture' ? ['text', 'shape', 'template'] : ['divider'],
        defaultBlendMode: kind === 'texture' ? 'multiply' : 'normal',
        defaultOpacity: kind === 'texture' ? 45 : 100,
        defaultScale: kind === 'texture' ? 160 : 100,
      };
      if (kind === 'texture') {
        setCustomTextureAssets(previous => {
          const next = [...previous, asset];
          localStorage.setItem('cardforge-maker2-custom-textures', JSON.stringify(next));
          return next;
        });
      } else {
        setCustomDividerAssets(previous => {
          const next = [...previous, asset];
          localStorage.setItem('cardforge-maker2-custom-dividers', JSON.stringify(next));
          return next;
        });
      }
      toast({ title: 'Asset Added', description: `${file.name} added to ${kind} assets.` });
    };
    reader.onerror = () => toast({ title: 'Upload Error', description: 'Failed to read the selected asset.', variant: 'destructive' });
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [toast]);

  const renderEditableElement = (element: FreeformCardElement) => {
    const selected = selectedElementId === element.id;
    const borderWidth = borderWidthClassToPixels(element.borderWidth);
    const resolvedBg = element.backgroundImageUrl ? replacePlaceholdersLocal(element.backgroundImageUrl, livePreviewData, false) : '';
    const structuredAppearanceStyle = appearanceToStyle(normalizeAppearanceForElement(element));
    const elementIsDivider = isDividerElement(element);
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: `rotate(${element.rotation || 0}deg)${element.appearance?.assetFlipX ? ' scaleX(-1)' : ''}`,
      transformOrigin: 'center',
      opacity: element.opacity ?? 1,
      zIndex: element.zIndex,
      color: element.textColor || currentTemplate.baseTextColor || undefined,
      backgroundColor: element.backgroundColor || 'transparent',
      backgroundImage: resolvedBg && (resolvedBg.startsWith('linear-gradient') || resolvedBg.startsWith('radial-gradient'))
        ? resolvedBg
        : resolvedBg && (resolvedBg.startsWith('http') || resolvedBg.startsWith('data:'))
          ? `url(${resolvedBg})`
          : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      borderStyle: borderWidth > 0 ? 'solid' : undefined,
      borderWidth: borderWidth > 0 ? borderWidth : undefined,
      borderColor: element.borderColor || currentTemplate.defaultSectionBorderColor || undefined,
      borderRadius: radiusClassToPixels(element.borderRadius) || element.borderRadius || undefined,
      boxSizing: 'border-box',
      overflow: 'hidden',
      cursor: previewMode || element.locked ? 'default' : 'move',
      ...structuredAppearanceStyle,
    };

    let body;
    if (element.type === 'image') {
      const source = replacePlaceholdersLocal(element.imageSource || element.content, livePreviewData, false);
      const imageUrl = source && (source.startsWith('http') || source.startsWith('data:'))
        ? source
        : typeof livePreviewData[source as keyof typeof livePreviewData] === 'string'
          ? livePreviewData[source as keyof typeof livePreviewData]
          : `https://placehold.co/${Math.round(element.width)}x${Math.round(element.height)}.png?text=Artwork`;
      body = <img src={imageUrl} alt={element.name} className="block h-full w-full max-h-full max-w-full" style={{ minWidth: 0, minHeight: 0, objectFit: element.imageObjectFit || 'cover', objectPosition: 'center', borderRadius: 'inherit' }} draggable={false} />;
    } else if (element.type === 'icon') {
      const iconImageUrl = element.iconImageSource ? replacePlaceholdersLocal(element.iconImageSource, livePreviewData, false) : '';
      if (iconImageUrl && (iconImageUrl.startsWith('http') || iconImageUrl.startsWith('data:'))) {
        body = <img src={iconImageUrl} alt={element.name} className="block h-full w-full max-h-full max-w-full" style={{ minWidth: 0, minHeight: 0, objectFit: 'contain', objectPosition: 'center', borderRadius: 'inherit' }} draggable={false} />;
      } else {
        const IconComponent = (LucideIcons as unknown as Record<string, React.ElementType>)[element.iconName || 'Sparkles'] || Sparkles;
        body = <IconComponent size="78%" color={element.strokeColor || element.textColor || 'currentColor'} fill={element.fillColor || 'none'} strokeWidth={element.strokeWidth || 2} />;
      }
    } else if (element.type === 'shape') {
      body = null;
      baseStyle.backgroundColor = element.fillColor || element.backgroundColor || 'transparent';
      baseStyle.borderColor = element.strokeColor || element.borderColor || undefined;
      baseStyle.borderWidth = element.strokeWidth !== undefined ? element.strokeWidth : baseStyle.borderWidth;
      baseStyle.borderRadius = element.shapeKind === 'ellipse' ? '9999px' : baseStyle.borderRadius;
      baseStyle.clipPath = elementIsDivider ? undefined : shapeClipPath(element.shapeKind);
      if (elementIsDivider) {
        baseStyle.height = Math.max(element.height || 0, element.strokeWidth || 2, 2);
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 0;
      }
      Object.assign(baseStyle, structuredAppearanceStyle);
    } else {
      const resolved = replacePlaceholdersLocal(element.content, livePreviewData, true);
      body = <RichTextContent text={resolved} />;
    }

    return (
      <div
        key={element.id}
        className={cn(
          element.type === 'text' && [element.padding || 'p-1', element.fontFamily || 'font-sans', element.fontWeight || 'font-normal'],
          element.type === 'text' && 'whitespace-pre-wrap break-words',
          element.type === 'icon' && 'flex items-center justify-center',
          selected && !previewMode && 'outline outline-2 outline-offset-2 outline-[#d5ad54]',
          element.locked && 'cursor-not-allowed'
        )}
        style={{
          ...baseStyle,
          display: element.type === 'text' ? (element.writingMode && element.writingMode !== 'horizontal-tb' ? 'block' : 'flex') : baseStyle.display,
          alignItems: element.type === 'text' && !element.writingMode || element.writingMode === 'horizontal-tb' ? (element.textAlign === 'center' ? 'center' : undefined) : undefined,
          justifyContent: element.type === 'text' && (!element.writingMode || element.writingMode === 'horizontal-tb') ? (element.textAlign === 'right' ? 'flex-end' : element.textAlign === 'center' ? 'center' : 'flex-start') : undefined,
          textAlign: element.textAlign || 'left',
          fontSize: element.type === 'text' ? `${textFontSizePx(element)}px` : undefined,
          lineHeight: element.type === 'text' ? 1.4 : undefined,
          fontStyle: element.fontStyle || 'normal',
          writingMode: element.writingMode as React.CSSProperties['writingMode'] || undefined,
          textOrientation: (element.writingMode && element.writingMode !== 'horizontal-tb') ? 'upright' : undefined,
        }}
        onPointerDown={(event) => handleElementPointerDown(event, element)}
      >
        {body}
        {selected && !previewMode && !element.locked && (
          <button
            type="button"
            aria-label="Resize selected element"
            className="absolute -bottom-2 -right-2 h-4 w-4 rounded-[2px] border border-[#d5ad54] bg-[#090b0f] shadow-[0_0_12px_rgba(213,173,84,0.45)]"
            onPointerDown={(event) => handleResizePointerDown(event, element)}
          />
        )}
      </div>
    );
  };

  const canvasStyle: React.CSSProperties = {
    width: canvas.width,
    height: canvas.height,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
    backgroundColor: currentTemplate.baseBackgroundColor || '#ffffff',
    color: currentTemplate.baseTextColor || '#000000',
    borderColor: currentTemplate.cardBorderColor || 'hsl(var(--border))',
    borderWidth: currentTemplate.cardBorderWidth || '4px',
    borderStyle: currentTemplate.cardBorderStyle && currentTemplate.cardBorderStyle !== '_default_' ? currentTemplate.cardBorderStyle : 'solid',
    borderRadius: currentTemplate.cardBorderRadius || '0.5rem',
    backgroundImage: [
      showGrid ? `linear-gradient(to right, rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.08) 1px, transparent 1px)` : '',
      currentTemplate.cardBackgroundImageUrl ? `url(${replacePlaceholdersLocal(currentTemplate.cardBackgroundImageUrl, livePreviewData, false)})` : '',
    ].filter(Boolean).join(', '),
    backgroundSize: showGrid ? `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, cover` : 'cover',
    backgroundPosition: 'center',
  };

  return (
    <TooltipProvider>
      <div className={cn('min-h-[calc(100vh-145px)] overflow-hidden rounded-[10px] border', makerTheme.shell)}>
        <div className="flex flex-col border-b border-[#2b2415] bg-[#0b0d11] px-2 py-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#6d5323] bg-[#171207] shadow-[inset_0_0_18px_rgba(213,173,84,0.12)]">
              <PenTool className="h-4 w-4 text-[#d5ad54]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-[#f3ead7]">Card Template Maker 2.0</h2>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f95a3]">Freeform arcane layout studio</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1 lg:mt-0">
            {[
              { label: 'Undo (Ctrl+Z)', icon: Undo2, action: undo, disabled: history.length === 0 },
              { label: 'Redo (Ctrl+Y)', icon: Redo2, action: redo, disabled: future.length === 0 },
              { label: 'Zoom out (-)', icon: ZoomOut, action: () => { setAutoFitCanvas(false); setZoom(value => clamp(Math.round((value - 0.08) * 100) / 100, 0.28, 1.2)); } },
              { label: 'Zoom in (+)', icon: ZoomIn, action: () => { setAutoFitCanvas(false); setZoom(value => clamp(Math.round((value + 0.08) * 100) / 100, 0.28, 1.2)); } },
              { label: 'Fit to screen', icon: Maximize2, action: () => setAutoFitCanvas(true) },
            ].map(item => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" onClick={item.action} disabled={item.disabled} className="h-7 w-7 rounded-[4px] text-[#aeb4c0] hover:bg-[#171d29] hover:text-[#f3ead7]">
                    <item.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{item.label}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowGrid(value => !value)} className={cn(makerTheme.toolButton, showGrid && makerTheme.activeButton, 'gap-1 px-2 text-xs')}>
                  <Grid3X3 className="h-4 w-4" /> Grid
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle grid (G)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="sm" onClick={() => setSnapToGrid(value => !value)} className={cn(makerTheme.toolButton, snapToGrid && makerTheme.activeButton, 'gap-1 px-2 text-xs')}>
                  <BoxSelect className="h-4 w-4" /> Snap
                </Button>
              </TooltipTrigger>
              <TooltipContent>Snap movement to grid</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="sm" onClick={() => setPreviewMode(value => !value)} className={cn(makerTheme.toolButton, previewMode && makerTheme.activeButton, 'gap-1 px-2 text-xs')}>
                  {previewMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Preview
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle preview mode (P)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" onClick={handleSave} size="sm" className="h-8 rounded-[4px] border border-[#7f6225] bg-[#d5ad54] px-3 text-xs font-semibold text-[#11100c] hover:bg-[#f0ca71]">
                  <Save className="h-4 w-4" /> Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save template (Ctrl+S)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="grid min-h-[calc(100vh-205px)] min-w-0 grid-cols-1 lg:grid-cols-[240px_minmax(320px,1fr)_300px] xl:grid-cols-[280px_minmax(420px,1fr)_330px] 2xl:grid-cols-[300px_minmax(520px,1fr)_360px]">
          <aside className="min-w-0 border-b border-[#252b35] bg-[#0d1117] lg:border-b-0 lg:border-r">
            <ScrollArea className="h-[calc(100vh-205px)] min-h-[760px]">
              <div className="space-y-3 p-2">
                <Card className={cn(makerTheme.panel, 'rounded-[8px]')}>
                  <CardHeader className="p-2.5">
                    <CardTitle className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
                      <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-[#d5ad54]" /> Templates</span>
                      <Button type="button" variant="ghost" size="icon" onClick={handleNewTemplate} className="h-6 w-6 rounded-[3px] hover:bg-[#1b2230]">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-2.5 pt-0">
                    <Select value={currentTemplate.id || '__new__'} onValueChange={(value) => {
                      if (value === '__new__') handleNewTemplate();
                      else onSelectTemplateForEditing(value);
                    }}>
                      <SelectTrigger className={makerTheme.control}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">Unsaved 2.0 Template</SelectItem>
                        {freeformTemplates.map(template => (
                          <SelectItem key={template.id!} value={template.id!}>{template.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleNewTemplate} className={makerTheme.button}><Plus className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleClone} disabled={!currentTemplate.id} className={makerTheme.button}><Copy className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => currentTemplate.id && onDeleteTemplate(currentTemplate.id)} disabled={!currentTemplate.id} className={makerTheme.button}><Trash2 className="h-4 w-4 text-[#ff554a]" /></Button>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {templatePresets.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          className="group flex w-full items-center gap-2 rounded-[5px] border border-[#2b2f39] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/70 hover:bg-[#131720]"
                          onClick={() => applyTemplatePreset(preset)}
                        >
                          <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-[3px] border" style={{ borderColor: preset.accent, background: preset.bg }}>
                            <span className="absolute inset-x-1 top-1 h-6 rounded-[2px]" style={{ background: preset.art }} />
                            <span className="absolute inset-x-1 bottom-1 h-2 rounded-[1px] bg-[#f1dfb6]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[#f5d27b]">{preset.name}</span>
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{preset.caption}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn(makerTheme.panel, 'rounded-[8px]')}>
                  <CardHeader className="p-2.5">
                    <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]"><Shapes className="h-3.5 w-3.5 text-[#d5ad54]" /> Elements</CardTitle>
                    <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">Primitives only; styles live in inspector</p>
                  </CardHeader>
                  <CardContent className="space-y-2 p-2.5 pt-0">
                    {(Object.keys(groupedElementKits) as Array<keyof typeof groupedElementKits>).map(category => (
                      <div key={category} className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#757d8c]">{category}</div>
                        <div className="grid grid-cols-2 gap-1.5 2xl:grid-cols-3">
                          {groupedElementKits[category].map((item) => {
                            const index = CONSOLIDATED_ELEMENT_KITS.findIndex(kit => kit.label === item.label);
                            return (
                              <Tooltip key={item.label}>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    draggable
                                    onDragStart={(event) => {
                                      event.dataTransfer.setData('application/cardforge-element', item.type);
                                      event.dataTransfer.setData('application/cardforge-kit-index', String(index));
                                    }}
                                    onClick={() => addElement(item.type, undefined, item.preset)}
                                    className="h-[54px] flex-col gap-1 rounded-[5px] border-[#2d3340] bg-[#111720] px-1 text-[#d8d1c4] hover:border-[#d5ad54]/80 hover:bg-[#171b24]"
                                  >
                                    <item.icon className="h-4 w-4 text-[#d5ad54]" />
                                    <span className="max-w-full truncate text-[10px] leading-none">{item.label}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-56">
                                  <div className="space-y-1">
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className={cn(makerTheme.panel, 'rounded-[8px]')}>
                  <CardHeader className="p-2.5">
                    <CardTitle className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
                      <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-[#d5ad54]" /> Layers</span>
                      <span className="text-[10px] font-normal text-[#757d8c]">{canvas.elements.length}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 p-2.5 pt-0">
                    {sortedElements.map(element => {
                      const Icon = element.type === 'text' ? Type : element.type === 'image' ? ImageIcon : element.type === 'icon' ? Sparkles : element.shapeKind === 'ellipse' ? Circle : Square;
                      return (
                        <button
                          key={element.id}
                          type="button"
                          className={cn('grid w-full grid-cols-[18px_1fr_22px_22px] items-center gap-1 rounded-[4px] border px-1.5 py-1.5 text-left text-[11px] transition-colors', selectedElementId === element.id ? 'border-[#d5ad54] bg-[#211a0d] text-[#f5d27b]' : 'border-[#252b35] bg-[#0c1016] text-[#b7bdc9] hover:border-[#6d55b8] hover:bg-[#111720]')}
                          onClick={() => setSelectedElementId(element.id)}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{element.name}</span>
                          <span className="text-center text-[10px] text-[#757d8c]">{element.zIndex}</span>
                          {element.locked ? <Lock className="h-3.5 w-3.5 text-[#d5ad54]" /> : <Eye className="h-3.5 w-3.5 text-[#757d8c]" />}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </aside>

          <section className="min-w-0 overflow-hidden bg-[#05080c] lg:min-h-[760px]">
            <div className="flex items-center justify-between border-b border-[#252b35] bg-[#080c12] px-3 py-1.5 text-[11px] text-[#8f95a3]">
              <span className="flex items-center gap-2"><MousePointer2 className="h-3.5 w-3.5 text-[#d5ad54]" /> Drag, snap, resize, layer, and tune every card surface.</span>
              <span className="font-mono text-[#d5ad54]">{Math.round(zoom * 100)}% / {canvas.width} x {canvas.height}</span>
            </div>
            <div
              ref={stageRef}
              data-cardforge-stage="true"
              className="relative flex h-[calc(100vh-238px)] min-h-[720px] justify-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(122,82,204,0.12),transparent_42%),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:auto,24px_24px,24px_24px] p-8"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="relative pl-7 pt-7" style={{ width: canvas.width * zoom + 28, height: canvas.height * zoom + 28 }}>
                <div
                  aria-hidden="true"
                  className="absolute left-7 top-0 h-7 border-b border-[#3b3324] bg-[#090d13] shadow-[inset_0_-1px_0_rgba(213,173,84,0.18)]"
                  style={{
                    width: canvas.width * zoom,
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 19px, rgba(213,173,84,0.48) 19px 20px), repeating-linear-gradient(90deg, transparent 0 99px, rgba(213,173,84,0.9) 99px 100px)',
                    backgroundSize: `${gridSize * zoom}px 100%, ${gridSize * 5 * zoom}px 100%`,
                  }}
                />
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-7 w-7 border-r border-[#3b3324] bg-[#090d13] shadow-[inset_-1px_0_0_rgba(213,173,84,0.18)]"
                  style={{
                    height: canvas.height * zoom,
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 19px, rgba(213,173,84,0.48) 19px 20px), repeating-linear-gradient(0deg, transparent 0 99px, rgba(213,173,84,0.9) 99px 100px)',
                    backgroundSize: `100% ${gridSize * zoom}px, 100% ${gridSize * 5 * zoom}px`,
                  }}
                />
                <div
                  ref={canvasRef}
                  data-cardforge-canvas="true"
                  tabIndex={0}
                  className="relative shadow-[0_24px_70px_rgba(0,0,0,0.75),0_0_0_1px_rgba(213,173,84,0.2)] focus:outline-none focus:ring-2 focus:ring-[#d5ad54]"
                  style={canvasStyle}
                  onKeyDown={handleCanvasKeyDown}
                  onPointerDown={() => !previewMode && setSelectedElementId(null)}
                >
                  {[...canvas.elements].sort((a, b) => a.zIndex - b.zIndex).map(renderEditableElement)}
                </div>
              </div>
            </div>
          </section>

          <aside className="min-w-0 border-t border-[#252b35] bg-[#0d1117] lg:border-l lg:border-t-0">
            <ScrollArea className="h-[calc(100vh-205px)] min-h-[760px]">
              <div className="space-y-3 p-2">
                <Tabs defaultValue="element">
                  <TabsList className="grid h-9 w-full grid-cols-2 rounded-[5px] border border-[#2b2f39] bg-[#12161d] p-1">
                    <TabsTrigger value="template" className="h-7 rounded-[3px] text-xs data-[state=active]:bg-[#0b0f15] data-[state=active]:text-[#f5d27b]">Template</TabsTrigger>
                    <TabsTrigger value="element" className="h-7 rounded-[3px] text-xs data-[state=active]:bg-[#0b0f15] data-[state=active]:text-[#f5d27b]">Element</TabsTrigger>
                  </TabsList>

                  <TabsContent value="template" className="space-y-4 pt-3">
                    <Card className={cn(makerTheme.panel, 'rounded-[8px]')}>
                      <CardHeader className="p-2.5">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">Template Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 p-2.5 pt-0">
                        <div>
                          <Label htmlFor="maker2-name" className="text-xs text-[#b7bdc9]">Template Name</Label>
                          <Input id="maker2-name" className={makerTheme.control} value={currentTemplate.name || ''} onChange={event => updateTemplate({ name: event.target.value }, false)} />
                        </div>
                        <div>
                          <Label htmlFor="maker2-ratio" className="text-xs text-[#b7bdc9]">Aspect Ratio</Label>
                          <Input id="maker2-ratio" className={makerTheme.control} value={currentTemplate.aspectRatio || TCG_ASPECT_RATIO} onChange={event => updateTemplate({ aspectRatio: event.target.value }, false)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label htmlFor="maker2-width" className="text-xs text-[#b7bdc9]">Width</Label>
                            <Input id="maker2-width" className={makerTheme.control} type="number" value={customWidthValue} onChange={event => setCustomWidthValue(event.target.value)} />
                          </div>
                          <div>
                            <Label htmlFor="maker2-height" className="text-xs text-[#b7bdc9]">Height</Label>
                            <Input id="maker2-height" className={makerTheme.control} type="number" value={customHeightValue} onChange={event => setCustomHeightValue(event.target.value)} />
                          </div>
                          <div>
                            <Label htmlFor="maker2-unit" className="text-xs text-[#b7bdc9]">Unit</Label>
                            <Select value={customUnit} onValueChange={setCustomUnit}>
                              <SelectTrigger id="maker2-unit" className={makerTheme.control}><SelectValue /></SelectTrigger>
                              <SelectContent>{DIMENSION_UNITS.map(unit => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleApplyCustomDimensions} className={cn(makerTheme.button, 'w-full text-xs')}>Apply Dimensions</Button>
                        <div>
                          <Label htmlFor="maker2-frame" className="text-xs text-[#b7bdc9]">Frame Style</Label>
                          <Select value={currentTemplate.frameStyle || 'custom'} onValueChange={handleApplyFrameStyle}>
                            <SelectTrigger id="maker2-frame" className={makerTheme.control}><SelectValue /></SelectTrigger>
                            <SelectContent>{FRAME_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="maker2-bg" className="text-xs">Base Background</Label>
                            <ColorField id="maker2-bg" value={currentTemplate.baseBackgroundColor || '#ffffff'} onChange={value => updateTemplate({ baseBackgroundColor: value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker2-text" className="text-xs">Base Text</Label>
                            <ColorField id="maker2-text" value={currentTemplate.baseTextColor || '#000000'} onChange={value => updateTemplate({ baseTextColor: value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker2-border-color" className="text-xs">Border Color</Label>
                            <ColorField id="maker2-border-color" value={currentTemplate.cardBorderColor || '#c89f42'} onChange={value => updateTemplate({ cardBorderColor: value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker2-section-border" className="text-xs">Section Border</Label>
                            <ColorField id="maker2-section-border" value={currentTemplate.defaultSectionBorderColor || '#c89f42'} onChange={value => updateTemplate({ defaultSectionBorderColor: value }, false)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="maker2-border-width" className="text-xs">Border Width</Label>
                            <Input id="maker2-border-width" value={currentTemplate.cardBorderWidth || ''} onChange={event => updateTemplate({ cardBorderWidth: event.target.value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker2-border-radius" className="text-xs">Corner Radius</Label>
                            <Input id="maker2-border-radius" value={currentTemplate.cardBorderRadius || ''} onChange={event => updateTemplate({ cardBorderRadius: event.target.value }, false)} />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="maker2-border-style">Border Style</Label>
                          <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={value => updateTemplate({ cardBorderStyle: value === '_default_' ? undefined : value as TCGCardTemplate['cardBorderStyle'] })}>
                            <SelectTrigger id="maker2-border-style"><SelectValue /></SelectTrigger>
                            <SelectContent>{CARD_BORDER_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="maker2-bg-image">Card Background Image</Label>
                          <div className="flex gap-2">
                            <Input id="maker2-bg-image" value={currentTemplate.cardBackgroundImageUrl || ''} onChange={event => updateTemplate({ cardBackgroundImageUrl: event.target.value }, false)} />
                            <Button type="button" variant="outline" size="icon" onClick={() => bgImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                            <input ref={bgImageInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateTemplate({ cardBackgroundImageUrl: dataUri }))} />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="maker2-border-image">Border Image/Gradient</Label>
                          <div className="flex gap-2">
                            <Input id="maker2-border-image" value={currentTemplate.cardBorderImageSource || ''} onChange={event => updateTemplate({ cardBorderImageSource: event.target.value }, false)} />
                            <Button type="button" variant="outline" size="icon" onClick={() => borderImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                            <input ref={borderImageInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateTemplate({ cardBorderImageSource: dataUri }))} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="element" className="space-y-4 pt-3">
                    {!selectedElement ? (
                      <Card className={cn(makerTheme.panel, 'rounded-[8px]')}>
                        <CardContent className="p-6 text-center text-sm text-muted-foreground">Select an element on the canvas or in Layers.</CardContent>
                      </Card>
                    ) : (
                      <Card className={cn(makerTheme.panel, 'rounded-[8px]')}>
                        <CardHeader className="border-b border-[#252b35] p-2.5">
                          <CardTitle className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
                            Inspector
                            <span className="text-[10px] font-normal text-[#d5ad54]">{selectedElement.type}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 p-2.5 pt-3">
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={duplicateSelected} className={cn(makerTheme.button, 'flex-1 gap-1 text-xs')}><Copy className="h-4 w-4" /> Duplicate</Button>
                            <Button type="button" variant="outline" size="sm" onClick={deleteSelected} className={cn(makerTheme.button, 'flex-1 gap-1 text-xs')}><Trash2 className="h-4 w-4 text-[#ff554a]" /> Delete</Button>
                          </div>
                          <div>
                            <Label htmlFor="element-name" className="text-xs text-[#b7bdc9]">Layer Name</Label>
                            <Input id="element-name" className={makerTheme.control} value={selectedElement.name} onChange={event => updateElement(selectedElement.id, { name: event.target.value }, false)} />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {(['x', 'y', 'width', 'height'] as const).map(key => (
                              <div key={key}>
                                <Label htmlFor={`element-${key}`} className="text-[10px] uppercase tracking-wide text-[#8f95a3]">{key}</Label>
                                <Input id={`element-${key}`} className={makerTheme.control} type="number" value={Math.round(selectedElement[key])} onChange={event => updateElement(selectedElement.id, { [key]: Number(event.target.value) } as Partial<FreeformCardElement>, false)} />
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label htmlFor="element-rotation" className="text-xs text-[#b7bdc9]">Rotation</Label>
                              <Input id="element-rotation" className={makerTheme.control} type="number" value={selectedElement.rotation || 0} onChange={event => updateElement(selectedElement.id, { rotation: Number(event.target.value) }, false)} />
                            </div>
                            <div>
                              <Label htmlFor="element-z" className="text-xs text-[#b7bdc9]">Z</Label>
                              <Input id="element-z" className={makerTheme.control} type="number" value={selectedElement.zIndex} onChange={event => updateElement(selectedElement.id, { zIndex: Number(event.target.value) }, false)} />
                            </div>
                            <div className="flex items-end gap-2 pb-2">
                              <Switch checked={!!selectedElement.locked} onCheckedChange={checked => updateElement(selectedElement.id, { locked: checked })} aria-label="Lock element" />
                              {selectedElement.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <Label>Opacity</Label>
                              <span className="text-xs text-muted-foreground">{Math.round((selectedElement.opacity ?? 1) * 100)}%</span>
                            </div>
                            <Slider value={[Math.round((selectedElement.opacity ?? 1) * 100)]} min={0} max={100} step={1} onValueChange={value => updateElement(selectedElement.id, { opacity: value[0] / 100 }, false)} />
                          </div>

                          <div className="space-y-3 rounded-[6px] border border-[#3a2e17] bg-[#100d08] p-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Appearance Studio</Label>
                              <Button type="button" variant="outline" size="sm" className={cn(makerTheme.button, 'h-7 px-2 text-[10px]')} onClick={saveSelectedAppearanceStyle}>
                                <Save className="mr-1 h-3.5 w-3.5" /> Save Style
                              </Button>
                            </div>
                            {!canUseImageSource && (
                            <div>
                              <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Quick Styles</Label>
                              <div className="grid grid-cols-2 gap-1">
                                {ELEMENT_STYLE_PRESETS.map(preset => (
                                  <Button
                                    key={preset.label}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 justify-start gap-1.5 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                    onClick={() => updateElement(selectedElement.id, preset.updates)}
                                  >
                                    <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: preset.updates.backgroundColor || preset.updates.fillColor || '#222' }} />
                                    {preset.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            )}
                            <div className="grid grid-cols-2 gap-1.5">
                              {compatibleAppearanceStyles.map(style => (
                                <Tooltip key={style.id}>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 justify-start gap-2 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]/80"
                                      onClick={() => applyAppearancePreset(style)}
                                    >
                                      <span className="h-3.5 w-3.5 shrink-0 rounded-[2px] border border-[#2d3340]" style={appearanceToStyle(style.appearance)} />
                                      <span className="truncate">{style.name}</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Apply {style.name}</TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Material</Label>
                                <ColorField value={normalizeAppearanceForElement(selectedElement).material?.baseColor || '#111720'} onChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, material: { ...appearance.material, baseColor: value } }), false)} />
                              </div>
                              {!canUseDividerControls && selectedElement.type !== 'image' && (
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Text</Label>
                                <ColorField value={normalizeAppearanceForElement(selectedElement).material?.textColor || selectedElement.textColor || '#f5d27b'} onChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, material: { ...appearance.material, textColor: value, strokeColor: selectedElement.type === 'icon' ? value : appearance.material?.strokeColor } }), false)} />
                              </div>
                              )}
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">{canUseDividerControls ? 'Tint' : 'Border'}</Label>
                                <ColorField value={normalizeAppearanceForElement(selectedElement).border?.color || selectedElement.borderColor || '#d5ad54'} onChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, border: { ...appearance.border, kind: appearance.border?.kind || 'solid', color: value } }), false)} />
                              </div>
                            </div>
                            {!canUseDividerControls && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Gradient</Label>
                                <Select value={normalizeAppearanceForElement(selectedElement).material?.gradient?.type || 'none'} onValueChange={value => updateElementAppearance(selectedElement.id, appearance => ({
                                  ...appearance,
                                  material: {
                                    ...appearance.material,
                                    gradient: value === 'none'
                                      ? { type: 'none', stops: [] }
                                      : appearance.material?.gradient?.type && appearance.material.gradient.type !== 'none'
                                        ? { ...appearance.material.gradient, type: value as AppearanceGradientType }
                                        : { type: value as AppearanceGradientType, angle: 135, stops: [{ id: 'a', color: '#7a52cc', position: 0, opacity: 0.85 }, { id: 'b', color: '#d5ad54', position: 100, opacity: 0.35 }] },
                                  },
                                }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="linear">Linear</SelectItem>
                                    <SelectItem value="radial">Radial</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Angle</Label>
                                <Input className={makerTheme.control} type="number" value={normalizeAppearanceForElement(selectedElement).material?.gradient?.angle ?? 135} onChange={event => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, material: { ...appearance.material, gradient: { ...(appearance.material?.gradient || { type: 'linear', stops: [] }), angle: Number(event.target.value) } } }), false)} />
                              </div>
                            </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              {canUseBackgroundTexture && (
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Texture</Label>
                                <Select value={normalizeAppearanceForElement(selectedElement).material?.texture?.kind || 'none'} onValueChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, material: { ...appearance.material, texture: { ...(appearance.material?.texture || {}), kind: value as AppearanceTextureKind, intensity: appearance.material?.texture?.intensity ?? 40, scale: appearance.material?.texture?.scale ?? 12 } } }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="parchment">Parchment Grain</SelectItem>
                                    <SelectItem value="foil">Foil Hatch</SelectItem>
                                    <SelectItem value="etched">Etched Lines</SelectItem>
                                    <SelectItem value="grain">Noise / Grain</SelectItem>
                                    <SelectItem value="hatch">Hatch</SelectItem>
                                    <SelectItem value="uploaded">Uploaded</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              )}
                              {!canUseDividerControls && (
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Border Style</Label>
                                <Select value={normalizeAppearanceForElement(selectedElement).border?.kind || 'none'} onValueChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, border: { ...appearance.border, kind: value as AppearanceBorderKind, width: appearance.border?.width ?? 1, radius: appearance.border?.radius ?? 6 } }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="solid">Solid</SelectItem>
                                    <SelectItem value="double">Double</SelectItem>
                                    <SelectItem value="etched">Etched</SelectItem>
                                    <SelectItem value="relic">Relic</SelectItem>
                                    <SelectItem value="foil">Foil</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              )}
                            </div>
                            {canUseBackgroundTexture && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Texture Assets</Label>
                                <Button type="button" variant="outline" size="sm" className={cn(makerTheme.button, 'h-7 px-2 text-[10px]')} onClick={() => textureAssetUploadInputRef.current?.click()}>
                                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                                </Button>
                                <input ref={textureAssetUploadInputRef} type="file" accept="image/*" hidden onChange={event => handleAssetUpload(event, 'texture')} />
                              </div>
                              <Input className={makerTheme.control} placeholder="Search textures..." value={assetSearch} onChange={event => setAssetSearch(event.target.value)} />
                              <div className="grid grid-cols-4 gap-1.5">
                                {compatibleTextureAssets.map(asset => (
                                  <Tooltip key={asset.id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="h-16 overflow-hidden rounded-[4px] border border-[#2d3340] bg-[#111720] hover:border-[#d5ad54]"
                                        style={{ backgroundImage: `url(${asset.url})`, backgroundSize: '52px 52px', backgroundRepeat: 'repeat' }}
                                        aria-label={asset.name}
                                        onClick={() => updateElementAppearance(selectedElement.id, appearance => ({
                                          ...appearance,
                                          assetSource: undefined,
                                          assetKind: 'texture',
                                          textureScale: asset.defaultScale,
                                          textureOpacity: asset.defaultOpacity,
                                          blendMode: asset.defaultBlendMode,
                                          tileMode: 'repeat',
                                          material: {
                                            ...appearance.material,
                                            texture: {
                                              ...(appearance.material?.texture || {}),
                                              kind: 'uploaded',
                                              imageSource: asset.url,
                                              assetSource: asset.url,
                                              assetKind: 'texture',
                                              textureScale: asset.defaultScale,
                                              textureOpacity: asset.defaultOpacity,
                                              blendMode: asset.defaultBlendMode,
                                              tileMode: 'repeat',
                                            },
                                          },
                                        }))}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>{asset.name}</TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                            )}
                            {canUseDividerControls && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Divider Assets</Label>
                                  <Button type="button" variant="outline" size="sm" className={cn(makerTheme.button, 'h-7 px-2 text-[10px]')} onClick={() => dividerAssetUploadInputRef.current?.click()}>
                                    <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                                  </Button>
                                  <input ref={dividerAssetUploadInputRef} type="file" accept="image/*" hidden onChange={event => handleAssetUpload(event, 'divider')} />
                                </div>
                                <Input className={makerTheme.control} placeholder="Search dividers..." value={assetSearch} onChange={event => setAssetSearch(event.target.value)} />
                                <div className="grid grid-cols-4 gap-1.5" data-testid="divider-asset-grid">
                                  {compatibleDividerAssets.map(asset => (
                                    <Tooltip key={asset.id}>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="h-14 rounded-[4px] border border-[#2d3340] bg-[#080b10] bg-contain bg-center bg-no-repeat hover:border-[#d5ad54]"
                                          style={{ backgroundImage: `url(${asset.url})` }}
                                          aria-label={asset.name}
                                          onClick={() => updateElementAppearance(selectedElement.id, appearance => ({
                                            ...appearance,
                                            dividerAsset: asset.url,
                                            assetKind: 'divider',
                                            textureOpacity: asset.defaultOpacity,
                                            blendMode: asset.defaultBlendMode,
                                            tileMode: asset.tileMode,
                                            shapeRole: 'divider',
                                            material: { ...appearance.material, baseColor: 'transparent', texture: { kind: 'none' } },
                                            border: { ...appearance.border, kind: 'none', width: 0 },
                                          }))}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>{asset.name}</TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              {canUseBackgroundTexture && (
                              <div>
                                <div className="mb-1 flex items-center justify-between text-[10px] text-[#8f95a3]"><span>Texture</span><span>{normalizeAppearanceForElement(selectedElement).material?.texture?.intensity ?? 0}%</span></div>
                                <Slider value={[normalizeAppearanceForElement(selectedElement).material?.texture?.intensity ?? 0]} min={0} max={100} step={1} onValueChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, material: { ...appearance.material, texture: { ...(appearance.material?.texture || { kind: 'grain' }), intensity: value[0] } } }), false)} />
                              </div>
                              )}
                              <div>
                                <div className="mb-1 flex items-center justify-between text-[10px] text-[#8f95a3]"><span>Glow</span><span>{normalizeAppearanceForElement(selectedElement).effects?.glow ?? 0}</span></div>
                                <Slider value={[normalizeAppearanceForElement(selectedElement).effects?.glow ?? 0]} min={0} max={60} step={1} onValueChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, effects: { ...appearance.effects, glow: value[0] } }), false)} />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Button type="button" variant="outline" size="icon" onClick={() => alignSelected('left')} className={makerTheme.button}><AlignLeft className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="icon" onClick={() => alignSelected('center')} className={makerTheme.button}><AlignCenter className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="icon" onClick={() => alignSelected('right')} className={makerTheme.button}><AlignRight className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="icon" onClick={() => arrangeSelected('front')} className={makerTheme.button}><ArrowUpToLine className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="icon" onClick={() => arrangeSelected('up')} className={makerTheme.button}><AlignHorizontalSpaceAround className="h-4 w-4" /></Button>
                            <Button type="button" variant="outline" size="icon" onClick={() => arrangeSelected('back')} className={makerTheme.button}><ArrowDownToLine className="h-4 w-4" /></Button>
                          </div>

                          {(canUseTypography || canUseImageSource) && (
                            <div>
                              {selectedElement.type === 'text' ? (
                                <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
                                  <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Text Data Binding</Label>
                                  <div>
                                    <Label htmlFor="element-field-key" className="text-xs">Generator Field</Label>
                                    <Input
                                      id="element-field-key"
                                      className={makerTheme.control}
                                      placeholder="cardName"
                                      value={parseTextBinding(selectedElement.content).field}
                                      onChange={event => {
                                        const parsed = parseTextBinding(selectedElement.content);
                                        updateElement(selectedElement.id, { content: buildTextBinding(event.target.value, parsed.fallback) }, false);
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="element-default-text" className="text-xs">Default Text</Label>
                                    <RichTextToolbar
                                      textareaRef={defaultTextareaRef}
                                      value={parseTextBinding(selectedElement.content).fallback}
                                      onChange={value => {
                                        const parsed = parseTextBinding(selectedElement.content);
                                        updateElement(selectedElement.id, { content: buildTextBinding(parsed.field || 'text', value) }, false);
                                      }}
                                    />
                                    <Textarea
                                      id="element-default-text"
                                      ref={defaultTextareaRef}
                                      value={parseTextBinding(selectedElement.content).fallback}
                                      onChange={event => {
                                        const parsed = parseTextBinding(selectedElement.content);
                                        updateElement(selectedElement.id, { content: buildTextBinding(parsed.field || 'text', event.target.value) }, false);
                                      }}
                                      rows={4}
                                      className="mt-1 font-mono text-xs"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <>
                                <Label htmlFor="element-content">Image URL or Data Key</Label>
                                <div className="flex gap-2">
                                  <Input id="element-content" value={selectedElement.imageSource || selectedElement.content || ''} onChange={event => updateElement(selectedElement.id, { imageSource: event.target.value, content: event.target.value }, false)} />
                                  <Button type="button" variant="outline" size="icon" onClick={() => elementImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                                  <input ref={elementImageInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateElement(selectedElement.id, { imageSource: dataUri, content: dataUri }))} />
                                </div>
                                </>
                              )}
                            </div>
                          )}

                          {canUseIconLibrary && (
                            <div className="space-y-2">
                              <Label htmlFor="icon-name">Icon Source</Label>
                              <Select value={selectedElement.iconName || 'Sparkles'} onValueChange={value => updateElement(selectedElement.id, { iconName: value, iconImageSource: undefined })}>
                                <SelectTrigger id="icon-name"><SelectValue /></SelectTrigger>
                                <SelectContent>{ICON_OPTIONS.map(icon => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
                              </Select>
                              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                                <Input
                                  className={makerTheme.control}
                                  placeholder="Custom icon URL or {{symbolUrl}}"
                                  value={selectedElement.iconImageSource || ''}
                                  onChange={event => updateElement(selectedElement.id, { iconImageSource: event.target.value }, false)}
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button type="button" variant="outline" size="icon" className={makerTheme.button} onClick={() => iconUploadInputRef.current?.click()}>
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Upload custom icon</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button type="button" variant="outline" size="icon" className={makerTheme.button} onClick={() => updateElement(selectedElement.id, { iconImageSource: undefined })}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Clear custom icon</TooltipContent>
                                </Tooltip>
                                <input ref={iconUploadInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateElement(selectedElement.id, { iconImageSource: dataUri }))} />
                              </div>
                            </div>
                          )}

                          {canUseShapeControls && (
                            <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
                              <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Shape Studio</Label>
                              <Label htmlFor="shape-kind">Primitive</Label>
                              <Select value={selectedElement.shapeKind || 'rectangle'} onValueChange={value => updateElement(selectedElement.id, { shapeKind: value as FreeformCardElement['shapeKind'] })}>
                                <SelectTrigger id="shape-kind"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {SHAPE_PRIMITIVE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Role Presets</Label>
                              <div className="grid grid-cols-2 gap-1.5">
                                {SHAPE_ROLE_PRESETS.map(preset => (
                                  <Button
                                    key={preset.label}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                    onClick={() => {
                                      const next = { ...selectedElement, ...preset.updates } as FreeformCardElement;
                                      updateElement(selectedElement.id, { ...preset.updates, appearance: normalizeAppearanceForElement(next) });
                                    }}
                                  >
                                    {preset.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}

                          {canUseDividerControls && (
                            <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
                              <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Divider Studio</Label>
                              <div>
                                <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Quick Presets</Label>
                                <div className="grid grid-cols-2 gap-1">
                                  {DIVIDER_PRESETS.map(preset => (
                                    <Button
                                      key={preset.label}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                      onClick={() => updateElement(selectedElement.id, { ...preset.updates, appearance: normalizeAppearanceForElement({ ...selectedElement, ...preset.updates } as FreeformCardElement) })}
                                    >
                                      {preset.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="divider-height" className="text-xs">Height</Label>
                                  <Input id="divider-height" type="number" min="4" value={selectedElement.height || 36} onChange={event => updateElement(selectedElement.id, { height: Number(event.target.value) || 36 }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="divider-opacity" className="text-xs">Opacity</Label>
                                  <Input id="divider-opacity" type="number" min="0" max="100" value={Math.round((selectedElement.opacity ?? 1) * 100)} onChange={event => updateElement(selectedElement.id, { opacity: Math.max(0, Math.min(1, Number(event.target.value) / 100)) }, false)} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="divider-mode" className="text-xs">Stretch Mode</Label>
                                  <Select value={normalizeAppearanceForElement(selectedElement).tileMode || 'stretch'} onValueChange={value => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, tileMode: value as FreeformAppearance['tileMode'] }))}>
                                    <SelectTrigger id="divider-mode"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="stretch">Stretch</SelectItem>
                                      <SelectItem value="contain">Contain</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end justify-between gap-2 rounded-[5px] border border-[#252b35] bg-[#111720] px-2 py-2">
                                  <Label htmlFor="divider-flip" className="text-xs">Flip</Label>
                                  <Switch id="divider-flip" checked={Boolean(normalizeAppearanceForElement(selectedElement).assetFlipX)} onCheckedChange={checked => updateElementAppearance(selectedElement.id, appearance => ({ ...appearance, assetFlipX: checked }))} />
                                </div>
                              </div>
                            </div>
                          )}

                          {canUseTypography && (
                            <div className="space-y-2">
                              <div>
                                <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Frame Presets</Label>
                                <div className="grid grid-cols-2 gap-1">
                                  {TEXT_FRAME_PRESETS.map(preset => (
                                    <Button
                                      key={preset.label}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 justify-start gap-1.5 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                      onClick={() => updateElement(selectedElement.id, preset.updates)}
                                    >
                                      <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: preset.updates.backgroundColor || '#222' }} />
                                      {preset.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="element-text-color" className="text-xs">Text Color</Label>
                                  <ColorField id="element-text-color" value={selectedElement.textColor || '#fbbf24'} onChange={value => updateElement(selectedElement.id, { textColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-bg-color" className="text-xs">Panel Fill</Label>
                                  <ColorField id="element-bg-color" value={selectedElement.backgroundColor || '#ffffff'} onChange={value => updateElement(selectedElement.id, { backgroundColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-border-color" className="text-xs">Border</Label>
                                  <ColorField id="element-border-color" value={selectedElement.borderColor || '#c89f42'} onChange={value => updateElement(selectedElement.id, { borderColor: value }, false)} />
                                </div>
                              </div>
                            </div>
                          )}

                          {canUseIconLibrary && (
                            <div className="space-y-2">
                              <div>
                                <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Symbol Presets</Label>
                                <div className="grid grid-cols-3 gap-1">
                                  {SYMBOL_STYLE_PRESETS.map(preset => (
                                    <Button
                                      key={preset.label}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-1.5 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                      onClick={() => updateElement(selectedElement.id, preset.updates)}
                                    >
                                      {preset.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="element-icon-stroke" className="text-xs">Stroke</Label>
                                  <ColorField id="element-icon-stroke" value={selectedElement.strokeColor || selectedElement.textColor || '#fbbf24'} onChange={value => updateElement(selectedElement.id, { strokeColor: value, textColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-icon-fill" className="text-xs">Fill</Label>
                                  <ColorField id="element-icon-fill" value={selectedElement.fillColor || '#ffffff'} onChange={value => updateElement(selectedElement.id, { fillColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-icon-bg" className="text-xs">Backplate</Label>
                                  <ColorField id="element-icon-bg" value={selectedElement.backgroundColor || '#000000'} onChange={value => updateElement(selectedElement.id, { backgroundColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-icon-stroke-width" className="text-xs">Line Weight</Label>
                                  <Input id="element-icon-stroke-width" type="number" min="0" value={selectedElement.strokeWidth || 0} onChange={event => updateElement(selectedElement.id, { strokeWidth: Number(event.target.value) }, false)} />
                                </div>
                              </div>
                            </div>
                          )}

                          {canUseShapeControls && (
                            <div className="space-y-2">
                              <div>
                                <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Shape Presets</Label>
                                <div className="grid grid-cols-2 gap-1">
                                  {SHAPE_PRESETS.map(preset => (
                                    <Button
                                      key={preset.label}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                      onClick={() => updateElement(selectedElement.id, preset.updates)}
                                    >
                                      {preset.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="element-shape-stroke" className="text-xs">Stroke</Label>
                                  <ColorField id="element-shape-stroke" value={selectedElement.strokeColor || selectedElement.borderColor || '#fbbf24'} onChange={value => updateElement(selectedElement.id, { strokeColor: value, borderColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-shape-fill" className="text-xs">Fill</Label>
                                  <ColorField id="element-shape-fill" value={selectedElement.fillColor || selectedElement.backgroundColor || '#ffffff'} onChange={value => updateElement(selectedElement.id, { fillColor: value, backgroundColor: value }, false)} />
                                </div>
                                <div>
                                  <Label htmlFor="element-shape-stroke-width" className="text-xs">Stroke Width</Label>
                                  <Input id="element-shape-stroke-width" type="number" min="0" value={selectedElement.strokeWidth || 0} onChange={event => updateElement(selectedElement.id, { strokeWidth: Number(event.target.value) }, false)} />
                                </div>
                              </div>
                            </div>
                          )}

                          {canUseImageSource && (
                            <div>
                              <Label htmlFor="element-image-border-color" className="text-xs">Frame Color</Label>
                              <ColorField id="element-image-border-color" value={selectedElement.borderColor || '#c89f42'} onChange={value => updateElement(selectedElement.id, { borderColor: value }, false)} />
                            </div>
                          )}

                          {canUseBackgroundTexture && (
                            <details className="rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
                              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f95a3]">Advanced Raw CSS</summary>
                              <div className="mt-2">
                                <Label htmlFor="element-bg-image">{selectedElement.type === 'text' ? 'Panel Texture / Gradient' : 'Shape Texture / Gradient'}</Label>
                                <div className="flex gap-2">
                                  <Input id="element-bg-image" value={selectedElement.backgroundImageUrl || ''} onChange={event => updateElement(selectedElement.id, { backgroundImageUrl: event.target.value }, false)} />
                                  <Button type="button" variant="outline" size="icon" onClick={() => elementBgInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                                  <input ref={elementBgInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateElement(selectedElement.id, { backgroundImageUrl: dataUri }))} />
                                </div>
                              </div>
                            </details>
                          )}

                          {canUseImageSource && (
                            <div>
                              <Label htmlFor="element-fit">Image Fit</Label>
                              <Select value={selectedElement.imageObjectFit || 'cover'} onValueChange={value => updateElement(selectedElement.id, { imageObjectFit: value as FreeformCardElement['imageObjectFit'] })}>
                                <SelectTrigger id="element-fit"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cover">Cover</SelectItem>
                                  <SelectItem value="contain">Contain</SelectItem>
                                  <SelectItem value="fill">Fill</SelectItem>
                                  <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {canUseTypography && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="element-font">Font</Label>
                                  <Select value={selectedElement.fontFamily || 'font-sans'} onValueChange={value => updateElement(selectedElement.id, { fontFamily: value })}>
                                    <SelectTrigger id="element-font"><SelectValue /></SelectTrigger>
                                    <SelectContent>{AVAILABLE_FONTS.map(font => <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="element-font-size-px">Size (px)</Label>
                                  <Input
                                    id="element-font-size-px"
                                    type="number"
                                    min="6"
                                    max="96"
                                    value={textFontSizePx(selectedElement)}
                                    onChange={event => updateElement(selectedElement.id, { fontSizePx: clamp(Number(event.target.value) || 14, 6, 96) }, false)}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="element-font-weight">Weight</Label>
                                  <Select value={selectedElement.fontWeight || 'font-normal'} onValueChange={value => updateElement(selectedElement.id, { fontWeight: value as FreeformCardElement['fontWeight'] })}>
                                    <SelectTrigger id="element-font-weight"><SelectValue /></SelectTrigger>
                                    <SelectContent>{FONT_WEIGHTS.map(weight => <SelectItem key={weight} value={weight}>{weight}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="element-font-style">Style</Label>
                                  <Select value={selectedElement.fontStyle || 'normal'} onValueChange={value => updateElement(selectedElement.id, { fontStyle: value as FreeformCardElement['fontStyle'] })}>
                                    <SelectTrigger id="element-font-style"><SelectValue /></SelectTrigger>
                                    <SelectContent>{FONT_STYLES.map(style => <SelectItem key={style} value={style}>{style}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="element-align">Align</Label>
                                  <Select value={selectedElement.textAlign || 'left'} onValueChange={value => updateElement(selectedElement.id, { textAlign: value as FreeformCardElement['textAlign'] })}>
                                    <SelectTrigger id="element-align"><SelectValue /></SelectTrigger>
                                    <SelectContent>{TEXT_ALIGNS.map(align => <SelectItem key={align} value={align}>{align}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="element-padding">Padding</Label>
                                  <Select value={selectedElement.padding || 'p-1'} onValueChange={value => updateElement(selectedElement.id, { padding: value })}>
                                    <SelectTrigger id="element-padding"><SelectValue /></SelectTrigger>
                                    <SelectContent>{PADDING_OPTIONS.map(padding => <SelectItem key={padding.value} value={padding.value}>{padding.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="element-writing-mode">Direction</Label>
                                  <Select value={selectedElement.writingMode || 'horizontal-tb'} onValueChange={value => updateElement(selectedElement.id, { writingMode: value as FreeformCardElement['writingMode'] })}>
                                    <SelectTrigger id="element-writing-mode"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="horizontal-tb">Horizontal</SelectItem>
                                      <SelectItem value="vertical-rl">Vertical ↕ (R→L)</SelectItem>
                                      <SelectItem value="vertical-lr">Vertical ↕ (L→R)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </>
                          )}

                          <div>
                            <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Border Presets</Label>
                            <div className="grid grid-cols-2 gap-1">
                              {BORDER_PRESETS.map(preset => (
                                <Button
                                  key={preset.label}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                                  onClick={() => updateElement(selectedElement.id, preset.updates)}
                                >
                                  {preset.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="element-border-width">Border Width</Label>
                              <Select value={selectedElement.borderWidth || '_none_'} onValueChange={value => updateElement(selectedElement.id, { borderWidth: value })}>
                                <SelectTrigger id="element-border-width"><SelectValue /></SelectTrigger>
                                <SelectContent>{BORDER_WIDTH_OPTIONS.map(width => <SelectItem key={width.value} value={width.value}>{width.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="element-radius">Radius</Label>
                              <Select value={selectedElement.borderRadius || 'rounded-none'} onValueChange={value => updateElement(selectedElement.id, { borderRadius: value })}>
                                <SelectTrigger id="element-radius"><SelectValue /></SelectTrigger>
                                <SelectContent>{BORDER_RADIUS_OPTIONS.map(radius => <SelectItem key={radius.value} value={radius.value}>{radius.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </aside>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#252b35] bg-[#080b10] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#757d8c]">
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
