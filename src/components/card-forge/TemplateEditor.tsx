
"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TCGCardTemplate, CardSection, CardSectionType, CardRow } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, Cog, Rows, Save, Edit2, XCircle, GripVertical, Columns, Paintbrush
} from 'lucide-react';
import { SECTION_TYPES, FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS, FRAME_STYLES, ROW_ALIGN_ITEMS, createDefaultRow } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from './CardPreview';
import { extractUniquePlaceholderKeys } from '@/lib/utils';
import { ColumnEditor } from './ColumnEditor';
import { nanoid } from 'nanoid';

interface TemplateEditorProps {
  onSaveTemplate: (template: TCGCardTemplate) => void;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: TCGCardTemplate | null;
}

// getFreshDefaultTemplate is used when "Create New Template" is clicked or no suitable template is found.
// It always generates new, unique IDs for the template and its nested elements.
const getFreshDefaultTemplate = (id?: string, name?: string): TCGCardTemplate => {
  const preset = PRESET_TEMPLATES.find(t => t.id === 'sfc-v6-stable-id') || PRESET_TEMPLATES[0];
  const newTemplateBase = JSON.parse(JSON.stringify(preset)) as TCGCardTemplate;
  
  const newTemplateId = id || nanoid();
  const newTemplateName = name || `New Template ${new Date().toLocaleTimeString()}`;

  // When creating a fresh template, all its rows and sections get new unique IDs.
  const newRows = newTemplateBase.rows.map((rowPreset) => {
    const newRowId = nanoid(); 
    return {
      ...rowPreset, 
      id: newRowId,
      columns: rowPreset.columns.map((colPreset) => ({
        ...colPreset, 
        id: nanoid(), 
      })),
    };
  });

  return {
    ...newTemplateBase,
    id: newTemplateId,
    name: newTemplateName,
    rows: newRows,
    aspectRatio: newTemplateBase.aspectRatio || "63:88",
    frameStyle: newTemplateBase.frameStyle || 'standard',
    baseBackgroundColor: newTemplateBase.baseBackgroundColor || '',
    baseTextColor: newTemplateBase.baseTextColor || '',
    defaultSectionBorderColor: newTemplateBase.defaultSectionBorderColor || '',
    legacyFrameColor: newTemplateBase.legacyFrameColor || '',
  };
};


export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  const { toast } = useToast();

  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(() => {
    if (initialTemplate) {
        return JSON.parse(JSON.stringify(initialTemplate));
    }
    return getFreshDefaultTemplate();
  });

  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || "63:88");

  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>([]);
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  
  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  useEffect(() => {
    let templateToProcess: TCGCardTemplate | null = null;
    let source: 'initial' | 'selected' | 'new' = 'new';

    if (initialTemplate && (!selectedTemplateToEditId || selectedTemplateToEditId === initialTemplate.id)) {
        templateToProcess = JSON.parse(JSON.stringify(initialTemplate));
        source = 'initial';
    } else if (selectedTemplateToEditId) {
        const foundTemplate = templates.find(t => t.id === selectedTemplateToEditId);
        if (foundTemplate) {
            templateToProcess = JSON.parse(JSON.stringify(foundTemplate));
            source = 'selected';
        } else {
            templateToProcess = getFreshDefaultTemplate(selectedTemplateToEditId, "New Template (ID Recycled)");
            source = 'new';
        }
    } else if (templates.length > 0) { 
        templateToProcess = JSON.parse(JSON.stringify(templates[0]));
        // Ensure selectedTemplateToEditId is updated if we default to the first template
        if (templates[0].id !== selectedTemplateToEditId) {
            setSelectedTemplateToEditId(templates[0].id);
        }
        source = 'selected';
    } else {
        const freshId = nanoid(); // ID for a brand new template
        templateToProcess = getFreshDefaultTemplate(freshId);
         // Ensure selectedTemplateToEditId is updated for a new template
        if (freshId !== selectedTemplateToEditId) {
            setSelectedTemplateToEditId(freshId);
        }
        source = 'new';
    }
    
    if (!templateToProcess) {
        // This should ideally not be reached if logic above is correct.
        console.error("TemplateEditor: templateToProcess is null, falling back to fresh default.");
        templateToProcess = getFreshDefaultTemplate(nanoid());
        source = 'new';
    }

    // CRITICAL FOR HYDRATION:
    // When reconstructing, IDs from `templateToProcess` (if it came from props/localStorage) MUST be preserved.
    // `createDefaultRow` and `createDefaultSection` will use the passed ID if provided.
    const reconstructedRows = (templateToProcess.rows || []).map((r_loaded: CardRow) => {
        const rowId = r_loaded.id; 
        if (!rowId) {
            // This signals an issue with data from props (DEFAULT_TEMPLATES or localStorage migration)
            // It should already have a stable ID. Generating one here will break hydration.
            console.error("FATAL HYDRATION RISK: Row from templateToProcess is missing ID!", r_loaded, "Template:", templateToProcess.name);
            // Fallback to a new ID for this specific instance to avoid crashes, but this means hydration will fail.
            // The root cause (missing ID in source data) needs fixing.
            return {...r_loaded, id: nanoid(), columns: (r_loaded.columns || []).map(c => ({...c, id: c.id || nanoid()}))}; 
        }
        const defaultRowShape = createDefaultRow(rowId, [], r_loaded.alignItems, r_loaded.customHeight);
        const newR: CardRow = { 
            ...defaultRowShape, 
            ...r_loaded, 
            id: rowId // Ensure original ID is strictly used
        }; 
        
        newR.columns = (r_loaded.columns || []).map((c_loaded: CardSection) => {
            const sectionId = c_loaded.id; 
            if (!sectionId) {
                 console.error("FATAL HYDRATION RISK: Section from templateToProcess is missing ID!", c_loaded, "Template:", templateToProcess.name);
                 return {...c_loaded, id: nanoid(), type: (c_loaded.type as CardSectionType | undefined) || 'CustomText'};
            }
            const sectionType = (c_loaded.type as CardSectionType | undefined) || 'CustomText';
            const defaultSectionShape = createDefaultSection(sectionType, sectionId); 
            const newC: CardSection = { 
                ...defaultSectionShape, 
                ...c_loaded, 
                id: sectionId, // Ensure original ID is strictly used
                type: sectionType 
            };
            return newC;
        });
        return newR;
    });
    
    const templateIdToUse = templateToProcess.id;
     if (!templateIdToUse) {
        console.error("FATAL HYDRATION RISK: templateToProcess is missing ID!", templateToProcess);
        // This will lead to hydration errors.
    }

    const basePresetForShape = PRESET_TEMPLATES.find(p => p.id === templateIdToUse) || PRESET_TEMPLATES[0] || {};

    const fullyReconstructedTemplate: TCGCardTemplate = {
       ...basePresetForShape,
       ...templateToProcess, 
       id: templateIdToUse!, 
       name: templateToProcess.name || 'Untitled Template',
       aspectRatio: templateToProcess.aspectRatio || "63:88",
       frameStyle: templateToProcess.frameStyle || 'standard',
       baseBackgroundColor: templateToProcess.baseBackgroundColor || '',
       baseTextColor: templateToProcess.baseTextColor || '',
       defaultSectionBorderColor: templateToProcess.defaultSectionBorderColor || '',
       legacyFrameColor: templateToProcess.legacyFrameColor || '',
       rows: reconstructedRows
    };
    
    setCurrentTemplate(fullyReconstructedTemplate);
    setAspectRatioInput(fullyReconstructedTemplate.aspectRatio || "63:88");
    
    // Only auto-expand if it's a new load or explicit selection to avoid jarring UX on minor prop updates
    if (source === 'initial' || source === 'selected' || source === 'new') {
      setActiveRowAccordionItems((fullyReconstructedTemplate.rows || []).map(r => r.id));
    }
    setActiveStylingAccordion(null);

  }, [initialTemplate, selectedTemplateToEditId, templates]);


  const updateCurrentTemplate = (updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    // Sync aspectRatioInput to currentTemplate.aspectRatio if they diverge
    if (currentTemplate.aspectRatio !== aspectRatioInput) {
        const ratioParts = aspectRatioInput.split(':').map(Number);
        if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
            const newAspectRatio = `${ratioParts[0]}:${ratioParts[1]}`;
            updateCurrentTemplate({ aspectRatio: newAspectRatio });
        }
    }
  }, [aspectRatioInput, currentTemplate.aspectRatio]);

   useEffect(() => {
    // Sync currentTemplate.name to selected template's name if selectedTemplateToEditId changes
    // and currentTemplate.id matches it (meaning we're editing it).
    if (selectedTemplateToEditId && currentTemplate.id === selectedTemplateToEditId) {
        const selectedTpl = templates.find(t => t.id === selectedTemplateToEditId);
        if (selectedTpl && selectedTpl.name !== currentTemplate.name) {
             // This might be too aggressive if user is in middle of typing name
             // Consider if this is needed or if name sync should only happen on load.
        }
    }
   }, [selectedTemplateToEditId, templates, currentTemplate.id, currentTemplate.name]);


  const updateRow = (rowId: string, updates: Partial<CardRow>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => r.id === rowId ? { ...r, ...updates } : r),
    }));
  };

  const addRow = () => {
    const newRowId = nanoid();
    const newSectionInRowId = nanoid();
    const newRow = createDefaultRow(newRowId, [createDefaultSection('CustomText', newSectionInRowId)]); 
    updateCurrentTemplate({ rows: [...(currentTemplate.rows || []), newRow] });
    setActiveRowAccordionItems(prev => [...prev, newRowId]);
  };

  const removeRow = (rowId: string) => {
    updateCurrentTemplate({ rows: (currentTemplate.rows || []).filter(r => r.id !== rowId) });
    setActiveRowAccordionItems(prev => prev.filter(id => id !== rowId));
  };

  const moveRow = (rowId: string, direction: 'up' | 'down') => {
    const rows = [...(currentTemplate.rows || [])];
    const index = rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    
    [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
    updateCurrentTemplate({ rows });
  };

  const addSectionToRow = (rowId: string, type: CardSectionType) => {
    const newSectionId = nanoid(); 
    const newSection = createDefaultSection(type, newSectionId);
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: [...r.columns, newSection] } : r
      )
    }));
    setActiveStylingAccordion(newSectionId);
  };

  const removeSectionFromRow = (rowId: string, sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: r.columns.filter(s => s.id !== sectionId) } : r
      )
    }));
    if (activeStylingAccordion === sectionId) {
        setActiveStylingAccordion(null);
    }
  };

  const updateSectionInRow = useCallback((rowId: string, sectionId: string, updates: Partial<CardSection>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId
        ? { ...r, columns: r.columns.map(s => s.id === sectionId ? { ...s, ...updates } : s) }
        : r
      )
    }));
  }, []);

  const moveSectionInRow = (rowId: string, sectionId: string, direction: 'left' | 'right') => {
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r => {
        if (r.id === rowId) {
          const sectionIndex = r.columns.findIndex(s => s.id === sectionId);
          if (sectionIndex === -1) return r;

          const newColumns = [...r.columns];
          const targetIndex = direction === 'left' ? sectionIndex - 1 : sectionIndex + 1;

          if (targetIndex >= 0 && targetIndex < newColumns.length) {
            [newColumns[sectionIndex], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[sectionIndex]];
          }
          return { ...r, columns: newColumns };
        }
        return r;
      });
      return { ...prev, rows: newRows };
    });
  };

  const resetFormToNew = () => {
    const newId = nanoid(); 
    const newDefaultTemplate = getFreshDefaultTemplate(newId); 
    setCurrentTemplate(newDefaultTemplate);
    setSelectedTemplateToEditId(newId); 
    setAspectRatioInput(newDefaultTemplate.aspectRatio || "63:88");
    setActiveRowAccordionItems((newDefaultTemplate.rows || []).map(r => r.id));
    setActiveStylingAccordion(null);
  };

  const handleSubmit = () => {
    let templateToSave = JSON.parse(JSON.stringify(currentTemplate)); 

    if (!templateToSave.name.trim()) {
      toast({ title: "Validation Error", description: 'Template name is required.', variant: "destructive" });
      return;
    }
    const ratioPartsVal = String(templateToSave.aspectRatio).split(':').map(Number);
    if (!(ratioPartsVal.length === 2 && !isNaN(ratioPartsVal[0]) && ratioPartsVal[0] > 0 && !isNaN(ratioPartsVal[1]) && ratioPartsVal[1] > 0)) {
        toast({ title: "Validation Error", description: 'Aspect Ratio must be in W:H format (e.g., 63:88) with positive numbers.', variant: "destructive" });
        return;
    }
    if (!templateToSave.rows || templateToSave.rows.length === 0) {
      toast({ title: "Validation Error", description: 'Template structure must have at least one row.', variant: "destructive" });
      return;
    }
    if (templateToSave.rows.some((row: CardRow) => !row.columns || row.columns.length === 0)) {
      toast({ title: "Validation Error", description: 'All rows in the structure must have at least one section (column).', variant: "destructive" });
      return;
    }
    onSaveTemplate(templateToSave);
    setSelectedTemplateToEditId(templateToSave.id); 
  };

  const handleSelectTemplateToEdit = (templateId: string) => {
    if (templateId !== selectedTemplateToEditId) { // Only update if different
        setSelectedTemplateToEditId(templateId);
    }
  };
  
  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      const newPresetTemplateBase = JSON.parse(JSON.stringify(preset)) as TCGCardTemplate; 
      
      // When loading a preset, we assume it's for the current template being edited/created.
      // We should preserve the current template's ID and name, but replace its structure.
      const newRows = newPresetTemplateBase.rows.map((rowPreset) => {
        const newRowId = nanoid(); // Preset rows get new IDs when instantiated this way
        return {
          ...rowPreset,
          id: newRowId,
          columns: rowPreset.columns.map((colPreset) => ({
            ...colPreset,
            id: nanoid(), // Preset columns also get new IDs
          })),
        };
      });
      
      const newPresetTemplate: TCGCardTemplate = {
        ...newPresetTemplateBase, // Spread preset for its properties like aspectRatio, frameStyle
        id: currentTemplate.id || nanoid(), // Keep current ID or make a new one if truly new
        name: currentTemplate.name || preset.name, // Keep current name or use preset's
        rows: newRows, // Use the newly ID'd rows and columns
      };
      
      setCurrentTemplate(newPresetTemplate);
      setAspectRatioInput(newPresetTemplate.aspectRatio || "63:88");
      setActiveRowAccordionItems((newPresetTemplate.rows || []).map(r => r.id));
      setActiveStylingAccordion(null);
      toast({ title: "Preset Loaded", description: `"${preset.name}" structure loaded into current editor.`});
    }
  };

  const handleRowClickFromPreview = (rowId: string) => {
    setActiveRowAccordionItems(prev => {
      if (prev.includes(rowId)) return prev.filter(id => id !== rowId);
      return [...prev.filter(id => id !== rowId), rowId]; 
    });
    setActiveStylingAccordion(null);
    setTimeout(() => {
      const itemElement = document.getElementById(`accordion-row-${rowId}`);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },0);
  };

  const handleSectionClickFromPreview = (sectionId: string) => {
    const parentRow = (currentTemplate.rows || []).find(r => r.columns.some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)){
        setActiveRowAccordionItems(prev => [...prev.filter(id => id !== parentRow.id), parentRow.id]); 
    }
    onToggleStylingAccordion(sectionId);
     setTimeout(() => {
      const itemElement = document.getElementById(`accordion-section-styling-${sectionId}`);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    if (currentTemplate && currentTemplate.rows) {
        extractUniquePlaceholderKeys(currentTemplate).forEach(placeholder => {
            data[placeholder.key] = placeholder.defaultValue !== undefined ? placeholder.defaultValue : `{{${placeholder.key}}}`;
        });
    }
    return data;
  }, [currentTemplate]); 

  const isNonStandardFrame = currentTemplate.frameStyle && currentTemplate.frameStyle !== 'standard' && currentTemplate.frameStyle !== 'custom';
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5"/>Your Templates</CardTitle>
          <CardDescription>Select a preset, create new, or edit an existing template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={resetFormToNew} variant="outline" className="w-full flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Create New Template
          </Button>
          <div>
            <Label htmlFor="templatePresetSelect">Load Preset Structure:</Label>
            <Select onValueChange={handleTemplatePresetChange}>
              <SelectTrigger id="templatePresetSelect">
                <SelectValue placeholder="Load a preset..." />
              </SelectTrigger>
              <SelectContent>
                {PRESET_TEMPLATES.map(preset => (
                  <SelectItem key={preset.id || preset.name} value={preset.name}>{preset.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {templates.length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t">
              <Label>Edit Existing Template:</Label>
              <ScrollArea className="h-[200px] pr-3">
                <ul className="space-y-2">
                  {templates.map((template) => (
                    <li key={template.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-muted/30 transition-colors">
                      <span
                        className={`cursor-pointer flex-grow ${selectedTemplateToEditId === template.id ? 'font-semibold text-primary' : ''}`}
                        onClick={() => handleSelectTemplateToEdit(template.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplateToEdit(template.id)}
                        aria-label={`Edit template ${template.name}`}
                      >
                        {template.name}
                      </span>
                      <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(template.id);
                          if (selectedTemplateToEditId === template.id) resetFormToNew();
                      }} aria-label={`Delete template ${template.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
           {templates.length === 0 && <p className="text-muted-foreground text-sm mt-2">No custom templates saved yet. Create one or start from a preset.</p>}
        </CardContent>
      </Card>

      {currentTemplate && (
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Edit2 className="h-5 w-5" />
                        {(templates.find(t=>t.id === currentTemplate.id) && selectedTemplateToEditId === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: <span className="text-primary">{currentTemplate.name || "Untitled"}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input id="templateName" value={currentTemplate.name} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., My Awesome TCG Template" required />
                    </div>
                    <div>
                        <Label htmlFor="templateAspectRatio" className="text-sm">Aspect Ratio (W:H)</Label>
                        <Input
                            id="templateAspectRatio"
                            value={aspectRatioInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAspectRatioInput(e.target.value)}
                            placeholder="e.g., 63:88 (Standard TCG)"
                        />
                         <p className="text-xs text-muted-foreground mt-1">Current effective: {currentTemplate.aspectRatio}. Standard TCG is 63:88.</p>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full" defaultValue="overall-styling-accordion-item">
                        <AccordionItem value="overall-styling-accordion-item" id="overall-styling-accordion-item" className="border rounded-md">
                            <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline">
                                <div className="flex items-center gap-2"><Cog className="h-4 w-4" /> Overall Card Styling</div>
                            </AccordionTrigger>
                            <AccordionContent className="p-3 space-y-3 border-t">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <Label htmlFor="templateFrameStyle" className="text-xs">Card Frame Style</Label>
                                        <Select value={currentTemplate.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                            <SelectTrigger id="templateFrameStyle"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseBgColor" className="text-xs">Base Background Color</Label>
                                        <Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} disabled={isNonStandardFrame && currentTemplate.frameStyle !== 'custom'}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {(currentTemplate.frameStyle === 'standard' || currentTemplate.frameStyle === 'custom') 
                                            ? "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default." 
                                            : `Overridden by Frame Style ('${currentTemplate.frameStyle || 'none'}'). Set for 'Standard' or 'Custom Colors'.`}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor" className="text-xs">Base Text Color</Label>
                                        <Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })} disabled={isNonStandardFrame && currentTemplate.frameStyle !== 'custom'}/>
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                           {(currentTemplate.frameStyle === 'standard' || currentTemplate.frameStyle === 'custom') 
                                            ? "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default." 
                                            : `Overridden by Frame Style ('${currentTemplate.frameStyle || 'none'}'). Set for 'Standard' or 'Custom Colors'.`}
                                        </p>
                                    </div>
                                     <div>
                                        <Label htmlFor="legacyFrameColor" className="text-xs">Legacy Frame Color (Border)</Label>
                                        <Input id="legacyFrameColor" type="color" value={currentTemplate.legacyFrameColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ legacyFrameColor: e.target.value })} disabled={isNonStandardFrame && currentTemplate.frameStyle !== 'custom'} />
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {(isNonStandardFrame && currentTemplate.frameStyle !== 'custom')
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle}'). Set for 'Standard' or 'Custom Colors'.`
                                            : "Older border color. Prefer frame styles or individual section borders."}
                                        </p>
                                    </div>
                                     <div>
                                        <Label htmlFor="defaultSectionBorderColor" className="text-xs">Default Section Border Color</Label>
                                        <Input id="defaultSectionBorderColor" type="color" value={currentTemplate.defaultSectionBorderColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ defaultSectionBorderColor: e.target.value })} />
                                        <p className="text-xs text-muted-foreground mt-0.5">Fallback for individual section borders if they have a width but no specific color.</p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                 <CardFooter className="p-4 border-t flex justify-end">
                    <Button type="button" onClick={handleSubmit} className="flex items-center gap-2">
                        <Save className="h-4 w-4"/>
                        Save Template Settings
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Rows className="h-5 w-5 text-primary" /> Card Rows & Sections (Columns)
                </CardTitle>
                <CardDescription>Define rows, then add sections (columns) to each row. Use <code>{`{{placeholder}}`}</code> or <code>{`{{placeholder:"default"}}`}</code> for dynamic data.</CardDescription>
                </CardHeader>
                <CardContent className="pr-2"> 
                    <ScrollArea className="max-h-[calc(100vh-400px)] pr-1"> 
                        <Accordion
                            type="multiple"
                            value={activeRowAccordionItems}
                            onValueChange={setActiveRowAccordionItems}
                            className="w-full space-y-2"
                        >
                            {(currentTemplate.rows || []).map((row, rowIndex) => (
                            <AccordionItem value={row.id} key={row.id} id={`accordion-row-${row.id}`} className="border border-border bg-card/60 rounded-md overflow-hidden last:mb-0">
                               <div className="flex items-center w-full px-2 py-1 hover:bg-muted/30 rounded-t-md focus-within:ring-1 focus-within:ring-ring">
                                    <AccordionTrigger className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                            <span>Row {rowIndex + 1} ({row.columns.length} Column(s))</span>
                                        </div>
                                    </AccordionTrigger>
                                    <div className="flex gap-1 ml-2 flex-shrink-0">
                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'up')}} disabled={rowIndex === 0} aria-label="Move row up" className="h-7 w-7"><ArrowUp className="h-4 w-4" /></Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'down')}} disabled={rowIndex === (currentTemplate.rows || []).length - 1} aria-label="Move row down" className="h-7 w-7"><ArrowDown className="h-4 w-4" /></Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeRow(row.id)}} aria-label="Remove row" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                </div>
                                <AccordionContent className="p-3 space-y-4 border-t bg-card/30">
                                <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3'>
                                    <div>
                                        <Label htmlFor={`rowAlignItems-${row.id}`} className="text-xs">Row Vertical Alignment (columns)</Label>
                                        <Select value={row.alignItems || 'flex-start'} onValueChange={v => updateRow(row.id, {alignItems: v as CardRow['alignItems']})}>
                                            <SelectTrigger id={`rowAlignItems-${row.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                {ROW_ALIGN_ITEMS.map(item => (
                                                <SelectItem key={item.value} value={item.value} className="text-xs">{item.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor={`rowCustomHeight-${row.id}`} className="text-xs">Row Custom Height (e.g., 50px, 20%, auto)</Label>
                                        <Input id={`rowCustomHeight-${row.id}`} value={row.customHeight || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRow(row.id, { customHeight: e.target.value })} placeholder="e.g., 50px, 20%, auto" className="h-8 text-xs" />
                                    </div>
                                </div>

                                <h4 className="text-sm font-semibold flex items-center gap-2"><Columns className="h-4 w-4"/>Sections (Columns) in this Row:</h4>
                                {row.columns.length === 0 && <p className="text-xs text-muted-foreground">No sections (columns) in this row yet. Add one below.</p>}
                                <div className="space-y-3">
                                    {row.columns.map((section, sectionIndex) => (
                                        <ColumnEditor
                                            key={section.id}
                                            section={section}
                                            sectionIndex={sectionIndex}
                                            rowId={row.id}
                                            isFirstColumn={sectionIndex === 0}
                                            isLastColumn={sectionIndex === row.columns.length - 1}
                                            activeStylingAccordion={activeStylingAccordion}
                                            onToggleStylingAccordion={onToggleStylingAccordion}
                                            onUpdateSectionInRow={updateSectionInRow}
                                            onRemoveSectionFromRow={removeSectionFromRow}
                                            onMoveSectionInRow={moveSectionInRow}
                                        />
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <Select onValueChange={(value) => { if(value) addSectionToRow(row.id, value as CardSectionType)}}>
                                    <SelectTrigger className="w-full sm:w-auto text-xs h-9">
                                        <SelectValue placeholder="Add Section to this Row..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SECTION_TYPES.map(type => (
                                        <SelectItem key={type} value={type} className="text-xs"><PlusCircle className="inline mr-2 h-3 w-3"/>Add {type} Section</SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                </div>
                                </AccordionContent>
                            </AccordionItem>
                            ))}
                        </Accordion>
                    </ScrollArea>
                </CardContent>
                 <CardFooter className="p-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button type="button" onClick={addRow} variant="outline" className="w-full sm:w-auto flex items-center gap-2">
                        <PlusCircle className="h-4 w-4"/> Add New Row
                    </Button>
                     <Button type="button" onClick={handleSubmit} className="w-full sm:w-auto ml-auto flex items-center gap-2">
                        <Save className="h-4 w-4"/>
                        Save Template Structure
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-6 mb-6 pt-4 border-t">
                <h4 className="text-lg font-semibold mb-2 text-center">Live Template Preview</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">(Click row or section in preview to focus. Uses placeholder names or defaults.)</p>
                <div className="mx-auto max-w-xs">
                <CardPreview
                    card={{template: currentTemplate, data:livePreviewData, uniqueId: 'editor-preview'}}
                    isPrintMode={false}
                    isEditorPreview={true}
                    hideEmptySections={false}
                    onSectionClick={handleSectionClickFromPreview}
                    onRowClick={handleRowClickFromPreview}
                />
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

    