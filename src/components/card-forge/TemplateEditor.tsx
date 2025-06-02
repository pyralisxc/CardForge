
"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { TCGCardTemplate, CardSection, CardRow } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  LayoutDashboard, Trash2, PlusCircle, Rows, Eye, Save, Edit2, GripVertical, ArrowUp, ArrowDown, Settings, Frame, FileImage
} from 'lucide-react';
import {
  TCG_ASPECT_RATIO,
  FRAME_STYLES,
  ROW_ALIGN_ITEMS,
  CARD_BORDER_STYLES,
  DIMENSION_UNITS,
} from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from './CardPreview';
import { ColumnEditor } from './ColumnEditor';
import { nanoid } from 'nanoid';
import { cn, extractUniquePlaceholderKeys, simplifyRatio } from "@/lib/utils";
import type { getFreshDefaultTemplate as GetFreshDefaultTemplateFn, reconstructMinimalTemplate as ReconstructMinimalTemplateFn } from '@/store/appStore';

export type { ReconstructMinimalTemplateFn as ReconstructTemplatePropFn };

const PREDEFINED_FRAME_VISUAL_PROPERTIES: Record<string, Partial<TCGCardTemplate>> = {
  'classic-gold': {
    baseBackgroundColor: '#fDF4D8', baseTextColor: '#4A3B2A', cardBorderRadius: '0.75rem',
    cardBorderColor: 'transparent', // This will be handled by CSS border-image for classic-gold
    cardBorderWidth: '6px', cardBorderStyle: 'solid', cardBackgroundImageUrl: undefined,
  },
  'minimal-dark': {
    baseBackgroundColor: '#282828', baseTextColor: '#c0c0c0', cardBorderColor: '#4a4a4a',
    cardBorderWidth: '2px', cardBorderStyle: 'solid', cardBorderRadius: '0.25rem', cardBackgroundImageUrl: undefined,
  },
  'arcane-purple': {
    baseBackgroundColor: '#7A52CC', // Was hsl(260, 60%, 55%)
    baseTextColor: '#F1F2F3',       // Was hsl(220, 10%, 95%)
    cardBorderColor: '#F1F2F3',     // Was hsl(220, 10%, 95%)
    cardBorderWidth: '5px', cardBorderStyle: 'solid', cardBorderRadius: '0.6rem', cardBackgroundImageUrl: undefined,
  },
  'standard': { // For 'Standard' (user-editable colors from theme defaults)
    baseBackgroundColor: '#FFFFFF', // Default white, user can change
    baseTextColor: '#000000',     // Default black, user can change
    cardBorderColor: undefined,      // Fallback to theme/globals.css, user can change. reconstruction will remove if undefined.
    cardBorderWidth: '4px',       // Default, user can change
    cardBorderStyle: 'solid',     // Default, user can change
    cardBorderRadius: '0.5rem',   // Default, user can change
    cardBackgroundImageUrl: undefined, // User can set
  },
  'custom': { // For 'Custom Colors' mode (user-editable from blank slate or last values)
    baseBackgroundColor: '', baseTextColor: '', cardBorderColor: '', 
    cardBorderWidth: '4px', cardBorderStyle: 'solid', cardBorderRadius: '0.5rem', cardBackgroundImageUrl: undefined,
  }
};


export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  reconstructMinimalTemplate,
  memoizedGetFreshDefaultTemplate,
  selectedTemplateIdForEditing,
  onSelectTemplateForEditing,
}: TemplateEditorProps) {
  const { toast } = useToast();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    if (!hasMounted) { // Ensure this effect runs only once on mount
      setHasMounted(true);
    }
  }, [hasMounted]);


  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(() =>
    reconstructMinimalTemplate(memoizedGetFreshDefaultTemplate(selectedTemplateIdForEditing))
  );
  const currentTemplateInternalRef = useRef<TCGCardTemplate>(currentTemplate);

  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || TCG_ASPECT_RATIO);
  const [customWidthValue, setCustomWidthValue] = useState<string>('');
  const [customHeightValue, setCustomHeightValue] = useState<string>('');
  const [customUnit, setCustomUnit] = useState<string>('mm');
  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>([]);
  const [activeColumnAccordionItems, setActiveColumnAccordionItems] = useState<string[]>([]);
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const cardBgImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isSettingsCardOpen, setIsSettingsCardOpen] = useState(true);
  const [isRowsAndSectionsCardOpen, setIsRowsAndSectionsCardOpen] = useState(true);

  const updateCurrentTemplateState = useCallback((newTemplateData: Partial<TCGCardTemplate> | TCGCardTemplate) => {
    const isAlreadyReconstructed = 'rows' in newTemplateData && Array.isArray(newTemplateData.rows);
    const reconstructedNewTemplate = isAlreadyReconstructed
      ? newTemplateData as TCGCardTemplate
      : reconstructMinimalTemplate(newTemplateData);

    if (JSON.stringify(reconstructedNewTemplate) === JSON.stringify(currentTemplateInternalRef.current)) {
      return;
    }
    setCurrentTemplate(reconstructedNewTemplate);
    currentTemplateInternalRef.current = reconstructedNewTemplate;
  }, [reconstructMinimalTemplate]);

  const updateCurrentTemplate = useCallback((updates: Partial<TCGCardTemplate>) => {
    const updatedRaw = { ...currentTemplateInternalRef.current, ...updates };
    updateCurrentTemplateState(reconstructMinimalTemplate(updatedRaw));
  }, [reconstructMinimalTemplate, updateCurrentTemplateState]);

  const resetFormToNew = useCallback(() => {
    const newFreshTemplate = memoizedGetFreshDefaultTemplate(null, "New Unsaved Template");
    updateCurrentTemplateState(newFreshTemplate);
  }, [memoizedGetFreshDefaultTemplate, updateCurrentTemplateState]);


  // Main Data Loading Effect: Responsible for loading the selected template or resetting.
  useEffect(() => {
    if (!hasMounted) return;

    let templateToLoad: Partial<TCGCardTemplate>;
    let performingReset = false;

    if (selectedTemplateIdForEditing) {
      const foundTemplate = templates.find(t => t.id === selectedTemplateIdForEditing);
      if (foundTemplate) {
        templateToLoad = foundTemplate;
      } else {
        if (currentTemplateInternalRef.current?.id !== null) {
          performingReset = true;
        }
        templateToLoad = memoizedGetFreshDefaultTemplate(null);
      }
    } else {
      if (currentTemplateInternalRef.current?.id !== null) {
        performingReset = true;
      }
      templateToLoad = memoizedGetFreshDefaultTemplate(null);
    }

    if (performingReset) {
      resetFormToNew();
    } else {
      const reconstructedLoadedTemplate = reconstructMinimalTemplate(templateToLoad);
      if (JSON.stringify(reconstructedLoadedTemplate) !== JSON.stringify(currentTemplateInternalRef.current)) {
        updateCurrentTemplateState(reconstructedLoadedTemplate);
      }
    }
  }, [hasMounted, selectedTemplateIdForEditing, templates, reconstructMinimalTemplate, resetFormToNew, updateCurrentTemplateState, memoizedGetFreshDefaultTemplate]);


  // Effect to synchronize aspectRatioInput with currentTemplate.aspectRatio
  useEffect(() => {
    if (!hasMounted) return;
    const targetAspectRatio = currentTemplateInternalRef.current.aspectRatio || TCG_ASPECT_RATIO;
    if (targetAspectRatio !== aspectRatioInput) {
      setAspectRatioInput(targetAspectRatio);
    }
  }, [hasMounted, currentTemplateInternalRef.current.id, currentTemplateInternalRef.current.aspectRatio, aspectRatioInput]);


  // Effect to synchronize activeRowAccordionItems with currentTemplate.rows
  useEffect(() => {
    if (!hasMounted) return;
    let newRowIds: string[];
    const currentRows = currentTemplateInternalRef.current.rows;

    if (currentRows && currentRows.length > 0) {
      newRowIds = currentRows.map(r => r.id).filter(Boolean) as string[];
    } else if (currentTemplateInternalRef.current.id === null) { 
      const defaultNewTemplate = memoizedGetFreshDefaultTemplate(null);
      newRowIds = (defaultNewTemplate.rows || []).map(r => r.id).filter(Boolean) as string[];
    } else { 
      newRowIds = [];
    }

    if (JSON.stringify(newRowIds) !== JSON.stringify(activeRowAccordionItems)) {
      setActiveRowAccordionItems(newRowIds);
    }
  }, [hasMounted, currentTemplateInternalRef.current.id, currentTemplateInternalRef.current.rows, activeRowAccordionItems, memoizedGetFreshDefaultTemplate]);

  // Effect to update currentTemplate with visual properties from pre-defined frame styles
  useEffect(() => {
    if (!hasMounted) return;

    const newSelectedFrameStyle = currentTemplateInternalRef.current.frameStyle || 'standard';
    const predefinedVisualProps = PREDEFINED_FRAME_VISUAL_PROPERTIES[newSelectedFrameStyle];

    if (predefinedVisualProps) {
      const candidateTemplateState: Partial<TCGCardTemplate> = {
        id: currentTemplateInternalRef.current.id,
        name: currentTemplateInternalRef.current.name,
        aspectRatio: currentTemplateInternalRef.current.aspectRatio,
        rows: currentTemplateInternalRef.current.rows,
        defaultSectionBorderColor: currentTemplateInternalRef.current.defaultSectionBorderColor,
        ...predefinedVisualProps,
        frameStyle: newSelectedFrameStyle, 
      };
      updateCurrentTemplateState(candidateTemplateState);
    }
  }, [hasMounted, currentTemplateInternalRef.current.frameStyle, updateCurrentTemplateState, reconstructMinimalTemplate]);


  const updateLocalRow = useCallback((rowId: string, updates: Partial<CardRow>) => {
    const newRows = (currentTemplateInternalRef.current.rows || []).map(r => r.id === rowId ? { ...r, ...updates } : r);
    updateCurrentTemplate({ rows: newRows });
  }, [updateCurrentTemplate]);

  const addLocalRow = useCallback(() => {
    const newRowId = nanoid();
    const defaultRowStructureFromStore = memoizedGetFreshDefaultTemplate(null).rows[0] || { id: newRowId, columns: [], alignItems: 'flex-start' };
    const newRow: CardRow = {
        ...defaultRowStructureFromStore,
        id: newRowId,
        columns: (defaultRowStructureFromStore.columns || []).map(c => ({ ...c, id: nanoid() }))
    };
    const newRows = [...(currentTemplateInternalRef.current.rows || []), newRow];
    updateCurrentTemplate({ rows: newRows });
    setIsRowsAndSectionsCardOpen(true);
  }, [updateCurrentTemplate, memoizedGetFreshDefaultTemplate]);


  const removeLocalRow = useCallback((rowId: string) => {
    let newRows = (currentTemplateInternalRef.current.rows || []).filter(r => r.id !== rowId);
    if (newRows.length === 0) {
      const defaultRowStructure = memoizedGetFreshDefaultTemplate(null).rows[0] || { id: nanoid(), columns: [], alignItems: 'flex-start' };
      const newFallbackRow: CardRow = {
          ...defaultRowStructure,
          id: nanoid(),
          columns: (defaultRowStructure.columns || []).map(c => ({ ...c, id: nanoid() }))
      };
      newRows.push(newFallbackRow);
    }
    updateCurrentTemplate({ rows: newRows });
  }, [updateCurrentTemplate, memoizedGetFreshDefaultTemplate]);

  const moveLocalRow = useCallback((rowId: string, direction: 'up' | 'down') => {
    const rows = [...(currentTemplateInternalRef.current.rows || [])];
    const index = rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
    updateCurrentTemplate({ rows });
  }, [updateCurrentTemplate]);

  const addLocalSectionToRow = useCallback((rowId: string) => {
    const newSectionId = nanoid();
    const defaultSectionStructure = memoizedGetFreshDefaultTemplate(null).rows[0]?.columns[0] || { id: newSectionId, sectionContentType: 'placeholder', contentPlaceholder: '{{new_field}}', flexGrow: 0 };
    const newSection: CardSection = { ...defaultSectionStructure, id: newSectionId };

    const newRows = (currentTemplateInternalRef.current.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: [...(r.columns || []), newSection ] } : r
    );
    updateCurrentTemplate({ rows: newRows });
    setActiveStylingAccordion(newSectionId);
    setActiveColumnAccordionItems(prevActive => [...prevActive, newSectionId]);
    if (!activeRowAccordionItems.includes(rowId)) setActiveRowAccordionItems(prevActive => [...prevActive, rowId]);
    setIsRowsAndSectionsCardOpen(true);
  }, [activeRowAccordionItems, updateCurrentTemplate, memoizedGetFreshDefaultTemplate]);


  const removeLocalSectionFromRow = useCallback((rowId: string, sectionId: string) => {
    const newRows = (currentTemplateInternalRef.current.rows || []).map(r => {
      if (r.id === rowId) {
        const newColumns = (r.columns || []).filter(s => s.id !== sectionId);
        const defaultSectionStructure = memoizedGetFreshDefaultTemplate(null).rows[0]?.columns[0] || { id: nanoid(), sectionContentType: 'placeholder', contentPlaceholder: '{{fallback_field}}', flexGrow: 0 };
        const finalColumns = newColumns.length > 0 ? newColumns : [ { ...defaultSectionStructure, id: nanoid() } ];
        return { ...r, columns: finalColumns };
      }
      return r;
    });
    if (activeStylingAccordion === sectionId) setActiveStylingAccordion(null);
    setActiveColumnAccordionItems(prevActive => prevActive.filter(id => id !== sectionId));
    updateCurrentTemplate({ rows: newRows });
  }, [activeStylingAccordion, updateCurrentTemplate, memoizedGetFreshDefaultTemplate]);

  const onUpdateLocalSectionInRow = useCallback((rowId: string, sectionId: string, updates: Partial<CardSection>) => {
     const currentInternal = currentTemplateInternalRef.current;
     const newRows = (currentInternal.rows || []).map(r =>
         r.id === rowId ? { ...r, columns: (r.columns || []).map(s => s.id === sectionId ? { ...s, ...updates } : s) } : r
     );
     updateCurrentTemplate({ rows: newRows });
  }, [updateCurrentTemplate]);

  const moveLocalSectionInRow = useCallback((rowId: string, sectionId: string, direction: 'left' | 'right') => {
    const newRows = (currentTemplateInternalRef.current.rows || []).map(r => {
      if (r.id === rowId) {
        const cols = [...(r.columns || [])];
        const idx = cols.findIndex(s => s.id === sectionId);
        if (idx === -1) return r;
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx >= 0 && targetIdx < cols.length) {
          [cols[idx], cols[targetIdx]] = [cols[targetIdx], cols[idx]];
        }
        return { ...r, columns: cols };
      }
      return r;
    });
    updateCurrentTemplate({ rows: newRows });
  }, [updateCurrentTemplate]);

  const handleSubmit = useCallback(() => {
    let templateToSave = currentTemplateInternalRef.current;

    if (!templateToSave.name?.trim() || templateToSave.name === "New Unsaved Template") {
      toast({ title: "Validation Error", description: "Template name must be set.", variant: "destructive" });
      return;
    }
    const ratioPartsVal = String(templateToSave.aspectRatio || '').split(':').map(Number);
    if (!(ratioPartsVal.length === 2 && !isNaN(ratioPartsVal[0]) && ratioPartsVal[0] > 0 && !isNaN(ratioPartsVal[1]) && ratioPartsVal[1] > 0)) {
        toast({ title: "Validation Error", description: 'Aspect Ratio must be in W:H format (e.g., 63:88) with positive numbers.', variant: "destructive" });
        return;
    }
    if (!templateToSave.rows || templateToSave.rows.length === 0) {
        toast({ title: "Validation Error", description: 'Template must have at least one row.', variant: "destructive" });
        return;
    }
    if (templateToSave.rows.some((row: CardRow) => !row.columns || row.columns.length === 0)) {
        toast({ title: "Validation Error", description: 'All rows must have at least one section (column).', variant: "destructive" });
        return;
    }

    const savedTemplateId = onSaveTemplate(templateToSave);

    if (currentTemplateInternalRef.current.id === null && savedTemplateId) {
      onSelectTemplateForEditing(savedTemplateId);
    } else if (selectedTemplateIdForEditing !== savedTemplateId && savedTemplateId) {
      onSelectTemplateForEditing(savedTemplateId);
    }
  }, [onSaveTemplate, toast, selectedTemplateIdForEditing, onSelectTemplateForEditing]);


  const handleSelectTemplateToEditFromDropdown = useCallback((templateId: string | null) => {
     onSelectTemplateForEditing(templateId);
     setCustomWidthValue('');
     setCustomHeightValue('');
     setCustomUnit('mm');
  }, [onSelectTemplateForEditing]);


  const isNonCustomizableFrame = useMemo(() => {
    const frameStyle = currentTemplateInternalRef.current.frameStyle;
    return !!frameStyle && frameStyle !== 'standard' && frameStyle !== 'custom';
  }, [currentTemplateInternalRef.current.frameStyle]);


  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    extractUniquePlaceholderKeys(currentTemplateInternalRef.current).forEach(p => {
      data[p.key] = p.defaultValue !== undefined ? p.defaultValue : `{{${p.key}}}`;
    });
    return data;
  }, [currentTemplateInternalRef.current]);

  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  const onToggleColumnAccordionCb = useCallback((sectionId: string) => {
    setActiveColumnAccordionItems(prev =>
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  }, []);

  const handleRowClickFromPreview = useCallback((rowId: string) => {
    setIsRowsAndSectionsCardOpen(true);
    setActiveRowAccordionItems(prev => {
      if (prev.includes(rowId) && prev.length === 1 && activeRowAccordionItems.length === 1) return prev;
      if(prev.includes(rowId)) return prev.filter(id => id !== rowId);
      return [...prev, rowId];
    });
    setTimeout(() => document.getElementById(`accordion-row-${rowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),0);
  }, [activeRowAccordionItems]);

  const handleSectionClickFromPreview = useCallback((sectionId: string) => {
    setIsRowsAndSectionsCardOpen(true);
    const parentRow = (currentTemplateInternalRef.current.rows || []).find(r => (r.columns || []).some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)) {
        setActiveRowAccordionItems(prevActive => [...prevActive, parentRow.id]);
    }
    onToggleColumnAccordionCb(sectionId);
    setTimeout(() => document.querySelector(`.column-editor-card[data-section-id="${sectionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }, [currentTemplateInternalRef.current.rows, activeRowAccordionItems, onToggleColumnAccordionCb]);


  const handleCardBgImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => updateCurrentTemplate({ cardBackgroundImageUrl: e.target?.result as string });
      reader.readAsDataURL(file);
      toast({ title: "Image Uploaded", description: `Card background image "${file.name}" loaded.` });
    }
    if (event.target) event.target.value = "";
  }, [updateCurrentTemplate, toast]);

  const handleApplyCustomDimensions = useCallback(() => {
    const widthNum = parseFloat(customWidthValue);
    const heightNum = parseFloat(customHeightValue);

    if (isNaN(widthNum) || widthNum <= 0 || isNaN(heightNum) || heightNum <= 0) {
      toast({ title: "Invalid Dimensions", description: "Please enter positive numbers for width and height.", variant: "destructive" });
      return;
    }
    const simplified = simplifyRatio(widthNum, heightNum);
    updateCurrentTemplate({ aspectRatio: simplified });
    toast({ title: "Aspect Ratio Updated", description: `Ratio set to ${simplified} based on custom dimensions.` });
  }, [customWidthValue, customHeightValue, updateCurrentTemplate, toast]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5"/>Your Templates</CardTitle>
          <CardDescription>Create new, or edit an existing template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => handleSelectTemplateToEditFromDropdown(null)} variant="outline" className="w-full flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Create New Template
          </Button>

          {templates.filter(t => t.id && t.id.trim() !== "").length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t">
              <Label>Edit Existing Template:</Label>
              <Select
                value={selectedTemplateIdForEditing || undefined}
                onValueChange={(id) => handleSelectTemplateToEditFromDropdown(id === 'new-template-placeholder-value' ? null : id)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template to edit..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-[200px] pr-1">
                    {templates.filter(t => t.id && t.id.trim() !== "").map((template) => (
                      <SelectItem key={template.id!} value={template.id!}>
                        {template.name || `Template (${String(template.id!).substring(0,5)})`}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              <ul className="space-y-1 mt-1 max-h-[160px] overflow-y-auto pr-1">
                  {templates.filter(t => t.id && t.id.trim() !== "").map((template) => (
                    <li key={`${template.id!}-li`} className="flex justify-between items-center p-1.5 border rounded-md hover:bg-muted/30 transition-colors text-xs">
                      <span
                        className={cn(
                            "cursor-pointer flex-grow truncate",
                            selectedTemplateIdForEditing === template.id ? 'font-semibold text-primary' : ''
                        )}
                        onClick={() => handleSelectTemplateToEditFromDropdown(template.id!)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplateToEditFromDropdown(template.id!)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit template ${template.name || 'Untitled Template'}`}
                      >
                        {template.name || `Template (${String(template.id!).substring(0,5)})`}
                      </span>
                      <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(template.id!);
                      }} aria-label={`Delete template ${template.name || 'Untitled Template'}`} className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
            </div>
          )}
           {(templates.filter(t => t.id && t.id.trim() !== "").length === 0) && <p className="text-muted-foreground text-sm mt-2">No templates saved. Click "Create New Template" to start.</p>}
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-6">
            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={isSettingsCardOpen ? "editor-settings-card" : undefined}
              onValueChange={(value) => setIsSettingsCardOpen(value === "editor-settings-card")}
            >
              <AccordionItem value="editor-settings-card" className="border-none">
                <Card>
                  <AccordionTrigger className="hover:no-underline p-0 [&>.lucide-chevron-down]:hidden">
                    <CardHeader className="flex flex-row items-center justify-between w-full hover:bg-muted/20 rounded-t-lg cursor-pointer px-2 py-3 sm:px-4 sm:py-3">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Edit2 className="h-5 w-5" />
                            Template Settings: <span className="text-primary font-medium">{currentTemplateInternalRef.current.name || "Untitled Template"}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {currentTemplateInternalRef.current.id === null ? "Define new template properties." : `Editing template properties.`}
                            {hasMounted && currentTemplateInternalRef.current.id && <span className="text-xs text-muted-foreground ml-2">(ID: {typeof currentTemplateInternalRef.current.id === 'string' ? currentTemplateInternalRef.current.id.substring(0,8) : 'New'})</span>}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-4 p-2 sm:p-4">
                        <div>
                            <Label htmlFor="templateName">Template Name</Label>
                            <Input
                                id="templateName"
                                value={currentTemplateInternalRef.current.name || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    updateCurrentTemplate({ name: e.target.value });
                                }}
                                placeholder="Enter a unique name for your template"
                            />
                        </div>

                        <div className="space-y-3 border p-3 rounded-md bg-muted/20">
                            <h4 className="text-sm font-medium">Define Aspect Ratio</h4>
                            <div className="space-y-2">
                                <Label htmlFor="templateAspectRatio">Current Ratio (W:H) - Editable</Label>
                                <Input
                                    id="templateAspectRatio"
                                    value={aspectRatioInput}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        const newRatio = e.target.value;
                                        setAspectRatioInput(newRatio);
                                        const ratioParts = newRatio.split(':').map(Number);
                                        if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
                                            updateCurrentTemplate({ aspectRatio: newRatio });
                                        } else if (newRatio.trim() === '') {
                                            updateCurrentTemplate({ aspectRatio: TCG_ASPECT_RATIO });
                                        }
                                    }}
                                    onBlur={() => {
                                        const currentStoredRatio = currentTemplateInternalRef.current.aspectRatio || TCG_ASPECT_RATIO;
                                        const ratioParts = aspectRatioInput.split(':').map(Number);
                                        if (!(ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0)) {
                                            setAspectRatioInput(currentStoredRatio);
                                            if(currentTemplateInternalRef.current.aspectRatio !== currentStoredRatio) updateCurrentTemplate({aspectRatio: currentStoredRatio});
                                        } else if (aspectRatioInput !== currentStoredRatio) {
                                            updateCurrentTemplate({aspectRatio: aspectRatioInput});
                                        }
                                    }}
                                    placeholder={`e.g., ${TCG_ASPECT_RATIO} (Standard TCG)`}
                                />
                            </div>
                            <div className="space-y-2 pt-2 border-t">
                                <Label className="text-xs text-muted-foreground">Or, Set Ratio by Dimensions:</Label>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2 items-end">
                                    <div>
                                        <Label htmlFor="customWidth" className="text-xs">Width</Label>
                                        <Input id="customWidth" type="number" value={customWidthValue} onChange={e => setCustomWidthValue(e.target.value)} placeholder="e.g., 63" className="h-8"/>
                                    </div>
                                    <div>
                                        <Label htmlFor="customHeight" className="text-xs">Height</Label>
                                        <Input id="customHeight" type="number" value={customHeightValue} onChange={e => setCustomHeightValue(e.target.value)} placeholder="e.g., 88" className="h-8"/>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="customUnit" className="text-xs">Unit</Label>
                                        <Select value={customUnit} onValueChange={setCustomUnit}>
                                            <SelectTrigger id="customUnit" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {DIMENSION_UNITS.map(u => <SelectItem key={u.value} value={u.value} className="text-xs">{u.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleApplyCustomDimensions} size="sm" className="col-span-2 sm:col-span-1 h-8 text-xs">Apply Dimensions to Ratio</Button>
                                </div>
                            </div>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="overall-styling-accordion-item" id="overall-styling-accordion-item" className="border rounded-md">
                                <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline [&>.lucide-chevron-down]:hidden">
                                    <div className="flex items-center gap-2"><Settings className="h-4 w-4" /> Overall Card Styling</div>
                                </AccordionTrigger>
                                <AccordionContent className="p-3 space-y-3 border-t">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                        <div>
                                            <Label htmlFor="templateFrameStyle">Card Frame Style</Label>
                                            <Select value={currentTemplateInternalRef.current.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                                <SelectTrigger id="templateFrameStyle"><SelectValue/></SelectTrigger>
                                                <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                        <Label htmlFor="cardBackgroundImageUrl">Card Background Image URL (or placeholder)</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                            id="cardBackgroundImageUrl"
                                            value={currentTemplateInternalRef.current.cardBackgroundImageUrl || ''}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ cardBackgroundImageUrl: e.target.value })}
                                            placeholder="e.g., https://.../bg.png or {{bgKey}}"
                                            className="h-8 text-xs flex-grow"
                                            disabled={isNonCustomizableFrame}
                                            />
                                            <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => cardBgImageInputRef.current?.click()}
                                            aria-label="Upload card background image"
                                            disabled={isNonCustomizableFrame}
                                            >
                                            <FileImage className="h-4 w-4" />
                                            </Button>
                                            <input
                                            type="file"
                                            accept="image/*"
                                            ref={cardBgImageInputRef}
                                            onChange={handleCardBgImageUpload}
                                            style={{ display: 'none' }}
                                            id="cardBackgroundImageUrl-file"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isNonCustomizableFrame
                                            ? `Background is controlled by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for none."}
                                        </p>
                                        </div>

                                        <div>
                                            <Label htmlFor="baseBgColor">Base Background Color</Label>
                                            <Input id="baseBgColor" type="color" value={currentTemplateInternalRef.current.baseBackgroundColor || ''}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })}
                                                disabled={isNonCustomizableFrame} />
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isNonCustomizableFrame
                                                    ? `Overridden by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').`
                                                    : "Applies to 'Standard' and 'Custom Colors' frames. Other frames may override."}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="baseTextColor">Base Text Color</Label>
                                            <Input id="baseTextColor" type="color" value={currentTemplateInternalRef.current.baseTextColor || ''}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })}
                                                disabled={isNonCustomizableFrame} />
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isNonCustomizableFrame
                                                    ? `Overridden by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').`
                                                    : "Applies to 'Standard' and 'Custom Colors' frames. Other frames may override."}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="defaultSectionBorderColor">Default Section Fallback Border Color</Label>
                                            <Input id="defaultSectionBorderColor" type="color" value={currentTemplateInternalRef.current.defaultSectionBorderColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ defaultSectionBorderColor: e.target.value })} />
                                            <p className="text-xs text-muted-foreground mt-0.5">Fallback for individual section borders if they have width but no specific color.</p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderColor">Card Outer Border Color</Label>
                                            <Input id="cardBorderColor" type="color" value={currentTemplateInternalRef.current.cardBorderColor || ''} onChange={e => updateCurrentTemplate({cardBorderColor: e.target.value})}
                                            disabled={isNonCustomizableFrame}/>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').` : "For 'Standard'/'Custom Colors' frames."}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderWidth">Card Outer Border Width</Label>
                                            <Input id="cardBorderWidth" value={currentTemplateInternalRef.current.cardBorderWidth || ''} onChange={e => updateCurrentTemplate({cardBorderWidth: e.target.value})} placeholder="e.g., 4px, 0"
                                            className="h-8 text-xs"
                                            disabled={isNonCustomizableFrame}/>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').` : 'E.g., "4px", "0" for no border.'}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderStyle">Card Outer Border Style</Label>
                                            <Select value={currentTemplateInternalRef.current.cardBorderStyle || '_default_'} onValueChange={v => updateCurrentTemplate({cardBorderStyle: (v === '_default_' ? undefined : v as TCGCardTemplate['cardBorderStyle'])}) }
                                            disabled={isNonCustomizableFrame}
                                            >
                                                <SelectTrigger id="cardBorderStyle"><SelectValue/></SelectTrigger>
                                                <SelectContent>{CARD_BORDER_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').` : "For 'Standard'/'Custom Colors' frames."}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderRadius">Card Corner Radius</Label>
                                            <Input id="cardBorderRadius" value={currentTemplateInternalRef.current.cardBorderRadius || ''} onChange={e => updateCurrentTemplate({cardBorderRadius: e.target.value})} placeholder="e.g., 8px, 0.5rem"
                                            className="h-8 text-xs"
                                            disabled={isNonCustomizableFrame}/>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplateInternalRef.current.frameStyle || ''}').` : 'E.g., "8px", "0.5rem".'}
                                            </p>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={isRowsAndSectionsCardOpen ? "rows-sections-card" : undefined}
              onValueChange={(value) => setIsRowsAndSectionsCardOpen(value === "rows-sections-card")}
            >
              <AccordionItem value="rows-sections-card" className="border-none">
                <Card>
                    <AccordionTrigger className="hover:no-underline p-0 [&>.lucide-chevron-down]:hidden">
                        <CardHeader className="flex flex-row items-center justify-between w-full hover:bg-muted/20 rounded-t-lg cursor-pointer px-2 py-3 sm:px-4 sm:py-3">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Rows className="h-5 w-5 text-primary" /> Card Rows &amp; Sections (Columns)
                                </CardTitle>
                                <CardDescription className="mt-1">Define rows, then add sections (columns) to each row.</CardDescription>
                            </div>
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                        <CardContent className="p-1 sm:p-2">
                          {hasMounted && (
                            <ScrollArea className="h-[60vh] w-full">
                                <Accordion
                                    type="multiple"
                                    value={activeRowAccordionItems}
                                    onValueChange={setActiveRowAccordionItems}
                                    className="w-full space-y-2"
                                >
                                    {(currentTemplateInternalRef.current.rows || []).map((row, rowIndex) => (
                                    <AccordionItem value={row.id} key={row.id} id={`accordion-row-${row.id}`} className="border border-border bg-card/60 rounded-md overflow-hidden last:mb-0">
                                    <div className="flex items-center w-full px-2 py-1 hover:bg-muted/30 rounded-t-md focus-within:ring-1 focus-within:ring-ring">
                                            <AccordionTrigger
                                                aria-label={`Toggle Row ${rowIndex + 1} details`}
                                                className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium [&>.lucide-chevron-down]:hidden"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate flex-1">{`Row ${rowIndex + 1} (${(row.columns || []).length} Column(s))`}</span>
                                                </div>
                                            </AccordionTrigger>
                                            <div className="flex gap-1 ml-2 flex-shrink-0">
                                                <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveLocalRow(row.id, 'up')}} disabled={rowIndex === 0} aria-label="Move row up" className="h-7 w-7"><ArrowUp className="h-4 w-4" /></Button>
                                                <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveLocalRow(row.id, 'down')}} disabled={rowIndex === (currentTemplateInternalRef.current.rows || []).length - 1} aria-label="Move row down" className="h-7 w-7"><ArrowDown className="h-4 w-4" /></Button>
                                                <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeLocalRow(row.id)}} aria-label="Remove row" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                        </div>
                                        <AccordionContent className="px-1 py-2 sm:px-2 sm:py-3 space-y-4 border-t bg-background/70">
                                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3'>
                                            <div>
                                                <Label htmlFor={`rowAlignItems-${row.id}`}>Row Vertical Alignment (columns)</Label>
                                                <Select value={row.alignItems || 'flex-start'} onValueChange={v => updateLocalRow(row.id, {alignItems: v as CardRow['alignItems']})}>
                                                    <SelectTrigger id={`rowAlignItems-${row.id}`}><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        {ROW_ALIGN_ITEMS.map(item => (
                                                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor={`rowCustomHeight-${row.id}`}>Row Custom Height (e.g., 50px, 20%, auto)</Label>
                                                <Input id={`rowCustomHeight-${row.id}`} value={row.customHeight || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateLocalRow(row.id, { customHeight: e.target.value })} placeholder="e.g., 100px, 20%, auto" />
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-semibold flex items-center gap-2 pt-2 border-t mt-3">
                                            <LayoutDashboard className="h-4 w-4" />
                                            Sections (Columns) in this Row:
                                        </h4>
                                        {(row.columns || []).length === 0 && <p className="text-xs text-muted-foreground">No sections (columns) in this row yet. Add one below.</p>}
                                        <div className="space-y-3">
                                            <Accordion
                                                type="multiple"
                                                value={activeColumnAccordionItems}
                                                onValueChange={setActiveColumnAccordionItems}
                                                className="w-full space-y-2"
                                            >
                                                {(row.columns || []).map((section, sectionIndex) => (
                                                    <ColumnEditor
                                                        key={section.id}
                                                        section={section}
                                                        sectionIndex={sectionIndex}
                                                        rowId={row.id}
                                                        isFirstColumn={sectionIndex === 0}
                                                        isLastColumn={(row.columns || []).length -1 === sectionIndex}
                                                        activeStylingAccordion={activeStylingAccordion}
                                                        onToggleStylingAccordion={onToggleStylingAccordion}
                                                        onUpdateSectionInRow={onUpdateLocalSectionInRow}
                                                        onRemoveSectionFromRow={removeLocalSectionFromRow}
                                                        onMoveSectionInRow={moveLocalSectionInRow}
                                                        onToggleColumnAccordion={() => onToggleColumnAccordionCb(section.id)}
                                                    />
                                                ))}
                                            </Accordion>
                                        </div>
                                        <div className="mt-3">
                                            <Button onClick={() => addLocalSectionToRow(row.id)} variant="outline" size="sm" className="flex items-center gap-2">
                                                <PlusCircle className="h-4 w-4"/>Add New Section to this Row
                                            </Button>
                                        </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                          )}
                        </CardContent>
                        <CardFooter className="p-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Button type="button" onClick={addLocalRow} variant="outline" className="w-full sm:w-auto flex items-center gap-2">
                                <PlusCircle className="h-4 w-4"/> Add New Row
                            </Button>
                        </CardFooter>
                    </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            <div className="mt-6 pt-6 border-t">
                <Button type="button" onClick={handleSubmit} className="w-full flex items-center gap-2 text-lg py-6">
                    <Save className="h-5 w-5"/>
                    Save Template "{currentTemplateInternalRef.current.name || "Untitled Template"}"
                </Button>
            </div>

            <div className="mt-6 mb-6 pt-4 border-t">
                <h4 className="text-lg font-semibold mb-2 text-center">Live Template Preview</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">(Click row or section in preview to focus.)</p>
                {hasMounted && (
                  <div className="mx-auto max-w-xs flex justify-center">
                      <CardPreview
                          card={{ template: currentTemplateInternalRef.current, data: livePreviewData, uniqueId: 'editor-preview' }}
                          isPrintMode={false}
                          isEditorPreview={true}
                          hideEmptySections={false}
                          onSectionClick={handleSectionClickFromPreview}
                          onRowClick={handleRowClickFromPreview}
                          targetWidthPx={280}
                      />
                  </div>
                )}
                 <div className="flex justify-center mt-4">
                    <Button onClick={() => setIsPreviewDialogOpen(true)} variant="outline" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" /> View Full Size Preview
                    </Button>
                 </div>
            </div>
             {hasMounted && isPreviewDialogOpen && (
                <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                    <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Full Size Template Preview: {currentTemplateInternalRef.current.name || "Untitled Template"}</DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center p-4 my-auto">
                            <CardPreview
                                card={{ template: currentTemplateInternalRef.current, data: livePreviewData, uniqueId: 'full-editor-preview-dialog' }}
                                isPrintMode={false}
                                isEditorPreview={true}
                                hideEmptySections={false}
                                className="mx-auto"
                                targetWidthPx={400}
                            />
                        </div>
                        <DialogClose asChild className="mt-auto">
                            <Button type="button" variant="outline">Close</Button>
                        </DialogClose>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    </div>
  );
}

