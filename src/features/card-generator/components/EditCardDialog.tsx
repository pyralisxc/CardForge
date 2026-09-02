"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import type { CardData, CardFace } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { TemplateFieldDefinition } from '@/domain/templates';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollableDialogBody, ScrollableDialogContent } from '@/components/ui/scrollable-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Save, Layers, Minus, Plus, RefreshCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useProjectStore } from '@/features/project/client/workspace';
import { CardPreview, useArtifactViewport } from '@/features/card-rendering/client';
import { GeneratorFieldGroups } from '@/features/card-generator/components/GeneratorFieldGroups';
import {
  completeCardDataWithTemplateDefaults,
  getMissingRequiredFieldLabels,
  initializeCardDataFromTemplate,
} from '@/features/card-generator/lib/cardDataDefaults';
import { optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client/persistence-storage';
import { hasCardBacking, type DisplayCard } from '@/domain/rendering';

interface EditCardDialogProps {
  isOpen: boolean;
  card: DisplayCard | null;
  onSave: (updatedCard: DisplayCard) => void;
  onDuplicate: (cardToDuplicate: DisplayCard) => void;
  onClose: () => void;
  presentation?: 'dialog' | 'workspace';
}

export function EditCardDialog({ isOpen, card, onSave, onDuplicate, onClose, presentation = 'dialog' }: EditCardDialogProps) {
  const [editedData, setEditedData] = useState<CardData>({});
  const [dynamicFields, setDynamicFields] = useState<TemplateFieldDefinition[]>([]);
  const [editedBackingData, setEditedBackingData] = useState<CardData>({});
  const [backingFields, setBackingFields] = useState<TemplateFieldDefinition[]>([]);
  const [previewFace, setPreviewFace] = useState<CardFace>('front');

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const backingFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useProjectStore((state) => state.setRichTextHighlightColor);
  const previewTemplate = previewFace === 'back' ? card?.backingTemplate : card?.template;
  const artifactViewport = useArtifactViewport({
    aspectRatio: previewTemplate?.aspectRatio,
    horizontalPadding: 80,
    maxWidth: 620,
    verticalPadding: 80,
  });
  const fitArtifactViewport = artifactViewport.fit;

  const generateFieldsAndData = useCallback((template: TCGCardTemplate | undefined | null, existingData: CardData | null | undefined): [TemplateFieldDefinition[], CardData] => {
    return initializeCardDataFromTemplate(template, existingData);
  }, []);

  useEffect(() => {
    if (card) {
      const [fields, data] = generateFieldsAndData(card.template, card.data);
      const [nextBackingFields, nextBackingData] = generateFieldsAndData(card.backingTemplate, card.backingData);
      setDynamicFields(fields);
      setEditedData(data);
      setBackingFields(nextBackingFields);
      setEditedBackingData(nextBackingData);
    } else {
      setEditedData({});
      setDynamicFields([]);
      setEditedBackingData({});
      setBackingFields([]);
    }
  }, [card, generateFieldsAndData]);

  useEffect(() => {
    if (!card?.backingTemplate) setPreviewFace('front');
    fitArtifactViewport();
  }, [card?.backingTemplate, card?.uniqueId, fitArtifactViewport]);

  const handleImageUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>,
    fieldKey: string,
    face: 'front' | 'back',
  ) => {
    const file = event.target.files?.[0];
    const fileRefsLocal = face === 'back' ? backingFileInputRefs : fileInputRefs;
    if (fileRefsLocal.current[fieldKey]) fileRefsLocal.current[fieldKey]!.value = '';

    if (file) {
      const validation = validateLocalAssetFile(file);
      if (!validation.ok) {
        toast({ title: 'Image Not Added', description: validation.message, variant: 'destructive' });
        return;
      }
      let storedFile: File;
      try {
        storedFile = await optimizeLocalAssetFile(file);
      } catch (error) {
        toast({ title: 'Image Not Added', description: error instanceof Error ? error.message : 'Unable to validate the image.', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        const setFaceData = face === 'back' ? setEditedBackingData : setEditedData;
        setFaceData(prev => ({ ...prev, [fieldKey]: dataUri }));
        toast({ title: "Image Uploaded", description: `"${file.name}" loaded for the ${face} ${fieldKey} field.` });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read image file.", variant: "destructive" });
      };
      reader.readAsDataURL(storedFile);
    }
  }, [toast]);

  const validateRequiredFields = useCallback((): boolean => {
    const missingFields = [
      ...getMissingRequiredFieldLabels(dynamicFields, editedData).map((label) => `Front: ${label}`),
      ...(card?.backingTemplate
        ? getMissingRequiredFieldLabels(backingFields, editedBackingData).map((label) => `Back: ${label}`)
        : []),
    ];
    if (missingFields.length === 0) return true;
    toast({
      title: 'Required fields are missing',
      description: `Fill in ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ', ...' : ''} before saving.`,
      variant: 'destructive',
    });
    return false;
  }, [backingFields, card?.backingTemplate, dynamicFields, editedBackingData, editedData, toast]);

  const getEditedCard = useCallback((): DisplayCard | null => {
    if (!card) return null;
    const finalData = completeCardDataWithTemplateDefaults(dynamicFields, editedData);
    const finalBackingData = card.backingTemplate
      ? completeCardDataWithTemplateDefaults(backingFields, editedBackingData)
      : undefined;
    return { ...card, data: finalData, backingData: finalBackingData };
  }, [backingFields, card, dynamicFields, editedBackingData, editedData]);

  const handleSaveChanges = useCallback(() => {
    if (validateRequiredFields()) {
      const updatedCard = getEditedCard();
      if (!updatedCard) return;
      onSave(updatedCard);
    }
  }, [getEditedCard, onSave, validateRequiredFields]);

  const handleDuplicateThisCard = useCallback(() => {
    if (validateRequiredFields()) {
      const updatedCard = getEditedCard();
      if (!updatedCard) return;
      onDuplicate(updatedCard);
      onClose();
    }
  }, [getEditedCard, onClose, onDuplicate, validateRequiredFields]);

  const previewCard = useMemo<DisplayCard | null>(() => card ? {
    ...card,
    data: editedData,
    backingData: card.backingTemplate ? editedBackingData : undefined,
  } : null, [card, editedBackingData, editedData]);

  if (!card) return null;

  const cardIdentifier = String(editedData[dynamicFields.find(f => f.key.toLowerCase().includes("name") && !f.key.toLowerCase().includes("artistname") && !f.isImage)?.key || ''] || editedData[dynamicFields.find(f => f.key.toLowerCase().includes("title") && !f.isImage)?.key || ''] || `Card ${card.uniqueId.substring(0,5)}`);

  const renderFields = (
    fields: TemplateFieldDefinition[],
    data: CardData,
    fileRefsLocal: React.MutableRefObject<Record<string, HTMLInputElement | null>>,
    onFieldChange: (fieldKey: string, value: string) => void,
    face: 'front' | 'back',
    emptyMessage: string,
  ) => (
    <GeneratorFieldGroups
      fields={fields}
      data={data}
      onFieldChange={onFieldChange}
      highlightColor={richTextHighlightColor}
      onHighlightColorChange={setRichTextHighlightColorAction}
      fileInputRefs={fileRefsLocal}
      onImageUpload={(event, fieldKey) => handleImageUpload(event, fieldKey, face)}
      emptyMessage={emptyMessage}
    />
  );

  const editorFields = (
    <Accordion type="multiple" defaultValue={['edit-front-data', 'edit-back-data']} className="w-full">
      <AccordionItem value="edit-front-data">
        <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Front Details</AccordionTrigger>
        <AccordionContent className="space-y-1 pt-3">
          {renderFields(
            dynamicFields,
            editedData,
            fileInputRefs,
            (fieldKey, value) => setEditedData(prev => ({ ...prev, [fieldKey]: value })),
            'front',
            'This front design has no editable fields.',
          )}
        </AccordionContent>
      </AccordionItem>
      {card.backingTemplate ? (
        <AccordionItem value="edit-back-data">
          <AccordionTrigger className="text-base [&>.lucide-chevron-down]:hidden"><Layers className="mr-2 h-4 w-4" />Back Details</AccordionTrigger>
          <AccordionContent className="space-y-1 pt-3">
            {renderFields(
              backingFields,
              editedBackingData,
              backingFileInputRefs,
              (fieldKey, value) => setEditedBackingData(prev => ({ ...prev, [fieldKey]: value })),
              'back',
              'This back is a fixed design with no per-card fields. It will still appear in previews and exports.',
            )}
          </AccordionContent>
        </AccordionItem>
      ) : null}
    </Accordion>
  );

  if (presentation === 'workspace' && previewCard) {
    return (
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--cf-canvas)] text-[var(--cf-text)]" data-artifact-edit-workspace aria-labelledby="artifact-edit-heading">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-editor-shell)] py-2 pl-3 pr-16 sm:gap-3 sm:px-4 sm:pr-20">
          <div className="mr-auto min-w-0">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Artifact editor</p>
            <h2 id="artifact-edit-heading" className="truncate font-serif text-lg text-[var(--cf-text-strong)]">{cardIdentifier}</h2>
          </div>
          <div className="flex items-center gap-1" aria-label="Artifact zoom controls">
            <Button type="button" size="icon" variant="ghost" onClick={() => artifactViewport.changeZoom(artifactViewport.zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
            <span className="w-12 text-center text-xs tabular-nums text-[var(--cf-text-muted)]" aria-live="polite">{Math.round(artifactViewport.zoom * 100)}%</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => artifactViewport.changeZoom(artifactViewport.zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
            <Button type="button" size="sm" variant="ghost" onClick={artifactViewport.fit}>Fit</Button>
          </div>
          <span className="hidden text-[0.68rem] text-[var(--cf-text-subtle)] xl:inline">Pinch or scroll to zoom</span>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" variant="secondary" onClick={handleDuplicateThisCard}><Copy className="mr-1.5 h-4 w-4" />Duplicate</Button>
          <Button type="button" size="sm" onClick={handleSaveChanges}><Save className="mr-1.5 h-4 w-4" />Save</Button>
        </header>
        <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(15rem,42dvh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] lg:grid-rows-1">
          <div
            ref={artifactViewport.viewportRef}
            className="relative min-h-0 min-w-0 overscroll-contain bg-[var(--cf-editor-canvas)]"
            data-artifact-edit-stage
            data-auto-fit={artifactViewport.isAutoFit ? 'true' : 'false'}
            onWheel={artifactViewport.onWheel}
            onPointerDown={artifactViewport.onPointerDown}
            onPointerMove={artifactViewport.onPointerMove}
            onPointerUp={artifactViewport.onPointerUp}
            onPointerCancel={artifactViewport.onPointerCancel}
            style={{ overflow: artifactViewport.isAutoFit ? 'hidden' : 'auto', touchAction: 'pan-x pan-y' }}
            aria-label={`${cardIdentifier} editing viewport`}
          >
            <div className="relative flex items-center justify-center" style={{ width: artifactViewport.worldWidth, height: artifactViewport.worldHeight }}>
              <div className="relative shrink-0" style={{ width: artifactViewport.visualWidth, minHeight: artifactViewport.visualHeight }} data-card-face={previewFace}>
                <CardPreview card={previewCard} face={previewFace} targetWidthPx={artifactViewport.visualWidth} />
                {hasCardBacking(previewCard) ? (
                  <Button type="button" size="sm" variant="outline" className="absolute bottom-3 right-3 shadow-lg" onClick={() => setPreviewFace((current) => current === 'front' ? 'back' : 'front')} aria-label={`Show ${previewFace === 'front' ? 'back' : 'front'} of ${cardIdentifier}`}>
                    <RefreshCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />{previewFace === 'front' ? 'Back' : 'Front'}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <aside className="cardforge-scroll-body min-h-0 overflow-y-auto overscroll-contain border-t border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4 [-webkit-overflow-scrolling:touch] lg:border-l lg:border-t-0" aria-label="Artifact fields">
            <p className="mb-1 text-xs text-[var(--cf-text-muted)]">Front: {card.template.name || card.template.id?.substring(0,8)}{card.backingTemplate ? ` · Back: ${card.backingTemplate.name || card.backingTemplate.id?.substring(0, 8)}` : ' · No back selected'}</p>
            {editorFields}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => !openState && onClose()}>
      <ScrollableDialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit: {cardIdentifier}</DialogTitle>
          <DialogDescription>
            Front: {card.template.name || card.template.id?.substring(0,8)}
            {card.backingTemplate ? ` · Back: ${card.backingTemplate.name || card.backingTemplate.id?.substring(0, 8)}` : ' · No back selected'}
          </DialogDescription>
        </DialogHeader>
        <ScrollableDialogBody className="-mr-6 mb-4 pr-6">
          {editorFields}
        </ScrollableDialogBody>

        <DialogFooter className="mt-4 shrink-0 border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="secondary" onClick={handleDuplicateThisCard}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate & Close
          </Button>
          <Button type="button" onClick={handleSaveChanges}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
