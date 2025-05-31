
"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
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
  LayoutDashboard, Trash2, PlusCircle, Rows, Eye, Save, Edit2, GripVertical, ArrowUp, ArrowDown, Cog, Frame, FileImage, Settings, ChevronDown
} from 'lucide-react';
import {
  TCG_ASPECT_RATIO,
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


export const getFreshDefaultTemplate = (id?: string | null, nameProp?: string): TCGCardTemplate => {
  let newTemplateId: string | null;
  let newTemplateName: string;

  if (id === null) { // Truly new, unsaved template
    newTemplateId = null;
    newTemplateName = `Template ${nanoid(8)}`;
  } else if (id && nameProp && nameProp !== "New Unsaved Template") { // Loading existing with a specific name
    newTemplateId = id;
    newTemplateName = nameProp;
  } else if (id) { // Loading existing, nameProp might be undefined or "New Unsaved Template" (which we ignore)
    newTemplateId = id;
    newTemplateName = `Template ${String(id).substring(0, 8)}`; // Default to ID-based name if nameProp is not suitable
  } else { // Fallback: Should ideally not be hit if id is null is handled above, but as safety for new templates
    newTemplateId = nanoid();
    newTemplateName = `Template ${newTemplateId.substring(0, 8)}`;
  }
   if (nameProp && nameProp !== "New Unsaved Template" && nameProp !== newTemplateName && id === null) {
    newTemplateName = nameProp; // User is creating a new template AND has already typed a name for it
  }


  const defaultRowId1 = id === null ? 'unsaved-default-row-1-v9-stable-id' : nanoid();
  const defaultSectionId1 = id === null ? 'unsaved-default-sec-1-v9-stable-id' : nanoid();
  const defaultRowId2 = id === null ? 'unsaved-default-row-2-v9-stable-id' : nanoid();
  const defaultSectionId2 = id === null ? 'unsaved-default-sec-2-v9-stable-id' : nanoid();


  return {
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
    rows: [
      createDefaultRow(defaultRowId1, [
        createDefaultSection(defaultSectionId1, { contentPlaceholder: `{{cardName}}`, flexGrow: 1, sectionContentType: 'placeholder', textAlign:'center', fontSize:'text-lg', fontWeight: 'font-bold' }),
      ]),
      createDefaultRow(defaultRowId2, [
        createDefaultSection(defaultSectionId2, { contentPlaceholder: '{{artworkUrl}}', sectionContentType:'image', flexGrow:1, customHeight: '200px', imageWidthPx: '260', imageHeightPx:'180' }),
      ]),
    ],
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
  
  const memoizedGetFreshDefaultTemplate = useCallback(getFreshDefaultTemplate, []);

  const reconstructTemplate = useCallback((templateData: Partial<TCGCardTemplate>): TCGCardTemplate => {
    const anId = templateData.id !== undefined ? templateData.id : (templateData.name === "New Unsaved Template" && templateData.id === undefined ? null : nanoid());
    const baseTemplate = memoizedGetFreshDefaultTemplate(anId);

    const newTemplate: TCGCardTemplate = {
      ...baseTemplate,
      id: anId,
      name: templateData.name !== undefined ? templateData.name : baseTemplate.name,
      aspectRatio: templateData.aspectRatio !== undefined ? templateData.aspectRatio : baseTemplate.aspectRatio,
      frameStyle: templateData.frameStyle !== undefined ? templateData.frameStyle : baseTemplate.frameStyle,
      cardBackgroundImageUrl: templateData.cardBackgroundImageUrl !== undefined ? templateData.cardBackgroundImageUrl : baseTemplate.cardBackgroundImageUrl,
      baseBackgroundColor: templateData.baseBackgroundColor !== undefined ? templateData.baseBackgroundColor : baseTemplate.baseBackgroundColor,
      baseTextColor: templateData.baseTextColor !== undefined ? templateData.baseTextColor : baseTemplate.baseTextColor,
      defaultSectionBorderColor: templateData.defaultSectionBorderColor !== undefined ? templateData.defaultSectionBorderColor : baseTemplate.defaultSectionBorderColor,
      cardBorderColor: templateData.cardBorderColor !== undefined ? templateData.cardBorderColor : baseTemplate.cardBorderColor,
      cardBorderWidth: templateData.cardBorderWidth !== undefined ? templateData.cardBorderWidth : baseTemplate.cardBorderWidth,
      cardBorderStyle: templateData.cardBorderStyle !== undefined ? templateData.cardBorderStyle : baseTemplate.cardBorderStyle,
      cardBorderRadius: templateData.cardBorderRadius !== undefined ? templateData.cardBorderRadius : baseTemplate.cardBorderRadius,
      rows: [], 
    };

    for (const key in templateData) {
        if (key !== 'rows' && !(key in newTemplate)) {
            (newTemplate as any)[key] = (templateData as any)[key];
        }
    }

    newTemplate.rows = (templateData.rows || baseTemplate.rows || []).map(currentRowDataFromState => {
      const rowId = currentRowDataFromState.id || nanoid();
      const baseTemplateRow = baseTemplate.rows.find(br => br.id === rowId) || createDefaultRow(rowId);

      let reconstructedRow: CardRow = {
        ...createDefaultRow(rowId),
        ...baseTemplateRow,
        ...currentRowDataFromState,
        id: rowId,
      };

      reconstructedRow.columns = (currentRowDataFromState.columns || []).map(currentSectionDataFromState => {
        const sectionId = currentSectionDataFromState.id || nanoid();
        const baseTemplateSection = (baseTemplateRow.columns || []).find(bs => bs.id === sectionId) || createDefaultSection(sectionId);

        const reconstructedSection: CardSection = {
          ...createDefaultSection(sectionId),   
          ...baseTemplateSection,              
          ...currentSectionDataFromState,       
          id: sectionId,                        

          sectionContentType: currentSectionDataFromState.sectionContentType !== undefined 
                              ? currentSectionDataFromState.sectionContentType 
                              : (baseTemplateSection.sectionContentType !== undefined 
                                  ? baseTemplateSection.sectionContentType 
                                  : createDefaultSection(sectionId).sectionContentType),
          contentPlaceholder: currentSectionDataFromState.contentPlaceholder !== undefined 
                              ? currentSectionDataFromState.contentPlaceholder 
                              : (baseTemplateSection.contentPlaceholder !== undefined 
                                  ? baseTemplateSection.contentPlaceholder 
                                  : createDefaultSection(sectionId).contentPlaceholder),
          
          textColor: currentSectionDataFromState.textColor !== undefined ? currentSectionDataFromState.textColor : baseTemplateSection.textColor,
          backgroundColor: currentSectionDataFromState.backgroundColor !== undefined ? currentSectionDataFromState.backgroundColor : baseTemplateSection.backgroundColor,
          fontFamily: currentSectionDataFromState.fontFamily !== undefined ? currentSectionDataFromState.fontFamily : baseTemplateSection.fontFamily,
          fontSize: currentSectionDataFromState.fontSize !== undefined ? currentSectionDataFromState.fontSize : baseTemplateSection.fontSize,
          fontWeight: currentSectionDataFromState.fontWeight !== undefined ? currentSectionDataFromState.fontWeight : baseTemplateSection.fontWeight,
          textAlign: currentSectionDataFromState.textAlign !== undefined ? currentSectionDataFromState.textAlign : baseTemplateSection.textAlign,
          fontStyle: currentSectionDataFromState.fontStyle !== undefined ? currentSectionDataFromState.fontStyle : baseTemplateSection.fontStyle,
          padding: currentSectionDataFromState.padding !== undefined ? currentSectionDataFromState.padding : baseTemplateSection.padding,
          borderColor: currentSectionDataFromState.borderColor !== undefined ? currentSectionDataFromState.borderColor : baseTemplateSection.borderColor,
          borderWidth: currentSectionDataFromState.borderWidth !== undefined ? currentSectionDataFromState.borderWidth : baseTemplateSection.borderWidth,
          borderRadius: currentSectionDataFromState.borderRadius !== undefined ? currentSectionDataFromState.borderRadius : baseTemplateSection.borderRadius,
          minHeight: currentSectionDataFromState.minHeight !== undefined ? currentSectionDataFromState.minHeight : baseTemplateSection.minHeight,
          flexGrow: currentSectionDataFromState.flexGrow !== undefined ? currentSectionDataFromState.flexGrow : baseTemplateSection.flexGrow,
          customHeight: currentSectionDataFromState.customHeight !== undefined ? currentSectionDataFromState.customHeight : baseTemplateSection.customHeight,
          customWidth: currentSectionDataFromState.customWidth !== undefined ? currentSectionDataFromState.customWidth : baseTemplateSection.customWidth,
          imageWidthPx: currentSectionDataFromState.imageWidthPx !== undefined ? currentSectionDataFromState.imageWidthPx : baseTemplateSection.imageWidthPx,
          imageHeightPx: currentSectionDataFromState.imageHeightPx !== undefined ? currentSectionDataFromState.imageHeightPx : baseTemplateSection.imageHeightPx,
          backgroundImageUrl: currentSectionDataFromState.backgroundImageUrl !== undefined ? currentSectionDataFromState.backgroundImageUrl : baseTemplateSection.backgroundImageUrl,
        };
        return reconstructedSection;
      });
      if (reconstructedRow.columns.length === 0) reconstructedRow.columns = [createDefaultSection(nanoid())];
      return reconstructedRow;
    });

    if (newTemplate.rows.length === 0) {
      newTemplate.rows = [createDefaultRow(nanoid(), [createDefaultSection(nanoid())])];
    }
    return newTemplate;
  }, [memoizedGetFreshDefaultTemplate]);


  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(() =>
    reconstructTemplate(initialTemplate || memoizedGetFreshDefaultTemplate(null, "New Unsaved Template"))
  );

  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || TCG_ASPECT_RATIO);
  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>([]);
  const [activeColumnAccordionItems, setActiveColumnAccordionItems] = useState<string[]>([]);
  const [activeStylingAccordion, setActiveStylingAccordion] = useState<string | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const cardBgImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isSettingsCardOpen, setIsSettingsCardOpen] = useState(true);
  const [isRowsAndSectionsCardOpen, setIsRowsAndSectionsCardOpen] = useState(true);


  const resetFormToNew = useCallback(() => {
    const newFreshTemplate = memoizedGetFreshDefaultTemplate(null); 
    setCurrentTemplate(reconstructTemplate(newFreshTemplate));
    setSelectedTemplateToEditId(null); 
    setAspectRatioInput(newFreshTemplate.aspectRatio || TCG_ASPECT_RATIO);
    setActiveRowAccordionItems((newFreshTemplate.rows || []).map(r => r.id).filter(Boolean) as string[]);
    setActiveColumnAccordionItems([]);
    setActiveStylingAccordion(null);
    setIsSettingsCardOpen(true);
    setIsRowsAndSectionsCardOpen(true);
    toast({ title: "Form Reset", description: `Ready to create a new template: "${newFreshTemplate.name}"` });
  }, [toast, reconstructTemplate, memoizedGetFreshDefaultTemplate]);


  useEffect(() => {
    let templateToLoad: Partial<TCGCardTemplate> = currentTemplate; 
    let shouldReconstruct = false;
    let newActiveRows: string[] | undefined = undefined;

    if (selectedTemplateToEditId) {
        const found = templates.find(t => t.id === selectedTemplateToEditId);
        if (found) {
            if (JSON.stringify(currentTemplate) !== JSON.stringify(found) || currentTemplate.id !== found.id) {
                templateToLoad = found;
                shouldReconstruct = true;
                newActiveRows = (found.rows || []).map(r => r.id).filter(Boolean) as string[];
            }
        } else {
            resetFormToNew();
            return; 
        }
    } else if (initialTemplate && currentTemplate.id === null) { 
         if (JSON.stringify(currentTemplate) !== JSON.stringify(initialTemplate)) {
             templateToLoad = initialTemplate;
             shouldReconstruct = true;
             newActiveRows = (initialTemplate.rows || []).map(r => r.id).filter(Boolean) as string[];
         }
    } else if (currentTemplate.id === null && (!initialTemplate || initialTemplate.id === null)) { 
        const freshDefault = memoizedGetFreshDefaultTemplate(null, currentTemplate.name);
        if (JSON.stringify(currentTemplate) !== JSON.stringify(freshDefault)) {
             templateToLoad = freshDefault;
             shouldReconstruct = true;
             newActiveRows = (freshDefault.rows || []).map(r => r.id).filter(Boolean) as string[];
        }
    }
    
    if (shouldReconstruct) {
      const reconstructed = reconstructTemplate(templateToLoad);
      setCurrentTemplate(reconstructed);
      setAspectRatioInput(reconstructed.aspectRatio || TCG_ASPECT_RATIO);
      if (newActiveRows) {
        setActiveRowAccordionItems(newActiveRows);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, selectedTemplateToEditId, templates, reconstructTemplate, memoizedGetFreshDefaultTemplate, resetFormToNew]);
  
  useEffect(() => {
    setAspectRatioInput(currentTemplate.aspectRatio || TCG_ASPECT_RATIO);
    if (currentTemplate.id !== selectedTemplateToEditId && selectedTemplateToEditId === null) {
        setActiveRowAccordionItems((currentTemplate.rows || []).map(r => r.id).filter(Boolean) as string[]);
    }
  }, [currentTemplate, TCG_ASPECT_RATIO, selectedTemplateToEditId]);


  const updateCurrentTemplate = useCallback((updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  }, []);


  const updateRow = useCallback((rowId: string, updates: Partial<CardRow>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => r.id === rowId ? { ...r, ...updates } : r)
    }));
  }, []);

  const addRow = useCallback(() => {
    const newRowId = nanoid();
    setCurrentTemplate(prev => ({
      ...prev,
      rows: [...(prev.rows || []), createDefaultRow(newRowId)]
    }));
    setActiveRowAccordionItems(prevActive => [...prevActive, newRowId]);
    setIsRowsAndSectionsCardOpen(true); 
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setCurrentTemplate(prev => {
      let newRows = (prev.rows || []).filter(r => r.id !== rowId);
      if (newRows.length === 0) {
        const newFallbackRowId = nanoid();
        newRows.push(createDefaultRow(newFallbackRowId));
        setActiveRowAccordionItems([newFallbackRowId]);
      } else {
        setActiveRowAccordionItems(prevActive => prevActive.filter(id => id !== rowId));
      }
      return { ...prev, rows: newRows };
    });
  }, []);

  const moveRow = useCallback((rowId: string, direction: 'up' | 'down') => {
    setCurrentTemplate(prev => {
        const rows = [...(prev.rows || [])];
        const index = rows.findIndex(r => r.id === rowId);
        if (index === -1) return prev;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= rows.length) return prev;
        [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
        return { ...prev, rows };
    });
  }, []);

  const addSectionToRow = useCallback((rowId: string) => {
    const newSectionId = nanoid();
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => r.id === rowId ? { ...r, columns: [...(r.columns || []), createDefaultSection(newSectionId)] } : r)
    }));
    setActiveStylingAccordion(newSectionId); 
    setActiveColumnAccordionItems(prevActive => [...prevActive, newSectionId]); 
    if (!activeRowAccordionItems.includes(rowId)) setActiveRowAccordionItems(prevActive => [...prevActive, rowId]);
    setIsRowsAndSectionsCardOpen(true); 
  }, [activeRowAccordionItems]);


  const removeSectionFromRow = useCallback((rowId: string, sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => r.id === rowId ? { ...r, columns: (r.columns || []).filter(s => s.id !== sectionId).length > 0 ? (r.columns || []).filter(s => s.id !== sectionId) : [createDefaultSection(nanoid())] } : r)
    }));
    if (activeStylingAccordion === sectionId) setActiveStylingAccordion(null);
    setActiveColumnAccordionItems(prevActive => prevActive.filter(id => id !== sectionId));
  }, [activeStylingAccordion]);

  const onUpdateSectionInRow = useCallback((rowId: string, sectionId: string, updates: Partial<CardSection>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => r.id === rowId ? { ...r, columns: (r.columns || []).map(s => s.id === sectionId ? { ...s, ...updates } : s) } : r)
    }));
  }, []);

  const moveSectionInRow = useCallback((rowId: string, sectionId: string, direction: 'left' | 'right') => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: (prev.rows || []).map(r => {
        if (r.id === rowId) {
          const cols = [...(r.columns || [])];
          const idx = cols.findIndex(s => s.id === sectionId);
          if (idx === -1) return r;
          const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
          if (targetIdx >= 0 && targetIdx < cols.length) [cols[idx], cols[targetIdx]] = [cols[targetIdx], cols[idx]];
          return { ...r, columns: cols };
        }
        return r;
      })
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    let templateToSave = { ...currentTemplate };

    if (!templateToSave.name?.trim()) {
      toast({ title: "Validation Error", description: "Template name cannot be empty.", variant: "destructive" });
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

    if (templateToSave.id === null) { 
      templateToSave.id = nanoid(); 
    }

    const existingTemplateWithSameName = templates.find(t => t.name === templateToSave.name && t.id !== templateToSave.id);
    if (existingTemplateWithSameName) {
        toast({ title: "Save Error", description: `A different template with the name "${templateToSave.name}" already exists. Please choose a unique name.`, variant: "destructive" });
        return;
    }

    const finalTemplateToSave = reconstructTemplate(templateToSave);
    onSaveTemplate(finalTemplateToSave);

    if (selectedTemplateToEditId !== finalTemplateToSave.id) {
      setSelectedTemplateToEditId(finalTemplateToSave.id!);
    }
     toast({ title: "Template Saved", description: `"${finalTemplateToSave.name}" has been saved.`});
  }, [currentTemplate, templates, onSaveTemplate, toast, reconstructTemplate, selectedTemplateToEditId]);


  const handleSelectTemplateToEdit = useCallback((templateId: string | null) => {
    if (templateId === null) { 
        resetFormToNew();
    } else {
        const found = templates.find(t => t.id === templateId);
        if (found) {
            setSelectedTemplateToEditId(templateId); 
        } else { 
            resetFormToNew();
        }
    }
  }, [templates, resetFormToNew]);


  const isNonCustomizableFrame = useMemo(() =>
    currentTemplate.frameStyle &&
    currentTemplate.frameStyle !== 'standard' &&
    currentTemplate.frameStyle !== 'custom'
  , [currentTemplate.frameStyle]);

  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    extractUniquePlaceholderKeys(currentTemplate).forEach(p => {
      data[p.key] = p.defaultValue !== undefined ? p.defaultValue : `{{${p.key}}}`;
    });
    return data;
  }, [currentTemplate]);

  const onToggleStylingAccordion = useCallback((sectionId: string) => {
    setActiveStylingAccordion(prev => prev === sectionId ? null : sectionId);
  }, []);

  const onToggleColumnAccordion = useCallback((sectionId: string) => {
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
    const parentRow = (currentTemplate.rows || []).find(r => (r.columns || []).some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)) setActiveRowAccordionItems(prevActive => [...prevActive, parentRow.id]);
    onToggleColumnAccordion(sectionId);
    setTimeout(() => document.querySelector(`.column-editor-card[data-section-id="${sectionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }, [currentTemplate.rows, activeRowAccordionItems, onToggleColumnAccordion]);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5"/>Your Templates</CardTitle>
          <CardDescription>Create new, or edit an existing template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => handleSelectTemplateToEdit(null)} variant="outline" className="w-full flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Create New Template
          </Button>

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
                        aria-label={`Edit template ${template.name || 'Untitled Template'}`}
                      >
                        {template.name || `Template (${String(template.id).substring(0,5)})`}
                      </span>
                      <Button variant="ghost" size="icon" onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(template.id!);
                          if (selectedTemplateToEditId === template.id) resetFormToNew();
                      }} aria-label={`Delete template ${template.name || 'Untitled Template'}`} className="h-7 w-7">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
           {(templates.length === 0) && <p className="text-muted-foreground text-sm mt-2">No custom templates saved. Click "Create New Template" to start.</p>}
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
                  <AccordionTrigger className="hover:no-underline p-0">
                    <CardHeader className="flex flex-row items-center justify-between w-full hover:bg-muted/20 rounded-t-lg cursor-pointer p-4">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Edit2 className="h-5 w-5" />
                            Template Settings: <span className="text-primary font-medium">{currentTemplate.name || "Untitled Template"}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {currentTemplate.id === null ? "Define new template properties." : `Editing template properties.`}
                            {currentTemplate.id && <span className="text-xs text-muted-foreground ml-2">(ID: {typeof currentTemplate.id === 'string' ? currentTemplate.id.substring(0,8) : 'New'})</span>}
                        </CardDescription>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform duration-200",
                          isSettingsCardOpen ? "rotate-180" : ""
                        )}
                      />
                    </CardHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="templateName">Template Name</Label>
                            <Input
                                id="templateName"
                                value={currentTemplate.name || ''} 
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    updateCurrentTemplate({ name: e.target.value });
                                }}
                                placeholder="Enter a unique name for your template"
                            />
                        </div>
                        <div>
                            <Label htmlFor="templateAspectRatio">Aspect Ratio (W:H)</Label>
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
                                placeholder={`e.g., ${TCG_ASPECT_RATIO} (Standard TCG)`}
                            />
                        </div>

                        <Accordion type="single" collapsible className="w-full" defaultValue="overall-styling-accordion-item">
                            <AccordionItem value="overall-styling-accordion-item" id="overall-styling-accordion-item" className="border rounded-md">
                                <AccordionTrigger className="px-3 py-2 text-sm font-semibold hover:no-underline">
                                    <div className="flex items-center gap-2"><Settings className="h-4 w-4" /> Overall Card Styling</div>
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
                                            {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom')
                                            ? `Background is controlled by Frame Style ('${currentTemplate.frameStyle || ''}').`
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
                                                    ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').`
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
                                            disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom') ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : "For 'Standard'/'Custom Colors' frames."}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderWidth">Card Outer Border Width</Label>
                                            <Input id="cardBorderWidth" value={currentTemplate.cardBorderWidth || ''} onChange={e => updateCurrentTemplate({cardBorderWidth: e.target.value})} placeholder="e.g., 4px, 0"
                                            className="h-8 text-xs"
                                            disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom') ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : 'E.g., "4px", "0" for no border.'}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderStyle">Card Outer Border Style</Label>
                                            <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={v => updateCurrentTemplate({cardBorderStyle: (v === '_default_' ? undefined : v as TCGCardTemplate['cardBorderStyle'])}) }
                                            disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}
                                            >
                                                <SelectTrigger id="cardBorderStyle"><SelectValue/></SelectTrigger>
                                                <SelectContent>{CARD_BORDER_STYLES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom') ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : "For 'Standard'/'Custom Colors' frames."}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="cardBorderRadius">Card Corner Radius</Label>
                                            <Input id="cardBorderRadius" value={currentTemplate.cardBorderRadius || ''} onChange={e => updateCurrentTemplate({cardBorderRadius: e.target.value})} placeholder="e.g., 8px, 0.5rem"
                                            className="h-8 text-xs"
                                            disabled={isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom'}/>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {(isNonCustomizableFrame && currentTemplate.frameStyle !== 'custom') ? `Overridden by Frame Style ('${currentTemplate.frameStyle || ''}').` : 'E.g., "8px", "0.5rem".'}
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
                    <AccordionTrigger className="hover:no-underline p-0">
                        <CardHeader className="flex flex-row items-center justify-between w-full hover:bg-muted/20 rounded-t-lg cursor-pointer p-4">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Rows className="h-5 w-5 text-primary" /> Card Rows &amp; Sections (Columns)
                                </CardTitle>
                                <CardDescription className="mt-1">Define rows, then add sections (columns) to each row.</CardDescription>
                            </div>
                            <ChevronDown
                                className={cn(
                                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                                isRowsAndSectionsCardOpen ? "rotate-180" : ""
                                )}
                            />
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                        <CardContent className="px-1 py-2 sm:px-3 sm:py-3">
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
                                        <AccordionContent className="px-1 py-2 sm:px-2 sm:py-3 space-y-4 border-t bg-background/70">
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
                                                        onUpdateSectionInRow={onUpdateSectionInRow}
                                                        onRemoveSectionFromRow={removeSectionFromRow}
                                                        onMoveSectionInRow={moveSectionInRow}
                                                        isColumnAccordionOpen={activeColumnAccordionItems.includes(section.id)}
                                                        onToggleColumnAccordion={() => onToggleColumnAccordion(section.id)}
                                                    />
                                                ))}
                                            </Accordion>
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
                    </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>

            <div className="mt-6 pt-6 border-t">
                <Button type="button" onClick={handleSubmit} className="w-full flex items-center gap-2 text-lg py-6">
                    <Save className="h-5 w-5"/>
                    Save Template "{currentTemplate.name || "Untitled Template"}"
                </Button>
            </div>


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
                            <DialogTitle>Full Size Template Preview: {currentTemplate.name || "Untitled Template"}</DialogTitle>
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

