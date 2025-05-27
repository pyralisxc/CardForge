
"use client";

import type { TCGCardTemplate } from '@/types'; // Changed from SimplifiedCardTemplate
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { nanoid } from 'nanoid';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Trash2, PlusCircle } from 'lucide-react';
import { TCG_ASPECT_RATIO } from '@/lib/constants'; // For fixed aspect ratio

interface TemplateEditorProps {
  onSaveTemplate: (template: TCGCardTemplate) => void;
  templates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  initialTemplate?: TCGCardTemplate | null;
}

const frameStyles = ["standard", "legendary", "spell", "artifact_common", "land_basic"]; // Example frame styles

export function TemplateEditor({
  onSaveTemplate,
  templates,
  onDeleteTemplate,
  initialTemplate,
}: TemplateEditorProps) {
  // State for TCGCardTemplate fields
  const [id, setId] = useState(initialTemplate?.id || nanoid());
  const [name, setName] = useState(initialTemplate?.name || ''); // Template Name
  const [cardNamePlaceholder, setCardNamePlaceholder] = useState(initialTemplate?.cardNamePlaceholder || '{{cardName}}');
  const [manaCostPlaceholder, setManaCostPlaceholder] = useState(initialTemplate?.manaCostPlaceholder || '{{manaCost}}');
  const [artworkUrlPlaceholder, setArtworkUrlPlaceholder] = useState(initialTemplate?.artworkUrlPlaceholder || `https://placehold.co/375x275.png`);
  const [cardTypeLinePlaceholder, setCardTypeLinePlaceholder] = useState(initialTemplate?.cardTypeLinePlaceholder || 'Creature - {{subType}}');
  const [rulesTextPlaceholder, setRulesTextPlaceholder] = useState(initialTemplate?.rulesTextPlaceholder || '{{ability}}');
  const [flavorTextPlaceholder, setFlavorTextPlaceholder] = useState(initialTemplate?.flavorTextPlaceholder || '"{{flavor}}"');
  const [powerToughnessPlaceholder, setPowerToughnessPlaceholder] = useState(initialTemplate?.powerToughnessPlaceholder || '{{P}}/{{T}}');
  const [rarityPlaceholder, setRarityPlaceholder] = useState(initialTemplate?.rarityPlaceholder || '{{rarity}}');
  const [artistCreditPlaceholder, setArtistCreditPlaceholder] = useState(initialTemplate?.artistCreditPlaceholder || 'Illus. {{artist}}');
  
  const [frameColor, setFrameColor] = useState(initialTemplate?.frameColor || '#CCCCCC'); // Default frame color
  const [borderColor, setBorderColor] = useState(initialTemplate?.borderColor || '#888888');
  const [baseBackgroundColor, setBaseBackgroundColor] = useState(initialTemplate?.baseBackgroundColor || '#FFFFFF');
  const [baseTextColor, setBaseTextColor] = useState(initialTemplate?.baseTextColor || '#000000');
  
  const [selectedTemplateToEdit, setSelectedTemplateToEdit] = useState<TCGCardTemplate | null>(initialTemplate || null);

  useEffect(() => {
    if (selectedTemplateToEdit) {
      setId(selectedTemplateToEdit.id);
      setName(selectedTemplateToEdit.name);
      setCardNamePlaceholder(selectedTemplateToEdit.cardNamePlaceholder || '{{cardName}}');
      setManaCostPlaceholder(selectedTemplateToEdit.manaCostPlaceholder || '{{manaCost}}');
      setArtworkUrlPlaceholder(selectedTemplateToEdit.artworkUrlPlaceholder || `https://placehold.co/375x275.png`);
      setCardTypeLinePlaceholder(selectedTemplateToEdit.cardTypeLinePlaceholder || 'Creature - {{subType}}');
      setRulesTextPlaceholder(selectedTemplateToEdit.rulesTextPlaceholder || '{{ability}}');
      setFlavorTextPlaceholder(selectedTemplateToEdit.flavorTextPlaceholder || '"{{flavor}}"');
      setPowerToughnessPlaceholder(selectedTemplateToEdit.powerToughnessPlaceholder || '{{P}}/{{T}}');
      setRarityPlaceholder(selectedTemplateToEdit.rarityPlaceholder || '{{rarity}}');
      setArtistCreditPlaceholder(selectedTemplateToEdit.artistCreditPlaceholder || 'Illus. {{artist}}');
      setFrameColor(selectedTemplateToEdit.frameColor || '#CCCCCC');
      setBorderColor(selectedTemplateToEdit.borderColor || '#888888');
      setBaseBackgroundColor(selectedTemplateToEdit.baseBackgroundColor || '#FFFFFF');
      setBaseTextColor(selectedTemplateToEdit.baseTextColor || '#000000');
    } else {
      resetForm();
    }
  }, [selectedTemplateToEdit]);
  
  useEffect(() => {
    setSelectedTemplateToEdit(initialTemplate || null);
  }, [initialTemplate]);

  const resetForm = () => {
    setId(nanoid());
    setName('');
    setCardNamePlaceholder('{{cardName}}');
    setManaCostPlaceholder('{{manaCost}}');
    setArtworkUrlPlaceholder(`https://placehold.co/375x275.png`);
    setCardTypeLinePlaceholder('Creature - {{subType}}');
    setRulesTextPlaceholder('{{ability}}');
    setFlavorTextPlaceholder('"{{flavor}}"');
    setPowerToughnessPlaceholder('{{P}}/{{T}}');
    setRarityPlaceholder('{{rarity}}');
    setArtistCreditPlaceholder('Illus. {{artist}}');
    setFrameColor('#CCCCCC');
    setBorderColor('#888888');
    setBaseBackgroundColor('#FFFFFF');
    setBaseTextColor('#000000');
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
      aspectRatio: TCG_ASPECT_RATIO, // Fixed aspect ratio for TCG
      frameColor,
      borderColor,
      baseBackgroundColor,
      baseTextColor,
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
        <CardContent className="max-h-[600px] overflow-y-auto">
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
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="templateName">Template Name</Label>
              <Input id="templateName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Red Creature Aggro" required />
            </div>
            
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
              <Label htmlFor="artworkUrlPlaceholder">Default Artwork URL</Label>
              <Input id="artworkUrlPlaceholder" value={artworkUrlPlaceholder} onChange={(e) => setArtworkUrlPlaceholder(e.target.value)} placeholder="https://placehold.co/375x275.png" />
            </div>

            <div>
              <Label htmlFor="cardTypeLinePlaceholder">Card Type Line Placeholder</Label>
              <Input id="cardTypeLinePlaceholder" value={cardTypeLinePlaceholder} onChange={(e) => setCardTypeLinePlaceholder(e.target.value)} placeholder="Creature - {{subType}}" />
            </div>

            <div>
              <Label htmlFor="rulesTextPlaceholder">Rules Text Placeholder</Label>
              <Textarea id="rulesTextPlaceholder" value={rulesTextPlaceholder} onChange={(e) => setRulesTextPlaceholder(e.target.value)} placeholder="Keywords, abilities like {{ability1}}, {{ability2}}" rows={3} />
            </div>

            <div>
              <Label htmlFor="flavorTextPlaceholder">Flavor Text Placeholder</Label>
              <Textarea id="flavorTextPlaceholder" value={flavorTextPlaceholder} onChange={(e) => setFlavorTextPlaceholder(e.target.value)} placeholder={'"{flavorText}}"'} rows={2} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="powerToughnessPlaceholder">P/T Placeholder</Label>
                <Input id="powerToughnessPlaceholder" value={powerToughnessPlaceholder} onChange={(e) => setPowerToughnessPlaceholder(e.target.value)} placeholder="{{P}}/{{T}}" />
              </div>
              <div>
                <Label htmlFor="rarityPlaceholder">Rarity Placeholder</Label>
                <Input id="rarityPlaceholder" value={rarityPlaceholder} onChange={(e) => setRarityPlaceholder(e.target.value)} placeholder="{{rarity}}" />
              </div>
              <div>
                <Label htmlFor="artistCreditPlaceholder">Artist Credit Placeholder</Label>
                <Input id="artistCreditPlaceholder" value={artistCreditPlaceholder} onChange={(e) => setArtistCreditPlaceholder(e.target.value)} placeholder="Illus. {{artist}}" />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">Use {'{{variable_name}}'} for dynamic fields.</p>

            <h4 className="text-lg font-semibold pt-2 border-t mt-4">Styling</h4>
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
                    <Label htmlFor="baseBackgroundColor">Base Background Color</Label>
                    <Input id="baseBackgroundColor" type="color" value={baseBackgroundColor} onChange={(e) => setBaseBackgroundColor(e.target.value)} />
                </div>
                <div>
                    <Label htmlFor="baseTextColor">Base Text Color</Label>
                    <Input id="baseTextColor" type="color" value={baseTextColor} onChange={(e) => setBaseTextColor(e.target.value)} />
                </div>
            </div>
            
            <Button type="submit" className="w-full">Save TCG Template</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
