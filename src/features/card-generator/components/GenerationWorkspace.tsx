"use client";

import { useCallback, useMemo } from 'react';
import { FolderOpen, Layers3, PackagePlus, Pencil, PenTool, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardPreview, CardWatermarkOverlay, shouldShowVisibleCardWatermark } from '@/features/card-rendering/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkGenerator } from '@/features/card-generator/components/BulkGenerator';
import { CardSetManager } from '@/features/card-generator/components/CardSetManager';
import type { ZipExportKind } from '@/features/card-generator/hooks/useCardZipExportActions';
import type { GeneratedGallerySort } from '@/features/card-generator/components/GeneratedCardGallery';
import type { CardSet } from '@/domain/cards';
import {
  getCompatibleCardBacks,
  getTemplateCardMeasurement,
  resolveTemplateCardFormat,
  type TemplateCardFormatSource,
} from '@/domain/card-formats';
import type { TCGCardTemplate } from '@/domain/templates';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import type { TabletopSimulatorExportQuality } from '@/features/card-generator/lib/zipExport';
import { trackCardForgeEvent } from '@/features/analytics/client';

interface GenerationWorkspaceProps {
  isLoadingTemplates: boolean;
  templates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  activeCardSet: CardSet;
  generatorSelectedTemplateId: string | null;
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  richTextHighlightColor: string;
  exportMode: ExportMode;
  exportDpi: number;
  generatedDisplayCards: DisplayCard[];
  zipProgress: { done: number; total: number } | null;
  gallerySearch: string;
  gallerySort: GeneratedGallerySort;
  isZipExporting: boolean;
  zipExportKind: ZipExportKind | null;
  isCheckoutStarting: boolean;
  canExportClean: boolean;
  exportGateMessage?: string | null;
  exportEntitlementLabel: string;
  exportEntitlementMessage: string;
  onOpenTemplateMaker: () => void;
  onCreateMatchingBack: (formatSource: TemplateCardFormatSource) => void;
  onEditSelectedBack: (templateId: string) => void;
  onManageCardBacks: () => void;
  onSingleCardAdded: (card: DisplayCard) => void;
  onBulkCardsGenerated: (cards: DisplayCard[]) => void;
  onTemplateSelectionChange: (templateId: string | null) => void;
  onSetActiveCardSetName: (name: string) => void;
  onSetActiveCardSetBackingTemplateId: (templateId: string | null) => void;
  onSelectPaperSize: (size: PaperSize) => void;
  onSetPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  onSetExportMode: (mode: ExportMode) => void;
  onSetExportDpi: (dpi: number) => void;
  onStartCheckout: () => void;
  onExportAllAsZip: () => void;
  onExportTabletopSimulatorSpritesheets: (quality: TabletopSimulatorExportQuality) => void;
  onClearCardsRequest: () => void;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
  onRemoveCard: (card: DisplayCard) => void;
}

export function GenerationWorkspace(props: GenerationWorkspaceProps) {
  const {
    isLoadingTemplates,
    templates,
    backFaceTemplates,
    activeCardSet,
    generatorSelectedTemplateId,
    richTextHighlightColor,
    canExportClean,
    generatedDisplayCards,
    onOpenTemplateMaker,
    onCreateMatchingBack,
    onEditSelectedBack,
    onManageCardBacks,
    onBulkCardsGenerated,
    onTemplateSelectionChange,
    onSetActiveCardSetName,
    onSetActiveCardSetBackingTemplateId,
  } = props;

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === generatorSelectedTemplateId) || null,
    [generatorSelectedTemplateId, templates],
  );
  const compatibleBackTemplates = useMemo(
    () => selectedTemplate ? getCompatibleCardBacks(selectedTemplate, backFaceTemplates) : [],
    [backFaceTemplates, selectedTemplate],
  );
  const selectedBackingTemplate = useMemo(
    () => activeCardSet.backingTemplateId
      ? compatibleBackTemplates.find((template) => template.id === activeCardSet.backingTemplateId) || null
      : null,
    [activeCardSet.backingTemplateId, compatibleBackTemplates],
  );
  const selectedFormat = selectedTemplate ? resolveTemplateCardFormat(selectedTemplate) : null;
  const deckPreviewCard = useMemo<DisplayCard | null>(() => (
    selectedTemplate
      ? {
          template: selectedTemplate,
          backingTemplate: selectedBackingTemplate,
          backingTemplateId: selectedBackingTemplate?.id ?? null,
          setId: activeCardSet.id,
          setName: activeCardSet.name,
          data: selectedTemplate.templatePreviewData || {},
          uniqueId: `${activeCardSet.id}-setup-preview`,
        }
      : null
  ), [activeCardSet.id, activeCardSet.name, selectedBackingTemplate, selectedTemplate]);
  const showGeneratedPreviewWatermark = shouldShowVisibleCardWatermark(canExportClean);

  const requestMatchingBack = useCallback(() => {
    if (!selectedTemplate) return;
    trackCardForgeEvent('matching_back_requested', {
      format_id: selectedFormat?.formatId ?? 'custom',
      format_kind: selectedFormat?.formatId === 'custom' ? 'custom' : 'standard',
    });
    onCreateMatchingBack(selectedTemplate);
  }, [onCreateMatchingBack, selectedFormat?.formatId, selectedTemplate]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    onBulkCardsGenerated(cards);
    if (cards.length > 0) {
      trackCardForgeEvent('generation_method_selected', { generation_method: 'bulk' });
    }
  }, [onBulkCardsGenerated]);

  if (isLoadingTemplates) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Loading templates" />
        <p className="text-sm text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-5 rounded-xl border bg-card/30 p-12 text-center shadow-inner">
        <PenTool className="h-16 w-16 text-primary/60" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">No Templates Yet</h2>
          <p className="max-w-sm text-muted-foreground">Open Templates to create a front Template first, then come back here to generate cards from a list.</p>
        </div>
        <Button size="lg" onClick={onOpenTemplateMaker} className="gap-2">
          <PenTool className="h-5 w-5" /> Open Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <section data-workflow-step="setup" tabIndex={-1} aria-labelledby="generator-setup-heading" className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Layers3 className="h-5 w-5 text-primary" />
          <div>
            <h2 id="generator-setup-heading" className="text-base font-semibold">Generation target</h2>
            <p className="text-xs text-muted-foreground">Choose which set and Template this batch should use.</p>
          </div>
        </div>

        <CardSetManager />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
          <div>
            <Label htmlFor="active-card-set-name">Set name</Label>
            <Input
              id="active-card-set-name"
              value={activeCardSet.name}
              onChange={(event) => onSetActiveCardSetName(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="deck-front-template">Template</Label>
            <Select
              value={generatorSelectedTemplateId ?? undefined}
              onValueChange={(value) => onTemplateSelectionChange(value)}
              disabled={templates.length === 0}
            >
              <SelectTrigger id="deck-front-template">
                <SelectValue placeholder="Choose a Template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id || template.name} value={template.id || template.name}>
                    {template.name || template.id} · {getTemplateCardMeasurement(template, 'mm').label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="deck-backing-template">Card back</Label>
            <Select
              value={activeCardSet.backingTemplateId || '_none_'}
              onValueChange={(value) => {
                onSetActiveCardSetBackingTemplateId(value === '_none_' ? null : value);
                trackCardForgeEvent('card_back_selected', {
                  format_id: selectedFormat?.formatId ?? 'custom',
                  has_matching_back: value !== '_none_',
                });
              }}
            >
              <SelectTrigger id="deck-backing-template">
                <SelectValue placeholder="Choose card back" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">No card back</SelectItem>
                {compatibleBackTemplates.map((template) => (
                  <SelectItem key={template.id || template.name} value={template.id || template.name}>
                    {template.name || template.id} · {getTemplateCardMeasurement(template, 'mm').label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplate && compatibleBackTemplates.length > 0 ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {selectedBackingTemplate?.id ? (
                  <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={() => onEditSelectedBack(selectedBackingTemplate.id!)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit selected back
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={requestMatchingBack}>
                  <Plus className="mr-2 h-4 w-4" /> Create matching back
                </Button>
                <Button type="button" size="sm" variant="ghost" className="w-full justify-start" onClick={onManageCardBacks}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Manage card backs
                </Button>
              </div>
            ) : null}

            {selectedTemplate && compatibleBackTemplates.length === 0 ? (
              <div className="mt-2 space-y-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs">
                <p className="font-medium text-foreground">No matching card back yet</p>
                <p className="leading-5 text-muted-foreground">
                  This design uses {selectedFormat ? `${selectedFormat.widthMm} × ${selectedFormat.heightMm} mm` : 'a custom size'}. Create a matching back now, or continue without one.
                </p>
                <Button type="button" size="sm" variant="outline" className="w-full" onClick={requestMatchingBack}>
                  Create matching card back
                </Button>
              </div>
            ) : null}
          </div>

          {deckPreviewCard ? (
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-background/70 p-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Front</p>
                <div className="relative w-fit">
                  <CardPreview card={deckPreviewCard} face="front" highlightColor={richTextHighlightColor} targetWidthPx={110} />
                  {showGeneratedPreviewWatermark ? <CardWatermarkOverlay testId="deck-front-watermark" /> : null}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Back</p>
                {selectedBackingTemplate ? (
                  <div className="relative w-fit">
                    <CardPreview card={deckPreviewCard} face="back" highlightColor={richTextHighlightColor} targetWidthPx={110} />
                    {showGeneratedPreviewWatermark ? <CardWatermarkOverlay testId="deck-back-watermark" /> : null}
                  </div>
                ) : (
                  <div className="flex aspect-[63/88] w-[78px] items-center justify-center rounded border border-dashed bg-muted/40 px-2 text-center text-xs text-muted-foreground">
                    No card back selected
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section data-workflow-step="generate" aria-labelledby="generator-entry-heading" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bulk generation</p>
            <h2 id="generator-entry-heading" className="mt-1 text-xl font-semibold">Generate cards from a list</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Make Cards is the production-input workspace. Add or paste a batch here, then use Sets to inspect, edit, share, back up, and export the finished cards.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
            <PackagePlus className="h-4 w-4 text-primary" />
            {generatedDisplayCards.length} card{generatedDisplayCards.length === 1 ? '' : 's'} currently in {activeCardSet.name}
          </div>
        </div>

        <BulkGenerator
          templates={templates}
          backingTemplate={selectedBackingTemplate}
          activeCardSet={activeCardSet}
          onCardsGenerated={handleBulkCardsGenerated}
          selectedTemplateIdProp={generatorSelectedTemplateId}
        />
      </section>

      {generatedDisplayCards.length > 0 ? (
        <div className="rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-text-muted)]" role="status">
          This set already has {generatedDisplayCards.length} card{generatedDisplayCards.length === 1 ? '' : 's'}. Review, preview, share, and export them from <span className="font-semibold text-[var(--cf-text-strong)]">Sets</span>.
        </div>
      ) : null}
    </div>
  );
}
