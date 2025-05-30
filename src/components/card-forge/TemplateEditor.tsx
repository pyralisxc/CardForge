
"use client";

import type { ChangeEvent, ElementType } from 'react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Cog, Frame, Rows, Eye, Save, Edit2, GripVertical, Paintbrush, Upload, Columns
} from 'lucide-react';
import {
  TCG_ASPECT_RATIO,
  DEFAULT_TEMPLATES as PRESET_TEMPLATES,
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

// Moved getFreshDefaultTemplate here and ensured it initializes all TCGCardTemplate fields
// and uses HARDCODED IDs for its default row/section when id is null (for "New Unsaved Template")
export const getFreshDefaultTemplate = (id?: string | null, nameProp?: string): TCGCardTemplate => {
  let newTemplateId = id;
  let newTemplateName = nameProp;

  const isTrulyNewUnsaved = (id === null && (nameProp === "New Unsaved Template" || nameProp === undefined));

  if (newTemplateId === undefined && !isTrulyNewUnsaved) { // For a new template that WILL be saved
    newTemplateId = nanoid();
  }
  if (newTemplateName === undefined) {
    newTemplateName = "New Unsaved Template";
  }

  // For the "New Unsaved Template", use HARDCODED IDs for rows/sections
  // Otherwise, use nanoid for a truly new template being created (not loaded)
  const defaultRows = isTrulyNewUnsaved ? [
    createDefaultRow('unsaved-default-row-1-v8', [
      createDefaultSection('unsaved-default-sec-1-v8')
    ])
  ] : [
    createDefaultRow(nanoid(), [createDefaultSection(nanoid())])
  ];

  return {
    id: newTemplateId, // This will be null for the "New Unsaved Template"
    name: newTemplateName,
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    baseBackgroundColor: '',
    baseTextColor: '',
    defaultSectionBorderColor: '',
    cardBorderColor: '',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    cardBackgroundImageUrl: '',
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

  const reconstructSection = useCallback((sectionData: Partial<CardSection>, sectionIdOverride?: string): CardSection => {
    const id = sectionIdOverride || sectionData.id || nanoid();
    const baseSection = createDefaultSection(id);
    return {
      ...baseSection,
      ...sectionData,
      id: id,
    };
  }, []);

  const reconstructRow = useCallback((rowData: Partial<CardRow>, rowIdOverride?: string): CardRow => {
    const id = rowIdOverride || rowData.id || nanoid();
    const baseRow = createDefaultRow(id);
    const newRow: CardRow = {
      ...baseRow,
      ...rowData,
      id: id,
    };
    newRow.columns = (rowData.columns || []).map(c => reconstructSection(c, c.id || nanoid()));
    if (newRow.columns.length === 0) {
      newRow.columns = [reconstructSection({}, nanoid())];
    }
    return newRow;
  }, [reconstructSection]);

  const reconstructTemplate = useCallback((templateData: Partial<TCGCardTemplate>): TCGCardTemplate => {
    const anId = templateData.id !== undefined ? templateData.id : (templateData.name === "New Unsaved Template" && templateData.id === undefined ? null : nanoid());
    const baseTemplate = getFreshDefaultTemplate(anId, templateData.name);

    const newTemplate: TCGCardTemplate = {
      ...baseTemplate,
      ...templateData,
      id: anId,
      name: templateData.name !== undefined ? templateData.name : baseTemplate.name,
    };

    newTemplate.rows = (templateData.rows || []).map(r_loaded =>
      reconstructRow({ ...createDefaultRow(r_loaded.id || nanoid()), ...r_loaded })
    );

    if (newTemplate.rows.length === 0) {
        newTemplate.rows = [reconstructRow(createDefaultRow(nanoid(), [createDefaultSection(nanoid())]))];
    }
    return newTemplate;
  }, [getFreshDefaultTemplate, reconstructRow]);

  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(() =>
    reconstructTemplate(initialTemplate || getFreshDefaultTemplate(null, "New Unsaved Template"))
  );
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(
    currentTemplate.aspectRatio || TCG_ASPECT_RATIO
  );

  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>(
    (currentTemplate.rows || []).map(r => r.id).filter(Boolean) as string[]
  );
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const cardBgImageInputRef = useRef<HTMLInputElement | null>(null);


  const resetFormToNew = useCallback(() => {
    const newFreshTemplate = reconstructTemplate(getFreshDefaultTemplate(null, "New Unsaved Template"));
    setCurrentTemplate(newFreshTemplate);
    setSelectedTemplateToEditId(null);
    setAspectRatioInput(newFreshTemplate.aspectRatio || TCG_ASPECT_RATIO);
    setActiveRowAccordionItems((newFreshTemplate.rows || []).map(r => r.id).filter(Boolean) as string[]);
    setActiveStylingAccordion(null);
    toast({ title: "Form Reset", description: "Ready to create a new template." });
  }, [toast, reconstructTemplate, getFreshDefaultTemplate, setActiveRowAccordionItems, setActiveStylingAccordion, setAspectRatioInput, setSelectedTemplateToEditId, setCurrentTemplate, TCG_ASPECT_RATIO]);


  useEffect(() => {
    let templateToLoad: TCGCardTemplate | null = null;

    if (initialTemplate) {
        if (!selectedTemplateToEditId || selectedTemplateToEditId === initialTemplate.id) {
            templateToLoad = initialTemplate;
        } else {
            const found = templates.find(t => t.id === selectedTemplateToEditId);
            templateToLoad = found || getFreshDefaultTemplate(null, "New Unsaved Template");
             if (!found) {
                toast({ title: "Note", description: "Selected template not found, starting new." });
                setSelectedTemplateToEditId(null); // Reset selection if template disappeared
            }
        }
    } else if (selectedTemplateToEditId) {
        const found = templates.find(t => t.id === selectedTemplateToEditId);
        templateToLoad = found || getFreshDefaultTemplate(null, "New Unsaved Template");
        if (!found) {
            toast({ title: "Note", description: "Selected template not found, starting new." });
            setSelectedTemplateToEditId(null);
        }
    } else {
        templateToLoad = getFreshDefaultTemplate(null, "New Unsaved Template");
    }

    const reconstructed = reconstructTemplate(templateToLoad);
    if (JSON.stringify(currentTemplate) !== JSON.stringify(reconstructed)) {
        setCurrentTemplate(reconstructed);
    }
  }, [initialTemplate, selectedTemplateToEditId, templates, reconstructTemplate, getFreshDefaultTemplate, currentTemplate, setSelectedTemplateToEditId, toast]);


  useEffect(() => {
    setAspectRatioInput(currentTemplate.aspectRatio || TCG_ASPECT_RATIO);
    // Only expand all rows if the template ID has changed OR it's a new template without expanded rows yet
    if (activeRowAccordionItems.length === 0 || !currentTemplate.rows.every(r => activeRowAccordionItems.includes(r.id))) {
        setActiveRowAccordionItems((currentTemplate.rows || []).map(r => r.id).filter(Boolean) as string[]);
    }
    setActiveStylingAccordion(null); // Reset styling accordion when template changes
  }, [currentTemplate, TCG_ASPECT_RATIO, activeRowAccordionItems.length]); // Added activeRowAccordionItems.length to help stabilize

  const updateCurrentTemplate = useCallback((updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => {
      const updatedData = { ...prev, ...updates };
      return reconstructTemplate(updatedData);
    });
  }, [reconstructTemplate]);

  const updateRow = useCallback((rowId: string, updates: Partial<CardRow>) => {
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r => r.id === rowId ? reconstructRow({ ...r, ...updates }, r.id) : r);
      return reconstructTemplate({ ...prev, rows: newRows });
    });
  }, [reconstructTemplate, reconstructRow]);

  const addRow = useCallback(() => {
    const newRowId = nanoid();
    const newRow = createDefaultRow(newRowId);
    setCurrentTemplate(prev => {
      const currentRows = prev.rows || [];
      const newTemplateState = reconstructTemplate({ ...prev, rows: [...currentRows, newRow] });
      return newTemplateState;
    });
    setActiveRowAccordionItems(prevActive => [...prevActive, newRowId]);
  }, [reconstructTemplate, setActiveRowAccordionItems]);

  const removeRow = useCallback((rowId: string) => {
    setCurrentTemplate(prev => {
      let newRows = (prev.rows || []).filter(r => r.id !== rowId);
      if (newRows.length === 0) {
        newRows.push(createDefaultRow(nanoid()));
      }
      return reconstructTemplate({ ...prev, rows: newRows });
    });
    setActiveRowAccordionItems(prevActive => prevActive.filter(id => id !== rowId));
  }, [reconstructTemplate, setActiveRowAccordionItems]);

  const moveRow = useCallback((rowId: string, direction: 'up' | 'down') => {
    setCurrentTemplate(prev => {
        const rows = [...(prev.rows || [])];
        const index = rows.findIndex(r => r.id === rowId);
        if (index === -1) return prev;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= rows.length) return prev;

        [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
        return reconstructTemplate({ ...prev, rows });
    });
  }, [reconstructTemplate]);

  const addSectionToRow = useCallback((rowId: string) => {
    const newSectionId = nanoid();
    const newSection = createDefaultSection(newSectionId);
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r =>
        r.id === rowId ? reconstructRow({ ...r, columns: [...(r.columns || []), newSection] }, r.id) : r
      );
      return reconstructTemplate({ ...prev, rows: newRows });
    });
    setActiveStylingAccordion(newSectionId);
    if (!activeRowAccordionItems.includes(rowId)) {
        setActiveRowAccordionItems(prev => [...prev, rowId]);
    }
  }, [reconstructTemplate, reconstructRow, activeRowAccordionItems, setActiveRowAccordionItems, setActiveStylingAccordion]);

  const removeSectionFromRow = useCallback((rowId: string, sectionId: string) => {
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r => {
        if (r.id === rowId) {
          let updatedColumns = (r.columns || []).filter(s => s.id !== sectionId);
          if (updatedColumns.length === 0) {
            updatedColumns.push(createDefaultSection(nanoid()));
          }
          return reconstructRow({ ...r, columns: updatedColumns }, r.id);
        }
        return r;
      });
      return reconstructTemplate({ ...prev, rows: newRows });
    });
    if (activeStylingAccordion === sectionId) {
        setActiveStylingAccordion(null);
    }
  }, [reconstructTemplate, reconstructRow, activeStylingAccordion, setActiveStylingAccordion]);

  const onUpdateSectionInRow = useCallback((rowId: string, sectionId: string, updates: Partial<CardSection>) => {
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r =>
        r.id === rowId
        ? reconstructRow({
            ...r,
            columns: (r.columns || []).map(s => s.id === sectionId ? reconstructSection({ ...s, ...updates }, s.id) : s)
          }, r.id)
        : r
      );
      return reconstructTemplate({ ...prev, rows: newRows });
    });
  }, [reconstructTemplate, reconstructRow, reconstructSection]);

  const moveSectionInRow = useCallback((rowId: string, sectionId: string, direction: 'left' | 'right') => {
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
          return reconstructRow({ ...r, columns: newColumns }, r.id);
        }
        return r;
      });
      return reconstructTemplate({ ...prev, rows: newRows });
    });
  }, [reconstructTemplate, reconstructRow]);

  const handleSubmit = useCallback(() => {
    let templateToSave = { ...currentTemplate };
    if (!templateToSave.name?.trim() || templateToSave.name === "New Unsaved Template") {
      toast({ title: "Validation Error", description: 'Please provide a unique name for your template before saving.', variant: "destructive" });
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

    if (templateToSave.id === null) { // If it's the "New Unsaved Template"
      templateToSave.id = nanoid(); // Give it a real ID before saving
    }
    const finalTemplateToSave = reconstructTemplate(templateToSave);
    onSaveTemplate(finalTemplateToSave);

    // If it was a new template that just got saved, update selectedTemplateToEditId
    if (currentTemplate.id === null && finalTemplateToSave.id) {
      setSelectedTemplateToEditId(finalTemplateToSave.id);
    }
  }, [currentTemplate, onSaveTemplate, toast, reconstructTemplate, setSelectedTemplateToEditId]);


  const handleSelectTemplateToEdit = useCallback((templateId: string) => {
    setSelectedTemplateToEditId(templateId);
    const selectedTemplate = templates.find(t => t.id === templateId);
    if (selectedTemplate) {
        const reconstructed = reconstructTemplate(selectedTemplate);
        setCurrentTemplate(reconstructed);
        setActiveRowAccordionItems((reconstructed.rows || []).map(r => r.id).filter(Boolean) as string[]);
    } else {
        resetFormToNew();
    }
  }, [templates, reconstructTemplate, resetFormToNew, setActiveRowAccordionItems, setCurrentTemplate, setSelectedTemplateToEditId]);


  const handleTemplatePresetChange = useCallback((presetName: string) => {
     if (PRESET_TEMPLATES.length === 0 || !PRESET_TEMPLATES.find(p => p.name === presetName)) {
      toast({ title: "No Preset Found", description: `Could not find selected preset or no presets available.`, variant: "default" });
      return;
    }
    const presetTemplateData = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (presetTemplateData) {
        const newEditingId = nanoid();
        const newName = `${presetTemplateData.name || 'Preset'} (Copy)`;

        let clonedPreset = JSON.parse(JSON.stringify(presetTemplateData));
        clonedPreset.id = newEditingId;
        clonedPreset.name = newName;
        (clonedPreset.rows || []).forEach((row: Partial<CardRow>) => {
            row.id = nanoid(); // Give new IDs to rows
            (row.columns || []).forEach((col: Partial<CardSection>) => {
                col.id = nanoid(); // And to sections
            });
        });

        const reconstructedPreset = reconstructTemplate(clonedPreset);
        setCurrentTemplate(reconstructedPreset);
        setSelectedTemplateToEditId(reconstructedPreset.id); // Select it for editing
        setActiveRowAccordionItems((reconstructedPreset.rows || []).map(r => r.id).filter(Boolean) as string[]);
        toast({ title: "Preset Loaded", description: `"${reconstructedPreset.name}" loaded. Save to keep it.`});
    }
  }, [PRESET_TEMPLATES, toast, reconstructTemplate, setActiveRowAccordionItems, setCurrentTemplate, setSelectedTemplateToEditId]);


  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    if (currentTemplate && currentTemplate.rows) {
        extractUniquePlaceholderKeys(currentTemplate).forEach(placeholder => {
            data[placeholder.key] = placeholder.defaultValue !== undefined ? placeholder.defaultValue : `{{${placeholder.key}}}`;
        });
    }
    return data;
  }, [currentTemplate]);

  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  const handleRowClickFromPreview = useCallback((rowId: string) => {
    setActiveRowAccordionItems(prev => {
      if (prev.includes(rowId) && prev.length === 1 && activeRowAccordionItems.length === 1) return prev;
      if(prev.includes(rowId)) return prev.filter(id => id !== rowId);
      return [...prev, rowId];
    });
    setActiveStylingAccordion(null);
    setTimeout(() => {
      const itemElement = document.getElementById(`accordion-row-${rowId}`);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },0);
  }, [activeRowAccordionItems]);

  const handleSectionClickFromPreview = useCallback((sectionId: string) => {
    const parentRow = (currentTemplate.rows || []).find(r => (r.columns || []).some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)){
        setActiveRowAccordionItems(prev => [...prev, parentRow.id]);
    }
    onToggleStylingAccordion(sectionId);
     setTimeout(() => {
      const sectionEditorElement = document.querySelector(`.column-editor-card[data-section-id="${sectionId}"]`);
      sectionEditorElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }, [currentTemplate.rows, activeRowAccordionItems, onToggleStylingAccordion]);

  const isNonCustomizableFrame = useMemo(() =>
    currentTemplate.frameStyle &&
    currentTemplate.frameStyle !== 'standard' &&
    currentTemplate.frameStyle !== 'custom'
  , [currentTemplate.frameStyle]);

  const handleCardBgImageUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        updateCurrentTemplate({ cardBackgroundImageUrl: dataUri });
        toast({ title: "Image Uploaded", description: `Card background image "${file.name}" loaded.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read background image file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  }, [updateCurrentTemplate, toast]);

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
                    <SelectItem key={preset.name} value={preset.name}>{preset.name}</SelectItem>
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
              <ScrollArea className="max-h-[200px] pr-1">
                <ul className="space-y-2">
                  {templates.map((template) => (
                    <li key={template.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-muted/30 transition-colors">
                      <span
                        className={cn(
                            "cursor-pointer flex-grow",
                            selectedTemplateToEditId === template.id ? 'font-semibold text-primary' : ''
                        )}
                        onClick={() => handleSelectTemplateToEdit(template.id!)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplateToEdit(template.id!)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit template ${template.name || 'Unnamed Template'}`}
                      >
                        {template.name || 'Unnamed Template'}
                      </span>
                      <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(template.id!);
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
                        {(currentTemplate.id && templates.find(t=>t.id === currentTemplate.id) && selectedTemplateToEditId === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: <span className="text-primary">{currentTemplate.name || "Untitled"}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input id="templateName" value={currentTemplate.name || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., My Awesome TCG Template" required />
                    </div>
                    <div>
                        <Label htmlFor="templateAspectRatio">Aspect Ratio (W:H)</Label>
                         <Input id="templateAspectRatio" value={aspectRatioInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setAspectRatioInput(e.target.value)} placeholder="e.g., 63:88 (Standard TCG)" />
                         <p className="text-xs text-muted-foreground mt-1">Current: {currentTemplate.aspectRatio || TCG_ASPECT_RATIO}</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full" defaultValue="overall-styling-accordion-item">
                        <AccordionItem value="overall-styling-accordion-item" id="overall-styling-accordion-item" className="border rounded-md">
                             <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline">
                                <div className="flex items-center gap-2"><Cog className="h-4 w-4" /> Overall Card Styling</div>
                            </AccordionTrigger>
                            <AccordionContent className="p-3 space-y-3 border-t">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <Label htmlFor="templateFrameStyle">Card Frame Style</Label>
                                        <Select value={currentTemplate.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                            <SelectTrigger id="templateFrameStyle"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-1">
                                      <Label htmlFor="cardBackgroundImageUrl">Card Background Image URL (or placeholder)</Label>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          id="cardBackgroundImageUrl"
                                          value={currentTemplate.cardBackgroundImageUrl || ''}
                                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ cardBackgroundImageUrl: e.target.value })}
                                          placeholder="e.g., https://.../bg.png or {{bgKey}}"
                                          className="h-8 text-xs flex-grow"
                                          disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8 shrink-0"
                                          onClick={() => cardBgImageInputRef.current?.click()}
                                          aria-label="Upload card background image"
                                          disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}
                                        >
                                          <Upload className="h-4 w-4" />
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
                                        {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                          ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}'). Applies to 'Standard'/'Custom Colors' if frame allows.`
                                          : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for none."}
                                      </p>
                                    </div>
                                     <div>
                                        <Label htmlFor="baseBgColor">Base Background Color</Label>
                                        <Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || ''}
                                               onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })}
                                               disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'} />
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                                ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}'). Set for 'Standard'/'Custom'.`
                                                : "Applies to 'Standard' and 'Custom Colors' frames. Other frames may override."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor">Base Text Color</Label>
                                        <Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || ''}
                                               onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })}
                                               disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'} />
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                            {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                                ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}'). Set for 'Standard'/'Custom'.`
                                                : "Applies to 'Standard' and 'Custom Colors' frames. Other frames may override."}
                                        </p>
                                    </div>
                                     <div>
                                        <Label htmlFor="defaultSectionBorderColor">Default Section Fallback Border Color</Label>
                                        <Input id="defaultSectionBorderColor" type="color" value={currentTemplate.defaultSectionBorderColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ defaultSectionBorderColor: e.target.value })} />
                                        <p className="text-xs text-muted-foreground mt-0.5">Fallback for individual section borders if they have width but no specific color.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderColor">Card Outer Border Color</Label>
                                        <Input id="cardBorderColor" type="color" value={currentTemplate.cardBorderColor || ''} onChange={e => updateCurrentTemplate({cardBorderColor: e.target.value})}
                                          disabled={isNonCustomizableFrame}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : "For 'Standard'/'Custom Colors' frames."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderWidth">Card Outer Border Width</Label>
                                        <Input id="cardBorderWidth" value={currentTemplate.cardBorderWidth || ''} onChange={e => updateCurrentTemplate({cardBorderWidth: e.target.value})} placeholder="e.g., 4px, 0"
                                          className="h-8 text-xs"
                                          disabled={isNonCustomizableFrame}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : 'E.g., "4px", "0" for no border.'}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderStyle">Card Outer Border Style</Label>
                                        <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={v => updateCurrentTemplate({cardBorderStyle: (v === '_default_' ? undefined : v as TCGCardTemplate['cardBorderStyle'])}) }
                                           disabled={isNonCustomizableFrame}
                                        >
                                            <SelectTrigger id="cardBorderStyle"><SelectValue/></SelectTrigger>
                                            <SelectContent>{CARD_BORDER_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : "For 'Standard'/'Custom Colors' frames."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="cardBorderRadius">Card Corner Radius</Label>
                                        <Input id="cardBorderRadius" value={currentTemplate.cardBorderRadius || ''} onChange={e => updateCurrentTemplate({cardBorderRadius: e.target.value})} placeholder="e.g., 8px, 0.5rem"
                                          className="h-8 text-xs"
                                           disabled={isNonCustomizableFrame}/>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : 'E.g., "8px", "0.5rem".'}
                                        </p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                 <CardFooter className="p-4 border-t flex justify-end">
                    <Button type="button" onClick={handleSubmit} className="flex items-center gap-2">
                        <Save className="h-4 w-4"/>
                        Save Template
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
                                    <AccordionTrigger
                                        aria-label={`Toggle Row ${rowIndex + 1} details`}
                                        className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium"
                                    >
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
                                        <Label htmlFor={`rowAlignItems-${row.id}`}>Row Vertical Alignment (columns)</Label>
                                        <Select value={row.alignItems || 'flex-start'} onValueChange={v => updateRow(row.id, {alignItems: v as CardRow['alignItems']})}>
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
                                        <Input id={`rowCustomHeight-${row.id}`} value={row.customHeight || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRow(row.id, { customHeight: e.target.value })} placeholder="e.g., 100px, 20%, auto" />
                                    </div>
                                </div>

                                <h4 className="text-sm font-semibold flex items-center gap-2 pt-2 border-t mt-3">
                                     <Columns className="h-4 w-4" /> Sections (Columns) in this Row:
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
                                            onUpdateSectionInRow={onUpdateSectionInRow}
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
                        <div className="flex justify-center p-4 my-auto"> {/* Added my-auto for vertical centering */}
                            <CardPreview
                                card={{ template: currentTemplate, data: livePreviewData, uniqueId: 'full-editor-preview-dialog' }}
                                isPrintMode={false}
                                isEditorPreview={true} // Keep true to show raw placeholders
                                hideEmptySections={false}
                                className="mx-auto"
                                targetWidthPx={400} // Larger preview in dialog
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
