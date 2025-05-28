
"use client";

import type { TCGCardTemplate, CardSection, CardSectionType, CardRow } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LayoutDashboard, Trash2, PlusCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Type, ChevronsUpDown, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Baseline, Settings2, Paintbrush, TextCursorInput, Minus, Ratio, Ruler, FileImage, Settings, Cog, Frame, Rows, Columns, GripVertical, AlignVerticalSpaceAround, Save, SquarePen } from 'lucide-react';
import { SECTION_TYPES, FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS, FRAME_STYLES, ROW_ALIGN_ITEMS, createDefaultRow } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from './CardPreview';
import { extractUniquePlaceholderKeys } from '@/lib/utils';

interface TemplateEditorProps {
  onSaveTemplate: (template: TCGCardTemplate) => void;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: TCGCardTemplate | null;
}

const iconMap: Record<CardSectionType, React.ElementType> = {
  CardName: TextCursorInput,
  ManaCost: Baseline,
  Artwork: FileImage,
  TypeLine: Type,
  RulesText: AlignLeft,
  FlavorText: Italic,
  PowerToughness: ChevronsUpDown,
  ArtistCredit: Baseline,
  CustomText: SquarePen,
  Divider: Minus,
};

const getFreshDefaultTemplate = (id?: string, name?: string): TCGCardTemplate => {
  const preset = PRESET_TEMPLATES.find(t => t.name.includes("Standard Creature")) || PRESET_TEMPLATES[0];
  const newTemplate = JSON.parse(JSON.stringify(preset)) as TCGCardTemplate; // Deep clone
  newTemplate.id = id || nanoid();
  newTemplate.name = name || 'New Custom Template';
  
  newTemplate.rows = (newTemplate.rows || []).map((r: CardRow) => ({
    ...r,
    id: r.id, 
    columns: (r.columns || []).map((c: CardSection) => ({...c, id: c.id})), 
    customHeight: r.customHeight || '',
  }));

  newTemplate.aspectRatio = newTemplate.aspectRatio || "63:88";
  newTemplate.frameStyle = newTemplate.frameStyle || 'standard';
  newTemplate.baseBackgroundColor = newTemplate.baseBackgroundColor || '';
  newTemplate.baseTextColor = newTemplate.baseTextColor || '';
  newTemplate.borderColor = newTemplate.borderColor || '';
  newTemplate.legacyFrameColor = newTemplate.legacyFrameColor || ''; 
  return newTemplate;
};


export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  const { toast } = useToast();

  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(
     () => {
      if (initialTemplate) {
        const clonedInitial = JSON.parse(JSON.stringify(initialTemplate)) as TCGCardTemplate;
        return clonedInitial;
      }
      return getFreshDefaultTemplate(); 
     }
  );
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);

  const [activeRowAccordionItems, setActiveRowAccordionItems] = useState<string[]>([]);
  const [activeSectionStylingAccordionItems, setActiveSectionStylingAccordionItems] = useState<string[]>([]);
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || "63:88");
  
  useEffect(() => {
    let newTemplateToSet: TCGCardTemplate;

    if (selectedTemplateToEditId) {
      const templateToEdit = templates.find(t => t.id === selectedTemplateToEditId);
      if (templateToEdit) {
        newTemplateToSet = JSON.parse(JSON.stringify(templateToEdit)); 
      } else {
        newTemplateToSet = getFreshDefaultTemplate(selectedTemplateToEditId, "New Custom Template");
      }
    } else if (initialTemplate) {
      newTemplateToSet = JSON.parse(JSON.stringify(initialTemplate)); 
    } else {
      newTemplateToSet = getFreshDefaultTemplate();
    }
    
    newTemplateToSet.aspectRatio = newTemplateToSet.aspectRatio || "63:88";
    newTemplateToSet.frameStyle = newTemplateToSet.frameStyle || 'standard';
    newTemplateToSet.baseBackgroundColor = newTemplateToSet.baseBackgroundColor || '';
    newTemplateToSet.baseTextColor = newTemplateToSet.baseTextColor || '';
    newTemplateToSet.borderColor = newTemplateToSet.borderColor || '';
    newTemplateToSet.legacyFrameColor = newTemplateToSet.legacyFrameColor || '';
    
    newTemplateToSet.rows = (newTemplateToSet.rows || []).map((r: CardRow) => ({
        ...r,
        id: r.id, 
        columns: (r.columns || []).map((c: CardSection) => ({...c, id: c.id})), 
        customHeight: r.customHeight || '',
      }));

    setCurrentTemplate(newTemplateToSet);
    setAspectRatioInput(newTemplateToSet.aspectRatio || "63:88");
  }, [selectedTemplateToEditId, initialTemplate, templates]); 


  useEffect(() => {
    const ratioParts = aspectRatioInput.split(':').map(Number);
    if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
      if (currentTemplate.aspectRatio !== aspectRatioInput) {
        updateCurrentTemplate({ aspectRatio: aspectRatioInput });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatioInput]);


  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      const newPresetTemplate = JSON.parse(JSON.stringify(preset)) as TCGCardTemplate; 
      newPresetTemplate.id = currentTemplate.id; 
      newPresetTemplate.name = currentTemplate.name || preset.name; 
      
      newPresetTemplate.rows = (newPresetTemplate.rows || []).map((r: CardRow) => ({
        ...r,
        id: r.id, 
        columns: (r.columns || []).map((c: CardSection) => ({ ...c, id: c.id })), 
        customHeight: r.customHeight || '',
      }));
      newPresetTemplate.aspectRatio = newPresetTemplate.aspectRatio || "63:88";
      newPresetTemplate.frameStyle = newPresetTemplate.frameStyle || 'standard';
      newPresetTemplate.baseBackgroundColor = newPresetTemplate.baseBackgroundColor || '';
      newPresetTemplate.baseTextColor = newPresetTemplate.baseTextColor || '';
      newPresetTemplate.borderColor = newPresetTemplate.borderColor || '';
      newPresetTemplate.legacyFrameColor = newPresetTemplate.legacyFrameColor || '';

      setCurrentTemplate(newPresetTemplate);
      setActiveRowAccordionItems((newPresetTemplate.rows || []).map(r => r.id)); 
      setActiveSectionStylingAccordionItems([]);
      setAspectRatioInput(newPresetTemplate.aspectRatio || "63:88");
      toast({ title: "Preset Loaded", description: `"${preset.name}" structure loaded into editor.`});
    }
  };

  const updateCurrentTemplate = (updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  };

  const updateRow = (rowId: string, updates: Partial<CardRow>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: prev.rows.map(r => r.id === rowId ? { ...r, ...updates } : r),
    }));
  };

  const addRow = () => {
    const newRow = createDefaultRow(nanoid(), [createDefaultSection(nanoid(), 'CustomText')]);
    updateCurrentTemplate({ rows: [...currentTemplate.rows, newRow] });
    setActiveRowAccordionItems(prev => [...prev, newRow.id]);
  };

  const removeRow = (rowId: string) => {
    updateCurrentTemplate({ rows: currentTemplate.rows.filter(r => r.id !== rowId) });
    setActiveRowAccordionItems(prev => prev.filter(id => id !== rowId));
  };

  const moveRow = (rowId: string, direction: 'up' | 'down') => {
    const index = currentTemplate.rows.findIndex(r => r.id === rowId);
    if (index === -1) return;
    const newRows = [...currentTemplate.rows];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRows.length) return;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    updateCurrentTemplate({ rows: newRows });
  };

  const addSectionToRow = (rowId: string, type: CardSectionType) => {
    const newSection = createDefaultSection(nanoid(), type);
    setCurrentTemplate(prev => ({
      ...prev,
      rows: prev.rows.map(r =>
        r.id === rowId ? { ...r, columns: [...r.columns, newSection] } : r
      )
    }));
  };

  const removeSectionFromRow = (rowId: string, sectionId: string) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: prev.rows.map(r =>
        r.id === rowId ? { ...r, columns: r.columns.filter(s => s.id !== sectionId) } : r
      )
    }));
  };

  const updateSectionInRow = (rowId: string, sectionId: string, updates: Partial<CardSection>) => {
    setCurrentTemplate(prev => ({
      ...prev,
      rows: prev.rows.map(r =>
        r.id === rowId
        ? { ...r, columns: r.columns.map(s => s.id === sectionId ? { ...s, ...updates } : s) }
        : r
      )
    }));
  };

  const moveSectionInRow = (rowId: string, sectionId: string, direction: 'left' | 'right') => {
    setCurrentTemplate(prev => {
      const newRows = prev.rows.map(r => {
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
    setActiveRowAccordionItems((newDefaultTemplate.rows || []).map(r => r.id));
    setActiveSectionStylingAccordionItems([]);
    setAspectRatioInput(newDefaultTemplate.aspectRatio || "63:88");
  };
  
  const handleSaveCurrentTemplate = () => {
    let templateToSave = JSON.parse(JSON.stringify(currentTemplate)); 
    
    if (!templateToSave.name.trim()) {
      toast({ title: "Validation Error", description: 'Template name is required.', variant: "destructive" });
      return;
    }
    const ratioParts = aspectRatioInput.split(':').map(Number);
    if (!(ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0)) {
        toast({ title: "Validation Error", description: 'Aspect Ratio must be in W:H format (e.g., 63:88) with positive numbers.', variant: "destructive" });
        return;
    }
    templateToSave.aspectRatio = aspectRatioInput;

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
    const templateToEdit = templates.find(t => t.id === templateId);
     if (templateToEdit && templateToEdit.rows) {
       setActiveRowAccordionItems((templateToEdit.rows).map(r => r.id));
       setActiveSectionStylingAccordionItems([]);
       setAspectRatioInput(templateToEdit.aspectRatio || "63:88");
    } else {
       const newDefault = getFreshDefaultTemplate();
       setActiveRowAccordionItems((newDefault.rows || []).map(r => r.id));
       setActiveSectionStylingAccordionItems([]);
       setAspectRatioInput(newDefault.aspectRatio || "63:88");
    }
  };

  const handleRowClickFromPreview = (rowId: string) => {
    setActiveRowAccordionItems(prev => {
      if (prev.includes(rowId)) return prev.filter(id => id !== rowId); 
      return [rowId]; 
    });
    setTimeout(() => {
      const itemElement = document.getElementById(`accordion-row-${rowId}`);
      itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },0);
  };

  const handleSectionClickFromPreview = (sectionId: string) => {
    const parentRow = currentTemplate.rows.find(r => r.columns.some(s => s.id === sectionId));
    if(parentRow && !activeRowAccordionItems.includes(parentRow.id)){
        setActiveRowAccordionItems(prevActiveRows => {
          if (!prevActiveRows.includes(parentRow.id)) return [parentRow.id]; 
          return prevActiveRows;
        });
    }
     setActiveSectionStylingAccordionItems(prev => {
      if (prev.includes(sectionId)) return prev.filter(id => id !== sectionId); 
      return [sectionId]; 
    });
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
        <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-4">
          <Button onClick={resetFormToNew} variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
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
                    <li key={template.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-muted/50 transition-colors">
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
                    <CardTitle className="text-lg">
                        {templates.find(t=>t.id === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: <span className="text-primary">{currentTemplate.name || "Untitled"}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input id="templateName" value={currentTemplate.name} onChange={(e) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., My Awesome TCG Template" required />
                    </div>
                    
                    <div>
                        <Label htmlFor="templateAspectRatio" className="text-sm">Card Aspect Ratio (W:H)</Label>
                        <Input
                            id="templateAspectRatio"
                            value={aspectRatioInput}
                            onChange={(e) => setAspectRatioInput(e.target.value)}
                            placeholder="e.g., 63:88 (Standard TCG)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Standard TCG is 63:88. Current: {currentTemplate.aspectRatio}</p>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full" defaultValue="overall-styling-accordion">
                        <AccordionItem value="overall-styling-accordion" className="border rounded-md">
                            <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline">
                                <div className="flex items-center gap-2"><Cog className="h-4 w-4" /> Overall Card Styling</div>
                            </AccordionTrigger>
                            <AccordionContent className="p-3 space-y-3 border-t">
                                <div>
                                    <Label htmlFor="templateFrameStyle" className="text-xs">Card Frame Style</Label>
                                    <Select value={currentTemplate.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                        <SelectTrigger id="templateFrameStyle"><SelectValue/></SelectTrigger>
                                        <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <Label htmlFor="baseBgColor" className="text-xs">Base Background Color</Label>
                                        <Input
                                            id="baseBgColor"
                                            type="color"
                                            value={currentTemplate.baseBackgroundColor || ''}
                                            onChange={(e) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })}
                                            disabled={isNonStandardFrame}
                                        />
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {isNonStandardFrame
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || "None"}'). Set if planning to switch back.`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for default."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="baseTextColor" className="text-xs">Base Text Color</Label>
                                        <Input
                                            id="baseTextColor"
                                            type="color"
                                            value={currentTemplate.baseTextColor || ''}
                                            onChange={(e) => updateCurrentTemplate({ baseTextColor: e.target.value })}
                                            disabled={isNonStandardFrame}
                                        />
                                         <p className="text-xs text-muted-foreground mt-0.5">
                                          {isNonStandardFrame
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || "None"}'). Set if planning to switch back.`
                                            : "Applies to 'Standard' and 'Custom Colors' frames. Leave empty for default."}
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="borderColor" className="text-xs">Default Section Border Color</Label>
                                        <Input
                                            id="borderColor"
                                            type="color"
                                            value={currentTemplate.borderColor || ''}
                                            onChange={(e) => updateCurrentTemplate({ borderColor: e.target.value })}
                                        />
                                        <p className="text-xs text-muted-foreground mt-0.5">Fallback for section borders. Does not style main card outline.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="legacyFrameColor" className="text-xs">Legacy Frame Color (Use with caution)</Label>
                                        <Input
                                            id="legacyFrameColor"
                                            type="color"
                                            value={currentTemplate.legacyFrameColor || ''}
                                            onChange={(e) => updateCurrentTemplate({ legacyFrameColor: e.target.value })}
                                            disabled={isNonStandardFrame}
                                        />
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {isNonStandardFrame
                                            ? `Overridden by Frame Style ('${currentTemplate.frameStyle || "None"}').`
                                            : "Older system. Prefer 'Base Background Color' or specific Frame Styles."}
                                        </p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
                 <CardFooter className="p-4 border-t">
                    <Button type="button" onClick={handleSaveCurrentTemplate} className="w-full sm:w-auto ml-auto flex items-center">
                        <Save className="mr-2 h-4 w-4"/>
                        Save Template Settings & Structure
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Rows className="h-5 w-5 text-primary" /> Card Rows & Sections (Columns)
                </CardTitle>
                <CardDescription>Define rows, then add sections (columns) to each row. Use <code>{`{{placeholder:"default"}}`}</code> for dynamic data with defaults.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
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
                                    <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveRow(row.id, 'down')}} disabled={rowIndex === currentTemplate.rows.length - 1} aria-label="Move row down" className="h-7 w-7"><ArrowDown className="h-4 w-4" /></Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeRow(row.id)}} aria-label="Remove row" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            </div>
                            <AccordionContent className="p-3 space-y-4 border-t bg-card/30">
                              <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3'>
                                <div>
                                  <Label htmlFor={`rowAlignItems-${row.id}`} className="text-xs">Row Vertical Alignment (for columns)</Label>
                                  <Select value={row.alignItems || 'flex-start'} onValueChange={v => updateRow(row.id, {alignItems: v as CardRow['alignItems']})}>
                                      <SelectTrigger id={`rowAlignItems-${row.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                      <SelectContent>
                                        {ROW_ALIGN_ITEMS.map(item => (
                                          <SelectItem key={item.value} value={item.value!} className="text-xs">{item.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor={`rowCustomHeight-${row.id}`} className="text-xs">Row Custom Height (e.g., 100px, 20%, auto)</Label>
                                  <Input id={`rowCustomHeight-${row.id}`} value={row.customHeight || ''} onChange={(e) => updateRow(row.id, { customHeight: e.target.value })} placeholder="e.g., 100px, 20%, auto" className="h-8 text-xs" />
                                </div>
                              </div>

                              <h4 className="text-sm font-semibold flex items-center gap-2"><Columns className="h-4 w-4"/>Sections (Columns) in this Row:</h4>
                              {row.columns.length === 0 && <p className="text-xs text-muted-foreground">No sections (columns) in this row yet. Add one below.</p>}
                              <div className="space-y-3">
                                {row.columns.map((section, sectionIndex) => {
                                  const IconComponent = iconMap[section.type] || Type;
                                  return (
                                    <Card key={section.id} className="bg-background/50 p-0 overflow-hidden">
                                      <CardHeader className="flex flex-row items-center justify-between p-2 border-b bg-muted/20">
                                          <div className="flex items-center gap-2">
                                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">Column {sectionIndex + 1}: {section.type}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveSectionInRow(row.id, section.id, 'left');}} disabled={sectionIndex === 0} aria-label="Move section left" className="h-7 w-7">
                                                <ArrowLeft className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveSectionInRow(row.id, section.id, 'right');}} disabled={sectionIndex === row.columns.length - 1} aria-label="Move section right" className="h-7 w-7">
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeSectionFromRow(row.id, section.id);}} aria-label="Remove section from row" className="h-7 w-7">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                      </CardHeader>
                                      <CardContent className="p-3 space-y-3">
                                        <div>
                                            <Label htmlFor={`sectionType-${section.id}`} className="text-xs">Section Type</Label>
                                            <Select value={section.type} onValueChange={(v) => updateSectionInRow(row.id, section.id, { type: v as CardSectionType })}>
                                            <SelectTrigger id={`sectionType-${section.id}`} className="text-xs h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>{SECTION_TYPES.map(st => <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor={`contentPlaceholder-${section.id}`} className="text-xs">Content Placeholder (e.g., <code>{`{{fieldName:"Default"}}`}</code>)</Label>
                                            <Textarea id={`contentPlaceholder-${section.id}`} value={section.contentPlaceholder} onChange={(e) => updateSectionInRow(row.id, section.id, { contentPlaceholder: e.target.value })} rows={(section.type === 'RulesText' || section.type === 'FlavorText') ? 3:1} className="text-sm" />
                                            {section.type === 'Artwork' && <p className="text-xs text-muted-foreground mt-1">Set variable for image URL, e.g., <code>{`{{artworkUrl}}`}</code>. Set dimensions below.</p>}
                                        </div>

                                        <Accordion type="single" collapsible className="w-full" value={activeSectionStylingAccordionItems.includes(section.id) ? section.id : undefined} onValueChange={(val) => setActiveSectionStylingAccordionItems(val ? [val] : [])}>
                                            <AccordionItem value={section.id} id={`accordion-section-styling-${section.id}`} className="border rounded-md p-0">
                                            <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:no-underline py-1.5 px-2">
                                                <div className="flex items-center gap-1.5"><Paintbrush className="h-4 w-4" />Styling Options</div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 pb-3 px-3 space-y-2 border-t">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                                                    <div>
                                                      <Label htmlFor={`customHeight-${section.id}`} className="text-xs">Custom Height</Label>
                                                      <Input id={`customHeight-${section.id}`} value={section.customHeight || ''} onChange={(e) => updateSectionInRow(row.id, section.id, { customHeight: e.target.value })} placeholder="e.g., 180px, 50%, auto" className="h-8 text-xs" />
                                                    </div>
                                                    <div>
                                                      <Label htmlFor={`customWidth-${section.id}`} className="text-xs">Custom Width</Label>
                                                      <Input id={`customWidth-${section.id}`} value={section.customWidth || ''} onChange={(e) => updateSectionInRow(row.id, section.id, { customWidth: e.target.value })} placeholder="e.g., 100%, 250px, auto" className="h-8 text-xs" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
                                                  <div><Label htmlFor={`flexGrow-${section.id}`} className="text-xs">Flex Grow (0 for content size)</Label><Input id={`flexGrow-${section.id}`} type="number" min="0" step="0.1" className="h-8 text-xs" value={section.flexGrow || 0} onChange={(e) => updateSectionInRow(row.id, section.id, { flexGrow: parseFloat(e.target.value) || 0 })} /></div>
                                                  <div><Label htmlFor={`fontFamily-${section.id}`} className="text-xs">Font</Label><Select value={section.fontFamily || 'font-sans'} onValueChange={v => updateSectionInRow(row.id, section.id, {fontFamily: v})}><SelectTrigger id={`fontFamily-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent>{AVAILABLE_FONTS.map(f=><SelectItem key={f.value} value={f.value!} className="text-xs"><span className={f.value}>{f.name}</span></SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`fontSize-${section.id}`} className="text-xs">Size</Label><Select value={section.fontSize || 'text-sm'} onValueChange={v => updateSectionInRow(row.id, section.id, {fontSize: v as CardSection['fontSize']})}><SelectTrigger id={`fontSize-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent>{FONT_SIZES.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`fontWeight-${section.id}`} className="text-xs">Weight</Label><Select value={section.fontWeight || 'font-normal'} onValueChange={v => updateSectionInRow(row.id, section.id, {fontWeight: v as CardSection['fontWeight']})}><SelectTrigger id={`fontWeight-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent>{FONT_WEIGHTS.map(s=><SelectItem key={s} value={s!} className="text-xs">{s}</SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`fontStyle-${section.id}`} className="text-xs">Style</Label><Select value={section.fontStyle || 'normal'} onValueChange={v => updateSectionInRow(row.id, section.id, {fontStyle: v as CardSection['fontStyle']})}><SelectTrigger id={`fontStyle-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent>{FONT_STYLES.map(s=><SelectItem key={s} value={s!} className="text-xs">{s}</SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`textAlign-${section.id}`} className="text-xs">Align</Label><Select value={section.textAlign || 'left'} onValueChange={v => updateSectionInRow(row.id, section.id, {textAlign: v as CardSection['textAlign']})}><SelectTrigger id={`textAlign-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent>{TEXT_ALIGNS.map(s=><SelectItem key={s} value={s!} className="text-xs">{s}</SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`textColor-${section.id}`} className="text-xs">Text Color</Label><Input id={`textColor-${section.id}`} type="color" className="h-8" value={section.textColor || ''} onChange={(e) => updateSectionInRow(row.id, section.id, { textColor: e.target.value })} /></div>
                                                  <div><Label htmlFor={`bgColor-${section.id}`} className="text-xs">Background</Label><Input id={`bgColor-${section.id}`} type="color" className="h-8" value={section.backgroundColor || ''} onChange={(e) => updateSectionInRow(row.id, section.id, { backgroundColor: e.target.value })} /></div>
                                                  <div><Label htmlFor={`padding-${section.id}`} className="text-xs">Padding</Label><Select value={section.padding || 'p-1'} onValueChange={v => updateSectionInRow(row.id, section.id, {padding: v})}><SelectTrigger id={`padding-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger><SelectContent>{PADDING_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`borderColorSec-${section.id}`} className="text-xs">Border Color</Label><Input id={`borderColorSec-${section.id}`} type="color" className="h-8" value={section.borderColor || ''} onChange={(e) => updateSectionInRow(row.id, section.id, { borderColor: e.target.value })} /></div>
                                                  <div><Label htmlFor={`borderWidth-${section.id}`} className="text-xs">Border Width</Label><Select value={section.borderWidth || '_none_'} onValueChange={v => updateSectionInRow(row.id, section.id, {borderWidth: v === '_none_' ? undefined : v})}><SelectTrigger id={`borderWidth-${section.id}`} className="text-xs h-8"><SelectValue placeholder="No border"/></SelectTrigger><SelectContent>{BORDER_WIDTH_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent></Select></div>
                                                  <div><Label htmlFor={`minHeight-${section.id}`} className="text-xs">Min Height (Tailwind)</Label><Select value={section.minHeight || '_auto_'} onValueChange={v => updateSectionInRow(row.id, section.id, {minHeight: v === '_auto_' ? undefined : v})}><SelectTrigger id={`minHeight-${section.id}`} className="text-xs h-8"><SelectValue placeholder="Auto"/></SelectTrigger><SelectContent>{MIN_HEIGHT_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent></Select></div>
                                                </div>
                                            </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>

                                      </CardContent>
                                    </Card>
                                  );
                                })}
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
                </CardContent>
                <CardFooter className="p-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button type="button" onClick={addRow} variant="outline" className="w-full sm:w-auto flex items-center">
                        <PlusCircle className="mr-2 h-4 w-4"/> Add New Row
                    </Button>
                    <Button type="button" onClick={handleSaveCurrentTemplate} className="w-full sm:w-auto ml-auto flex items-center">
                        <Save className="mr-2 h-4 w-4"/>
                        Save Template Structure
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-6 pt-4 border-t">
                <h4 className="text-lg font-semibold mb-2 text-center">Live Template Preview</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">(Click row or section in preview to edit. Defaults shown if defined: <code>{`{{key:"default"}}`}</code>)</p>
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
