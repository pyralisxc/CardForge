
"use client";

import type { TCGCardTemplate, CardSection, CardSectionType } from '@/types';
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
import { Trash2, PlusCircle, ArrowUp, ArrowDown, Palette, Type, ChevronsUpDown, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Baseline, Info, Settings2, Paintbrush, TextCursorInput, Minus, Ratio, Ruler, FileImage, Settings, Wand2, PackageOpen, LayoutDashboard, SlidersHorizontal, EyeOff } from 'lucide-react'; // Added more icons
import { SECTION_TYPES, FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS } from '@/lib/constants';
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
  Artwork: FileImage, // Changed icon
  TypeLine: Type,
  RulesText: AlignLeft, 
  FlavorText: Italic,
  PowerToughness: ChevronsUpDown, 
  ArtistCredit: Baseline, 
  CustomText: Type,
  Divider: Minus,
};

type DimensionUnit = 'ratio' | 'px' | 'in' | 'cm';

export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  const { toast } = useToast();
  
  const getDefaultTemplate = () => {
    const creaturePreset = PRESET_TEMPLATES.find(t => t.name.includes("Standard Fantasy Creature")) || PRESET_TEMPLATES[0];
    return JSON.parse(JSON.stringify(creaturePreset));
  };

  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(initialTemplate || getDefaultTemplate());
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);
  const [activeAccordionItems, setActiveAccordionItems] = useState<string[]>([]);

  const [dimensionWidth, setDimensionWidth] = useState<string>("63");
  const [dimensionHeight, setDimensionHeight] = useState<string>("88");
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>('ratio');

  useEffect(() => {
    let newTemplateToSet: TCGCardTemplate;
    const defaultTpl = getDefaultTemplate();
    
    if (selectedTemplateToEditId) {
      const templateToEdit = templates.find(t => t.id === selectedTemplateToEditId);
      if (templateToEdit) {
        newTemplateToSet = JSON.parse(JSON.stringify(templateToEdit)); 
      } else {
        newTemplateToSet = {...defaultTpl, id: nanoid(), name: "New Custom Template (Loaded Default)"};
        setSelectedTemplateToEditId(newTemplateToSet.id); 
      }
    } else if (initialTemplate) {
         newTemplateToSet = JSON.parse(JSON.stringify(initialTemplate)); 
    } else {
        newTemplateToSet = {
            ...defaultTpl,
            id: nanoid(), 
            name: 'New Custom Template',
        };
    }

    newTemplateToSet.sections = (newTemplateToSet.sections || []).map((s: CardSection) => ({...s, id: s.id || nanoid()}));
    if (newTemplateToSet.sections.length === 0) { 
        newTemplateToSet.sections = [createDefaultSection('CardName')];
    }

    setCurrentTemplate(newTemplateToSet);
    setActiveAccordionItems(newTemplateToSet.sections.map(s => s.id));
    
    const [wStr, hStr] = (newTemplateToSet.aspectRatio || "63:88").split(':');
    const w = parseFloat(wStr);
    const h = parseFloat(hStr);
    if (!isNaN(w) && !isNaN(h)) {
        setDimensionWidth(String(w));
        setDimensionHeight(String(h));
        setDimensionUnit('ratio'); // Default to ratio if parsing a simple W:H
    } else {
        setDimensionWidth("63"); // Default if aspect ratio is invalid
        setDimensionHeight("88");
        setDimensionUnit('ratio');
    }
  }, [selectedTemplateToEditId, templates, initialTemplate]);


  useEffect(() => {
    const w = parseFloat(dimensionWidth);
    const h = parseFloat(dimensionHeight);

    if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
      updateCurrentTemplate({ aspectRatio: `${w}:${h}` });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensionWidth, dimensionHeight]); // Unit change doesn't directly alter aspect ratio string, but W/H values might get re-interpreted


  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      const newSections = preset.sections.map(s => ({...s, id: s.id || nanoid() })); 
      const newPresetTemplate = {
        ...JSON.parse(JSON.stringify(preset)), 
        id: currentTemplate.id, 
        name: currentTemplate.name || preset.name, 
        sections: newSections,
      };
      setCurrentTemplate(newPresetTemplate);
      setActiveAccordionItems(newSections.map(s => s.id));

      const [w, h] = (newPresetTemplate.aspectRatio || "63:88").split(':').map(Number);
      setDimensionWidth(String(w));
      setDimensionHeight(String(h));
      setDimensionUnit('ratio');

      toast({ title: "Preset Loaded", description: `"${preset.name}" structure loaded into editor.`});
    }
  };
  
  const updateCurrentTemplate = (updates: Partial<TCGCardTemplate>) => {
    setCurrentTemplate(prev => ({ ...prev, ...updates }));
  };

  const updateSection = (sectionId: string, updates: Partial<CardSection>) => {
    updateCurrentTemplate({
      sections: currentTemplate.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
    });
  };

  const addSection = (type: CardSectionType) => {
    const newSection = createDefaultSection(type);
    updateCurrentTemplate({ sections: [...currentTemplate.sections, newSection] });
    setActiveAccordionItems(prev => [...prev, newSection.id]);
  };

  const removeSection = (sectionId: string) => {
    updateCurrentTemplate({ sections: currentTemplate.sections.filter(s => s.id !== sectionId) });
    setActiveAccordionItems(prev => prev.filter(id => id !== sectionId));
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const index = currentTemplate.sections.findIndex(s => s.id === sectionId);
    if (index === -1) return;

    const newSections = [...currentTemplate.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    updateCurrentTemplate({ sections: newSections });
  };

  const resetFormToNew = () => {
    const newTemplateBase = PRESET_TEMPLATES.find(t => t.name.includes("Basic Custom Card")) || PRESET_TEMPLATES[0];
    const newSections = newTemplateBase.sections.map(s => ({...s, id: s.id || nanoid()}));
    const newId = nanoid();
    const newDefaultTemplate = {
      ...JSON.parse(JSON.stringify(newTemplateBase)), 
      id: newId,
      name: 'New Custom Template',
      sections: newSections,
    };
    setCurrentTemplate(newDefaultTemplate);
    setSelectedTemplateToEditId(newId); 
    setActiveAccordionItems(newSections.map(s => s.id));
    
    const [w, h] = (newDefaultTemplate.aspectRatio || "63:88").split(':').map(Number);
    setDimensionWidth(String(w));
    setDimensionHeight(String(h));
    setDimensionUnit('ratio');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTemplate.name.trim()) {
      toast({ title: "Validation Error", description: 'Template name is required.', variant: "destructive" });
      return;
    }
    if (currentTemplate.sections.length === 0 && currentTemplate.templateType === 'CustomSequential') {
      toast({ title: "Validation Error", description: 'Custom template must have at least one section.', variant: "destructive" });
      return;
    }
    const w = parseFloat(dimensionWidth);
    const h = parseFloat(dimensionHeight);
    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
        toast({ title: "Validation Error", description: 'Card dimensions for aspect ratio must be positive numbers.', variant: "destructive" });
        return;
    }
    onSaveTemplate(JSON.parse(JSON.stringify({...currentTemplate, aspectRatio: `${w}:${h}`}))); 
  };
  
  const handleSelectTemplateToEdit = (templateId: string) => {
    setSelectedTemplateToEditId(templateId);
  };

  const handleSectionClickFromPreview = (sectionId: string) => {
    setActiveAccordionItems(prev => {
      if (prev.includes(sectionId)) return prev;
      return [sectionId]; 
    });
    const itemElement = document.getElementById(`accordion-item-${sectionId}`);
    itemElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const livePreviewData = useMemo(() => {
    const data: { [key: string]: string } = {};
    if (currentTemplate && currentTemplate.sections) {
        currentTemplate.sections.forEach(section => {
          extractUniquePlaceholderKeys(section.contentPlaceholder).forEach(key => {
            data[key] = `{{${key}}}`; 
          });
        });
    }
    return data;
  }, [currentTemplate]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
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
                      <Button variant="ghost" size="sm" onClick={(e) => {
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
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{currentTemplate.id === selectedTemplateToEditId && templates.find(t=>t.id === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: {currentTemplate.name}</CardTitle>
            <CardDescription>Define overall style and card sections. Click sections in the preview below to edit.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-300px)] pr-2"> 
              <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="bg-card/50">
                  <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />Template Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="templateName">Template Name</Label>
                      <Input id="templateName" value={currentTemplate.name} onChange={(e) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., Red Creature Aggro" required />
                    </div>
                    
                    <div>
                      <Label>Card Dimensions (Defines Aspect Ratio)</Label>
                      <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                              <Label htmlFor="dimensionWidth" className="text-xs">Width</Label>
                              <Input id="dimensionWidth" type="number" value={dimensionWidth} onChange={(e) => setDimensionWidth(e.target.value)} placeholder="e.g., 63" className="w-full" />
                          </div>
                          <div>
                              <Label htmlFor="dimensionHeight" className="text-xs">Height</Label>
                              <Input id="dimensionHeight" type="number" value={dimensionHeight} onChange={(e) => setDimensionHeight(e.target.value)} placeholder="e.g., 88" className="w-full" />
                          </div>
                          <div>
                              <Label htmlFor="dimensionUnit" className="text-xs">Unit</Label>
                              <Select value={dimensionUnit} onValueChange={(v) => setDimensionUnit(v as DimensionUnit)} disabled>
                                  {/* Unit selection is disabled as aspect ratio is primarily W:H. Actual print size is separate. */}
                                  <SelectTrigger id="dimensionUnit"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="ratio">Ratio</SelectItem>
                                      {/* <SelectItem value="px">Pixels (px)</SelectItem>
                                      <SelectItem value="in">Inches (in)</SelectItem>
                                      <SelectItem value="cm">Centimeters (cm)</SelectItem> */}
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Current Aspect Ratio: <strong>{currentTemplate.aspectRatio || "Not set"}</strong>. Standard TCG is 63:88.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="templateType">Template Type</Label>
                        <Select value={currentTemplate.templateType} onValueChange={(v) => updateCurrentTemplate({ templateType: v as TCGCardTemplate['templateType'] })} disabled>
                          <SelectTrigger id="templateType"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CustomSequential">Custom Sequential Sections</SelectItem>
                          </SelectContent>
                        </Select>
                         <p className="text-xs text-muted-foreground mt-1">Sections define the card layout from top to bottom.</p>
                      </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="overall-styling">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          <div className="flex items-center gap-2"><Palette className="h-4 w-4" /> Overall Card Styling <Info className="inline h-3 w-3 text-muted-foreground" /></div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                            <div><Label htmlFor="frameColor">Frame Color</Label><Input id="frameColor" type="color" value={currentTemplate.frameColor || '#CCCCCC'} onChange={(e) => updateCurrentTemplate({ frameColor: e.target.value })} /></div>
                            <div><Label htmlFor="borderColor">Default Section Border</Label><Input id="borderColor" type="color" value={currentTemplate.borderColor || '#888888'} onChange={(e) => updateCurrentTemplate({ borderColor: e.target.value })} /></div>
                            <div><Label htmlFor="baseBgColor">Base Background</Label><Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || '#FFFFFF'} onChange={(e) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} /></div>
                            <div><Label htmlFor="baseTextColor">Base Text Color</Label><Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || '#000000'} onChange={(e) => updateCurrentTemplate({ baseTextColor: e.target.value })} /></div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ChevronsUpDown className="h-5 w-5 text-primary" /> Card Sections (Top to Bottom Order)
                    </CardTitle>
                    <CardDescription>Define each visual layer of your card. Use <code>{`{{placeholder}}`}</code> syntax for dynamic data.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion 
                      type="multiple" 
                      value={activeAccordionItems}
                      onValueChange={setActiveAccordionItems}
                      className="w-full space-y-2"
                    >
                      {currentTemplate.sections.map((section, index) => {
                        const IconComponent = iconMap[section.type] || Type;
                        return (
                        <AccordionItem value={section.id} key={section.id} id={`accordion-item-${section.id}`} className="border border-border bg-card/60 rounded-md overflow-hidden last:mb-0">
                          <div className="flex items-center w-full px-2 py-1 hover:bg-muted/30 rounded-t-md">
                            <AccordionTrigger className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring">
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{index + 1}. {section.type}</span>
                              </div>
                            </AccordionTrigger>
                            <div className="flex gap-1 ml-2 flex-shrink-0">
                              <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'up')}} disabled={index === 0} aria-label="Move section up"><ArrowUp className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'down')}} disabled={index === currentTemplate.sections.length - 1} aria-label="Move section down"><ArrowDown className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeSection(section.id)}} aria-label="Remove section"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                          <AccordionContent className="p-3 space-y-3 border-t bg-card/30">
                            <div>
                              <Label htmlFor={`sectionType-${section.id}`}>Section Type</Label>
                              <Select value={section.type} onValueChange={(v) => updateSection(section.id, { type: v as CardSectionType })}>
                                <SelectTrigger id={`sectionType-${section.id}`}><SelectValue /></SelectTrigger>
                                <SelectContent>{SECTION_TYPES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label htmlFor={`contentPlaceholder-${section.id}`}>Content Placeholder (use <code>{`{{fieldName}}`}</code>)</Label>
                              <Textarea id={`contentPlaceholder-${section.id}`} value={section.contentPlaceholder} onChange={(e) => updateSection(section.id, { contentPlaceholder: e.target.value })} rows={section.type === 'RulesText' || section.type === 'FlavorText' ? 3 : 2} />
                               <p className="text-xs text-muted-foreground mt-1">Placeholders like <code>{`{{cardName}}`}</code>, <code>{`{{rulesText}}`}</code>, <code>{`{{artworkUrl}}`}</code> will be replaced by data.</p>
                            </div>
                            
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="section-styling" className="border-none">
                                <AccordionTrigger className="text-xs font-medium text-muted-foreground hover:text-foreground hover:no-underline py-1.5">
                                  <div className="flex items-center gap-1.5"><Paintbrush className="h-3.5 w-3.5" /> Styling Options</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-3">
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
                                    <div>
                                      <Label htmlFor={`fontFamily-${section.id}`} className="text-xs">Font Family</Label>
                                      <Select value={section.fontFamily || 'font-sans'} onValueChange={v => updateSection(section.id, {fontFamily: v})}>
                                          <SelectTrigger id={`fontFamily-${section.id}`}><SelectValue/></SelectTrigger>
                                          <SelectContent>{AVAILABLE_FONTS.map(f=><SelectItem key={f.value} value={f.value!}><span className={f.value}>{f.name}</span></SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`fontSize-${section.id}`} className="text-xs">Font Size</Label>
                                      <Select value={section.fontSize || 'text-sm'} onValueChange={v => updateSection(section.id, {fontSize: v as CardSection['fontSize']})}>
                                          <SelectTrigger id={`fontSize-${section.id}`}><SelectValue/></SelectTrigger>
                                          <SelectContent>{FONT_SIZES.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`fontWeight-${section.id}`} className="text-xs">Font Weight</Label>
                                      <Select value={section.fontWeight || 'font-normal'} onValueChange={v => updateSection(section.id, {fontWeight: v as CardSection['fontWeight']})}>
                                          <SelectTrigger id={`fontWeight-${section.id}`}><SelectValue/></SelectTrigger>
                                          <SelectContent>{FONT_WEIGHTS.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`fontStyle-${section.id}`} className="text-xs">Font Style</Label>
                                      <Select value={section.fontStyle || 'normal'} onValueChange={v => updateSection(section.id, {fontStyle: v as CardSection['fontStyle']})}>
                                          <SelectTrigger id={`fontStyle-${section.id}`}><SelectValue/></SelectTrigger>
                                          <SelectContent>{FONT_STYLES.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`textAlign-${section.id}`} className="text-xs">Text Align</Label>
                                      <Select value={section.textAlign || 'left'} onValueChange={v => updateSection(section.id, {textAlign: v as CardSection['textAlign']})}>
                                          <SelectTrigger id={`textAlign-${section.id}`}><SelectValue/></SelectTrigger>
                                          <SelectContent>{TEXT_ALIGNS.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div><Label htmlFor={`textColor-${section.id}`} className="text-xs">Text Color</Label><Input id={`textColor-${section.id}`} type="color" value={section.textColor || currentTemplate.baseTextColor || '#000000'} onChange={(e) => updateSection(section.id, { textColor: e.target.value })} /></div>
                                    
                                    <div><Label htmlFor={`bgColor-${section.id}`} className="text-xs">Background</Label><Input id={`bgColor-${section.id}`} type="color" value={section.backgroundColor || ''} onChange={(e) => updateSection(section.id, { backgroundColor: e.target.value === '#000000' && !section.backgroundColor ? '' : e.target.value })} /></div>
                                    <div>
                                      <Label htmlFor={`padding-${section.id}`} className="text-xs">Padding</Label>
                                      <Select value={section.padding || 'p-1'} onValueChange={v => updateSection(section.id, {padding: v})}>
                                          <SelectTrigger id={`padding-${section.id}`}><SelectValue/></SelectTrigger>
                                          <SelectContent>{PADDING_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div><Label htmlFor={`borderColor-${section.id}`} className="text-xs">Border Color</Label><Input id={`borderColor-${section.id}`} type="color" value={section.borderColor || currentTemplate.borderColor || '#888888'} onChange={(e) => updateSection(section.id, { borderColor: e.target.value })} /></div>
                                    <div>
                                      <Label htmlFor={`borderWidth-${section.id}`} className="text-xs">Border Width</Label>
                                      <Select 
                                        value={section.borderWidth || '_none_'} 
                                        onValueChange={v => updateSection(section.id, {borderWidth: v === '_none_' ? undefined : v})}
                                      >
                                          <SelectTrigger id={`borderWidth-${section.id}`}><SelectValue placeholder="No border"/></SelectTrigger>
                                          <SelectContent>{BORDER_WIDTH_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor={`minHeight-${section.id}`} className="text-xs">Min Height</Label>
                                      <Select 
                                        value={section.minHeight || '_auto_'} 
                                        onValueChange={v => updateSection(section.id, {minHeight: v === '_auto_' ? undefined : v})}
                                      >
                                          <SelectTrigger id={`minHeight-${section.id}`}><SelectValue placeholder="Auto"/></SelectTrigger>
                                          <SelectContent>{MIN_HEIGHT_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </div>
                                    
                                    <div className="flex items-center col-span-full sm:col-span-1 mt-2">
                                        <input type="checkbox" id={`flexGrow-${section.id}`} checked={!!section.flexGrow} onChange={(e) => updateSection(section.id, { flexGrow: e.target.checked })} className="mr-2 h-4 w-4 rounded border-primary text-primary focus:ring-primary" />
                                        <Label htmlFor={`flexGrow-${section.id}`} className="cursor-pointer text-xs">Flex Grow (expand vertically)</Label>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </AccordionContent>
                        </AccordionItem>
                      )})}
                    </Accordion>
                     <div className="mt-4">
                        <Select onValueChange={(value) => { if(value) addSection(value as CardSectionType)}}>
                        <SelectTrigger className="w-full md:w-auto">
                            <SelectValue placeholder="Add New Section Type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {SECTION_TYPES.map(type => (
                            <SelectItem key={type} value={type}><PlusCircle className="inline mr-2 h-4 w-4"/>Add {type} Section</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                  </CardContent>
                </Card>
                
                <CardFooter className="p-4 border-t">
                    <Button type="submit" className="w-full md:w-auto">Save Template</Button>
                </CardFooter>

              </form>
            </ScrollArea>
             <div className="mt-6 pt-6 border-t">
                <h4 className="text-lg font-semibold mb-2 text-center">Live Template Preview</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">(Shows placeholders as content. Click section to edit.)</p>
                <div className="mx-auto max-w-xs"> 
                  <CardPreview 
                    template={currentTemplate} 
                    data={livePreviewData} 
                    isPrintMode={false} 
                    isEditorPreview={true} 
                    hideEmptySections={false} 
                    onSectionClick={handleSectionClickFromPreview}
                  />
                </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
