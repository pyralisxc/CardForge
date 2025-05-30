
"use client";

import React from 'react';
import type { CardSection } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Paintbrush } from 'lucide-react';
import { FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS } from '@/lib/constants';

interface SectionStylingFormProps {
  section: CardSection;
  rowId: string;
  onUpdateSectionInRow: (rowId: string, sectionId: string, updates: Partial<CardSection>) => void;
  activeStylingAccordion: string | null;
  onToggleStylingAccordion: (sectionId: string) => void;
}

const SectionStylingFormMemoized = ({
  section,
  rowId,
  onUpdateSectionInRow,
  activeStylingAccordion,
  onToggleStylingAccordion,
}: SectionStylingFormProps) => {
  
  const handleUpdate = (updates: Partial<CardSection>) => {
    onUpdateSectionInRow(rowId, section.id, updates);
  };

  return (
    <Accordion 
      type="single" 
      collapsible 
      className="w-full" 
      value={activeStylingAccordion === section.id ? section.id : undefined} 
      onValueChange={() => onToggleStylingAccordion(section.id)}
    >
      <AccordionItem value={section.id} id={`accordion-section-styling-${section.id}`} className="border rounded-md p-0 mt-2">
        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:no-underline py-1.5 px-2">
          <div className="flex items-center gap-1.5"><Paintbrush className="h-4 w-4" />Styling Options</div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-3 px-3 space-y-2 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
            {/* Background Image URL input */}
            <div className="sm:col-span-2">
              <Label htmlFor={`backgroundImageUrl-${section.id}`} className="text-xs">Background Image URL (or placeholder)</Label>
              <Input 
                id={`backgroundImageUrl-${section.id}`} 
                value={section.backgroundImageUrl || ''} 
                onChange={(e) => handleUpdate({ backgroundImageUrl: e.target.value })} 
                placeholder="e.g., https://.../bg.png or {{bgImage}}" 
                className="h-8 text-xs" 
              />
            </div>
            <div>
              <Label htmlFor={`customHeight-${section.id}`} className="text-xs">Custom Height</Label>
              <Input id={`customHeight-${section.id}`} value={section.customHeight || ''} onChange={(e) => handleUpdate({ customHeight: e.target.value })} placeholder="e.g., 180px, 50%, auto" className="h-8 text-xs" />
            </div>
            <div>
              <Label htmlFor={`customWidth-${section.id}`} className="text-xs">Custom Width</Label>
              <Input id={`customWidth-${section.id}`} value={section.customWidth || ''} onChange={(e) => handleUpdate({ customWidth: e.target.value })} placeholder="e.g., 100%, 250px, auto" className="h-8 text-xs" />
            </div>
            <div>
              <Label htmlFor={`fontFamily-${section.id}`} className="text-xs">Font</Label>
              <Select value={section.fontFamily || 'font-sans'} onValueChange={v => handleUpdate({fontFamily: v})}>
                <SelectTrigger id={`fontFamily-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{AVAILABLE_FONTS.map(f=><SelectItem key={f.value} value={f.value} className="text-xs"><span className={f.value}>{f.name}</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`fontSize-${section.id}`} className="text-xs">Font Size</Label>
              <Select value={section.fontSize || 'text-sm'} onValueChange={v => handleUpdate({fontSize: v as CardSection['fontSize']})}>
                <SelectTrigger id={`fontSize-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{FONT_SIZES.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`fontWeight-${section.id}`} className="text-xs">Font Weight</Label>
              <Select value={section.fontWeight || 'font-normal'} onValueChange={v => handleUpdate({fontWeight: v as CardSection['fontWeight']})}>
                <SelectTrigger id={`fontWeight-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{FONT_WEIGHTS.map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`fontStyle-${section.id}`} className="text-xs">Font Style</Label>
              <Select value={section.fontStyle || 'normal'} onValueChange={v => handleUpdate({fontStyle: v as CardSection['fontStyle']})}>
                <SelectTrigger id={`fontStyle-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{FONT_STYLES.map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`textAlign-${section.id}`} className="text-xs">Text Align</Label>
              <Select value={section.textAlign || 'left'} onValueChange={v => handleUpdate({textAlign: v as CardSection['textAlign']})}>
                <SelectTrigger id={`textAlign-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{TEXT_ALIGNS.map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`textColor-${section.id}`} className="text-xs">Text Color</Label>
              <Input id={`textColor-${section.id}`} type="color" className="h-8 w-full" value={section.textColor || ''} onChange={(e) => handleUpdate({ textColor: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`bgColor-${section.id}`} className="text-xs">Content Background Color</Label>
              <Input id={`bgColor-${section.id}`} type="color" className="h-8 w-full" value={section.backgroundColor || ''} onChange={(e) => handleUpdate({ backgroundColor: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`padding-${section.id}`} className="text-xs">Padding</Label>
              <Select value={section.padding || 'p-1'} onValueChange={v => handleUpdate({padding: v})}>
                <SelectTrigger id={`padding-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{PADDING_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`borderColorSec-${section.id}`} className="text-xs">Border Color</Label>
              <Input id={`borderColorSec-${section.id}`} type="color" className="h-8 w-full" value={section.borderColor || ''} onChange={(e) => handleUpdate({ borderColor: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`borderWidth-${section.id}`} className="text-xs">Border Width</Label>
              <Select value={section.borderWidth || '_none_'} onValueChange={v => handleUpdate({borderWidth: v === '_none_' ? undefined : v})}>
                <SelectTrigger id={`borderWidth-${section.id}`} className="text-xs h-8"><SelectValue placeholder="No border"/></SelectTrigger>
                <SelectContent>{BORDER_WIDTH_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`minHeight-${section.id}`} className="text-xs">Min Height (Tailwind)</Label>
              <Select value={section.minHeight || '_auto_'} onValueChange={v => handleUpdate({minHeight: v === '_auto_' ? undefined : v})}>
                <SelectTrigger id={`minHeight-${section.id}`} className="text-xs h-8"><SelectValue placeholder="Auto"/></SelectTrigger>
                <SelectContent>{MIN_HEIGHT_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Input type="checkbox" id={`flexGrow-${section.id}`} checked={!!section.flexGrow && section.flexGrow > 0} onChange={(e) => handleUpdate({ flexGrow: e.target.checked ? 1 : 0 })} className="mr-1 h-4 w-4 accent-primary" />
              <Label htmlFor={`flexGrow-${section.id}`} className="text-xs cursor-pointer">Flex Grow (expand to fill available space in row)</Label>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export const SectionStylingForm = React.memo(SectionStylingFormMemoized);
