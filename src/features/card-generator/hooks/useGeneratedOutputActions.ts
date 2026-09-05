"use client";

import { useCallback } from 'react';
import { nanoid } from 'nanoid';


import type { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import { trackCardCreated } from '@/features/analytics/client/tracking';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseGeneratedOutputActionsInput {
  addGeneratedCards: (cards: DisplayCard[]) => void;
  closeEditDialog: () => void;
  openEditDialog: (cardUniqueId: string) => void;
  removeGeneratedCard: (cardUniqueId: string) => void;
  toast: ToastFn;
  updateGeneratedCard: (card: DisplayCard) => void;
}

export function useGeneratedOutputActions({
  addGeneratedCards,
  closeEditDialog,
  openEditDialog,
  removeGeneratedCard,
  toast,
  updateGeneratedCard,
}: UseGeneratedOutputActionsInput) {

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    addGeneratedCards(cards);
    if (cards.length > 0) {
      trackCardCreated('bulk', cards.length);
      toast({ title: 'Cards added to your set', description: `${cards.length} cards are ready for review.` });
    }
  }, [addGeneratedCards, toast]);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    addGeneratedCards([card]);
    trackCardCreated('single', 1);
  }, [addGeneratedCards]);


  const handleEditCardRequest = useCallback((cardToEdit: DisplayCard) => {
    openEditDialog(cardToEdit.uniqueId);
  }, [openEditDialog]);

  const handleSaveEditedCard = useCallback((updatedCard: DisplayCard) => {
    updateGeneratedCard(updatedCard);
    closeEditDialog();
    toast({ title: 'Card updated', description: 'Changes saved.' });
  }, [closeEditDialog, toast, updateGeneratedCard]);

  const handleRemoveCard = useCallback((cardToRemove: DisplayCard) => {
    removeGeneratedCard(cardToRemove.uniqueId);
    toast({ title: 'Card removed', description: 'The card was removed from this browser.' });
  }, [removeGeneratedCard, toast]);

  const handleDuplicateCard = useCallback((cardToDuplicate: DisplayCard) => {
    const newCard: DisplayCard = {
      ...JSON.parse(JSON.stringify(cardToDuplicate)),
      uniqueId: nanoid(),
    };
    addGeneratedCards([newCard]);
    toast({ title: 'Card duplicated', description: 'A copy of the card was added to this set.' });
  }, [addGeneratedCards, toast]);

  const handleCloseEditDialog = useCallback(() => {
    closeEditDialog();
  }, [closeEditDialog]);

  return {
    handleBulkCardsGenerated,
    handleCloseEditDialog,
    handleDuplicateCard,
    handleEditCardRequest,
    handleRemoveCard,
    handleSaveEditedCard,
    handleSingleCardAdded,
  };
}
