"use client";

import type { SimplifiedCardTemplate } from '@/types';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { nanoid } from 'nanoid';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Trash2, PlusCircle } from 'lucide-react';

interface TemplateEditorProps {
  onSaveTemplate: (template: SimplifiedCardTemplate) => void;
  templates: SimplifiedCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: SimplifiedCardTemplate | null;
}

const aspectRatios = ["3:2", "2:3", "5:7", "7:5", "16:9", "9:16", "1:1"];

export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  const [id, setId] = useState(initialTemplate?.id || nanoid());
  const [name, setName] = useState(initialTemplate?.name || '');
  const [titlePlaceholder, setTitlePlaceholder] = useState(initialTemplate?.titlePlaceholder || '');
  const [bodyPlaceholder, setBodyPlaceholder] = useState(initialTemplate?.bodyPlaceholder || '');
  const [imageSlot, setImageSlot] = useState(initialTemplate?.imageSlot || false);
  const [imageSrc, setImageSrc] = useState(initialTemplate?.imageSrc || `https://placehold.co/300x200.png`);
  const [aspectRatio, setAspectRatio] = useState(initialTemplate?.aspectRatio || '5:7');
  const [backgroundColor, setBackgroundColor] = useState(initialTemplate?.backgroundColor || '#FFFFFF');
  const [textColor, setTextColor] = useState(initialTemplate?.textColor || '#000000');

  const [selectedTemplateToEdit, setSelectedTemplateToEdit] = useState<SimplifiedCardTemplate | null>(initialTemplate || null);

  useEffect(() => {
    if (selectedTemplateToEdit) {
      setId(selectedTemplateToEdit.id);
      setName(selectedTemplateToEdit.name);
      setTitlePlaceholder(selectedTemplateToEdit.titlePlaceholder || '');
      setBodyPlaceholder(selectedTemplateToEdit.bodyPlaceholder || '');
      setImageSlot(selectedTemplateToEdit.imageSlot || false);
      setImageSrc(selectedTemplateToEdit.imageSrc || `https://placehold.co/300x200.png`);
      setAspectRatio(selectedTemplateToEdit.aspectRatio || '5:7');
      setBackgroundColor(selectedTemplateToEdit.backgroundColor || '#FFFFFF');
      setTextColor(selectedTemplateToEdit.textColor || '#000000');
    } else {
      resetForm();
    }
  }, [selectedTemplateToEdit]);
  
  useEffect(() => {
    // If initialTemplate prop changes (e.g. parent component selects a template)
    setSelectedTemplateToEdit(initialTemplate || null);
  }, [initialTemplate]);


  const resetForm = () => {
    setId(nanoid());
    setName('');
    setTitlePlaceholder('');
    setBodyPlaceholder('');
    setImageSlot(false);
    setImageSrc(`https://placehold.co/300x200.png`);
    setAspectRatio('5:7');
    setBackgroundColor('#FFFFFF');
    setTextColor('#000000');
    setSelectedTemplateToEdit(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Template name is required.');
      return;
    }
    const newTemplate: SimplifiedCardTemplate = {
      id,
      name,
      titlePlaceholder,
      bodyPlaceholder,
      imageSlot,
      imageSrc: imageSlot ? imageSrc : undefined,
      aspectRatio,
      backgroundColor,
      textColor,
    };
    onSaveTemplate(newTemplate);
    if (!initialTemplate) resetForm(); // Reset only if creating new, not if editing from prop
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Your Templates</CardTitle>
          <CardDescription>Select a template to edit or create a new one.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[400px] overflow-y-auto">
          <Button onClick={resetForm} variant="outline" className="w-full mb-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
          </Button>
          {templates.length === 0 && <p className="text-muted-foreground text-sm">No templates saved yet.</p>}
          <ul className="space-y-2">
            {templates.map((template) => (
              <li key={template.id} className="flex justify-between items-center p-2 border rounded-md hover:bg-muted">
                <span 
                  className="cursor-pointer flex-grow" 
                  onClick={() => setSelectedTemplateToEdit(template)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedTemplateToEdit(template)}
                >
                  {template.name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => onDeleteTemplate(template.id)} aria-label="Delete template">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{selectedTemplateToEdit ? 'Edit Template' : 'Create New Template'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="templateName">Template Name</Label>
              <Input id="templateName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Birthday Invite" required />
            </div>

            <div>
              <Label htmlFor="titlePlaceholder">Title Placeholder (use {'{{variable}}'} for dynamic text)</Label>
              <Input id="titlePlaceholder" value={titlePlaceholder} onChange={(e) => setTitlePlaceholder(e.target.value)} placeholder="e.g., Happy {{occasion}}!" />
            </div>

            <div>
              <Label htmlFor="bodyPlaceholder">Body Placeholder (use {'{{variable}}'} for dynamic text)</Label>
              <Textarea id="bodyPlaceholder" value={bodyPlaceholder} onChange={(e) => setBodyPlaceholder(e.target.value)} placeholder="e.g., Dear {{name}}, ..." />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="imageSlot" checked={imageSlot} onCheckedChange={(checked) => setImageSlot(Boolean(checked))} />
              <Label htmlFor="imageSlot">Include Image Slot</Label>
            </div>

            {imageSlot && (
              <div>
                <Label htmlFor="imageSrc">Default Image URL (placeholder)</Label>
                <Input id="imageSrc" value={imageSrc} onChange={(e) => setImageSrc(e.target.value)} placeholder="https://placehold.co/300x200.png" />
              </div>
            )}

            <div>
              <Label htmlFor="aspectRatio">Aspect Ratio (Width:Height)</Label>
              <select
                id="aspectRatio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full p-2 border rounded-md bg-input"
              >
                {aspectRatios.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="backgroundColor">Background Color</Label>
                <Input id="backgroundColor" type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="textColor">Text Color</Label>
                <Input id="textColor" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
              </div>
            </div>
            
            <Button type="submit" className="w-full">Save Template</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
