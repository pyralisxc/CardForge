
"use client";

import type { ChangeEvent, ElementType } from 'react';
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
  LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, Cog, Frame, Rows, Eye, Save, Edit2, GripVertical
} from 'lucide-react';
import {
  TCG_ASPECT_RATIO,
  DEFAULT_TEMPLATES as PRESET_TEMPLATES, // Correctly import and alias
  FRAME_STYLES,
  ROW_ALIGN_ITEMS,
  createDefaultRow,
  createDefaultSection,
  CARD_BORDER_STYLES,
} from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from './CardPreview';
import { ColumnEditor } from './ColumnEditor';
import { nanoid } from 'nanoid';
import { cn } from "@/lib/utils";
import { extractUniquePlaceholderKeys } from '@/lib/utils';


export const getFreshDefaultTemplate = (id?: string, name?: string): TCGCardTemplate => {
  const newTemplateId = id || nanoid();
  // Use a static default name to prevent hydration issues from Date.now() or similar
  const newTemplateName = name || "New Unsaved Template";

  const baseTemplate: TCGCardTemplate = {
    id: newTemplateId,
    name: newTemplateName,
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    legacyFrameColor: '',
    borderColor: '', // This was the old property, will be defaultSectionBorderColor
    defaultSectionBorderColor: '',
    cardBorderColor: '',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    rows: [],
  };

  // Initialize with one basic row and one basic section for a new template
   baseTemplate.rows = [
    createDefaultRow(nanoid(), [createDefaultSection(nanoid())])
  ];

  return baseTemplate;
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
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || TCG_ASPECT_RATIO);

  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>([]);
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);


  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  const resetFormToNew = useCallback(() => {
    const newDefaultTemplate = getFreshDefaultTemplate();
    setCurrentTemplate(newDefaultTemplate);
    setSelectedTemplateToEditId(null);
    setAspectRatioInput(newDefaultTemplate.aspectRatio || TCG_ASPECT_RATIO);
    setActiveRowAccordionItems((newDefaultTemplate.rows || []).map(r => r.id));
    setActiveStylingAccordion(null);
    toast({title: "Form Reset", description: "Ready to create a new template."});
  }, [toast]);


  useEffect(() => {
    let templateToLoad: TCGCardTemplate | null = null;
    let source = "new"; // For debugging or clarity

    if (initialTemplate) {
        if (!selectedTemplateToEditId || selectedTemplateToEditId === initialTemplate.id) {
            templateToLoad = initialTemplate;
            source = "initialProp";
        } else {
            // initialTemplate is present but a different template is selected by ID
            const found = templates.find(t => t.id === selectedTemplateToEditId);
            if (found) {
                templateToLoad = found;
                source = "selectedIdFromProp";
            }
        }
    } else if (selectedTemplateToEditId) {
        const found = templates.find(t => t.id === selectedTemplateToEditId);
        if (found) {
            templateToLoad = found;
            source = "selectedId";
        }
    }

    let templateToSet: TCGCardTemplate;

    if (templateToLoad) {
        // Deep clone and reconstruct to ensure all properties are present and defaults applied
        const baseForLoaded = getFreshDefaultTemplate(templateToLoad.id, templateToLoad.name);
        const clonedTemplateToLoad = JSON.parse(JSON.stringify(templateToLoad)); // Deep clone

        templateToSet = { ...baseForLoaded, ...clonedTemplateToLoad }; // Spread loaded over full default base
        templateToSet.id = baseForLoaded.id; // Ensure original ID is kept
        templateToSet.name = baseForLoaded.name; // Ensure original name is kept (or name from prop)

        templateToSet.rows = (clonedTemplateToLoad.rows || []).map((r_loaded: Partial<CardRow> & { id: string }) => {
            // Ensure rowId is strictly from loaded data, or fallback to nanoid IF AND ONLY IF it's truly a new row context (should not happen here)
            const rowId = r_loaded.id; // Must have an ID from prop
            const baseRow = createDefaultRow(rowId); // Pass ID to get a default row with this ID
            
            let newR: CardRow = { ...baseRow, ...r_loaded }; // Spread loaded row over default
            newR.id = rowId; // Re-assert ID

            newR.columns = (newR.columns || []).map((c_loaded: Partial<CardSection> & { id: string }) => {
                const sectionId = c_loaded.id; // Must have an ID from prop
                // Pass sectionType if available, otherwise createDefaultSection will use its own default
                const baseCol = createDefaultSection(sectionId); 
                
                let newC: CardSection = { ...baseCol, ...c_loaded }; // Spread loaded column over default
                newC.id = sectionId; // Re-assert ID
                return newC;
            });
            if (newR.columns.length === 0 && r_loaded.columns?.length === 0) { // Only add default if truly empty
                 newR.columns = [createDefaultSection(nanoid())];
            }
            return newR;
        });
        if (templateToSet.rows.length === 0 && clonedTemplateToLoad.rows?.length === 0) { // Only add if truly empty
            templateToSet.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];
        }

    } else {
        templateToSet = getFreshDefaultTemplate();
        if (selectedTemplateToEditId && !templates.find(t => t.id === selectedTemplateToEditId)) {
            setSelectedTemplateToEditId(null); // Clear selection if template not found after all
        }
    }
    
    setCurrentTemplate(templateToSet);
    setAspectRatioInput(templateToSet.aspectRatio || TCG_ASPECT_RATIO);

    // Only update accordion items if the template ID actually changes or it's a new template.
    const isNewOrDifferentTemplate = currentTemplate?.id !== templateToSet.id || source === "new";
    if (isNewOrDifferentTemplate) {
      setActiveRowAccordionItems((templateToSet.rows || []).map(r => r.id));
    }
    if (activeStylingAccordion && !(templateToSet.rows || []).flatMap(r => r.columns || []).find(s => s.id === activeStylingAccordion)) {
        setActiveStylingAccordion(null);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, selectedTemplateToEditId, templates, resetFormToNew]); // currentTemplate.id removed to prevent loops


  useEffect(() => {
    const ratioParts = aspectRatioInput.trim().split(':').map(Number);
    if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
        const newAspectRatio = `${ratioParts[0]}:${ratioParts[1]}`;
        if (currentTemplate.aspectRatio !== newAspectRatio ) {
             updateCurrentTemplate({ aspectRatio: newAspectRatio });
        }
    } else if (aspectRatioInput.trim() === "" && currentTemplate.aspectRatio !== TCG_ASPECT_RATIO) {
         updateCurrentTemplate({ aspectRatio: TCG_ASPECT_RATIO });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatioInput]);


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
    const newSection = createDefaultSection(newSectionId);
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: [...(r.columns || []), newSection] } : r
      )
    }));
    setActiveStylingAccordion(newSectionId); // Open styling for the new section
    if (!activeRowAccordionItems.includes(rowId)) {
        setActiveRowAccordionItems(prev => [...prev, rowId]); // Ensure parent row is open
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
    onSaveTemplate(templateToSave);
  };

  const handleSelectTemplateToEdit = (templateId: string) => {
    setSelectedTemplateToEditId(templateId);
    const selectedTpl = templates.find(t => t.id === templateId);
    if (selectedTpl && selectedTpl.rows) { // Check if rows exist
      setActiveRowAccordionItems(selectedTpl.rows.map(r => r.id));
    } else if (selectedTpl) { // Rows might be undefined or empty
      setActiveRowAccordionItems([]);
    } else {
      resetFormToNew(); // If template not found, reset
    }
    setActiveStylingAccordion(null);
  };

  const handleTemplatePresetChange = (presetId: string) => {
     if (PRESET_TEMPLATES.length === 0 || !PRESET_TEMPLATES.find(p => p.id === presetId)) {
      toast({ title: "No Preset Found", description: `Could not find selected preset or no presets available.`, variant: "default" });
      return;
    }
    const presetTemplate = PRESET_TEMPLATES.find(t => t.id === presetId);
    if (presetTemplate) {
        const clonedPreset = JSON.parse(JSON.stringify(presetTemplate));
        const newId = nanoid(); // Ensure a new ID for the copy
        clonedPreset.id = newId;
        clonedPreset.name = `${clonedPreset.name || 'Preset'} (Copy)`;
        (clonedPreset.rows || []).forEach((row: CardRow) => {
            row.id = nanoid(); // New IDs for rows
            (row.columns || []).forEach((col: CardSection) => {
                col.id = nanoid(); // New IDs for sections
            });
        });

        const fullyReconstructedPreset: TCGCardTemplate = {
          ...getFreshDefaultTemplate(clonedPreset.id, clonedPreset.name),
          ...clonedPreset, // Spread the cloned preset over the fresh base
          rows: (clonedPreset.rows || []).map((r_loaded: Partial<CardRow> & {id: string}) => {
            const baseRow = createDefaultRow(r_loaded.id); // Use new ID
            const newR: CardRow = { ...baseRow, ...r_loaded };
            newR.id = r_loaded.id; // Re-assert

            newR.columns = (newR.columns || []).map((c_loaded: Partial<CardSection> & {id: string}) => {
                const baseCol = createDefaultSection(c_loaded.id); // Use new ID
                let newC: CardSection = { ...baseCol, ...c_loaded };
                newC.id = c_loaded.id; // Re-assert
                return newC;
            });
            if(newR.columns.length === 0 && r_loaded.columns?.length === 0) newR.columns = [createDefaultSection(nanoid())];
            return newR;
          })
        };
        if(fullyReconstructedPreset.rows.length === 0 && clonedPreset.rows?.length === 0) {
            fullyReconstructedPreset.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];
        }


        setCurrentTemplate(fullyReconstructedPreset);
        setSelectedTemplateToEditId(null);
        setAspectRatioInput(fullyReconstructedPreset.aspectRatio || TCG_ASPECT_RATIO);
        setActiveRowAccordionItems((fullyReconstructedPreset.rows || []).map(r => r.id));
        setActiveStylingAccordion(null);
        toast({ title: "Preset Loaded", description: `"${presetTemplate.name}" structure loaded as a new copy. Save to keep it.`});
    }
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


  const handleRowClickFromPreview = (rowId: string) => {
    setActiveRowAccordionItems(prev => {
      if (prev.includes(rowId) && prev.length === 1 && activeRowAccordionItems.length === 1) return prev;
      return [rowId];
    });
    setActiveStylingAccordion(null);
    setTimeout(() => {
      const itemElement = document.getElementById(`accordion-row-${rowId}`);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },0);
  };

  const handleSectionClickFromPreview = (sectionId: string) => {
    const parentRow = (currentTemplate.rows || []).find(r => (r.columns || []).some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)){
        setActiveRowAccordionItems([parentRow.id]);
    }
    onToggleStylingAccordion(sectionId);
     setTimeout(() => {
      const sectionEditorElement = document.getElementById(`accordion-section-styling-${sectionId}`);
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
            <Select onValueChange={handleTemplatePresetChange} value="">
              <SelectTrigger id="templatePresetSelect">
                <SelectValue placeholder={PRESET_TEMPLATES.length > 0 ? "Choose a preset..." : "No presets available"} />
              </SelectTrigger>
              <SelectContent>
                {PRESET_TEMPLATES.length > 0 ? (
                  PRESET_TEMPLATES.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-presets" disabled>No presets available</SelectItem>
                )}
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
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplateToEdit(template.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit template ${template.name || 'Unnamed Template'}`}
                      >
                        {template.name || 'Unnamed Template'}
                      </span>
                      <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(template.id);
                          if (selectedTemplateToEditId === template.id) resetFormToNew();
                      }} aria-label={`Delete template ${template.name || 'Unnamed Template'}`} className="h-7 w-7">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
           {(templates.length === 0 && PRESET_TEMPLATES.length === 0) && <p className="text-muted-foreground text-sm mt-2">No custom templates saved. Click "Create New Template" to start.</p>}
        </CardContent>
      </Card>

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
                    <Accordion type="single" collapsible className="w-full" defaultValue="overall-styling-accordion-item">
                        <AccordionItem value="overall-styling-accordion-item" id="overall-styling-accordion-item" className="border rounded-md">
                             <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline">
                                <div className="flex items-center gap-2"><Cog className="h-4 w-4" /> Overall Card Styling</div>
                            </AccordionTrigger>
                            <AccordionContent className="p-3 space-y-3 border-t">
                                 <div>
                                    <Label htmlFor="templateAspectRatio" className="text-xs">Aspect Ratio (W:H)</Label>
                                    <Input
                                        id="templateAspectRatio"
                                        value={aspectRatioInput}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setAspectRatioInput(e.target.value)}
                                        placeholder="e.g., 63:88 (Standard TCG)"
                                        className="h-8 text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Effective: {currentTemplate.aspectRatio || "Not set"}. Standard TCG is 63:88.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <Label htmlFor="templateFrameStyle" className="text-xs">Card Frame Style</Label>
                                        <Select value={currentTemplate.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                            <SelectTrigger id="templateFrameStyle" className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                     <div>
                                        <Label htmlFor="baseBgColor" className="text-xs">Base Background Color</Label>
                                        <Input id="baseBgColor" type="color" className="h-8 w-full" value={currentTemplate.baseBackgroundColor || ''}
                                               onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })}
                                               disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'} />
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}'). Set if switching to 'Standard' or 'Custom Colors'.`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor" className="text-xs">Base Text Color</Label>
                                        <Input id="baseTextColor" type="color" className="h-8 w-full" value={currentTemplate.baseTextColor || ''}
                                               onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })}
                                               disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'} />
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                            {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}'). Set if switching to 'Standard' or 'Custom Colors'.`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="defaultSectionBorderColor" className="text-xs">Default Section Fallback Border Color</Label>
                                        <Input id="defaultSectionBorderColor" type="color" className="h-8 w-full" value={currentTemplate.defaultSectionBorderColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ defaultSectionBorderColor: e.target.value })} />
                                        <p className="text-xs text-muted-foreground mt-0.5">Fallback for individual section borders if they have width but no specific color.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderColor" className="text-xs">Card Outer Border Color</Label>
                                        <Input id="cardBorderColor" type="color" className="h-8 w-full" value={currentTemplate.cardBorderColor || ''} onChange={e => updateCurrentTemplate({cardBorderColor: e.target.value})}
                                          disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">For 'Standard'/'Custom' frames. May be overridden by other Frame Styles.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderWidth" className="text-xs">Card Outer Border Width</Label>
                                        <Input id="cardBorderWidth" value={currentTemplate.cardBorderWidth || ''} onChange={e => updateCurrentTemplate({cardBorderWidth: e.target.value})} placeholder="e.g., 4px, 0"
                                          className="h-8 text-xs"
                                          disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">E.g., "4px". May be overridden by Frame Styles.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderStyle" className="text-xs">Card Outer Border Style</Label>
                                        <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={v => updateCurrentTemplate({cardBorderStyle: (v === '_default_' ? undefined : v as TCGCardTemplate['cardBorderStyle'])}) }
                                           disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}
                                        >
                                            <SelectTrigger id="cardBorderStyle" className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>{CARD_BORDER_STYLES.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-0.5">May be overridden by specific Frame Styles.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderRadius" className="text-xs">Card Corner Radius</Label>
                                        <Input id="cardBorderRadius" value={currentTemplate.cardBorderRadius || ''} onChange={e => updateCurrentTemplate({cardBorderRadius: e.target.value})} placeholder="e.g., 8px, 0.5rem"
                                          className="h-8 text-xs"
                                           disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">May be overridden by Frame Styles.</p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                 <CardFooter className="p-4 border-t flex justify-end">
                    <Button type="button" onClick={handleSubmit} className="flex items-center gap-2">
                        <Save className="h-4 w-4"/>
                        Save Full Template
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Rows className="h-5 w-5 text-primary" /> Card Rows &amp; Sections (Columns)
                </CardTitle>
                <CardDescription>Define rows, then add sections (columns) to each row.</CardDescription>
                </CardHeader>
                <CardContent className="pr-0">
                    <ScrollArea className="h-[60vh] w-full">
                        <Accordion
                            type="multiple"
                            value={activeRowAccordionItems}
                            onValueChange={setActiveRowAccordionItems}
                            className="w-full space-y-2 pr-2"
                        >
                            {(currentTemplate.rows || []).map((row, rowIndex) => (
                            <AccordionItem value={row.id} key={row.id} id={`accordion-row-${row.id}`} className="border border-border bg-card/60 rounded-md overflow-hidden last:mb-0">
                               <div className="flex items-center w-full px-2 py-1 hover:bg-muted/30 rounded-t-md focus-within:ring-1 focus-within:ring-ring">
                                    <AccordionTrigger className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                            <span>Row {rowIndex + 1} ({ (row.columns || []).length} Column(s))</span>
                                        </div>
                                    </AccordionTrigger>
                                    <div className="flex gap-1 ml-2 flex-shrink-0">
                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'up')}} disabled={rowIndex === 0} aria-label="Move row up" className="h-7 w-7"><ArrowUp className="h-4 w-4" /></Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'down')}} disabled={rowIndex === (currentTemplate.rows || []).length - 1} aria-label="Move row down" className="h-7 w-7"><ArrowDown className="h-4 w-4" /></Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeRow(row.id)}} aria-label="Remove row" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                </div>
                                <AccordionContent className="p-3 space-y-4 border-t bg-background/70">
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
                                        <Label htmlFor={`rowCustomHeight-${row.id}`} className="text-xs">Row Custom Height (e.g., 100px, 20%, auto)</Label>
                                        <Input id={`rowCustomHeight-${row.id}`} value={row.customHeight || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRow(row.id, { customHeight: e.target.value })} placeholder="e.g., 100px, 20%, auto" className="h-8 text-xs" />
                                    </div>
                                </div>

                                <h4 className="text-sm font-semibold flex items-center gap-2 pt-2 border-t mt-3">
                                     Sections (Columns) in this Row:
                                </h4>
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
                                     <Button onClick={() => addSectionToRow(row.id)} variant="outline" size="sm" className="flex items-center gap-2">
                                        <PlusCircle className="h-4 w-4"/>Add New Section to this Row
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
                    <Button type="button" onClick={handleSubmit} className="w-full sm:w-auto flex items-center gap-2 ml-auto">
                        <Save className="h-4 w-4"/>
                        Save Template Structure
                    </Button>
                 </CardFooter>
            </Card>

            <div className="mt-6 mb-6 pt-4 border-t">
                <h4 className="text-lg font-semibold mb-2 text-center">Live Template Preview</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">(Click row or section in preview to focus.)</p>
                <div className="mx-auto max-w-xs flex justify-center">
                    <CardPreview
                        card={{template: currentTemplate, data:livePreviewData, uniqueId: 'editor-preview'}}
                        isPrintMode={false}
                        isEditorPreview={true}
                        hideEmptySections={false}
                        onSectionClick={handleSectionClickFromPreview}
                        onRowClick={handleRowClickFromPreview}
                        targetWidthPx={280}
                    />
                </div>
                 <div className="flex justify-center mt-4">
                    <Button onClick={() => setIsPreviewDialogOpen(true)} variant="outline" className="flex items-center gap-2">
                        <Eye className="h-4 w-4" /> View Full Size Preview
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
    </div>
  );
}

