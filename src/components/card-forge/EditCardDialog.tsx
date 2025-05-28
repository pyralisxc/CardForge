
"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import type { DisplayCard, CardData, TCGCardTemplate, CardSection } from '@/types';
import { TCG_FIELD_DEFINITIONS } from '@/lib/constants';
import { extractUniquePlaceholderKeys, toTitleCase } from '@/lib/utils';
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
  label: string;
  type: 'input' | 'textarea';
  example?: string;
  defaultValue?: string;
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose }: EditCardDialogProps) {
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);

  useEffect(() => {
    if (card) {
      const allPlaceholderKeys = extractUniquePlaceholderKeys(card.template);
      const currentCardData = { ...card.data };
      const newEditedData: CardData = {};

      const fields: DynamicField[] = allPlaceholderKeys.map(placeholder => {
        const definition = TCG_FIELD_DEFINITIONS.find(def => def.key.toLowerCase() === placeholder.key.toLowerCase());
        let exampleText = `e.g., ${toTitleCase(placeholder.key)}`;
        if (placeholder.key.toLowerCase().includes('url') || placeholder.key.toLowerCase().includes('artwork')) {
          exampleText = 'e.g., https://placehold.co/300x200.png or data:image/...';
        }

        // Initialize editedData: use existing card data, or template default, or empty
        if (currentCardData[placeholder.key] !== undefined) {
          newEditedData[placeholder.key] = currentCardData[placeholder.key];
        } else if (placeholder.defaultValue !== undefined) {
          newEditedData[placeholder.key] = placeholder.defaultValue;
        } else {
          newEditedData[placeholder.key] = '';
        }
        
        return {
          key: placeholder.key,
          label: definition?.label || toTitleCase(placeholder.key),
          type: definition?.type === 'textarea' ? 'textarea' : 'input',
          example: definition?.example || exampleText,
          defaultValue: placeholder.defaultValue,
        };
      });
      setDynamicFields(fields);
      setEditedData(newEditedData);
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
      onSave({ ...card, data: editedData });
    }
  };
  
  const handleDuplicateCard = () => {
    if (card) {
      onDuplicate({ ...card, data: editedData }); // Duplicate with current edits
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
                  {field.defaultValue !== undefined && (editedData[field.key] === field.defaultValue || card.data[field.key] === undefined) && 
                    <span className="text-xs text-muted-foreground ml-1">(Default: "{field.defaultValue}")</span>
                  }
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`editCard-${field.key}`}
                    value={(editedData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter ${field.label.toLowerCase()}...`}
                    rows={field.key.toLowerCase().includes('rules') || field.key.toLowerCase().includes('text') || field.key.toLowerCase().includes('effect') ? 3 : 2}
                    className="text-sm"
                  />
                ) : (
                  <Input
                    id={`editCard-${field.key}`}
                    value={(editedData[field.key] as string) || ''}
                    onChange={(e) => handleInputChange(e, field.key)}
                    placeholder={field.example || `Enter ${field.label.toLowerCase()}...`}
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
