
"use client";

import type { ChangeEvent } from 'react';
import React from 'react';
import type { CardSection } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { SectionStylingForm } from './SectionStylingForm';
import { SECTION_CONTENT_TYPES } from '@/lib/constants';

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
    : "Content Placeholder (e.g. {{title:\"Default Title\"}} or Your static text {{variable}})";

  return (
    <Card key={section.id} className="bg-background/50 p-0 overflow-hidden column-editor-card" data-section-id={section.id}>
      <CardHeader className="flex flex-row items-center justify-between p-2 border-b bg-muted/20">
        <span className="text-sm font-medium">Column {sectionIndex + 1}</span>
        <div className="flex items-center gap-1">
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
      </CardHeader>
      <CardContent className="p-3 space-y-3">
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
              {SECTION_CONTENT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
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
              placeholder="e.g., artworkUrl"
            />
          ) : (
            <Textarea
              id={`contentPlaceholder-${section.id}`}
              value={section.contentPlaceholder || ''}
              onChange={handleContentPlaceholderChange}
              rows={2}
              className="text-sm font-mono"
              placeholder="e.g. {{title:\"Default Title\"}} or Your static text {{variable}}"
            />
          )}
          {section.sectionContentType === 'image' && (
            <p className="text-xs text-muted-foreground mt-1">
              This key will be used to fetch the image URL from card data.
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
      </CardContent>
    </Card>
  );
};

export const ColumnEditor = React.memo(ColumnEditorMemoized);
