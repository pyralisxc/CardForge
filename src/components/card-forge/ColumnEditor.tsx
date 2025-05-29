
"use client";

import React from 'react';
import type { CardSection, CardSectionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Trash2, Type, TextCursorInput, FileImage, AlignLeft, Italic, ChevronsUpDown, Baseline, SquarePen, Minus } from 'lucide-react';
import { SECTION_TYPES } from '@/lib/constants';
import { SectionStylingForm } from './SectionStylingForm';

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

const iconMap: Record<CardSectionType, React.ElementType> = {
  CardName: TextCursorInput,
  ManaCost: Baseline,
  Artwork: FileImage,
  TypeLine: Type,
  RulesText: AlignLeft,
  FlavorText: Italic,
  PowerToughness: ChevronsUpDown,
  ArtistCredit: Baseline,
  CustomText: SquarePen,
  Divider: Minus,
};

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
  const IconComponent = iconMap[section.type] || Type;

  return (
    <Card key={section.id} className="bg-background/50 p-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Column {sectionIndex + 1}: {section.type}</span>
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
          <Label htmlFor={`sectionType-${section.id}`} className="text-xs">Section Type</Label>
          <Select value={section.type} onValueChange={(v) => onUpdateSectionInRow(rowId, section.id, { type: v as CardSectionType })}>
            <SelectTrigger id={`sectionType-${section.id}`} className="text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{SECTION_TYPES.map(st => <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`contentPlaceholder-${section.id}`} className="text-xs">
            Content Placeholder (e.g., <code>{`{{fieldName}}`}</code> or <code>{`{{fieldName:"Default"}}`}</code>)
          </Label>
          <Textarea
            id={`contentPlaceholder-${section.id}`}
            value={section.contentPlaceholder}
            onChange={(e) => onUpdateSectionInRow(rowId, section.id, { contentPlaceholder: e.target.value })}
            rows={(section.type === 'RulesText' || section.type === 'FlavorText') ? 3 : 1}
            className="text-sm font-mono"
          />
          {section.type === 'Artwork' && (
            <p className="text-xs text-muted-foreground mt-1">
              Variable for image URL, e.g., <code>{`{{artworkUrl}}`}</code>. Set dimensions in Styling Options.
            </p>
          )}
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
