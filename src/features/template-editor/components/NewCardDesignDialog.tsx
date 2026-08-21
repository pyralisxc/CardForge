"use client";

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getTemplateCardMeasurement,
  type CardFormatId,
  type CardMeasurementUnit,
  type TemplateCardFormatSource,
} from '@/domain/card-formats';
import type { TemplateUsage } from '@/domain/templates';
import { CardFormatSelect } from '@/features/template-editor/components/CardFormatSelect';
import type {
  NewCardDesignInput,
  NewTemplateStartingPoint,
} from '@/features/template-editor/lib/makerTemplateFactory';

export type { NewCardDesignInput } from '@/features/template-editor/lib/makerTemplateFactory';

export function NewCardDesignDialog({
  open,
  usage,
  initialFormat,
  canClone,
  brandedBackFormatIds,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  usage: TemplateUsage;
  initialFormat: TemplateCardFormatSource;
  canClone: boolean;
  brandedBackFormatIds: CardFormatId[];
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewCardDesignInput) => void;
}) {
  const resolvedInitial = initialFormat.formatId ?? 'poker';
  const [name, setName] = useState('');
  const [formatId, setFormatId] = useState<CardFormatId>(resolvedInitial);
  const [unit, setUnit] = useState<CardMeasurementUnit>('mm');
  const [startingPoint, setStartingPoint] = useState<NewTemplateStartingPoint>(
    usage === 'back-preset' ? 'branded-back' : 'starter',
  );

  useEffect(() => {
    if (!open) return;
    setName('');
    setFormatId(initialFormat.formatId ?? 'poker');
    setStartingPoint(usage === 'back-preset' ? 'branded-back' : 'starter');
  }, [initialFormat.formatId, open, usage]);

  const customMeasurement = getTemplateCardMeasurement(initialFormat, unit);
  const trimmedName = name.trim();
  const brandedBackAvailable = brandedBackFormatIds.includes(formatId);

  useEffect(() => {
    if (usage === 'back-preset' && startingPoint === 'branded-back' && !brandedBackAvailable) {
      setStartingPoint('blank');
    }
  }, [brandedBackAvailable, startingPoint, usage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-[var(--cf-border)] bg-[#111017] text-[var(--cf-text)]">
        <DialogHeader>
          <DialogTitle>{usage === 'back-preset' ? 'Create a card back Template' : 'Create a Template'}</DialogTitle>
          <DialogDescription className="text-[#b9ab91]">
            Choose the name and physical format before opening the canvas. You can view measurements in millimeters, inches, or canvas pixels.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-card-design-name">Template name</Label>
            <Input
              id="new-card-design-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={usage === 'back-preset' ? 'Example: Moonlit tarot back' : 'Example: Ember creature card'}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
            <div className="space-y-1.5">
              <Label>Card format</Label>
              <CardFormatSelect value={formatId} unit={unit} onValueChange={setFormatId} />
              {formatId === 'custom' ? (
                <p className="text-xs text-[#a99b82]">Inherited custom size: {customMeasurement.label}. Adjust it in Card setup after creation.</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>View measurements</Label>
              <Select value={unit} onValueChange={(value) => setUnit(value as CardMeasurementUnit)}>
                <SelectTrigger aria-label="View measurements"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mm">Millimeters</SelectItem>
                  <SelectItem value="in">Inches</SelectItem>
                  <SelectItem value="px">Canvas pixels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Starting point</Label>
            <Select value={startingPoint} onValueChange={(value) => setStartingPoint(value as NewTemplateStartingPoint)}>
              <SelectTrigger aria-label="Choose starting point"><SelectValue /></SelectTrigger>
              <SelectContent>
                {usage === 'back-preset' ? (
                  <SelectItem value="branded-back" disabled={!brandedBackAvailable}>CardForge Arcane Forge back</SelectItem>
                ) : (
                  <SelectItem value="starter">CardForge starter frame</SelectItem>
                )}
                <SelectItem value="blank">Blank canvas</SelectItem>
                {canClone ? <SelectItem value="clone">Clone the current design</SelectItem> : null}
              </SelectContent>
            </Select>
            {usage === 'back-preset' && !brandedBackAvailable ? (
              <p className="text-xs leading-5 text-[#d9b06a]">
                No published CardForge back matches this format yet. Start blank, then save and submit it to the Forge Pipeline if it should become reusable.
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={!trimmedName}
            onClick={() => onCreate({ name: trimmedName, formatId, startingPoint })}
          >
            Create and open canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
