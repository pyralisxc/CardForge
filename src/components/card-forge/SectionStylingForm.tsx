
"use client";

import type { ChangeEvent } from 'react';
import React, { useRef } from 'react'; 
import type { CardSection } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Paintbrush, Upload, RotateCcw } from 'lucide-react'; 
import { Button } from '@/components/ui/button'; 
import { useToast } from '@/hooks/use-toast'; 
import { createDefaultSection } from '@/lib/constants';


import { FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, FONT_STYLES, AVAILABLE_FONTS, PADDING_OPTIONS, BORDER_WIDTH_OPTIONS, MIN_HEIGHT_OPTIONS, BORDER_RADIUS_OPTIONS } from '@/lib/constants';

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
  const fileInputRefBg = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const handleUpdate = (updates: Partial<CardSection>) => {
    onUpdateSectionInRow(rowId, section.id, updates);
  };

  const handleBgImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        handleUpdate({ backgroundImageUrl: dataUri });
        toast({ title: "Image Uploaded", description: `Background image "${file.name}" loaded.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read background image file.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleResetStyling = () => {
    const defaultStyling = createDefaultSection(section.id);
    const stylingUpdates: Partial<CardSection> = {
      textColor: defaultStyling.textColor,
      backgroundColor: defaultStyling.backgroundColor,
      fontFamily: defaultStyling.fontFamily,
      fontSize: defaultStyling.fontSize,
      fontWeight: defaultStyling.fontWeight,
      textAlign: defaultStyling.textAlign,
      fontStyle: defaultStyling.fontStyle,
      padding: defaultStyling.padding,
      borderColor: defaultStyling.borderColor,
      borderWidth: defaultStyling.borderWidth,
      borderRadius: defaultStyling.borderRadius,
      minHeight: defaultStyling.minHeight,
      backgroundImageUrl: defaultStyling.backgroundImageUrl, // Reset background image URL as well
      // Explicitly NOT resetting: id, sectionContentType, contentPlaceholder, flexGrow, customHeight, customWidth, imageWidthPx, imageHeightPx
    };
    handleUpdate(stylingUpdates);
    toast({ title: "Styling Reset", description: `Styling for column reset to defaults.` });
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
            <div>
              <Label htmlFor={`contentBgColor-${section.id}`} className="text-xs">Background Color (Section)</Label>
              <Input id={`contentBgColor-${section.id}`} type="color" className="h-8 w-full" value={section.backgroundColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ backgroundColor: e.target.value })} />
            </div>
             <div className="space-y-1">
              <Label htmlFor={`backgroundImageUrlSec-${section.id}`} className="text-xs">Background Image URL (or placeholder/upload)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`backgroundImageUrlSec-${section.id}`}
                  value={section.backgroundImageUrl || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ backgroundImageUrl: e.target.value })}
                  placeholder="e.g., https://.../bg.png or {{bgKey}}"
                  className="h-8 text-xs flex-grow"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => fileInputRefBg.current?.click()}
                  aria-label="Upload background image"
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRefBg}
                  onChange={handleBgImageUpload}
                  style={{ display: 'none' }}
                  id={`backgroundImageUrlSec-file-${section.id}`}
                />
              </div>
            </div>
             <div>
              <Label htmlFor={`customHeight-${section.id}`} className="text-xs">Custom Height (Container)</Label>
              <Input id={`customHeight-${section.id}`} value={section.customHeight || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ customHeight: e.target.value })} placeholder="e.g., 180px, 50%, auto" className="h-8 text-xs" />
            </div>
            <div>
              <Label htmlFor={`customWidth-${section.id}`} className="text-xs">Custom Width (Container)</Label>
              <Input id={`customWidth-${section.id}`} value={section.customWidth || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ customWidth: e.target.value })} placeholder="e.g., 100%, 250px, auto" className="h-8 text-xs" />
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
              <Input id={`textColor-${section.id}`} type="color" className="h-8 w-full" value={section.textColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ textColor: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`padding-${section.id}`} className="text-xs">Padding (Container)</Label>
              <Select value={section.padding || 'p-1'} onValueChange={v => handleUpdate({padding: v})}>
                <SelectTrigger id={`padding-${section.id}`} className="text-xs h-8"><SelectValue/></SelectTrigger>
                <SelectContent>{PADDING_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`borderColorSec-${section.id}`} className="text-xs">Border Color (Container)</Label>
              <Input id={`borderColorSec-${section.id}`} type="color" className="h-8 w-full" value={section.borderColor || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ borderColor: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`borderWidth-${section.id}`} className="text-xs">Border Width (Container)</Label>
              <Select value={section.borderWidth || '_none_'} onValueChange={v => handleUpdate({borderWidth: v === '_none_' ? undefined : v})}>
                <SelectTrigger id={`borderWidth-${section.id}`} className="text-xs h-8"><SelectValue placeholder="No border"/></SelectTrigger>
                <SelectContent>{BORDER_WIDTH_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`borderRadius-${section.id}`} className="text-xs">Border Radius (Container)</Label>
              <Select value={section.borderRadius || 'rounded-none'} onValueChange={v => handleUpdate({borderRadius: v === 'rounded-none' ? undefined : v})}>
                <SelectTrigger id={`borderRadius-${section.id}`} className="text-xs h-8"><SelectValue placeholder="None"/></SelectTrigger>
                <SelectContent>{BORDER_RADIUS_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`minHeight-${section.id}`} className="text-xs">Min Height (Container)</Label>
              <Select value={section.minHeight || '_auto_'} onValueChange={v => handleUpdate({minHeight: v === '_auto_' ? undefined : v})}>
                <SelectTrigger id={`minHeight-${section.id}`} className="text-xs h-8"><SelectValue placeholder="Auto"/></SelectTrigger>
                <SelectContent>{MIN_HEIGHT_OPTIONS.map(s=><SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Label htmlFor={`flexGrow-${section.id}`} className="text-xs cursor-pointer flex-grow">Flex Grow (expand to fill row space)</Label>
              <Input type="number" id={`flexGrow-${section.id}`} value={section.flexGrow || 0} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate({ flexGrow: parseInt(e.target.value,10) || 0 })} min="0" className="h-8 text-xs w-16" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetStyling}
              className="w-full flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Reset Styling to Defaults
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export const SectionStylingForm = React.memo(SectionStylingFormMemoized);

