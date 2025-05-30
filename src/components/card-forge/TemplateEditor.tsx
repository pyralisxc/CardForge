
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
  LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Cog, Frame, Rows, Eye, Save, Edit2, GripVertical, Upload, Paintbrush
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

// Moved getFreshDefaultTemplate outside the component for stable reference
export function getFreshDefaultTemplate (id?: string | null, name?: string): TCGCardTemplate {
  const newTemplateId = id === undefined ? nanoid() : (id === null ? null : id); // null id for "New Unsaved"
  const baseName = "New Unsaved Template";
  const newTemplateName = name || baseName;

  const newTemplate: TCGCardTemplate = {
    id: newTemplateId,
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
    rows: [],
  };

  // Define a stable default structure for "New Unsaved Template"
  if (newTemplateId === null && newTemplateName === baseName) {
    newTemplate.rows = [
      createDefaultRow('new-unsaved-row-1-stable', [createDefaultSection('new-unsaved-sec-1-stable', { contentPlaceholder: '{{title:"My Card"}}', flexGrow:1, customHeight:'40px' })]),
      createDefaultRow('new-unsaved-row-2-stable', [createDefaultSection('new-unsaved-sec-2-stable', { contentPlaceholder: '{{artUrl}}', sectionContentType: 'image', flexGrow:1, customHeight:'180px', imageWidthPx: '100%', imageHeightPx: '100%' })]),
      createDefaultRow('new-unsaved-row-3-stable', [createDefaultSection('new-unsaved-sec-3-stable', { contentPlaceholder: '{{description:"Card details..."}}', flexGrow:1, customHeight:'100px'})]),
    ];
  } else if (PRESET_TEMPLATES.length > 0 && newTemplateId !== null && !id && name !== baseName) {
     // Logic for cloning a preset when creating a new template (not "New Unsaved")
     // This part is less critical for the loop, as it happens on user action.
     // For simplicity, we can just start with a very basic structure for user-created "new" templates too,
     // if they don't choose a preset from the dropdown.
     // The `handleTemplatePresetChange` handles cloning presets with new IDs.
     newTemplate.rows = [
      createDefaultRow(nanoid(), [createDefaultSection(nanoid())])
    ];
  } else { // For an existing template or a truly fresh one being created not based on explicit preset
    newTemplate.rows = [
      createDefaultRow(nanoid(), [createDefaultSection(nanoid())])
    ];
  }
  return newTemplate;
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

  const reconstructSection = useCallback((loadedSection: Partial<CardSection>, sectionId: string): CardSection => {
    const base = createDefaultSection(sectionId);
    const newSection: CardSection = {
      ...base,
      ...JSON.parse(JSON.stringify(loadedSection)),
      id: sectionId,
    };
    if(newSection.sectionContentType === undefined) newSection.sectionContentType = base.sectionContentType;
    if(newSection.contentPlaceholder === undefined) newSection.contentPlaceholder = base.contentPlaceholder;
    if(newSection.backgroundImageUrl === undefined) newSection.backgroundImageUrl = base.backgroundImageUrl;
    if(newSection.imageWidthPx === undefined) newSection.imageWidthPx = base.imageWidthPx;
    if(newSection.imageHeightPx === undefined) newSection.imageHeightPx = base.imageHeightPx;
    return newSection;
  }, []);

  const reconstructRow = useCallback((loadedRow: Partial<CardRow>, rowId: string): CardRow => {
    const base = createDefaultRow(rowId);
    const clonedLoadedRow = JSON.parse(JSON.stringify(loadedRow));
    const newRow: CardRow = {
      ...base,
      ...clonedLoadedRow,
      id: rowId,
    };
    newRow.columns = (clonedLoadedRow.columns || []).map((c: Partial<CardSection>) =>
      reconstructSection(c, c.id || nanoid())
    );
    if (newRow.columns.length === 0) {
      newRow.columns = [reconstructSection({}, nanoid())];
    }
    return newRow;
  }, [reconstructSection]);

  const reconstructTemplate = useCallback((loadedTemplate: Partial<TCGCardTemplate>): TCGCardTemplate => {
    const clonedLoadedTemplate = JSON.parse(JSON.stringify(loadedTemplate));
    const base = getFreshDefaultTemplate(clonedLoadedTemplate.id, clonedLoadedTemplate.name);
    const newTemplate: TCGCardTemplate = {
      ...base,
      ...clonedLoadedTemplate,
      id: clonedLoadedTemplate.id !== undefined ? clonedLoadedTemplate.id : base.id,
      name: clonedLoadedTemplate.name || base.name,
    };
    newTemplate.rows = (clonedLoadedTemplate.rows || []).map((r: Partial<CardRow>) =>
      reconstructRow(r, r.id || nanoid())
    );
    if (newTemplate.rows.length === 0) {
      newTemplate.rows = [reconstructRow({}, nanoid())];
    }
    return newTemplate;
  }, [reconstructRow]);


  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(() => reconstructTemplate(initialTemplate || getFreshDefaultTemplate(null)));
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || TCG_ASPECT_RATIO);
  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>(() => (currentTemplate.rows || []).map(r => r.id));
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const cardBgImageInputRef = useRef<HTMLInputElement>(null);


  const resetFormToNew = useCallback(() => {
    const newFreshTemplate = getFreshDefaultTemplate(null); // Use stable "new unsaved"
    setCurrentTemplate(reconstructTemplate(newFreshTemplate));
    setSelectedTemplateToEditId(null);
    setAspectRatioInput(newFreshTemplate.aspectRatio || TCG_ASPECT_RATIO);
    setActiveRowAccordionItems((newFreshTemplate.rows || []).map(r => r.id));
    setActiveStylingAccordion(null);
    toast({ title: "Form Reset", description: "Ready to create a new template." });
  }, [toast, reconstructTemplate, setActiveRowAccordionItems, setActiveStylingAccordion, setCurrentTemplate, setSelectedTemplateToEditId, setAspectRatioInput]);


  useEffect(() => {
    let templateToLoad: TCGCardTemplate | undefined = undefined;
    let isNewUnsavedStateTarget = false;

    if (initialTemplate && (!selectedTemplateToEditId || selectedTemplateToEditId === initialTemplate.id)) {
      templateToLoad = initialTemplate;
    } else if (selectedTemplateToEditId) {
      const foundTemplate = templates.find(t => t.id === selectedTemplateToEditId);
      if (foundTemplate) {
        templateToLoad = foundTemplate;
      } else {
        // Invalid selectedTemplateToEditId, reset to a new unsaved template
        // but only if not already in that state to prevent loops with resetFormToNew
        if (currentTemplate.id !== null || currentTemplate.name !== "New Unsaved Template") {
            resetFormToNew(); // This calls setCurrentTemplate internally
        }
        return; // Exit effect as resetFormToNew handles the update
      }
    } else {
      // No initialTemplate and no selectedTemplateToEditId: should be "New Unsaved Template"
      if (currentTemplate.id !== null || currentTemplate.name !== "New Unsaved Template") {
        templateToLoad = getFreshDefaultTemplate(null); // Get stable "new unsaved"
        isNewUnsavedStateTarget = true;
      } else {
        // Already in the "New Unsaved Template" state, no further action needed from this effect.
        return;
      }
    }

    if (templateToLoad) {
      const reconstructed = reconstructTemplate(templateToLoad);
      // Deep compare with JSON.stringify to avoid loops from new object references
      if (JSON.stringify(currentTemplate) !== JSON.stringify(reconstructed)) {
        setCurrentTemplate(reconstructed);
        setAspectRatioInput(reconstructed.aspectRatio || TCG_ASPECT_RATIO);
        // Only update accordions if the template ID truly changed or we specifically targeted new unsaved state
        if (currentTemplate.id !== reconstructed.id || isNewUnsavedStateTarget) {
            setActiveRowAccordionItems((reconstructed.rows || []).map(r => r.id));
            setActiveStylingAccordion(null);
        }
      }
    }
  }, [initialTemplate, selectedTemplateToEditId, templates, resetFormToNew, reconstructTemplate, setAspectRatioInput, setActiveRowAccordionItems, setActiveStylingAccordion, currentTemplate.id, currentTemplate.name]); // Added currentTemplate.id and .name to allow re-evaluation if those core identifiers change upstream


  useEffect(() => {
    const ratioParts = aspectRatioInput.trim().split(':').map(Number);
    if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
        const newAspectRatio = `${ratioParts[0]}:${ratioParts[1]}`;
        if (currentTemplate.aspectRatio !== newAspectRatio ) {
             updateCurrentTemplate({ aspectRatio: newAspectRatio });
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatioInput, currentTemplate.aspectRatio]); // Added currentTemplate.aspectRatio


  const updateCurrentTemplate = (updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => reconstructTemplate({ ...prev, ...updates }));
  };

  const updateRow = (rowId: string, updates: Partial<CardRow>) => {
    setCurrentTemplate(prev => {
      const newRows = (prev.rows || []).map(r => r.id === rowId ? reconstructRow({ ...r, ...updates }, r.id) : r);
      return reconstructTemplate({ ...prev, rows: newRows });
    });
  };

  const addRow = () => {
    const newRowId = nanoid();
    const newRow = createDefaultRow(newRowId, [createDefaultSection(nanoid())]);
    setCurrentTemplate(prev => {
      const newRows = [...(prev.rows || []), newRow];
      return reconstructTemplate({ ...prev, rows: newRows });
    });
    setActiveRowAccordionItems(prevActive => [...prevActive, newRowId]);
  };

  const removeRow = (rowId: string) => {
    setCurrentTemplate(prev => {
      let newRows = (prev.rows || []).filter(r => r.id !== rowId);
      if (newRows.length === 0) {
        const fallbackRowId = nanoid();
        newRows.push(createDefaultRow(fallbackRowId, [createDefaultSection(nanoid())]));
         setActiveRowAccordionItems([fallbackRowId]);
      }
      return reconstructTemplate({ ...prev, rows: newRows });
    });
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
        return reconstructTemplate({ ...prev, rows });
    });
  };

  const addSectionToRow = (rowId: string) => {
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
  };

  const removeSectionFromRow = (rowId: string, sectionId: string) => {
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
  };

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
  }, [reconstructRow, reconstructSection, reconstructTemplate]);

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
          return reconstructRow({ ...r, columns: newColumns }, r.id);
        }
        return r;
      });
      return reconstructTemplate({ ...prev, rows: newRows });
    });
  };

  const handleSubmit = () => {
    let templateToSave = JSON.parse(JSON.stringify(currentTemplate));
    if (!templateToSave.name.trim() || templateToSave.name === "New Unsaved Template") {
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
    onSaveTemplate(templateToSave);
  };

  const handleSelectTemplateToEdit = (templateId: string) => {
    const previouslySelectedId = selectedTemplateToEditId;
    setSelectedTemplateToEditId(templateId);
    // The main useEffect will handle loading and reconstructing this template.
    // Only adjust accordions if the ID genuinely changes to avoid unnecessary state updates.
    if (previouslySelectedId !== templateId) {
        const templateToEdit = templates.find(t => t.id === templateId);
        if (templateToEdit) {
            setActiveRowAccordionItems((templateToEdit.rows || []).map(r => r.id));
            setActiveStylingAccordion(null);
        }
    }
  };

  const handleTemplatePresetChange = (presetId: string) => {
     if (PRESET_TEMPLATES.length === 0 || !PRESET_TEMPLATES.find(p => p.id === presetId)) {
      toast({ title: "No Preset Found", description: `Could not find selected preset or no presets available.`, variant: "default" });
      return;
    }
    const presetTemplate = PRESET_TEMPLATES.find(t => t.id === presetId);
    if (presetTemplate) {
        // Clone the preset and give it a new temporary ID for editing if it's to be saved as new
        const newEditingId = nanoid(); // This is a new template *based on* a preset
        const newName = `${presetTemplate.name || 'Preset'} (Copy)`;

        let clonedPreset = JSON.parse(JSON.stringify(presetTemplate));
        clonedPreset.id = newEditingId;
        clonedPreset.name = newName;

        // Ensure all nested rows and columns get new unique IDs too
        clonedPreset.rows = (clonedPreset.rows || []).map((row: CardRow) => ({
            ...row,
            id: nanoid(),
            columns: (row.columns || []).map((col: CardSection) => ({
                ...col,
                id: nanoid(),
            })),
        }));


        const reconstructedPreset = reconstructTemplate(clonedPreset);
        setCurrentTemplate(reconstructedPreset);
        setSelectedTemplateToEditId(null); // It's a new template copy, not editing the original preset
        setAspectRatioInput(reconstructedPreset.aspectRatio || TCG_ASPECT_RATIO);
        setActiveRowAccordionItems((reconstructedPreset.rows || []).map(r => r.id));
        setActiveStylingAccordion(null);
        toast({ title: "Preset Loaded", description: `"${reconstructedPreset.name}" loaded. Save to keep it.`});
    }
  };

  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    if (currentTemplate && currentTemplate.rows) {
        extractUniquePlaceholderKeys(currentTemplate).forEach(placeholder => {
            // For editor preview, just show the key itself
            data[placeholder.key] = placeholder.key;
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

  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  const handleSectionClickFromPreview = (sectionId: string) => {
    const parentRow = (currentTemplate.rows || []).find(r => (r.columns || []).some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)){
        setActiveRowAccordionItems([parentRow.id]);
    }
    onToggleStylingAccordion(sectionId);
     setTimeout(() => {
      const sectionEditorElement = document.querySelector(`.column-editor-card[data-section-id="${sectionId}"]`);
      sectionEditorElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  };

  const isNonCustomizableFrame = currentTemplate.frameStyle &&
                               currentTemplate.frameStyle !== 'standard' &&
                               currentTemplate.frameStyle !== 'custom';

  const handleCardBgImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
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
  };

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
                        {(currentTemplate.id && templates.find(t=>t.id === currentTemplate.id) && selectedTemplateToEditId === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: <span className="text-primary">{currentTemplate.name || "Untitled"}</span>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <Label htmlFor="templateFrameStyle">Card Frame Style</Label>
                                        <Select value={currentTemplate.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                            <SelectTrigger id="templateFrameStyle"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
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
                                          ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').`
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
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor">Base Text Color</Label>
                                        <Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || ''}
                                               onChange={(e: ChangeEvent<HTMLInputElement>) => updateCurrentTemplate({ baseTextColor: e.target.value })}
                                               disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'} />
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                          {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for theme default."}
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
                                            {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : "For 'Standard'/'Custom' frames."}
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
                                            {isNonCustomizableFrame ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : "For 'Standard'/'Custom' frames."}
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
                        <div className="flex justify-center p-4 my-auto">
                            <CardPreview
                                card={{ template: currentTemplate, data: livePreviewData, uniqueId: 'full-editor-preview-dialog' }}
                                isPrintMode={false}
                                isEditorPreview={true} // Should be true to see raw placeholders
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
