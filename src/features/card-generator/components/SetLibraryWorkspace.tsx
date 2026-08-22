"use client";

import { useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Eye,
  FileJson2,
  FolderOpen,
  FolderPlus,
  Loader2,
  PackagePlus,
  Pencil,
  Search,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAccountEntitlement } from '@/features/account/client';
import {
  CardPreview,
  CardWatermarkOverlay,
  shouldShowVisibleCardWatermark,
} from '@/features/card-rendering/client';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import {
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  useCardTransferActions,
  useCloudSetActions,
  useProjectStore,
  type ProjectState,
} from '@/features/project/client';
import { CardVisualPreviewDialog } from '@/features/card-generator/components/CardVisualPreviewDialog';
import { ExportCardImageButton } from '@/features/card-generator/components/ExportCardImageButton';
import { ExportControlsPanel } from '@/features/card-generator/components/ExportControlsPanel';
import { ShareCardButton } from '@/features/card-generator/components/ShareCardButton';
import type { ZipExportKind } from '@/features/card-generator/hooks/useCardZipExportActions';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import type { TabletopSimulatorExportQuality } from '@/features/card-generator/lib/zipExport';

interface SetLibraryWorkspaceProps {
  onOpenMakeCards: () => void;
  onEditCardRequest: (card: DisplayCard) => void;
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  exportDpi: number;
  zipProgress: { done: number; total: number } | null;
  isZipExporting: boolean;
  zipExportKind: ZipExportKind | null;
  isCheckoutStarting: boolean;
  canExportClean: boolean;
  exportGateMessage?: string | null;
  exportEntitlementLabel: string;
  exportEntitlementMessage: string;
  onSelectPaperSize: (size: PaperSize) => void;
  onSetPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  onSetExportMode: (mode: ExportMode) => void;
  onSetExportDpi: (dpi: number) => void;
  onStartCheckout: () => void;
  onExportAllAsZip: () => void;
  onExportTabletopSimulatorSpritesheets: (quality: TabletopSimulatorExportQuality) => void;
  onClearCardsRequest: () => void;
}

const getCardTitle = (card: DisplayCard, index: number) => String(
  card.data.cardName
    ?? card.data.name
    ?? card.data.title
    ?? `Card ${index + 1}`,
);

export function SetLibraryWorkspace({
  onOpenMakeCards,
  onEditCardRequest,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  pdfDuplexLayout,
  exportMode,
  exportDpi,
  zipProgress,
  isZipExporting,
  zipExportKind,
  isCheckoutStarting,
  canExportClean,
  exportGateMessage,
  exportEntitlementLabel,
  exportEntitlementMessage,
  onSelectPaperSize,
  onSetPdfOptions,
  onSetExportMode,
  onSetExportDpi,
  onStartCheckout,
  onExportAllAsZip,
  onExportTabletopSimulatorSpritesheets,
  onClearCardsRequest,
}: SetLibraryWorkspaceProps) {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [previewCard, setPreviewCard] = useState<DisplayCard | null>(null);
  const account = useAccountEntitlement();
  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const storedCards = useProjectStore((state) => state.storedCards);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const setActiveCardSetName = useProjectStore((state) => state.setActiveCardSetName);
  const { exportSet, handleImportTransfer } = useCardTransferActions({ toast });
  const {
    cloud,
    cloudBySetId,
    isLoadingCloudSets,
    loadingSetId,
    loadSetFromCloud,
    saveSetToCloud,
    savingSetId,
  } = useCloudSetActions({
    toast,
    enabled: account.isSignedIn && !account.isLoadingEntitlement,
  });

  const templates = useMemo(
    () => selectAllTemplates({ defaultTemplates, userTemplates }),
    [defaultTemplates, userTemplates],
  );
  const displayCards = useMemo(() => selectAllGeneratedDisplayCards({
    defaultTemplates,
    userTemplates,
    storedCards,
  } as ProjectState), [defaultTemplates, storedCards, userTemplates]);
  const localSetIds = useMemo(() => new Set(cardSets.map((set) => set.id)), [cardSets]);
  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storedCards.forEach((card) => {
      if (card.setId) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
    });
    return counts;
  }, [storedCards]);
  const query = search.trim().toLowerCase();
  const filteredLocalSets = useMemo(() => (
    query ? cardSets.filter((set) => set.name.toLowerCase().includes(query)) : cardSets
  ), [cardSets, query]);
  const cloudOnlySets = useMemo(() => (
    (cloud?.sets ?? []).filter((summary) => (
      !localSetIds.has(summary.setId)
      && (!query || summary.name.toLowerCase().includes(query))
    ))
  ), [cloud?.sets, localSetIds, query]);
  const activeCards = useMemo(() => displayCards.filter((card) => (
    card.setId === activeCardSet.id
    || (!card.setId && cardSets[0]?.id === activeCardSet.id)
  )), [activeCardSet.id, cardSets, displayCards]);
  const activeFrontTemplate = templates.find((template) => template.id === activeCardSet.frontTemplateId) ?? null;
  const activeBackTemplate = templates.find((template) => template.id === activeCardSet.backingTemplateId) ?? null;
  const activeCloudSet = cloudBySetId.get(activeCardSet.id);
  const cloudLimit = cloud?.limit ?? account.capabilities.cloudSetLimit;
  const cloudUsed = cloud?.used ?? 0;
  const canBackUpActiveSet = Boolean(activeCloudSet) || cloudUsed < cloudLimit;
  const showWatermark = shouldShowVisibleCardWatermark(canExportClean);

  const openSetForProduction = (setId: string) => {
    setActiveCardSetId(setId);
    onOpenMakeCards();
  };

  const loadCloudSet = async (setId: string) => {
    if (await loadSetFromCloud(setId)) setActiveCardSetId(setId);
  };

  return (
    <section
      data-cardforge-set-library="true"
      aria-labelledby="studio-set-library-title"
      className="cardforge-set-library flex min-h-0 flex-col overflow-hidden border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] lg:h-full"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--cf-border-subtle)] px-3 py-2.5">
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[var(--cf-accent-strong)]" />
            <h2 id="studio-set-library-title" className="font-serif text-lg font-semibold text-[var(--cf-text-strong)]">Set Library</h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--cf-text-muted)]">Review, inspect, share, back up, and export finished sets here.</p>
        </div>
        {account.isSignedIn ? (
          <span className="inline-flex min-h-8 items-center gap-1.5 border border-[var(--cf-border-subtle)] px-2 text-xs text-[var(--cf-text-muted)]">
            <Cloud className="h-3.5 w-3.5" /> {cloudUsed}/{cloudLimit} cloud
          </span>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Import editable set
        </Button>
        <Button type="button" size="sm" onClick={() => createCardSet()}>
          <FolderPlus className="mr-1.5 h-4 w-4" /> New set
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import CardForge editable set"
          onChange={handleImportTransfer}
        />
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--cf-border-subtle)] p-2.5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-subtle)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sets"
                aria-label="Search set library"
                className="h-9 pl-8"
              />
            </label>
          </div>
          <div className="cardforge-mobile-scroll-surface max-h-[14rem] overflow-y-auto p-2 lg:h-full lg:max-h-none">
            <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">On this device</p>
            <div className="space-y-1">
              {filteredLocalSets.map((set) => {
                const active = set.id === activeCardSet.id;
                const backedUp = cloudBySetId.has(set.id);
                return (
                  <button
                    key={set.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveCardSetId(set.id)}
                    className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left transition ${active
                      ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)] text-[var(--cf-text-strong)]'
                      : 'border-transparent text-[var(--cf-text-muted)] hover:border-[var(--cf-border-subtle)] hover:bg-[var(--cf-surface-hover)]'}`}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-[var(--cf-accent-strong)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{set.name}</span>
                      <span className="block text-[10px] text-[var(--cf-text-subtle)]">{cardCounts.get(set.id) ?? 0} cards</span>
                    </span>
                    {backedUp ? <Cloud className="h-3.5 w-3.5 shrink-0 text-[var(--cf-success)]" aria-label="Backed up to cloud" /> : null}
                  </button>
                );
              })}
              {filteredLocalSets.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[var(--cf-text-subtle)]">No local sets match that search.</p>
              ) : null}
            </div>

            {account.isSignedIn ? (
              <div className="mt-4 border-t border-[var(--cf-border-subtle)] pt-3">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">Cloud only</p>
                  {isLoadingCloudSets ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--cf-text-subtle)]" /> : null}
                </div>
                <div className="space-y-1">
                  {cloudOnlySets.map((summary) => (
                    <button
                      key={summary.setId}
                      type="button"
                      disabled={Boolean(loadingSetId)}
                      onClick={() => void loadCloudSet(summary.setId)}
                      className="flex w-full items-center gap-2 border border-dashed border-[var(--cf-border-subtle)] px-2.5 py-2 text-left text-[var(--cf-text-muted)] transition hover:bg-[var(--cf-surface-hover)] disabled:opacity-60"
                    >
                      {loadingSetId === summary.setId
                        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        : <CloudDownload className="h-4 w-4 shrink-0 text-[var(--cf-accent-strong)]" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{summary.name}</span>
                        <span className="block text-[10px] text-[var(--cf-text-subtle)]">{summary.cardCount} cards · load to edit</span>
                      </span>
                    </button>
                  ))}
                  {!isLoadingCloudSets && cloudOnlySets.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-[var(--cf-text-subtle)]">No cloud-only sets.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="cardforge-mobile-scroll-surface min-h-0 overflow-y-auto bg-[var(--cf-canvas)] p-3 md:p-4">
          <div className="flex flex-wrap items-start gap-3 border-b border-[var(--cf-border-subtle)] pb-3">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="set-library-name" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">Set name</label>
              <Input
                id="set-library-name"
                value={activeCardSet.name}
                onChange={(event) => setActiveCardSetName(event.target.value)}
                className="mt-1 h-10 max-w-xl text-base font-semibold"
              />
              <p className="mt-2 text-xs text-[var(--cf-text-muted)]">
                {activeCards.length} card{activeCards.length === 1 ? '' : 's'} · {activeFrontTemplate?.name ?? 'No front Template selected'} · {activeBackTemplate?.name ?? 'No card back'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void exportSet(activeCardSet.id)} title="Download editable CardForge set data">
                <FileJson2 className="mr-1.5 h-4 w-4" /> Editable set
              </Button>
              {account.isSignedIn ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canBackUpActiveSet || Boolean(savingSetId) || isLoadingCloudSets}
                  onClick={() => void saveSetToCloud(activeCardSet.id)}
                >
                  {savingSetId === activeCardSet.id
                    ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    : <CloudUpload className="mr-1.5 h-4 w-4" />}
                  {activeCloudSet ? 'Update backup' : canBackUpActiveSet ? 'Back up' : 'Cloud full'}
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={() => openSetForProduction(activeCardSet.id)}>
                <PackagePlus className="mr-1.5 h-4 w-4" /> Add cards
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-xs text-[var(--cf-text-muted)] sm:grid-cols-2">
            <div>
              <p className="font-semibold text-[var(--cf-text-strong)]">Editable set</p>
              <p className="mt-1 leading-5">Portable CardForge data for continuing work later: set metadata, cards, required personal Templates, and referenced local assets.</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--cf-text-strong)]">Rendered output</p>
              <p className="mt-1 leading-5">Finished PNGs, print PDF, individual images, and Tabletop Simulator files. Quality and layout controls are below.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[var(--cf-text-strong)]">Cards in this set</h3>
              <p className="text-xs text-[var(--cf-text-muted)]">Edit card data, open a close visual preview, share a social image, or download an individual rendered card.</p>
            </div>
          </div>

          {activeCards.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {activeCards.map((card, index) => (
                <article
                  key={card.uniqueId}
                  className="min-w-0 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-2 transition hover:border-[var(--cf-accent)]"
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => onEditCardRequest(card)}
                    aria-label={`Edit ${getCardTitle(card, index)}`}
                  >
                    <div className="mx-auto w-fit max-w-full overflow-hidden">
                      <div className="relative w-fit">
                        <CardPreview card={card} face="front" targetWidthPx={150} />
                        {showWatermark ? <CardWatermarkOverlay testId={`set-library-watermark-${card.uniqueId}`} /> : null}
                      </div>
                    </div>
                    <p className="mt-2 truncate text-xs font-semibold text-[var(--cf-text-strong)]">{getCardTitle(card, index)}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[var(--cf-text-subtle)]">{card.template.name}</p>
                  </button>

                  <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--cf-border-subtle)] pt-2">
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => onEditCardRequest(card)} aria-label={`Edit ${getCardTitle(card, index)}`} title="Edit card">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => setPreviewCard(card)} aria-label={`Preview ${getCardTitle(card, index)}`} title="Inspect rendered card">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <ShareCardButton
                      card={card}
                      exportMode={exportMode}
                      exportDpi={exportDpi}
                      richTextHighlightColor={richTextHighlightColor}
                      ariaLabel={`Share ${getCardTitle(card, index)}`}
                    />
                    <ExportCardImageButton
                      card={card}
                      exportMode={exportMode}
                      exportDpi={exportDpi}
                      richTextHighlightColor={richTextHighlightColor}
                      canExportClean={canExportClean}
                      disabled={false}
                      iconOnly
                      ariaLabel={`Download ${getCardTitle(card, index)}`}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid min-h-48 place-items-center border border-dashed border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-6 text-center">
              <div>
                <FolderOpen className="mx-auto h-8 w-8 text-[var(--cf-accent-strong)]" />
                <p className="mt-3 font-medium text-[var(--cf-text-strong)]">This set is ready for cards</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--cf-text-muted)]">Use Make Cards to generate a batch into this set. Review and output stay here in Sets.</p>
                <Button type="button" size="sm" className="mt-4" onClick={() => openSetForProduction(activeCardSet.id)}>
                  <PackagePlus className="mr-1.5 h-4 w-4" /> Open Make cards
                </Button>
              </div>
            </div>
          )}

          {activeCards.length > 0 ? (
            <section className="mt-6 border-t border-[var(--cf-border-subtle)] pt-5" aria-label="Rendered set output">
              <ExportControlsPanel
                canExportClean={canExportClean}
                exportDpi={exportDpi}
                exportEntitlementLabel={exportEntitlementLabel}
                exportEntitlementMessage={exportEntitlementMessage}
                exportGateMessage={exportGateMessage}
                exportMode={exportMode}
                generatedDisplayCards={activeCards}
                isCheckoutStarting={isCheckoutStarting}
                isZipExporting={isZipExporting}
                pdfCardSpacingMm={pdfCardSpacingMm}
                pdfDuplexLayout={pdfDuplexLayout}
                pdfIncludeCutLines={pdfIncludeCutLines}
                pdfMarginMm={pdfMarginMm}
                richTextHighlightColor={richTextHighlightColor}
                selectedPaperSize={selectedPaperSize}
                zipExportKind={zipExportKind}
                zipProgress={zipProgress}
                onClearCardsRequest={onClearCardsRequest}
                onExportAllAsZip={onExportAllAsZip}
                onExportTabletopSimulatorSpritesheets={onExportTabletopSimulatorSpritesheets}
                onSelectPaperSize={onSelectPaperSize}
                onSetExportDpi={onSetExportDpi}
                onSetExportMode={onSetExportMode}
                onSetPdfOptions={onSetPdfOptions}
                onStartCheckout={onStartCheckout}
              />
            </section>
          ) : null}
        </div>
      </div>

      <CardVisualPreviewDialog
        card={previewCard}
        open={previewCard !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewCard(null);
        }}
        richTextHighlightColor={richTextHighlightColor}
        showWatermark={showWatermark}
      />
    </section>
  );
}
