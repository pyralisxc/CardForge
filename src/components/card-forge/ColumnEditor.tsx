
"use client";

import type { ChangeEvent } from 'react';
import React from 'react'; 
import type { CardSection } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Trash2, FileImage, TextCursorInput, GripVertical, ChevronDown } from 'lucide-react';
import { SectionStylingForm } from './SectionStylingForm';
import { SECTION_CONTENT_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ColumnEditorProps {
  section: CardSection;
  sectionIndex: number;
  rowId: string;
  isFirstColumn: boolean;
  isLastColumn: boolean;
  activeStylingAccordion: string | null;
  onToggleStylingAccordion: (sectionId: string) => void;
  onUpdateSectionInRow: (rowId: string, sectionId: string, updates: Partial<CardSection>) => void;
  onRemoveSectionFromRow: (rowId: string, sectionId: string) => void;
  onMoveSectionInRow: (rowId: string, sectionId: string, direction: 'left' | 'right') => void;
  isColumnAccordionOpen: boolean;
  onToggleColumnAccordion: () => void;
}

const ColumnEditorMemoized = ({
  section,
  sectionIndex,
  rowId,
  isFirstColumn,
  isLastColumn,
  activeStylingAccordion,
  onToggleStylingAccordion,
  onUpdateSectionInRow,
  onRemoveSectionFromRow,
  onMoveSectionInRow,
  isColumnAccordionOpen,
  onToggleColumnAccordion,
}: ColumnEditorProps) => {

  const handleContentPlaceholderChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onUpdateSectionInRow(rowId, section.id, { contentPlaceholder: e.target.value });
  };

  const handleImageDimensionChange = (e: ChangeEvent<HTMLInputElement>, dimension: 'width' | 'height') => {
    const value = e.target.value;
    if (dimension === 'width') {
      onUpdateSectionInRow(rowId, section.id, { imageWidthPx: value });
    } else {
      onUpdateSectionInRow(rowId, section.id, { imageHeightPx: value });
    }
  };

  const contentPlaceholderLabel = section.sectionContentType === 'image'
    ? "Image URL Key (e.g., artworkUrl)"
    : "Content Placeholder (e.g. {{title}} or Your static text {{variable}})";
  
  let displayPlaceholder = section.contentPlaceholder || '';
  if (section.sectionContentType === 'placeholder' && displayPlaceholder.length > 25) {
      displayPlaceholder = displayPlaceholder.substring(0, 22) + '...';
  }
  const placeholderInfo = section.sectionContentType === 'image'
      ? `Image: (${section.imageWidthPx || 'auto'} x ${section.imageHeightPx || 'auto'})`
      : `"${displayPlaceholder}"`;

  return (
    <AccordionItem value={section.id} key={section.id} className="border border-border bg-muted/20 rounded-md overflow-hidden column-editor-card" data-section-id={section.id}>
      <div className={cn(
          "flex items-center w-full px-2 py-1 hover:bg-muted/40 rounded-t-md focus-within:ring-1 focus-within:ring-ring",
           isColumnAccordionOpen ? "border-b" : ""
        )}
      >
        <AccordionTrigger
          onClick={onToggleColumnAccordion}
          aria-label={`Toggle Column ${sectionIndex + 1} details`}
          className="flex-grow p-1 text-left rounded-sm justify-start hover:no-underline data-[state=closed]:hover:bg-transparent data-[state=open]:hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="truncate flex-1 mr-2">
              Column {sectionIndex + 1}: <span className="text-muted-foreground text-xs">{placeholderInfo}</span>
            </span>
          </div>
        </AccordionTrigger>
         {/* Keep ChevronDown, Radix AccordionTrigger expects a child chevron for its own state management */}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground group-data-[state=open]:rotate-180", !isColumnAccordionOpen && "rotate-0")} />

        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onMoveSectionInRow(rowId, section.id, 'left'); }}
            disabled={isFirstColumn}
            aria-label="Move section left"
            className="h-7 w-7"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onMoveSectionInRow(rowId, section.id, 'right'); }}
            disabled={isLastColumn}
            aria-label="Move section right"
            className="h-7 w-7"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onRemoveSectionFromRow(rowId, section.id); }}
            aria-label="Remove section from row"
            className="h-7 w-7"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <AccordionContent className="p-3 space-y-3 bg-background/50">
        <div>
          <Label htmlFor={`sectionContentType-${section.id}`} className="text-xs">Section Content Type</Label>
          <Select
            value={section.sectionContentType || 'placeholder'}
            onValueChange={(value) => onUpdateSectionInRow(rowId, section.id, { sectionContentType: value as CardSection['sectionContentType'] })}
          >
            <SelectTrigger id={`sectionContentType-${section.id}`} className="text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(SECTION_CONTENT_TYPES || []).map(typeInfo => (
                <SelectItem key={typeInfo.value} value={typeInfo.value} className="text-xs">
                  {typeInfo.value === 'image' ? <FileImage className="inline mr-2 h-3 w-3"/> : <TextCursorInput className="inline mr-2 h-3 w-3"/>}
                  {typeInfo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`contentPlaceholder-${section.id}`} className="text-xs">
            {contentPlaceholderLabel}
          </Label>
          {section.sectionContentType === 'image' ? (
            <Input
              id={`contentPlaceholder-${section.id}`}
              value={section.contentPlaceholder || ''}
              onChange={handleContentPlaceholderChange}
              className="text-sm font-mono h-8"
              placeholder="e.g., artworkUrl (this is the key)"
            />
          ) : (
            <Textarea
              id={`contentPlaceholder-${section.id}`}
              value={section.contentPlaceholder || ''}
              onChange={handleContentPlaceholderChange}
              rows={(section.contentPlaceholder || '').toLowerCase().includes('rules') || (section.contentPlaceholder || '').toLowerCase().includes('description') ? 3 : 1}
              className="text-sm font-mono"
              placeholder="e.g. {{title}} or Your static text {{variable}}"
            />
          )}
          {section.sectionContentType === 'image' && (
            <p className="text-xs text-muted-foreground mt-1">
              This key name (e.g., "artworkUrl") will be used to find the image URL in your card's data.
            </p>
          )}
           {section.sectionContentType === 'placeholder' && (
             <p className="text-xs text-muted-foreground mt-1">
              Defines the section's text content. Use <code>{`{{key}}`}</code> or <code>{`{{key:"Default"}}`}</code> for dynamic data.
            </p>
           )}
        </div>

        {section.sectionContentType === 'image' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`imageWidth-${section.id}`} className="text-xs">Image Width (px)</Label>
              <Input
                id={`imageWidth-${section.id}`}
                type="text"
                value={section.imageWidthPx || ''}
                onChange={(e) => handleImageDimensionChange(e, 'width')}
                placeholder="e.g., 100"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor={`imageHeight-${section.id}`} className="text-xs">Image Height (px)</Label>
              <Input
                id={`imageHeight-${section.id}`}
                type="text"
                value={section.imageHeightPx || ''}
                onChange={(e) => handleImageDimensionChange(e, 'height')}
                placeholder="e.g., 150"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <SectionStylingForm
          section={section}
          rowId={rowId}
          onUpdateSectionInRow={onUpdateSectionInRow}
          activeStylingAccordion={activeStylingAccordion}
          onToggleStylingAccordion={onToggleStylingAccordion}
        />
      </AccordionContent>
    </AccordionItem>
  );
}; 

export const ColumnEditor = React.memo(ColumnEditorMemoized);
