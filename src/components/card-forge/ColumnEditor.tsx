
"use client";

import React from 'react';
import type { CardSection } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react'; // Removed SquarePen, ICON_MAP usage
import { SectionStylingForm } from './SectionStylingForm';
// Removed import { ICON_MAP } from '@/lib/constants';

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
  // const IconComponent = ICON_MAP['Default'] || SquarePen; // Section type icon removed

  return (
    <Card key={section.id} className="bg-background/50 p-0 overflow-hidden column-editor-card" data-section-id={section.id}>
      <CardHeader className="flex flex-row items-center justify-between p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          {/* <IconComponent className="h-4 w-4 text-muted-foreground" /> // Icon removed */}
          <span className="text-sm font-medium">Column {sectionIndex + 1}</span>
        </div>
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
          <Label htmlFor={`contentPlaceholder-${section.id}`} className="text-xs">
            Content Placeholder (e.g., <code>{`{{fieldName}}`}</code> or <code>{`{{fieldName:"Default"}}`}</code>)
          </Label>
          <Textarea
            id={`contentPlaceholder-${section.id}`}
            value={section.contentPlaceholder || ''}
            onChange={(e) => onUpdateSectionInRow(rowId, section.id, { contentPlaceholder: e.target.value })}
            rows={2}
            className="text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Defines the section's content. If its resolved value is an image URL, it will be shown as an image.
          </p>
        </div>
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
