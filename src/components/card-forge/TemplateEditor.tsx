
"use client";

import type { TCGCardTemplate, CardSection, CardSectionType } from '@/types';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, PlusCircle, ArrowUp, ArrowDown, Palette, Type, ChevronsUpDown, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Baseline } from 'lucide-react';
import { TCG_ASPECT_RATIO, SECTION_TYPES, FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, createDefaultSection, DEFAULT_TEMPLATES as PRESET_TEMPLATES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

interface TemplateEditorProps {
  onSaveTemplate: (template: TCGCardTemplate) => void;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: TCGCardTemplate | null;
}

const iconMap = {
  CardName: Type,
  ManaCost: Baseline, // Placeholder, consider a specific mana icon component later
  Artwork: Palette, // Placeholder, use Image icon from lucide if available
  TypeLine: Type,
  RulesText: AlignLeft,
  FlavorText: Italic,
  PowerToughness: ChevronsUpDown, // Placeholder
  ArtistCredit: Baseline, // Placeholder
  CustomText: Type,
  Divider: Baseline, // Placeholder, use Minus icon from lucide if available
};


export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  const { toast } = useToast();
  const [currentTemplate, setCurrentTemplate] = useState<TCGCardTemplate>(
    initialTemplate || PRESET_TEMPLATES.find(t => t.templateType === 'StandardFantasyTCG') || PRESET_TEMPLATES[0] || {
      id: nanoid(),
      name: 'New Custom Template',
      templateType: 'CustomSequential',
      aspectRatio: TCG_ASPECT_RATIO,
      sections: [createDefaultSection('CardName')],
      frameColor: '#CCCCCC',
      borderColor: '#888888',
      baseBackgroundColor: '#FFFFFF',
      baseTextColor: '#000000',
    }
  );
  const [selectedTemplateToEditId, setSelectedTemplateToEditId] = useState<string | null>(initialTemplate?.id || null);

  useEffect(() => {
    if (selectedTemplateToEditId) {
      const templateToEdit = templates.find(t => t.id === selectedTemplateToEditId);
      if (templateToEdit) {
        setCurrentTemplate(JSON.parse(JSON.stringify(templateToEdit))); // Deep copy
      }
    } else if (initialTemplate) {
         setCurrentTemplate(JSON.parse(JSON.stringify(initialTemplate)));
    }
  }, [selectedTemplateToEditId, templates, initialTemplate]);

  const handleTemplatePresetChange = (presetName: string) => {
    const preset = PRESET_TEMPLATES.find(t => t.name === presetName);
    if (preset) {
      setCurrentTemplate({
        ...JSON.parse(JSON.stringify(preset)), // Deep copy preset
        id: currentTemplate.id, // Keep current ID if editing, or new one if creating
        name: currentTemplate.name || preset.name, // Keep current name or use preset's
      });
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
    updateCurrentTemplate({ sections: [...currentTemplate.sections, createDefaultSection(type)] });
  };

  const removeSection = (sectionId: string) => {
    updateCurrentTemplate({ sections: currentTemplate.sections.filter(s => s.id !== sectionId) });
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
    const newTemplateBase = PRESET_TEMPLATES.find(t => t.templateType === 'CustomSequential') || PRESET_TEMPLATES[0];
    setCurrentTemplate({
      id: nanoid(),
      name: 'New Custom Template',
      templateType: 'CustomSequential',
      aspectRatio: TCG_ASPECT_RATIO,
      sections: [createDefaultSection('CardName'), createDefaultSection('Artwork'), createDefaultSection('CustomText')],
      frameColor: newTemplateBase?.frameColor ||'#CCCCCC',
      borderColor: newTemplateBase?.borderColor ||'#888888',
      baseBackgroundColor: newTemplateBase?.baseBackgroundColor ||'#FFFFFF',
      baseTextColor: newTemplateBase?.baseTextColor ||'#000000',
    });
    setSelectedTemplateToEditId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTemplate.name.trim()) {
      toast({ title: "Validation Error", description: 'Template name is required.', variant: "destructive" });
      return;
    }
    if (currentTemplate.sections.length === 0) {
      toast({ title: "Validation Error", description: 'Template must have at least one section.', variant: "destructive" });
      return;
    }
    onSaveTemplate(JSON.parse(JSON.stringify(currentTemplate))); // Save a deep copy
    if (!selectedTemplateToEditId && !initialTemplate) { // if it was a new template
        // Optionally reset to a fresh new state or keep the current one for further edits
        // resetFormToNew(); 
    }
  };
  
  const handleSelectTemplateToEdit = (templateId: string) => {
    setSelectedTemplateToEditId(templateId);
    const templateToEdit = templates.find(t => t.id === templateId);
    if (templateToEdit) {
      setCurrentTemplate(JSON.parse(JSON.stringify(templateToEdit))); // Deep copy
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Your Templates</CardTitle>
          <CardDescription>Select a template to edit or create new.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-2">
          <Button onClick={resetFormToNew} variant="outline" className="w-full mb-3">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
          </Button>
          <Label>Load Preset Structure:</Label>
           <Select onValueChange={handleTemplatePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Load a preset..." />
            </SelectTrigger>
            <SelectContent>
              {PRESET_TEMPLATES.map(preset => (
                <SelectItem key={preset.id} value={preset.name}>{preset.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {templates.length === 0 && <p className="text-muted-foreground text-sm mt-2">No templates saved yet.</p>}
          <ul className="space-y-2 mt-3">
            {templates.map((template) => (
              <li key={template.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-muted">
                <span 
                  className="cursor-pointer flex-grow" 
                  onClick={() => handleSelectTemplateToEdit(template.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplateToEdit(template.id)}
                >
                  {template.name} {template.id === currentTemplate.id && selectedTemplateToEditId === template.id && "(Editing)"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => {
                    onDeleteTemplate(template.id);
                    if (selectedTemplateToEditId === template.id) resetFormToNew();
                }} aria-label="Delete template">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{selectedTemplateToEditId ? 'Edit Template' : 'Create New Template'}: {currentTemplate.name}</CardTitle>
          <CardDescription>Define overall style and card sections from top to bottom.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-220px)] pr-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="templateName">Template Name</Label>
                <Input id="templateName" value={currentTemplate.name} onChange={(e) => updateCurrentTemplate({ name: e.target.value })} placeholder="e.g., Red Creature Aggro" required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="templateType">Template Type</Label>
                  <Select value={currentTemplate.templateType} onValueChange={(v) => updateCurrentTemplate({ templateType: v as TCGCardTemplate['templateType'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="StandardFantasyTCG">Standard Fantasy TCG (Preset Sections)</SelectItem>
                      <SelectItem value="CustomSequential">Custom Sequential (Build Your Own)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 <div>
                  <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                  <Input id="aspectRatio" value={currentTemplate.aspectRatio} onChange={(e) => updateCurrentTemplate({ aspectRatio: e.target.value })} placeholder="e.g., 63:88" />
                </div>
              </div>

              <h4 className="text-lg font-semibold pt-3 border-t">Overall Card Styling</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div><Label htmlFor="frameColor">Frame Color</Label><Input id="frameColor" type="color" value={currentTemplate.frameColor} onChange={(e) => updateCurrentTemplate({ frameColor: e.target.value })} /></div>
                <div><Label htmlFor="borderColor">Default Border Color</Label><Input id="borderColor" type="color" value={currentTemplate.borderColor} onChange={(e) => updateCurrentTemplate({ borderColor: e.target.value })} /></div>
                <div><Label htmlFor="baseBgColor">Base Background</Label><Input id="baseBgColor" type="color" value={currentTemplate.baseBackgroundColor} onChange={(e) => updateCurrentTemplate({ baseBackgroundColor: e.target.value })} /></div>
                <div><Label htmlFor="baseTextColor">Base Text Color</Label><Input id="baseTextColor" type="color" value={currentTemplate.baseTextColor} onChange={(e) => updateCurrentTemplate({ baseTextColor: e.target.value })} /></div>
              </div>

              <h4 className="text-lg font-semibold pt-3 border-t">Card Sections (Top to Bottom)</h4>
              {currentTemplate.sections.map((section, index) => {
                const IconComponent = iconMap[section.type] || Type;
                return (
                <Card key={section.id} className="p-3 space-y-2 bg-card/50">
                  <div className="flex justify-between items-center">
                    <Label className="flex items-center gap-2"><IconComponent className="h-4 w-4" /> Section {index + 1}: {section.type}</Label>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => moveSection(section.id, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => moveSection(section.id, 'down')} disabled={index === currentTemplate.sections.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(section.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`sectionType-${section.id}`}>Section Type</Label>
                    <Select value={section.type} onValueChange={(v) => updateSection(section.id, { type: v as CardSectionType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SECTION_TYPES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`contentPlaceholder-${section.id}`}>Content Placeholder (e.g., {'{{fieldName}}'})</Label>
                    <Textarea id={`contentPlaceholder-${section.id}`} value={section.contentPlaceholder} onChange={(e) => updateSection(section.id, { contentPlaceholder: e.target.value })} rows={2} />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2 text-xs">
                    <div><Label>Text Color</Label><Input type="color" value={section.textColor} onChange={(e) => updateSection(section.id, { textColor: e.target.value })} /></div>
                    <div><Label>Background</Label><Input type="color" value={section.backgroundColor} onChange={(e) => updateSection(section.id, { backgroundColor: e.target.value })} /></div>
                    <div><Label>Padding</Label><Input value={section.padding} placeholder="e.g. p-1" onChange={(e) => updateSection(section.id, { padding: e.target.value })} /></div>
                    <div><Label>Border Color</Label><Input type="color" value={section.borderColor} onChange={(e) => updateSection(section.id, { borderColor: e.target.value })} /></div>
                    <div><Label>Border Width</Label><Input value={section.borderWidth} placeholder="e.g. border-t-2" onChange={(e) => updateSection(section.id, { borderWidth: e.target.value })} /></div>
                    <div><Label>Min Height</Label><Input value={section.minHeight} placeholder="e.g. min-h-[60px]" onChange={(e) => updateSection(section.id, { minHeight: e.target.value })} /></div>
                    
                    <div><Label>Font Size</Label><Select value={section.fontSize} onValueChange={v => updateSection(section.id, {fontSize: v as CardSection['fontSize']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FONT_SIZES.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Font Weight</Label><Select value={section.fontWeight} onValueChange={v => updateSection(section.id, {fontWeight: v as CardSection['fontWeight']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FONT_WEIGHTS.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Text Align</Label><Select value={section.textAlign} onValueChange={v => updateSection(section.id, {textAlign: v as CardSection['textAlign']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{TEXT_ALIGNS.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Font Style</Label><Select value={section.fontStyle} onValueChange={v => updateSection(section.id, {fontStyle: v as CardSection['fontStyle']})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FONT_STYLES.map(s=><SelectItem key={s} value={s!}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex items-center col-span-full sm:col-span-1">
                        <input type="checkbox" id={`flexGrow-${section.id}`} checked={!!section.flexGrow} onChange={(e) => updateSection(section.id, { flexGrow: e.target.checked })} className="mr-2" />
                        <Label htmlFor={`flexGrow-${section.id}`}>Flex Grow (expand to fill space)</Label>
                    </div>
                  </div>
                </Card>
              )})}
              
              <Select onValueChange={(value) => addSection(value as CardSectionType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Add a New Section Type..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>Add {type} Section</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button type="submit" className="w-full mt-6">Save Template</Button>
            </form>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
