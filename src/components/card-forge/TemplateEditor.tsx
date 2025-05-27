
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
import { Trash2, PlusCircle, ArrowUp, ArrowDown, Palette, Type, ChevronsUpDown, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Baseline, Info, Settings2, Paintbrush, TextCursorInput, Minus, Ratio, Ruler, FileImage, Settings, Wand2, PackageOpen, LayoutDashboard, SlidersHorizontal, EyeOff, Save, Cog } from 'lucide-react';
import { SECTION_TYPES, FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS, FRAME_STYLES } from '@/lib/constants';
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
  CustomText: Type,
  Divider: Minus,
};

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
  const [aspectRatioInput, setAspectRatioInput] = useState<string>(currentTemplate.aspectRatio || "63:88");


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
    if (newTemplateToSet.sections.length === 0 && newTemplateToSet.templateType === 'CustomSequential') { 
        newTemplateToSet.sections = [createDefaultSection('CardName')];
    }
    newTemplateToSet.frameStyle = newTemplateToSet.frameStyle || 'standard';
    newTemplateToSet.aspectRatio = newTemplateToSet.aspectRatio || "63:88";


    setCurrentTemplate(newTemplateToSet);
    setActiveAccordionItems(newTemplateToSet.sections.map(s => s.id));
    setAspectRatioInput(newTemplateToSet.aspectRatio || "63:88");
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateToEditId, templates, initialTemplate]);


  useEffect(() => {
    // Validate aspect ratio format (simple W:H)
    const ratioParts = aspectRatioInput.split(':').map(Number);
    if (ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0) {
      updateCurrentTemplate({ aspectRatio: aspectRatioInput });
    } else if (!aspectRatioInput && currentTemplate.aspectRatio) { 
      // Do nothing, keep currentTemplate.aspectRatio if input is cleared but a valid one exists
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatioInput]);


  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      const newSections = preset.sections.map(s => ({...s, id: s.id || nanoid() })); 
      const newPresetTemplate = {
        ...JSON.parse(JSON.stringify(preset)), 
        id: currentTemplate.id, 
        name: currentTemplate.name || preset.name, 
        sections: newSections,
        frameStyle: preset.frameStyle || 'standard',
        aspectRatio: preset.aspectRatio || "63:88",
      };
      setCurrentTemplate(newPresetTemplate);
      setActiveAccordionItems(newSections.map(s => s.id));
      setAspectRatioInput(newPresetTemplate.aspectRatio || "63:88");
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
    const newDefaultTemplate: TCGCardTemplate = {
      ...JSON.parse(JSON.stringify(newTemplateBase)), 
      id: newId,
      name: 'New Custom Template',
      sections: newSections,
      templateType: 'CustomSequential',
      aspectRatio: newTemplateBase.aspectRatio || "63:88",
      frameStyle: newTemplateBase.frameStyle || 'standard',
    };
    setCurrentTemplate(newDefaultTemplate);
    setSelectedTemplateToEditId(newId); 
    setActiveAccordionItems(newSections.map(s => s.id));
    setAspectRatioInput(newDefaultTemplate.aspectRatio || "63:88");
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
     const ratioParts = aspectRatioInput.split(':').map(Number);
    if (!(ratioParts.length === 2 && !isNaN(ratioParts[0]) && ratioParts[0] > 0 && !isNaN(ratioParts[1]) && ratioParts[1] > 0)) {
        toast({ title: "Validation Error", description: 'Aspect Ratio must be in W:H format (e.g., 63:88) with positive numbers.', variant: "destructive" });
        return;
    }
    onSaveTemplate(JSON.parse(JSON.stringify({...currentTemplate, aspectRatio: aspectRatioInput }))); 
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
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        {currentTemplate.id === selectedTemplateToEditId && templates.find(t=>t.id === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: <span className="text-primary">{currentTemplate.name}</span>
                    </CardTitle>
                    <CardDescription>Define overall style and card sections. Click sections in the preview to edit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input id="templateName" value={currentTemplate.name} onChange={(e) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., Red Creature Aggro" required />
                    </div>
                    
                    <div>
                        <Label htmlFor="templateAspectRatio">Card Aspect Ratio (W:H)</Label>
                        <Input 
                            id="templateAspectRatio" 
                            value={aspectRatioInput} 
                            onChange={(e) => setAspectRatioInput(e.target.value)} 
                            placeholder="e.g., 63:88 (Standard TCG)" 
                        />
                        <p className="text-xs text-muted-foreground mt-1">Standard TCG is 63:88. This defines the card's shape.</p>
                    </div>

                    <h4 className="text-sm font-medium pt-2 border-t mt-4">Overall Card Styling</h4>
                    <div className="space-y-3 pl-1">
                        <div>
                            <Label htmlFor="templateFrameStyle" className="text-xs">Card Frame Style</Label>
                            <Select value={currentTemplate.frameStyle || 'standard'} onValueChange={v => updateCurrentTemplate({frameStyle: v})}>
                                <SelectTrigger id="templateFrameStyle"><SelectValue/></SelectTrigger>
                                <SelectContent>{FRAME_STYLES.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">Frame Style selection applies predefined borders and backgrounds. Colors below might be overridden or act as fallbacks.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                        <div><Label htmlFor="frameColor" className="text-xs">Frame Color (Legacy)</Label><Input id="frameColor" type="color" value={currentTemplate.frameColor || ''} onChange={(e) => updateCurrentTemplate({ frameColor: e.target.value })} /></div>
                        <div><Label htmlFor="borderColor" className="text-xs">Default Section Border</Label><Input id="borderColor" type="color" value={currentTemplate.borderColor || ''} onChange={(e) => updateCurrentTemplate({ borderColor: e.target.value })} /></div>
                        <div><Label htmlFor="baseBgColor" className="text-xs">Base Background</Label><Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || ''} onChange={(e) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} /></div>
                        <div><Label htmlFor="baseTextColor" className="text-xs">Base Text Color</Label><Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || ''} onChange={(e) => updateCurrentTemplate({ baseTextColor: e.target.value })} /></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-4 border-t">
                   <Button type="submit" className="w-full sm:w-auto ml-auto">
                        <Save className="mr-2 h-4 w-4"/>
                        Save Template Settings
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <ChevronsUpDown className="h-5 w-5 text-primary" /> Card Sections (Ordered Top to Bottom)
                </CardTitle>
                <CardDescription>Define each visual layer of your card. Use <code>{`{{placeholder}}`}</code> syntax for dynamic data fields.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
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
                                <p className="text-xs text-muted-foreground mt-1">Placeholders like <code>{`{{cardName}}`}</code>, <code>{`{{artworkUrl}}`}</code> will be replaced by data.</p>
                            </div>
                            
                            <Accordion type="single" collapsible className="w-full border rounded-md p-2 bg-background/30" defaultValue="styling-options-inner">
                                <AccordionItem value="styling-options-inner" className="border-none">
                                <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:no-underline py-1.5">
                                    <div className="flex items-center gap-1.5"><Paintbrush className="h-4 w-4" /> Styling Options</div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 space-y-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
                                    <div>
                                        <Label htmlFor={`fontFamily-${section.id}`} className="text-xs">Font Family</Label>
                                        <Select value={section.fontFamily || 'font-sans'} onValueChange={v => updateSection(section.id, {fontFamily: v})}>
                                            <SelectTrigger id={`fontFamily-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>{AVAILABLE_FONTS.map(f=><SelectItem key={f.value} value={f.value!} className="text-xs"><span className={f.value}>{f.name}</span></SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor={`fontSize-${section.id}`} className="text-xs">Font Size</Label>
                                        <Select value={section.fontSize || 'text-sm'} onValueChange={v => updateSection(section.id, {fontSize: v as CardSection['fontSize']})}>
                                            <SelectTrigger id={`fontSize-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FONT_SIZES.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor={`fontWeight-${section.id}`} className="text-xs">Font Weight</Label>
                                        <Select value={section.fontWeight || 'font-normal'} onValueChange={v => updateSection(section.id, {fontWeight: v as CardSection['fontWeight']})}>
                                            <SelectTrigger id={`fontWeight-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FONT_WEIGHTS.map(s=><SelectItem key={s} value={s!} className="text-xs">{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor={`fontStyle-${section.id}`} className="text-xs">Font Style</Label>
                                        <Select value={section.fontStyle || 'normal'} onValueChange={v => updateSection(section.id, {fontStyle: v as CardSection['fontStyle']})}>
                                            <SelectTrigger id={`fontStyle-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>{FONT_STYLES.map(s=><SelectItem key={s} value={s!} className="text-xs">{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor={`textAlign-${section.id}`} className="text-xs">Text Align</Label>
                                        <Select value={section.textAlign || 'left'} onValueChange={v => updateSection(section.id, {textAlign: v as CardSection['textAlign']})}>
                                            <SelectTrigger id={`textAlign-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>{TEXT_ALIGNS.map(s=><SelectItem key={s} value={s!} className="text-xs">{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div><Label htmlFor={`textColor-${section.id}`} className="text-xs">Text Color</Label><Input id={`textColor-${section.id}`} type="color" className="h-8" value={section.textColor || currentTemplate.baseTextColor || ''} onChange={(e) => updateSection(section.id, { textColor: e.target.value })} /></div>
                                    
                                    <div><Label htmlFor={`bgColor-${section.id}`} className="text-xs">Background</Label><Input id={`bgColor-${section.id}`} type="color" className="h-8" value={section.backgroundColor || ''} onChange={(e) => updateSection(section.id, { backgroundColor: e.target.value })} /></div>
                                    <div>
                                        <Label htmlFor={`padding-${section.id}`} className="text-xs">Padding</Label>
                                        <Select value={section.padding || 'p-1'} onValueChange={v => updateSection(section.id, {padding: v})}>
                                            <SelectTrigger id={`padding-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                                            <SelectContent>{PADDING_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div><Label htmlFor={`borderColor-${section.id}`} className="text-xs">Border Color</Label><Input id={`borderColor-${section.id}`} type="color" className="h-8" value={section.borderColor || currentTemplate.borderColor || ''} onChange={(e) => updateSection(section.id, { borderColor: e.target.value })} /></div>
                                    <div>
                                        <Label htmlFor={`borderWidth-${section.id}`} className="text-xs">Border Width</Label>
                                        <Select 
                                        value={section.borderWidth || '_none_'} 
                                        onValueChange={v => updateSection(section.id, {borderWidth: v === '_none_' ? undefined : v})}
                                        >
                                            <SelectTrigger id={`borderWidth-${section.id}`} className="text-xs h-8"><SelectValue placeholder="No border"/></SelectTrigger>
                                            <SelectContent>{BORDER_WIDTH_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor={`minHeight-${section.id}`} className="text-xs">Min Height</Label>
                                        <Select 
                                        value={section.minHeight || '_auto_'} 
                                        onValueChange={v => updateSection(section.id, {minHeight: v === '_auto_' ? undefined : v})}
                                        >
                                            <SelectTrigger id={`minHeight-${section.id}`} className="text-xs h-8"><SelectValue placeholder="Auto"/></SelectTrigger>
                                            <SelectContent>{MIN_HEIGHT_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
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
                </CardContent>
                <CardFooter className="p-4 border-t flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Select onValueChange={(value) => { if(value) addSection(value as CardSectionType)}}>
                    <SelectTrigger className="w-full sm:w-auto">
                        <SelectValue placeholder="Add New Section Type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {SECTION_TYPES.map(type => (
                        <SelectItem key={type} value={type}><PlusCircle className="inline mr-2 h-4 w-4"/>Add {type} Section</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Button type="submit" className="w-full sm:w-auto ml-auto">
                        <Save className="mr-2 h-4 w-4"/>
                        Save Template Sections
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-6 pt-6 border-t">
                <h4 className="text-lg font-semibold mb-2 text-center">Live Template Preview</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">(Shows placeholders as content. Click section to edit.)</p>
                <div className="mx-auto max-w-xs"> 
                <CardPreview 
                    card={{template: currentTemplate, data:livePreviewData, uniqueId: 'editor-preview'}}
                    isPrintMode={false} 
                    isEditorPreview={true} 
                    hideEmptySections={false} 
                    onSectionClick={handleSectionClickFromPreview}
                />
                </div>
            </div>
        </form>
      )}
    </div>
  );
}
    