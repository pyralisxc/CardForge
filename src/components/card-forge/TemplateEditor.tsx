
"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TCGCardTemplate, CardSection, CardRow } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, Cog, Frame, Rows, Eye, Save, Edit2
} from 'lucide-react';
import {
  DEFAULT_TEMPLATES as PRESET_TEMPLATES, // Renamed for clarity
  FRAME_STYLES,
  ROW_ALIGN_ITEMS,
  createDefaultRow,
  createDefaultSection,
} from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from './CardPreview';
import { ColumnEditor } from './ColumnEditor';
import { nanoid } from 'nanoid';
import { cn } from "@/lib/utils";
import { extractUniquePlaceholderKeys } from '@/lib/utils';


export const getFreshDefaultTemplate = (id?: string, name?: string): TCGCardTemplate => {
  const newTemplateId = id || nanoid();
  const newTemplateName = name || "New Unsaved Template";

  // Use the first preset as a base for a fresh template if needed, or a very minimal structure
  const basePreset = PRESET_TEMPLATES.length > 0 ? JSON.parse(JSON.stringify(PRESET_TEMPLATES[0])) : null;

  const defaultRows = basePreset ? basePreset.rows.map((r: CardRow) => ({
    ...r,
    id: nanoid(), // Always new IDs for rows in a fresh template
    columns: r.columns.map((c: CardSection) => ({
      ...c,
      id: nanoid() // Always new IDs for columns in a fresh template
    }))
  })) : [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];


  return {
    id: newTemplateId,
    name: newTemplateName,
    aspectRatio: basePreset?.aspectRatio || "63:88",
    frameStyle: basePreset?.frameStyle || 'standard',
    baseBackgroundColor: basePreset?.baseBackgroundColor || '',
    baseTextColor: basePreset?.baseTextColor || '',
    defaultSectionBorderColor: basePreset?.defaultSectionBorderColor || '',
    cardBorderColor: basePreset?.cardBorderColor || '',
    cardBorderWidth: basePreset?.cardBorderWidth || '4px',
    cardBorderStyle: basePreset?.cardBorderStyle || 'solid',
    cardBorderRadius: basePreset?.cardBorderRadius || '0.5rem',
    rows: defaultRows,
  };
};


interface TemplateEditorProps {
  onSaveTemplate: (template: TCGCardTemplate) => void;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: TCGCardTemplate | null;
}

export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  const { toast } = useToast();

  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(() => getFreshDefaultTemplate());
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(null);
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || "63:88");
  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>([]);
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);


  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  const resetFormToNew = useCallback(() => {
    const newDefaultTemplate = getFreshDefaultTemplate();
    setCurrentTemplate(newDefaultTemplate);
    setSelectedTemplateToEditId(null); // Crucial to indicate it's a new, unsaved template
    setAspectRatioInput(newDefaultTemplate.aspectRatio || "63:88");
    setActiveRowAccordionItems((newDefaultTemplate.rows || []).map(r => r.id));
    setActiveStylingAccordion(null);
    toast({title: "Form Reset", description: "Ready to create a new template."});
  }, [toast]);


  useEffect(() => {
    let templateToProcess: TCGCardTemplate | undefined | null = null;

    if (initialTemplate && (!selectedTemplateToEditId || selectedTemplateToEditId === initialTemplate.id)) {
        templateToProcess = initialTemplate;
    } else if (selectedTemplateToEditId) {
        templateToProcess = templates.find(t => t.id === selectedTemplateToEditId);
    }

    let newTemplateToSet: TCGCardTemplate;

    if (templateToProcess) {
        // Deep clone and reconstruct the template to ensure all properties are present
        const loadedTemplateData = JSON.parse(JSON.stringify(templateToProcess));
        const baseForReconstruction = getFreshDefaultTemplate(loadedTemplateData.id, loadedTemplateData.name);
        
        newTemplateToSet = { ...baseForReconstruction, ...loadedTemplateData }; // Spread base first, then loaded

        newTemplateToSet.rows = (loadedTemplateData.rows || []).map((r_loaded: CardRow) => {
            const rowId = r_loaded.id; // MUST use existing ID from loaded data
            const freshRowBase = createDefaultRow(rowId); // Get fresh structure with this ID
            let newR: CardRow = { ...freshRowBase, ...r_loaded, id: rowId };

            newR.columns = (r_loaded.columns || []).map((c_loaded: CardSection) => {
                const sectionId = c_loaded.id; // MUST use existing ID
                const freshSectionBase = createDefaultSection(sectionId);
                let newC: CardSection = { ...freshSectionBase, ...c_loaded, id: sectionId };
                return newC;
            });
            return newR;
        });
    } else {
        // If no template to process (e.g., initial load, or selectedTemplateToEditId was invalid)
        // and not already editing the initialTemplate, reset to a fresh one.
        if (!initialTemplate || (selectedTemplateToEditId && !templates.find(t => t.id === selectedTemplateToEditId))) {
             newTemplateToSet = getFreshDefaultTemplate();
             setSelectedTemplateToEditId(null); // Clear selection if it was invalid
        } else if (initialTemplate && !selectedTemplateToEditId) {
            // This case might be redundant if initialTemplate handling above is robust
            newTemplateToSet = getFreshDefaultTemplate(initialTemplate.id, initialTemplate.name);
            const loadedInitial = JSON.parse(JSON.stringify(initialTemplate));
            newTemplateToSet = { ...newTemplateToSet, ...loadedInitial };
             newTemplateToSet.rows = (loadedInitial.rows || []).map((r_loaded: CardRow) => {
                const rowId = r_loaded.id; 
                const freshRowBase = createDefaultRow(rowId);
                let newR: CardRow = { ...freshRowBase, ...r_loaded, id: rowId };
                newR.columns = (r_loaded.columns || []).map((c_loaded: CardSection) => {
                    const sectionId = c_loaded.id;
                    const freshSectionBase = createDefaultSection(sectionId);
                    return { ...freshSectionBase, ...c_loaded, id: sectionId };
                });
                return newR;
            });

        } else {
            // Fallback if something is very wrong, should ideally not be hit
            newTemplateToSet = getFreshDefaultTemplate();
            setSelectedTemplateToEditId(null);
        }
    }
    
    setCurrentTemplate(newTemplateToSet);
    setAspectRatioInput(newTemplateToSet.aspectRatio || "63:88");
    
    // Only update accordion if the template ID actually changes to avoid collapsing user interactions
    // Or if it's a fresh template load (no selectedTemplateToEditId)
    if (currentTemplate.id !== newTemplateToSet.id || !selectedTemplateToEditId && !initialTemplate) {
      setActiveRowAccordionItems((newTemplateToSet.rows || []).map(r => r.id));
    }
    setActiveStylingAccordion(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, selectedTemplateToEditId, templates]);


  useEffect(() => {
    const ratioParts = aspectRatioInput.trim().split(':').map(Number);
    if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
        const newAspectRatio = `${ratioParts[0]}:${ratioParts[1]}`;
        if (currentTemplate.aspectRatio !== newAspectRatio ) {
             setCurrentTemplate(prev => ({ ...prev, aspectRatio: newAspectRatio }));
        }
    }
  }, [aspectRatioInput, currentTemplate.aspectRatio]);

  const updateCurrentTemplate = (updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  };

  const updateRow = (rowId: string, updates: Partial<CardRow>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => r.id === rowId ? { ...r, ...updates } : r),
    }));
  };

  const addRow = () => {
    const newRowId = nanoid();
    const newRow = createDefaultRow(newRowId, [createDefaultSection(nanoid())]);
    setCurrentTemplate(prev => ({ ...prev, rows: [...(prev.rows || []), newRow] }));
    setActiveRowAccordionItems(prevActive => [...prevActive, newRowId]);
  };

  const removeRow = (rowId: string) => {
    setCurrentTemplate(prev => ({ ...prev, rows: (prev.rows || []).filter(r => r.id !== rowId) }));
    setActiveRowAccordionItems(prevActive => prevActive.filter(id => id !== rowId));
  };

  const moveRow = (rowId: string, direction: 'up' | 'down') => {
    setCurrentTemplate(prev => {
        const rows = [...(prev.rows || [])];
        const index = rows.findIndex(r => r.id === rowId);
        if (index === -1) return prev;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= rows.length) return prev;

        [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
        return { ...prev, rows };
    });
  };

  const addSectionToRow = (rowId: string) => {
    const newSectionId = nanoid();
    const newSection = createDefaultSection(newSectionId); // Simplified call
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: [...(r.columns || []), newSection] } : r
      )
    }));
    setActiveStylingAccordion(newSectionId);
    if (!activeRowAccordionItems.includes(rowId)) {
        setActiveRowAccordionItems(prev => [...prev, rowId]);
    }
  };

  const removeSectionFromRow = (rowId: string, sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: (r.columns || []).filter(s => s.id !== sectionId) } : r
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
        ? { ...r, columns: (r.columns || []).map(s => s.id === sectionId ? { ...s, ...updates } : s) }
        : r
      )
    }));
  }, []);

  const moveSectionInRow = (rowId: string, sectionId: string, direction: 'left' | 'right') => {
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r => {
        if (r.id === rowId) {
          const sectionIndex = (r.columns || []).findIndex(s => s.id === sectionId);
          if (sectionIndex === -1) return r;

          const newColumns = [...(r.columns || [])];
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
  };

  const handleSelectTemplateToEdit = (templateId: string) => {
    setSelectedTemplateToEditId(templateId);
    const selectedTpl = templates.find(t => t.id === templateId);
    if (selectedTpl) {
        setActiveRowAccordionItems((selectedTpl.rows || []).map(r => r.id)); // Expand rows of selected template
    }
    setActiveStylingAccordion(null);
  };

  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
        // Create a truly new instance from the preset with new IDs
        const newPresetTemplate = getFreshDefaultTemplate(nanoid(), preset.name); // Give it a new ID and base name
        // Deep clone the structure from the preset
        const presetStructure = JSON.parse(JSON.stringify(preset));

        // Overlay specific properties from the preset onto the fresh template
        const finalTemplateFromPreset: TCGCardTemplate = {
            ...newPresetTemplate, // Has fresh IDs for template, rows, sections by default from getFreshDefaultTemplate
            name: preset.name, // Use preset name
            aspectRatio: preset.aspectRatio,
            frameStyle: preset.frameStyle,
            baseBackgroundColor: preset.baseBackgroundColor,
            baseTextColor: preset.baseTextColor,
            defaultSectionBorderColor: preset.defaultSectionBorderColor,
            cardBorderColor: preset.cardBorderColor,
            cardBorderWidth: preset.cardBorderWidth,
            cardBorderStyle: preset.cardBorderStyle,
            cardBorderRadius: preset.cardBorderRadius,
            // Important: Use the rows from the preset, but ensure they get *new* IDs
            // if getFreshDefaultTemplate doesn't already do this for nested structures.
            // The current getFreshDefaultTemplate already creates new IDs for default rows/sections.
            // So we just need to map the structure.
            rows: presetStructure.rows.map((r_preset: CardRow) => ({
                ...createDefaultRow(nanoid()), // Ensure all row props from createDefaultRow are present
                ...r_preset, // Overlay preset row data
                id: nanoid(), // New row ID
                columns: r_preset.columns.map((c_preset: CardSection) => ({
                    ...createDefaultSection(nanoid()), // Ensure all section props from createDefaultSection are present
                    ...c_preset, // Overlay preset section data
                    id: nanoid(), // New section ID
                }))
            }))
        };

        setCurrentTemplate(finalTemplateFromPreset);
        setSelectedTemplateToEditId(finalTemplateFromPreset.id); // Mark it as if we are "editing" this newly loaded preset
        setAspectRatioInput(finalTemplateFromPreset.aspectRatio || "63:88");
        setActiveRowAccordionItems((finalTemplateFromPreset.rows || []).map(r => r.id));
        setActiveStylingAccordion(null);
        toast({ title: "Preset Loaded", description: `"${preset.name}" structure loaded. Save to keep this as a new template or overwrite an existing one.`});
    }
};


  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    if (currentTemplate && currentTemplate.rows) {
        extractUniquePlaceholderKeys(currentTemplate).forEach(placeholder => {
            // For editor preview, show the key itself for clarity.
            data[placeholder.key] = `{{${placeholder.key}}}`;
            if (placeholder.defaultValue) {
                 data[placeholder.key] = `{{${placeholder.key}:"${placeholder.defaultValue}"}}`;
            }
        });
    }
    return data;
  }, [currentTemplate]);

  const handleRowClickFromPreview = (rowId: string) => {
    setActiveRowAccordionItems(prev => {
      if (prev.includes(rowId) && prev.length === 1 && activeRowAccordionItems.length === 1) return prev; // Don't collapse if it's the only one open
      return [rowId]; // Focus on this row
    });
    setActiveStylingAccordion(null); // Close styling for sections if a row is clicked
    setTimeout(() => {
      const itemElement = document.getElementById(`accordion-row-${rowId}`);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },0);
  };

  const handleSectionClickFromPreview = (sectionId: string) => {
    const parentRow = (currentTemplate.rows || []).find(r => (r.columns || []).some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)){
        setActiveRowAccordionItems([parentRow.id]); // Ensure parent row is open
    }
    onToggleStylingAccordion(sectionId); // Toggle or open styling for this section
     setTimeout(() => {
      const sectionEditorElement = document.getElementById(`accordion-section-styling-${sectionId}`); // Target the styling accordion item
      sectionEditorElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const isNonCustomizableFrame = currentTemplate.frameStyle && currentTemplate.frameStyle !== 'standard' && currentTemplate.frameStyle !== 'custom';
  
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
                  <SelectItem key={preset.id} value={preset.name}>{preset.name}</SelectItem>
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
                        className={cn(
                            "cursor-pointer flex-grow",
                            selectedTemplateToEditId === template.id ? 'font-semibold text-primary' : ''
                        )}
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
                      }} aria-label={`Delete template ${template.name}`} className="h-7 w-7">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
           {templates.length === 0 && <p className="text-muted-foreground text-sm mt-2">No custom templates saved yet.</p>}
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
                        <Input id="templateName" value={currentTemplate.name || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., My Awesome TCG Template" required />
                    </div>
                     <div>
                        <Label htmlFor="templateAspectRatio" className="text-sm">Aspect Ratio (W:H)</Label>
                        <Input
                            id="templateAspectRatio"
                            value={aspectRatioInput}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAspectRatioInput(e.target.value)}
                            placeholder="e.g., 63:88 (Standard TCG)"
                        />
                         <p className="text-xs text-muted-foreground mt-1">Effective: {currentTemplate.aspectRatio || "Not set"}. Standard TCG is 63:88.</p>
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
                                        <Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || '#FFFFFF'} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                           {(currentTemplate.frameStyle === 'standard' || currentTemplate.frameStyle === 'custom')
                                            ? "Applies to 'Standard' and 'Custom Colors' frames. Leave empty or use #FFFFFF for default white/theme card."
                                            : `Overridden by Frame Style ('${currentTemplate.frameStyle}'). Set this if you plan to switch back.`}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor" className="text-xs">Base Text Color</Label>
                                        <Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || '#000000'} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })} disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                            {(currentTemplate.frameStyle === 'standard' || currentTemplate.frameStyle === 'custom')
                                            ? "Applies to 'Standard' and 'Custom Colors' frames. Leave empty or use #000000 for default black/theme foreground."
                                            : `Overridden by Frame Style ('${currentTemplate.frameStyle}'). Set this if you plan to switch back.`}
                                        </p>
                                    </div>
                                     <div>
                                        <Label htmlFor="cardBorderColor" className="text-xs">Card Outer Border Color</Label>
                                        <Input id="cardBorderColor" type="color" value={currentTemplate.cardBorderColor || ''} onChange={(e) => updateCurrentTemplate({ cardBorderColor: e.target.value })} />
                                        <p className="text-xs text-muted-foreground mt-0.5">May be overridden by specific Frame Styles.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderWidth" className="text-xs">Card Outer Border Width</Label>
                                        <Input id="cardBorderWidth" value={currentTemplate.cardBorderWidth || ''} onChange={(e) => updateCurrentTemplate({ cardBorderWidth: e.target.value })} placeholder="e.g., 4px, 0"/>
                                        <p className="text-xs text-muted-foreground mt-0.5">May be overridden by specific Frame Styles.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderStyle" className="text-xs">Card Outer Border Style</Label>
                                        <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={v => updateCurrentTemplate({cardBorderStyle: (v === '_default_' ? undefined : v as TCGCardTemplate['cardBorderStyle'])}) }>
                                            <SelectTrigger id="cardBorderStyle"><SelectValue/></SelectTrigger>
                                            <SelectContent>{CARD_BORDER_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-0.5">May be overridden by specific Frame Styles.</p>
                                    </div>
                                     <div>
                                        <Label htmlFor="cardBorderRadius" className="text-xs">Card Corner Radius</Label>
                                        <Input id="cardBorderRadius" value={currentTemplate.cardBorderRadius || ''} onChange={(e) => updateCurrentTemplate({ cardBorderRadius: e.target.value })} placeholder="e.g., 8px, 0.5rem"/>
                                        <p className="text-xs text-muted-foreground mt-0.5">May be overridden by specific Frame Styles.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="defaultSectionBorderColor" className="text-xs">Default Section Fallback Border Color</Label>
                                        <Input id="defaultSectionBorderColor" type="color" value={currentTemplate.defaultSectionBorderColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ defaultSectionBorderColor: e.target.value })} />
                                        <p className="text-xs text-muted-foreground mt-0.5">Fallback for individual section borders if they have width but no specific color set.</p>
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
                    <Rows className="h-5 w-5 text-primary" /> Card Rows &amp; Sections (Columns)
                </CardTitle>
                <CardDescription>Define rows, then add sections (columns) to each row. Use <code>{"{{placeholder}}"}</code> or <code>{"{{placeholder:\"default\"}}"}</code> for dynamic data.</CardDescription>
                </CardHeader>
                <CardContent className="pr-0">
                    <ScrollArea className="h-[60vh] w-full">
                        <Accordion
                            type="multiple"
                            value={activeRowAccordionItems}
                            onValueChange={setActiveRowAccordionItems}
                            className="w-full space-y-2 pr-3"
                        >
                            {(currentTemplate.rows || []).map((row, rowIndex) => (
                            <AccordionItem value={row.id} key={row.id} id={`accordion-row-${row.id}`} className="border border-border bg-card/60 rounded-md overflow-hidden last:mb-0">
                               <div className="flex items-center w-full px-2 py-1 hover:bg-muted/30 rounded-t-md focus-within:ring-1 focus-within:ring-ring">
                                    <AccordionTrigger className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                             {/* <GripVertical className="h-4 w-4 text-muted-foreground" /> Re-add if needed */}
                                            <span>Row {rowIndex + 1} ({ (row.columns || []).length} Column(s))</span>
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

                                <h4 className="text-sm font-semibold flex items-center gap-2">Sections (Columns) in this Row:</h4>
                                {(row.columns || []).length === 0 && <p className="text-xs text-muted-foreground">No sections (columns) in this row yet. Add one below.</p>}
                                <div className="space-y-3">
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
                                            onUpdateSectionInRow={updateSectionInRow}
                                            onRemoveSectionFromRow={removeSectionFromRow}
                                            onMoveSectionInRow={moveSectionInRow}
                                        />
                                    ))}
                                </div>
                                <div className="mt-3">
                                    <Button type="button" variant="outline" size="sm" onClick={() => addSectionToRow(row.id)} className="flex items-center gap-1.5 text-xs">
                                        <PlusCircle className="h-3.5 w-3.5"/> Add New Section to this Row
                                    </Button>
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
                <p className="text-xs text-muted-foreground text-center mb-3">(Click row or section in preview to focus. Shows placeholder names and defaults.)</p>
                <div className="mx-auto max-w-xs flex justify-center">
                    <CardPreview
                        card={{template: currentTemplate, data:livePreviewData, uniqueId: 'editor-preview'}}
                        isPrintMode={false}
                        isEditorPreview={true}
                        hideEmptySections={false}
                        onSectionClick={handleSectionClickFromPreview}
                        onRowClick={handleRowClickFromPreview}
                    />
                </div>
                 <div className="flex justify-center mt-4">
                    <Button onClick={() => setIsPreviewDialogOpen(true)} variant="outline">
                        <Eye className="mr-2 h-4 w-4" /> View Full Size Preview
                    </Button>
                 </div>
            </div>
             {isPreviewDialogOpen && (
                <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                    <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Full Size Template Preview: {currentTemplate.name || "Untitled"}</DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center p-4 my-auto">
                            <CardPreview
                                card={{ template: currentTemplate, data: livePreviewData, uniqueId: 'full-editor-preview-dialog' }}
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
      )}
    </div>
  );
}
