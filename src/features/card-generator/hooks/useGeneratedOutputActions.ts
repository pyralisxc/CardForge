"use client";

import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';

import type { DisplayCard } from '@/types';
import type { useToast } from '@/hooks/use-toast';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseGeneratedOutputActionsInput {
  addGeneratedCards: (cards: DisplayCard[]) => void;
  clearGeneratedCards: () => void;
  closeEditDialog: () => void;
  openEditDialog: (cardUniqueId: string) => void;
  toast: ToastFn;
  updateGeneratedCard: (card: DisplayCard) => void;
}

export function useGeneratedOutputActions({
  addGeneratedCards,
  clearGeneratedCards,
  closeEditDialog,
  openEditDialog,
  toast,
  updateGeneratedCard,
}: UseGeneratedOutputActionsInput) {
  const [isClearCardsDialogOpen, setIsClearCardsDialogOpen] = useState(false);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    addGeneratedCards(cards);
    if (cards.length > 0) toast({ title: 'Data Generation Complete', description: `${cards.length} outputs added.` });
  }, [addGeneratedCards, toast]);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    addGeneratedCards([card]);
  }, [addGeneratedCards]);

  const handleClearGeneratedCards = useCallback(() => {
    clearGeneratedCards();
    setIsClearCardsDialogOpen(false);
    toast({ title: 'Cleared', description: 'Generated outputs have been cleared.' });
  }, [clearGeneratedCards, toast]);

  const handleEditCardRequest = useCallback((cardToEdit: DisplayCard) => {
    openEditDialog(cardToEdit.uniqueId);
  }, [openEditDialog]);

  const handleSaveEditedCard = useCallback((updatedCard: DisplayCard) => {
    updateGeneratedCard(updatedCard);
    toast({ title: 'Output Updated', description: 'Changes saved.' });
  }, [toast, updateGeneratedCard]);

  const handleDuplicateCard = useCallback((cardToDuplicate: DisplayCard) => {
    const newCard: DisplayCard = {
      ...JSON.parse(JSON.stringify(cardToDuplicate)),
      uniqueId: nanoid(),
    };
    addGeneratedCards([newCard]);
    toast({ title: 'Output Duplicated', description: 'A copy of the output has been added.' });
  }, [addGeneratedCards, toast]);

  const handleCloseEditDialog = useCallback(() => {
    closeEditDialog();
  }, [closeEditDialog]);

  return {
    handleBulkCardsGenerated,
    handleClearGeneratedCards,
    handleCloseEditDialog,
    handleDuplicateCard,
    handleEditCardRequest,
    handleSaveEditedCard,
    handleSingleCardAdded,
    isClearCardsDialogOpen,
    setIsClearCardsDialogOpen,
  };
}
