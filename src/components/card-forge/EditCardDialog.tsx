
"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import type { DisplayCard, CardData } from '@/types';
// TCG_FIELD_DEFINITIONS is no longer strictly needed here for labels if we use placeholder keys
import { extractUniquePlaceholderKeys } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Save } from 'lucide-react';

interface EditCardDialogProps {
  isOpen: boolean;
  card: DisplayCard | null;
  onSave: (updatedCard: DisplayCard) => void;
  onDuplicate: (cardToDuplicate: DisplayCard) => void;
  onClose: () => void;
}

interface DynamicField {
  key: string;
  label: string; // Will now be like {{key}}
  type: 'input' | 'textarea';
  example?: string; // For placeholder text in input
  defaultValue?: string; // From template
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose }: EditCardDialogProps) {
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);

  useEffect(() => {
    if (card) {
      const allPlaceholderKeys = extractUniquePlaceholderKeys(card.template);
      const currentCardData = { ...card.data };
      const newEditedDataState: CardData = {};

      const fields: DynamicField[] = allPlaceholderKeys.map(placeholder => {
        const isTextarea = placeholder.key.toLowerCase().includes('rules') ||
                           placeholder.key.toLowerCase().includes('text') ||
                           placeholder.key.toLowerCase().includes('effect') ||
                           placeholder.key.toLowerCase().includes('abilit') ||
                           placeholder.key.toLowerCase().includes('description');

        let exampleText = `e.g., value for ${placeholder.key}`;
        if (placeholder.key.toLowerCase().includes('url') || placeholder.key.toLowerCase().includes('artwork')) {
          exampleText = 'e.g., https://placehold.co/300x200.png or data:image/...';
        }

        if (currentCardData[placeholder.key] !== undefined) {
          newEditedDataState[placeholder.key] = currentCardData[placeholder.key];
        } else if (placeholder.defaultValue !== undefined) {
          newEditedDataState[placeholder.key] = placeholder.defaultValue;
        } else {
          newEditedDataState[placeholder.key] = '';
        }

        return {
          key: placeholder.key,
          label: `{{${placeholder.key}}}`, // Use placeholder key as label
          type: isTextarea ? 'textarea' : 'input',
          example: exampleText,
          defaultValue: placeholder.defaultValue,
        };
      });
      setDynamicFields(fields);
      setEditedData(newEditedDataState);
    } else {
      setEditedData({});
      setDynamicFields([]);
    }
  }, [card]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldKey: string) => {
    setEditedData(prev => ({ ...prev, [fieldKey]: e.target.value }));
  };

  const handleSaveChanges = () => {
    if (card) {
      // Ensure all keys defined by the template are present in editedData, even if empty
      const finalData = { ...editedData };
      dynamicFields.forEach(field => {
        if (finalData[field.key] === undefined) {
          finalData[field.key] = field.defaultValue !== undefined ? field.defaultValue : '';
        }
      });
      onSave({ ...card, data: finalData });
    }
  };

  const handleDuplicateCard = () => {
    if (card) {
       const finalData = { ...editedData };
       dynamicFields.forEach(field => {
        if (finalData[field.key] === undefined) {
          finalData[field.key] = field.defaultValue !== undefined ? field.defaultValue : '';
        }
      });
      onDuplicate({ ...card, data: finalData });
    }
  };

  if (!card) return null;

  const cardNameKey = dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artist"))?.key ||
                      dynamicFields.find(f => f.key.toLowerCase().includes("title"))?.key ||
                      (dynamicFields.length > 0 ? dynamicFields[0].key : '');

  const cardName = String(editedData[cardNameKey] || 'Card');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit: {cardName}</DialogTitle>
          <DialogDescription>
            Modify the data for this card. Template: {card.template.name}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6 mb-4">
          <div className="space-y-3 py-1">
            {dynamicFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`editCard-${field.key}`}>
                  {field.label}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`editCard-${field.key}`}
                    value={(editedData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter value for ${field.key}...`}
                    rows={field.key.toLowerCase().includes('rules') || field.key.toLowerCase().includes('text') || field.key.toLowerCase().includes('effect') || field.key.toLowerCase().includes('abilit') || field.key.toLowerCase().includes('description') ? 3 : 2}
                    className="text-sm"
                  />
                ) : (
                  <Input
                    id={`editCard-${field.key}`}
                    value={(editedData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter value for ${field.key}...`}
                    className="text-sm"
                  />
                )}
              </div>
            ))}
            {dynamicFields.length === 0 && (
                <p className="text-sm text-muted-foreground">This card's template seems to have no editable placeholder fields.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="secondary" onClick={handleDuplicateCard}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate & Close
          </Button>
          <Button type="button" onClick={handleSaveChanges}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
