
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
import { Trash2, PlusCircle, ArrowUp, ArrowDown, Palette, Type, ChevronsUpDown, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Baseline, Info, Settings2, Paintbrush, TextCursorInput, Minus } from 'lucide-react';
import { TCG_ASPECT_RATIO, SECTION_TYPES, FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS } from '@/lib/constants';
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
  Artwork: Paintbrush,
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
  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(
    initialTemplate || JSON.parse(JSON.stringify(PRESET_TEMPLATES.find(t => t.name.includes("Standard Fantasy Creature")) || PRESET_TEMPLATES[0])) || { 
      id: nanoid(),
      name: 'New Custom Template',
      templateType: 'CustomSequential',
      aspectRatio: TCG_ASPECT_RATIO,
      sections: [createDefaultSection('CardName'), createDefaultSection('Artwork'), createDefaultSection('RulesText')],
      frameColor: '#CCCCCC',
      borderColor: '#888888',
      baseBackgroundColor: '#FFFFFF',
      baseTextColor: '#000000',
    }
  );
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);
  const [activeAccordionItems, setActiveAccordionItems] = useState<string[]>([]);


  useEffect(() => {
    let newTemplateToSet: TCGCardTemplate;
    const creaturePreset = PRESET_TEMPLATES.find(t => t.name.includes("Standard Fantasy Creature")) || PRESET_TEMPLATES[0];
    
    if (selectedTemplateToEditId) {
      const templateToEdit = templates.find(t => t.id === selectedTemplateToEditId);
      if (templateToEdit) {
        newTemplateToSet = JSON.parse(JSON.stringify(templateToEdit)); 
      } else {
        newTemplateToSet = {...JSON.parse(JSON.stringify(creaturePreset)), id: nanoid(), name: "New Custom Template (Loaded Default)"};
        setSelectedTemplateToEditId(newTemplateToSet.id); 
      }
    } else if (initialTemplate) {
         newTemplateToSet = JSON.parse(JSON.stringify(initialTemplate)); 
    } else {
        newTemplateToSet = {
            ...JSON.parse(JSON.stringify(creaturePreset)),
            id: nanoid(), 
            name: 'New Custom Template',
        };
    }

    newTemplateToSet.sections = newTemplateToSet.sections.map(s => ({...s, id: s.id || nanoid()}));

    setCurrentTemplate(newTemplateToSet);
    setActiveAccordionItems(newTemplateToSet.sections.map(s => s.id));
  }, [selectedTemplateToEditId, templates, initialTemplate]);

  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      const newSections = preset.sections.map(s => ({...s, id: s.id || nanoid() })); 
      setCurrentTemplate({
        ...JSON.parse(JSON.stringify(preset)), 
        id: currentTemplate.id, 
        name: currentTemplate.name || preset.name, 
        sections: newSections,
      });
      setActiveAccordionItems(newSections.map(s => s.id));
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
    setCurrentTemplate({
      ...JSON.parse(JSON.stringify(newTemplateBase)), 
      id: newId,
      name: 'New Custom Template',
      sections: newSections,
    });
    setSelectedTemplateToEditId(newId); 
    setActiveAccordionItems(newSections.map(s => s.id));
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
    onSaveTemplate(JSON.parse(JSON.stringify(currentTemplate))); 
  };
  
  const handleSelectTemplateToEdit = (templateId: string) => {
    setSelectedTemplateToEditId(templateId);
  };

  const handleSectionClickFromPreview = (sectionId: string) => {
    setActiveAccordionItems(prev => {
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
          <CardTitle>Your Templates</CardTitle>
          <CardDescription>Select or create a template.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-3">
          <Button onClick={resetFormToNew} variant="outline" className="w-full mb-3">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
          </Button>
          <div>
            <Label>Load Preset Structure:</Label>
            <Select onValueChange={handleTemplatePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Load a preset..." />
              </SelectTrigger>
              <SelectContent>
                {PRESET_TEMPLATES.map(preset => (
                  <SelectItem key={preset.id || preset.name} value={preset.name}>{preset.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {templates.length === 0 && <p className="text-muted-foreground text-sm mt-2">No templates saved yet.</p>}
          
          {templates.length > 0 && (
            <div className="space-y-2 mt-3 pt-3 border-t">
              <Label>Edit Existing Template:</Label>
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
            </div>
          )}
        </CardContent>
      </Card>

      {currentTemplate && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{currentTemplate.id === selectedTemplateToEditId && templates.find(t=>t.id === currentTemplate.id) ? 'Edit Template' : 'Create New Template'}: {currentTemplate.name}</CardTitle>
            <CardDescription>Define overall style and card sections from top to bottom.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-300px)] pr-2"> 
              <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4 p-4 border rounded-md bg-card/30">
                  <h4 className="text-lg font-semibold flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Template Settings</h4>
                  <div>
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input id="templateName" value={currentTemplate.name} onChange={(e) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., Red Creature Aggro" required />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="templateType">Template Type</Label>
                      <Select value={currentTemplate.templateType} onValueChange={(v) => updateCurrentTemplate({ templateType: v as TCGCardTemplate['templateType'] })}>
                        <SelectTrigger id="templateType"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CustomSequential">Custom Sequential (Build Your Own)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="aspectRatio">Aspect Ratio (e.g., 63:88)</Label>
                      <Input id="aspectRatio" value={currentTemplate.aspectRatio} onChange={(e) => updateCurrentTemplate({ aspectRatio: e.target.value })} placeholder="e.g., 63:88" />
                    </div>
                  </div>

                  <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1"><Palette className="h-4 w-4" /> Overall Card Styling <Info className="inline h-3 w-3" /></summary>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 mt-2 pt-2 border-t">
                        <div><Label htmlFor="frameColor">Frame Color</Label><Input id="frameColor" type="color" value={currentTemplate.frameColor || '#CCCCCC'} onChange={(e) => updateCurrentTemplate({ frameColor: e.target.value })} /></div>
                        <div><Label htmlFor="borderColor">Default Section Border</Label><Input id="borderColor" type="color" value={currentTemplate.borderColor || '#888888'} onChange={(e) => updateCurrentTemplate({ borderColor: e.target.value })} /></div>
                        <div><Label htmlFor="baseBgColor">Base Background</Label><Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor || '#FFFFFF'} onChange={(e) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} /></div>
                        <div><Label htmlFor="baseTextColor">Base Text Color</Label><Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor || '#000000'} onChange={(e) => updateCurrentTemplate({ baseTextColor: e.target.value })} /></div>
                      </div>
                  </details>
                </section>

                <section className="space-y-1">
                  <h4 className="text-lg font-semibold pt-3 border-t flex items-center gap-2">
                    <ChevronsUpDown className="h-5 w-5 text-primary" /> Card Sections (Top to Bottom)
                  </h4>
                  <Accordion 
                    type="multiple" 
                    value={activeAccordionItems}
                    onValueChange={setActiveAccordionItems}
                    className="w-full"
                  >
                    {currentTemplate.sections.map((section, index) => {
                      const IconComponent = iconMap[section.type] || Type;
                      return (
                      <AccordionItem value={section.id} key={section.id} id={`accordion-item-${section.id}`} className="border-border bg-card/40 rounded-md mb-2 overflow-hidden">
                        <div className="flex items-center w-full px-3 py-1 hover:bg-muted/50 rounded-t-md">
                          <AccordionTrigger className="flex-grow p-1 text-left rounded-sm justify-start data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent">
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{index + 1}. {section.type}</span>
                            </div>
                          </AccordionTrigger>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'up')}} disabled={index === 0} aria-label="Move section up"><ArrowUp className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'down')}} disabled={index === currentTemplate.sections.length - 1} aria-label="Move section down"><ArrowDown className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeSection(section.id)}} aria-label="Remove section"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                        <AccordionContent className="p-3 space-y-3 border-t bg-card/20 rounded-b-md">
                          <div>
                            <Label htmlFor={`sectionType-${section.id}`}>Section Type</Label>
                            <Select value={section.type} onValueChange={(v) => updateSection(section.id, { type: v as CardSectionType })}>
                              <SelectTrigger id={`sectionType-${section.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent>{SECTION_TYPES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor={`contentPlaceholder-${section.id}`}>Content Placeholder (use <code>{`{{fieldName}}`}</code> for data)</Label>
                            <Textarea id={`contentPlaceholder-${section.id}`} value={section.contentPlaceholder} onChange={(e) => updateSection(section.id, { contentPlaceholder: e.target.value })} rows={section.type === 'RulesText' || section.type === 'FlavorText' ? 3 : 2} />
                          </div>
                          
                          <details className="text-sm mt-2">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1"><Palette className="h-4 w-4" /> Styling Options <Info className="inline h-3 w-3" /></summary>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2 mt-2 pt-2 border-t">
                              <div>
                                <Label htmlFor={`fontFamily-${section.id}`}>Font Family</Label>
                                <Select value={section.fontFamily || 'font-sans'} onValueChange={v => updateSection(section.id, {fontFamily: v})}>
                                    <SelectTrigger id={`fontFamily-${section.id}`}><SelectValue/></SelectTrigger>
                                    <SelectContent>{AVAILABLE_FONTS.map(f=><SelectItem key={f.value} value={f.value!}><span className={f.value}>{f.name}</span></SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`fontSize-${section.id}`}>Font Size</Label>
                                <Select value={section.fontSize || 'text-sm'} onValueChange={v => updateSection(section.id, {fontSize: v as CardSection['fontSize']})}>
                                    <SelectTrigger id={`fontSize-${section.id}`}><SelectValue/></SelectTrigger>
                                    <SelectContent>{FONT_SIZES.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`fontWeight-${section.id}`}>Font Weight</Label>
                                <Select value={section.fontWeight || 'font-normal'} onValueChange={v => updateSection(section.id, {fontWeight: v as CardSection['fontWeight']})}>
                                    <SelectTrigger id={`fontWeight-${section.id}`}><SelectValue/></SelectTrigger>
                                    <SelectContent>{FONT_WEIGHTS.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`fontStyle-${section.id}`}>Font Style</Label>
                                <Select value={section.fontStyle || 'normal'} onValueChange={v => updateSection(section.id, {fontStyle: v as CardSection['fontStyle']})}>
                                    <SelectTrigger id={`fontStyle-${section.id}`}><SelectValue/></SelectTrigger>
                                    <SelectContent>{FONT_STYLES.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`textAlign-${section.id}`}>Text Align</Label>
                                <Select value={section.textAlign || 'left'} onValueChange={v => updateSection(section.id, {textAlign: v as CardSection['textAlign']})}>
                                    <SelectTrigger id={`textAlign-${section.id}`}><SelectValue/></SelectTrigger>
                                    <SelectContent>{TEXT_ALIGNS.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div><Label htmlFor={`textColor-${section.id}`}>Text Color</Label><Input id={`textColor-${section.id}`} type="color" value={section.textColor || currentTemplate.baseTextColor || '#000000'} onChange={(e) => updateSection(section.id, { textColor: e.target.value })} /></div>
                              
                              <div><Label htmlFor={`bgColor-${section.id}`}>Background Color</Label><Input id={`bgColor-${section.id}`} type="color" value={section.backgroundColor || ''} onChange={(e) => updateSection(section.id, { backgroundColor: e.target.value === '#000000' ? '' : e.target.value })} /></div>
                              <div>
                                <Label htmlFor={`padding-${section.id}`}>Padding</Label>
                                <Select value={section.padding || 'p-1'} onValueChange={v => updateSection(section.id, {padding: v})}>
                                    <SelectTrigger id={`padding-${section.id}`}><SelectValue/></SelectTrigger>
                                    <SelectContent>{PADDING_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div><Label htmlFor={`borderColor-${section.id}`}>Border Color</Label><Input id={`borderColor-${section.id}`} type="color" value={section.borderColor || currentTemplate.borderColor || '#888888'} onChange={(e) => updateSection(section.id, { borderColor: e.target.value })} /></div>
                              <div>
                                <Label htmlFor={`borderWidth-${section.id}`}>Border Width</Label>
                                <Select 
                                  value={section.borderWidth || '_none_'} 
                                  onValueChange={v => updateSection(section.id, {borderWidth: v === '_none_' ? '' : v})}
                                >
                                    <SelectTrigger id={`borderWidth-${section.id}`}><SelectValue placeholder="No border"/></SelectTrigger>
                                    <SelectContent>{BORDER_WIDTH_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`minHeight-${section.id}`}>Min Height</Label>
                                 <Select 
                                  value={section.minHeight || '_auto_'} 
                                  onValueChange={v => updateSection(section.id, {minHeight: v === '_auto_' ? '' : v})}
                                >
                                    <SelectTrigger id={`minHeight-${section.id}`}><SelectValue placeholder="Auto"/></SelectTrigger>
                                    <SelectContent>{MIN_HEIGHT_OPTIONS.map(s=><SelectItem key={s.value} value={s.value!}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              
                              <div className="flex items-center col-span-full sm:col-span-1 mt-2">
                                  <input type="checkbox" id={`flexGrow-${section.id}`} checked={!!section.flexGrow} onChange={(e) => updateSection(section.id, { flexGrow: e.target.checked })} className="mr-2 h-4 w-4 rounded border-primary text-primary focus:ring-primary" />
                                  <Label htmlFor={`flexGrow-${section.id}`} className="cursor-pointer">Flex Grow (expand vertically)</Label>
                              </div>
                            </div>
                          </details>
                        </AccordionContent>
                      </AccordionItem>
                    )})}
                  </Accordion>
                </section>
                
                <CardFooter className="flex-col items-start gap-3 p-4 border-t">
                    <Select onValueChange={(value) => { if(value) addSection(value as CardSectionType)}}>
                    <SelectTrigger className="w-full md:w-1/2">
                        <SelectValue placeholder="Add a New Section Type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {SECTION_TYPES.map(type => (
                        <SelectItem key={type} value={type}><PlusCircle className="inline mr-2 h-4 w-4"/>Add {type} Section</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    
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


    
