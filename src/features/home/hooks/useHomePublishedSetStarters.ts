"use client";

import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { createPublishedSetCopy } from '@/features/project/client';
import type { CardForgeCatalogManifest } from '@/features/pipeline/client';

interface UseHomePublishedSetStartersOptions {
  focusCreatedSet: (setId: string) => void;
  refreshLibrary: () => void;
}

export function useHomePublishedSetStarters({
  focusCreatedSet,
  refreshLibrary,
}: UseHomePublishedSetStartersOptions) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [publishedSets, setPublishedSets] = useState<CardForgeCatalogManifest['sets']['items']>([]);
  const [publishedSetsLoading, setPublishedSetsLoading] = useState(false);
  const [publishedSetsFailure, setPublishedSetsFailure] = useState<string | null>(null);
  const [creatingPublishedSetId, setCreatingPublishedSetId] = useState<string | null>(null);

  const openCreateMenu = () => {
    setCreateOpen(true);
    if (publishedSets.length || publishedSetsLoading) return;
    setPublishedSetsLoading(true);
    setPublishedSetsFailure(null);
    void fetch('/api/catalog', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Published Set starters are unavailable right now.');
        return response.json() as Promise<CardForgeCatalogManifest>;
      })
      .then((catalog) => setPublishedSets(catalog.sets?.items ?? []))
      .catch((error: unknown) => setPublishedSetsFailure(
        error instanceof Error ? error.message : 'Published Set starters are unavailable right now.',
      ))
      .finally(() => setPublishedSetsLoading(false));
  };

  const createFromPublishedSet = async (set: CardForgeCatalogManifest['sets']['items'][number]) => {
    setCreatingPublishedSetId(set.id);
    try {
      const result = await createPublishedSetCopy({ packageUrl: set.packageUrl, expectedName: set.name });
      focusCreatedSet(result.setId);
      setCreateOpen(false);
      refreshLibrary();
      toast({
        title: 'Set created',
        description: `${result.setName} is independent browser work with ${result.cardCount} card${result.cardCount === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      toast({
        title: 'Set was not created',
        description: error instanceof Error ? error.message : 'The published Set package is unavailable.',
        variant: 'destructive',
      });
    } finally {
      setCreatingPublishedSetId(null);
    }
  };

  return {
    createFromPublishedSet,
    createOpen,
    creatingPublishedSetId,
    openCreateMenu,
    publishedSets,
    publishedSetsFailure,
    publishedSetsLoading,
    setCreateOpen,
    setPublishedSets,
    setPublishedSetsFailure,
    setPublishedSetsLoading,
  };
}
