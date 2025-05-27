
"use client";

import type { TCGCardTemplate } from '@/types';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { nanoid } from 'nanoid';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, PlusCircle } from 'lucide-react';
import { TCG_ASPECT_RATIO } from '@/lib/constants';

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
  const [id, setId] = useState(initialTemplate?.id || nanoid());
  const [name, setName] = useState(initialTemplate?.name || '');
  const [cardNamePlaceholder, setCardNamePlaceholder] = useState(initialTemplate?.cardNamePlaceholder || '{{cardName}}');
  const [manaCostPlaceholder, setManaCostPlaceholder] = useState(initialTemplate?.manaCostPlaceholder || '{{manaCost}}');
  const [artworkUrlPlaceholder, setArtworkUrlPlaceholder] = useState(initialTemplate?.artworkUrlPlaceholder || `https://placehold.co/375x275.png`);
  const [cardTypeLinePlaceholder, setCardTypeLinePlaceholder] = useState(initialTemplate?.cardTypeLinePlaceholder || 'Creature - {{subType}}');
  const [rulesTextPlaceholder, setRulesTextPlaceholder] = useState(initialTemplate?.rulesTextPlaceholder || '{{abilityDescription}}');
  const [flavorTextPlaceholder, setFlavorTextPlaceholder] = useState(initialTemplate?.flavorTextPlaceholder || '"{{flavorText}}"');
  const [powerToughnessPlaceholder, setPowerToughnessPlaceholder] = useState(initialTemplate?.powerToughnessPlaceholder || '{{power}}/{{toughness}}');
  const [rarityPlaceholder, setRarityPlaceholder] = useState(initialTemplate?.rarityPlaceholder || '{{rarity}}');
  const [artistCreditPlaceholder, setArtistCreditPlaceholder] = useState(initialTemplate?.artistCreditPlaceholder || 'Illus. {{artistName}}');
  
  const [frameColor, setFrameColor] = useState(initialTemplate?.frameColor || '#CCCCCC');
  const [borderColor, setBorderColor] = useState(initialTemplate?.borderColor || '#888888');
  const [baseBackgroundColor, setBaseBackgroundColor] = useState(initialTemplate?.baseBackgroundColor || '#FFFFFF');
  const [baseTextColor, setBaseTextColor] = useState(initialTemplate?.baseTextColor || '#000000');

  // New specific color states
  const [nameTextColor, setNameTextColor] = useState(initialTemplate?.nameTextColor || baseTextColor);
  const [costTextColor, setCostTextColor] = useState(initialTemplate?.costTextColor || baseTextColor);
  const [typeLineTextColor, setTypeLineTextColor] = useState(initialTemplate?.typeLineTextColor || baseTextColor);
  const [rulesTextColor, setRulesTextColor] = useState(initialTemplate?.rulesTextColor || baseTextColor);
  const [flavorTextColor, setFlavorTextColor] = useState(initialTemplate?.flavorTextColor || baseTextColor);
  const [ptTextColor, setPtTextColor] = useState(initialTemplate?.ptTextColor || baseTextColor);
  const [artBoxBackgroundColor, setArtBoxBackgroundColor] = useState(initialTemplate?.artBoxBackgroundColor || baseBackgroundColor);
  const [textBoxBackgroundColor, setTextBoxBackgroundColor] = useState(initialTemplate?.textBoxBackgroundColor || baseBackgroundColor);
  
  const [selectedTemplateToEdit, setSelectedTemplateToEdit] = useState<TCGCardTemplate | null>(initialTemplate || null);

  const updateFormFields = (template: TCGCardTemplate | null) => {
    setId(template?.id || nanoid());
    setName(template?.name || '');
    setCardNamePlaceholder(template?.cardNamePlaceholder || '{{cardName}}');
    setManaCostPlaceholder(template?.manaCostPlaceholder || '{{manaCost}}');
    setArtworkUrlPlaceholder(template?.artworkUrlPlaceholder || `https://placehold.co/375x275.png`);
    setCardTypeLinePlaceholder(template?.cardTypeLinePlaceholder || 'Creature - {{subType}}');
    setRulesTextPlaceholder(template?.rulesTextPlaceholder || '{{abilityDescription}}');
    setFlavorTextPlaceholder(template?.flavorTextPlaceholder || '"{{flavorText}}"');
    setPowerToughnessPlaceholder(template?.powerToughnessPlaceholder || '{{power}}/{{toughness}}');
    setRarityPlaceholder(template?.rarityPlaceholder || '{{rarity}}');
    setArtistCreditPlaceholder(template?.artistCreditPlaceholder || 'Illus. {{artistName}}');
    
    const currentBaseBg = template?.baseBackgroundColor || '#FFFFFF';
    const currentBaseText = template?.baseTextColor || '#000000';

    setFrameColor(template?.frameColor || '#CCCCCC');
    setBorderColor(template?.borderColor || '#888888');
    setBaseBackgroundColor(currentBaseBg);
    setBaseTextColor(currentBaseText);

    setNameTextColor(template?.nameTextColor || currentBaseText);
    setCostTextColor(template?.costTextColor || currentBaseText);
    setTypeLineTextColor(template?.typeLineTextColor || currentBaseText);
    setRulesTextColor(template?.rulesTextColor || currentBaseText);
    setFlavorTextColor(template?.flavorTextColor || currentBaseText);
    setPtTextColor(template?.ptTextColor || currentBaseText);
    setArtBoxBackgroundColor(template?.artBoxBackgroundColor || currentBaseBg);
    setTextBoxBackgroundColor(template?.textBoxBackgroundColor || currentBaseBg);
  };
  
  useEffect(() => {
    if (selectedTemplateToEdit) {
      updateFormFields(selectedTemplateToEdit);
    } else {
      resetForm();
    }
  }, [selectedTemplateToEdit]);
  
  useEffect(() => {
    setSelectedTemplateToEdit(initialTemplate || null);
     if (initialTemplate) {
      updateFormFields(initialTemplate);
    }
  }, [initialTemplate]);

  const resetForm = () => {
    updateFormFields(null); // Pass null to use default values
    setSelectedTemplateToEdit(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Template name is required.');
      return;
    }
    const newTemplate: TCGCardTemplate = {
      id,
      name,
      cardNamePlaceholder,
      manaCostPlaceholder,
      artworkUrlPlaceholder,
      cardTypeLinePlaceholder,
      rulesTextPlaceholder,
      flavorTextPlaceholder,
      powerToughnessPlaceholder,
      rarityPlaceholder,
      artistCreditPlaceholder,
      aspectRatio: TCG_ASPECT_RATIO,
      frameColor,
      borderColor,
      baseBackgroundColor,
      baseTextColor,
      nameTextColor,
      costTextColor,
      typeLineTextColor,
      rulesTextColor,
      flavorTextColor,
      ptTextColor,
      artBoxBackgroundColor,
      textBoxBackgroundColor,
    };
    onSaveTemplate(newTemplate);
    if (!initialTemplate && !selectedTemplateToEdit) resetForm(); 
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Your Templates</CardTitle>
          <CardDescription>Select a TCG template to edit or create new.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto">
          <Button onClick={resetForm} variant="outline" className="w-full mb-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New TCG Template
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
          <CardTitle>{selectedTemplateToEdit ? 'Edit TCG Template' : 'Create New TCG Template'}</CardTitle>
          <CardDescription>Define placeholders and styles for your TCG cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-220px)] pr-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="templateName">Template Name</Label>
                <Input id="templateName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Red Creature Aggro" required />
              </div>
              
              <h4 className="text-lg font-semibold pt-2 border-t mt-4">Content Placeholders</h4>
              <p className="text-xs text-muted-foreground -mt-2 mb-2">Use {'{{variable_name}}'} for dynamic fields. These will become form fields in the single card generator.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cardNamePlaceholder">Card Name Placeholder</Label>
                  <Input id="cardNamePlaceholder" value={cardNamePlaceholder} onChange={(e) => setCardNamePlaceholder(e.target.value)} placeholder="{{cardName}}" />
                </div>
                <div>
                  <Label htmlFor="manaCostPlaceholder">Mana Cost Placeholder</Label>
                  <Input id="manaCostPlaceholder" value={manaCostPlaceholder} onChange={(e) => setManaCostPlaceholder(e.target.value)} placeholder="{{manaCost}}" />
                </div>
              </div>

              <div>
                <Label htmlFor="artworkUrlPlaceholder">Default Artwork URL Placeholder</Label>
                <Input id="artworkUrlPlaceholder" value={artworkUrlPlaceholder} onChange={(e) => setArtworkUrlPlaceholder(e.target.value)} placeholder="https://placehold.co/375x275.png or {{artworkUrl}}" />
              </div>

              <div>
                <Label htmlFor="cardTypeLinePlaceholder">Card Type Line Placeholder</Label>
                <Input id="cardTypeLinePlaceholder" value={cardTypeLinePlaceholder} onChange={(e) => setCardTypeLinePlaceholder(e.target.value)} placeholder="Creature - {{subType}} or {{cardType}}" />
              </div>

              <div>
                <Label htmlFor="rulesTextPlaceholder">Rules Text Placeholder</Label>
                <Textarea id="rulesTextPlaceholder" value={rulesTextPlaceholder} onChange={(e) => setRulesTextPlaceholder(e.target.value)} placeholder="Keywords, abilities like {{abilityDescription}}, {{triggeredAbility}}" rows={3} />
              </div>

              <div>
                <Label htmlFor="flavorTextPlaceholder">Flavor Text Placeholder</Label>
                <Textarea id="flavorTextPlaceholder" value={flavorTextPlaceholder} onChange={(e) => setFlavorTextPlaceholder(e.target.value)} placeholder={'"{{flavorText}}"'} rows={2} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="powerToughnessPlaceholder">P/T Placeholder</Label>
                  <Input id="powerToughnessPlaceholder" value={powerToughnessPlaceholder} onChange={(e) => setPowerToughnessPlaceholder(e.target.value)} placeholder="{{power}}/{{toughness}}" />
                </div>
                <div>
                  <Label htmlFor="rarityPlaceholder">Rarity Placeholder</Label>
                  <Input id="rarityPlaceholder" value={rarityPlaceholder} onChange={(e) => setRarityPlaceholder(e.target.value)} placeholder="{{rarity}}" />
                </div>
                <div>
                  <Label htmlFor="artistCreditPlaceholder">Artist Credit Placeholder</Label>
                  <Input id="artistCreditPlaceholder" value={artistCreditPlaceholder} onChange={(e) => setArtistCreditPlaceholder(e.target.value)} placeholder="Illus. {{artistName}}" />
                </div>
              </div>
              
              <h4 className="text-lg font-semibold pt-4 border-t mt-6">Base Styling</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor="frameColor">Frame Color</Label>
                      <Input id="frameColor" type="color" value={frameColor} onChange={(e) => setFrameColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="borderColor">Border Color (Art/Text Boxes)</Label>
                      <Input id="borderColor" type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="baseBackgroundColor">Card Body Background Color</Label>
                      <Input id="baseBackgroundColor" type="color" value={baseBackgroundColor} onChange={(e) => setBaseBackgroundColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="baseTextColor">Default Text Color (Fallback)</Label>
                      <Input id="baseTextColor" type="color" value={baseTextColor} onChange={(e) => setBaseTextColor(e.target.value)} />
                  </div>
              </div>

              <h4 className="text-lg font-semibold pt-4 border-t mt-6">Element Specific Styling</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor="nameTextColor">Card Name Text Color</Label>
                      <Input id="nameTextColor" type="color" value={nameTextColor} onChange={(e) => setNameTextColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="costTextColor">Mana Cost Text Color</Label>
                      <Input id="costTextColor" type="color" value={costTextColor} onChange={(e) => setCostTextColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="typeLineTextColor">Type Line Text Color</Label>
                      <Input id="typeLineTextColor" type="color" value={typeLineTextColor} onChange={(e) => setTypeLineTextColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="rulesTextColor">Rules Text Color</Label>
                      <Input id="rulesTextColor" type="color" value={rulesTextColor} onChange={(e) => setRulesTextColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="flavorTextColor">Flavor Text Color</Label>
                      <Input id="flavorTextColor" type="color" value={flavorTextColor} onChange={(e) => setFlavorTextColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="ptTextColor">P/T Text Color</Label>
                      <Input id="ptTextColor" type="color" value={ptTextColor} onChange={(e) => setPtTextColor(e.target.value)} />
                  </div>
                   <div>
                      <Label htmlFor="artBoxBackgroundColor">Artwork Area Background</Label>
                      <Input id="artBoxBackgroundColor" type="color" value={artBoxBackgroundColor} onChange={(e) => setArtBoxBackgroundColor(e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="textBoxBackgroundColor">Text Box Background</Label>
                      <Input id="textBoxBackgroundColor" type="color" value={textBoxBackgroundColor} onChange={(e) => setTextBoxBackgroundColor(e.target.value)} />
                  </div>
              </div>
              
              <Button type="submit" className="w-full mt-6">Save TCG Template</Button>
            </form>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
