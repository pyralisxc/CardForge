
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
  Trash2, PlusCircle, ArrowUp, ArrowDown, Edit2, XCircle, GripVertical, 
  Settings, Paintbrush, Rows, Save, Cog, Columns, LayoutDashboard,
  ArrowLeft, ArrowRight // Make sure ArrowLeft and ArrowRight are imported if used in ColumnEditor
} from 'lucide-react';
import { 
  SECTION_TYPES, ICON_MAP, FRAME_STYLES, ROW_ALIGN_ITEMS, 
  createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES, createDefaultRow
} from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from './CardPreview';
import { extractUniquePlaceholderKeys, cn } from '@/lib/utils';
import { ColumnEditor } from './ColumnEditor';
import { nanoid } from 'nanoid';

interface TemplateEditorProps {
  onSaveTemplate: (template: TCGCardTemplate) => void;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: TCGCardTemplate | null;
}

const getFreshDefaultTemplate = (id?: string, name?: string): TCGCardTemplate => {
  const preset = PRESET_TEMPLATES.find(t => t.id === 'sfc-v6-stable-id') || PRESET_TEMPLATES[0] || {
    id: 'fallback-preset-id',
    name: 'Fallback Preset',
    aspectRatio: '63:88',
    frameStyle: 'standard',
    rows: [createDefaultRow('fallback-row-id', [createDefaultSection('CardName', 'fallback-section-id')])]
  };
  
  const newTemplateBase = JSON.parse(JSON.stringify(preset)) as TCGCardTemplate; 
  
  const newTemplateId = id || nanoid();
  const newTemplateName = name || "New Unsaved Template";

  const newRows = (newTemplateBase.rows || []).map((rowPreset) => {
    const newRowId = rowPreset.id; 
    const baseRow = createDefaultRow(newRowId, [], rowPreset.alignItems, rowPreset.customHeight);
    return {
      ...baseRow,
      ...rowPreset,
      id: newRowId,
      columns: (rowPreset.columns || []).map((colPreset) => {
        const newColId = colPreset.id; 
        const baseCol = createDefaultSection(colPreset.type || 'CustomText', newColId);
        return {
          ...baseCol,
          ...colPreset,
          id: newColId,
          type: colPreset.type || 'CustomText'
        };
      }),
    };
  });

  return {
    id: newTemplateId,
    name: newTemplateName,
    aspectRatio: newTemplateBase.aspectRatio || "63:88",
    frameStyle: newTemplateBase.frameStyle || 'standard',
    baseBackgroundColor: newTemplateBase.baseBackgroundColor || '',
    baseTextColor: newTemplateBase.baseTextColor || '',
    defaultSectionBorderColor: newTemplateBase.defaultSectionBorderColor || '',
    cardBorderColor: newTemplateBase.cardBorderColor || '',
    cardBorderWidth: newTemplateBase.cardBorderWidth || '',
    cardBorderStyle: newTemplateBase.cardBorderStyle || 'solid',
    cardBorderRadius: newTemplateBase.cardBorderRadius || '',
    rows: newRows,
  };
};


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
  
  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  useEffect(() => {
    let templateToLoad: TCGCardTemplate | undefined | null = null;
    let source: 'initial' | 'selected' | 'new' = 'new';

    if (initialTemplate && (!selectedTemplateToEditId || selectedTemplateToEditId !== initialTemplate.id)) {
        templateToLoad = initialTemplate;
        setSelectedTemplateToEditId(initialTemplate.id); // Align selection with initial if it's different
        source = 'initial';
    } else if (selectedTemplateToEditId) {
        templateToLoad = templates.find(t => t.id === selectedTemplateToEditId);
        source = templateToLoad ? 'selected' : 'new'; // If not found, treat as new
    }

    if (!templateToLoad && selectedTemplateToEditId && source === 'new') {
        // A specific ID was selected, but not found in templates array, and wasn't initialTemplate
        // This implies user might have deleted it, or it's a fresh ID for a new template.
        // We use selectedTemplateToEditId to ensure the new template gets this ID.
        templateToLoad = getFreshDefaultTemplate(selectedTemplateToEditId);
    } else if (!templateToLoad) {
        // No selection, no initial, create a truly fresh new template
        templateToLoad = getFreshDefaultTemplate();
    }
    
    // Ensure currentTemplate.id aligns if it's meant to be a new one.
    if (source === 'new' && templateToLoad.id !== currentTemplate.id && !selectedTemplateToEditId) {
        // If we're falling back to a completely new default template because nothing was selected or initial,
        // ensure the currentTemplate ID matches the new default template's ID.
        // Also update selectedTemplateToEditId to match this new template's ID.
         setSelectedTemplateToEditId(templateToLoad.id);
    }


    const reconstructedRows = (templateToLoad.rows || []).map((r_loaded: CardRow) => {
        const rowId = r_loaded.id; // Must be stable from loaded data
        const baseRow = createDefaultRow(rowId, [], r_loaded.alignItems, r_loaded.customHeight); // Pass ID
        const newR: CardRow = {
            ...baseRow,
            ...r_loaded, // Overlay loaded properties
            id: rowId,    // Re-assert ID
            columns: (r_loaded.columns || []).map((c_loaded: CardSection) => {
                const sectionId = c_loaded.id; // Must be stable
                const sectionType = (c_loaded.type as CardSectionType | undefined) || 'CustomText';
                const baseSection = createDefaultSection(sectionType, sectionId); // Pass ID and Type
                return {
                    ...baseSection,
                    ...c_loaded, // Overlay loaded properties
                    id: sectionId,  // Re-assert ID
                    type: sectionType // Re-assert Type
                };
            })
        };
        return newR;
    });
    
    const newTemplateToSet: TCGCardTemplate = {
      ...getFreshDefaultTemplate(templateToLoad.id, templateToLoad.name), // Base with correct ID/Name
      ...templateToLoad, // Overlay all properties from loaded template
      id: templateToLoad.id, // Re-assert ID
      name: templateToLoad.name, // Re-assert Name
      rows: reconstructedRows,
    };

    setCurrentTemplate(newTemplateToSet);
    setAspectRatioInput(newTemplateToSet.aspectRatio || "63:88");
    setActiveStylingAccordion(null);

    if (source === 'new' || source === 'initial' || (source === 'selected' && (!activeRowAccordionItems.length || !newTemplateToSet.rows.every(r => activeRowAccordionItems.includes(r.id))))) {
        setActiveRowAccordionItems(newTemplateToSet.rows.map(r => r.id));
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, selectedTemplateToEditId]); // templates removed to avoid loops if parent reference changes without data change

  // Effect to update parent templates list when currentTemplate changes (e.g. after save)
  // This should only run if currentTemplate is actually part of the parent `templates` list
  // and its ID matches selectedTemplateToEditId.
  useEffect(() => {
    if (selectedTemplateToEditId && templates.find(t => t.id === selectedTemplateToEditId)) {
        const parentTemplate = templates.find(t => t.id === selectedTemplateToEditId);
        if (parentTemplate && JSON.stringify(parentTemplate) !== JSON.stringify(currentTemplate)) {
            // This indicates an internal change, which is typically saved via handleSubmit
            // For now, this effect does nothing to avoid loops if `templates` was in dependencies above.
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTemplate]);

  const updateCurrentTemplate = (updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    const ratioParts = aspectRatioInput.split(':').map(Number);
    if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
        const newAspectRatio = `${ratioParts[0]}:${ratioParts[1]}`;
        if (currentTemplate.aspectRatio !== newAspectRatio) {
            updateCurrentTemplate({ aspectRatio: newAspectRatio });
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatioInput]); 

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

  const addSectionToRow = (rowId: string, type: CardSectionType) => {
    const newSectionId = nanoid(); 
    const newSection = createDefaultSection(type, newSectionId);
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r =>
        r.id === rowId ? { ...r, columns: [...(r.columns || []), newSection] } : r
      )
    }));
    setActiveStylingAccordion(newSectionId); 
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

  const resetFormToNew = () => {
    const newId = nanoid(); 
    const newDefaultTemplate = getFreshDefaultTemplate(newId); 
    setCurrentTemplate(newDefaultTemplate);
    setSelectedTemplateToEditId(newId); 
    setAspectRatioInput(newDefaultTemplate.aspectRatio || "63:88");
    setActiveRowAccordionItems((newDefaultTemplate.rows || []).map(r => r.id));
    setActiveStylingAccordion(null);
  };

  const handleSubmit = (part: 'settings' | 'sections' = 'settings') => { // Default to 'settings' if not specified
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
    if (part === 'sections' && (!templateToSave.rows || templateToSave.rows.length === 0)) {
      toast({ title: "Validation Error", description: 'Template structure must have at least one row.', variant: "destructive" });
      return;
    }
    if (part === 'sections' && templateToSave.rows.some((row: CardRow) => !row.columns || row.columns.length === 0)) {
      toast({ title: "Validation Error", description: 'All rows in the structure must have at least one section (column).', variant: "destructive" });
      return;
    }
    onSaveTemplate(templateToSave);
  };

  const handleSelectTemplateToEdit = (templateId: string) => {
    setSelectedTemplateToEditId(templateId);
    const selectedTpl = templates.find(t => t.id === templateId);
    if (selectedTpl) {
        setActiveRowAccordionItems((selectedTpl.rows || []).map(r => r.id));
    }
    setActiveStylingAccordion(null);
  };
  
  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      // Use the currentTemplate's ID and Name if they exist and are not the "New Unsaved Template" default,
      // otherwise use the preset's ID and Name, or generate new ones.
      const baseId = (currentTemplate.id && currentTemplate.name !== "New Unsaved Template") ? currentTemplate.id : nanoid();
      const baseName = (currentTemplate.name && currentTemplate.name !== "New Unsaved Template") ? currentTemplate.name : preset.name;

      // Reconstruct the preset with potentially existing ID/Name
      const newPresetTemplateBase = JSON.parse(JSON.stringify(preset)) as TCGCardTemplate;
      const newRows = (newPresetTemplateBase.rows || []).map((rowPreset) => {
        const newRowId = rowPreset.id;
        const baseRow = createDefaultRow(newRowId, [], rowPreset.alignItems, rowPreset.customHeight);
        return {
          ...baseRow,
          ...rowPreset,
          id: newRowId,
          columns: (rowPreset.columns || []).map((colPreset) => {
            const newColId = colPreset.id; 
            const baseCol = createDefaultSection(colPreset.type || 'CustomText', newColId);
            return {
              ...baseCol,
              ...colPreset,
              id: newColId,
              type: colPreset.type || 'CustomText'
            };
          }),
        };
      });
      
      const newPresetTemplate: TCGCardTemplate = {
        ...newPresetTemplateBase, 
        id: baseId, 
        name: baseName, 
        rows: newRows,
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
        setActiveRowAccordionItems(prev => [parentRow.id]); 
    }
    onToggleStylingAccordion(sectionId); 
     setTimeout(() => {
      const itemElement = document.getElementById(`accordion-section-styling-${sectionId}`); // Ensure this is the right ID format for the styling accordion itself
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
                        {(templates.find(t=>t.id === currentTemplate.id) && selectedTemplateToEditId === currentTemplate.id && currentTemplate.name !== "New Unsaved Template") ? 'Edit Template' : 'Create New Template'}: <span className="text-primary">{currentTemplate.name || "Untitled"}</span>
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
                                        <Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} />
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {(currentTemplate.frameStyle === 'standard' || currentTemplate.frameStyle === 'custom') 
                                            ? "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default." 
                                            : `Overridden by Frame Style ('${currentTemplate.frameStyle || 'none'}'). Set this if you plan to switch back.`}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor" className="text-xs">Base Text Color</Label>
                                        <Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })} />
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                           {(currentTemplate.frameStyle === 'standard' || currentTemplate.frameStyle === 'custom') 
                                            ? "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default." 
                                            : `Overridden by Frame Style ('${currentTemplate.frameStyle || 'none'}'). Set this if you plan to switch back.`}
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
                    <Button type="button" onClick={() => handleSubmit('settings')} className="flex items-center gap-2">
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
                <CardDescription>Define rows, then add sections (columns) to each row. Use <code>{`{{placeholder}}`}</code> or <code>{`{{placeholder:"default"}}`}</code> for dynamic data.</CardDescription>
                </CardHeader>
                <CardContent className="pr-2"> 
                    <ScrollArea className="h-[60vh] w-full">
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

                                <h4 className="text-sm font-semibold flex items-center gap-2"><Columns className="h-4 w-4"/>Sections (Columns) in this Row:</h4>
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
                     <Button type="button" onClick={() => handleSubmit('sections')} className="w-full sm:w-auto ml-auto flex items-center gap-2">
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

