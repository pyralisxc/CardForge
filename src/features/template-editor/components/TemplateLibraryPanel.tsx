"use client";

import { useState, type ChangeEvent, type RefObject } from 'react';
import { Copy, FolderDown, FolderUp, Layers, Lock, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardPreview } from '@/features/card-rendering/client';
import { CardWatermarkOverlay } from '@/features/card-rendering/client';
import { getTemplateLibraryDescription, getTemplateLibraryLabel } from '@/domain/templates';
import { cn } from '@/shared/classNames';
import { WorkspaceSection } from '@/features/template-editor/components/WorkspaceSection';
import type { TCGCardTemplate, TemplateUsage } from '@/domain/templates';
import { getTemplateCardMeasurement } from '@/domain/card-formats';

interface TemplateLibraryPanelProps {
  canUseProjectFiles: boolean;
  showCardWatermark: boolean;
  currentTemplate: TCGCardTemplate;
  currentTemplateId: string | null;
  defaultTemplates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  projectFileGateMessage?: string | null;
  richTextHighlightColor: string;
  userTemplates: TCGCardTemplate[];
  onCreateNew: (templateUsage?: TemplateUsage) => void;
  onClone: () => void;
  onDelete: () => void;
  onExportProject: () => void;
  onImportProject: () => void;
  onLoadProject: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartCheckout: () => void;
  onSelectTemplateId: (value: string) => void;
  onOpenTemplate: (template: TCGCardTemplate) => void;
  panelClassName: string;
  controlClassName: string;
  buttonClassName: string;
}

const TEMPLATE_QUICK_VIEW_LIMIT = 5;
const CARD_BACK_QUICK_VIEW_LIMIT = 3;

export const getTemplateQuickView = (
  templates: readonly TCGCardTemplate[],
  limit = TEMPLATE_QUICK_VIEW_LIMIT,
): TCGCardTemplate[] => {
  const selected: TCGCardTemplate[] = [];
  const selectedIds = new Set<string>();
  const categories = new Set<string>();
  for (const template of templates) {
    const category = template.templateCategory?.trim().toLowerCase();
    if (!category || categories.has(category)) continue;
    selected.push(template);
    categories.add(category);
    if (template.id) selectedIds.add(template.id);
    if (selected.length === limit) return selected;
  }
  for (const template of templates) {
    if (template.id ? selectedIds.has(template.id) : selected.includes(template)) continue;
    selected.push(template);
    if (selected.length === limit) break;
  }
  return selected;
};

export function TemplateLibraryPanel({
  canUseProjectFiles,
  showCardWatermark,
  currentTemplate,
  currentTemplateId,
  defaultTemplates,
  backFaceTemplates,
  fileInputRef,
  isCheckoutStarting,
  projectFileGateMessage,
  richTextHighlightColor,
  userTemplates,
  onCreateNew,
  onClone,
  onDelete,
  onExportProject,
  onImportProject,
  onLoadProject,
  onStartCheckout,
  onSelectTemplateId,
  onOpenTemplate,
  panelClassName,
  controlClassName,
  buttonClassName,
}: TemplateLibraryPanelProps) {
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showAllCardBacks, setShowAllCardBacks] = useState(false);
  const frontUserTemplates = userTemplates.filter((template) => template.templateUsage !== 'back-preset');
  const allListedTemplates = [...defaultTemplates, ...frontUserTemplates, ...backFaceTemplates];
  const shouldShowUnsavedCurrentTemplate = Boolean(
    currentTemplateId && !allListedTemplates.some((template) => template.id === currentTemplateId)
  );
  const quickTemplates = getTemplateQuickView(defaultTemplates);
  const visibleTemplates = showAllTemplates ? defaultTemplates : quickTemplates;
  const visibleCardBacks = showAllCardBacks
    ? backFaceTemplates
    : backFaceTemplates.slice(0, CARD_BACK_QUICK_VIEW_LIMIT);

  return (
    <WorkspaceSection title="Template" icon={Layers} defaultOpen panelClassName={panelClassName}>
      <div className="space-y-2">
        <Select
          value={currentTemplateId || '__new__'}
          onValueChange={(value) => {
            if (value === '__new__') onCreateNew('standard');
            else onSelectTemplateId(value);
          }}
        >
          <SelectTrigger className={controlClassName} aria-label="Choose Template"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__new__">New Template</SelectItem>
            {shouldShowUnsavedCurrentTemplate ? (
              <SelectItem value={currentTemplateId!}>Unsaved Template / {currentTemplate.name || 'New Template'}</SelectItem>
            ) : null}
            {defaultTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>{getTemplateLibraryLabel(template)} / {template.name}</SelectItem>
            ))}
            {frontUserTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>{getTemplateLibraryLabel(template)} / {template.name}</SelectItem>
            ))}
            {backFaceTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>{getTemplateLibraryLabel(template)} / {template.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onCreateNew('standard')} aria-label="Create new front design" className={cn(buttonClassName, 'gap-1 px-2 text-xs')}><Plus className="h-4 w-4" /> New front</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onCreateNew('back-preset')} aria-label="Create new card back design" className={cn(buttonClassName, 'gap-1 px-2 text-xs')}><Plus className="h-4 w-4" /> New back</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClone} disabled={!currentTemplateId} aria-label="Clone selected template" className={buttonClassName}><Copy className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={!currentTemplateId} aria-label="Delete selected template" className={buttonClassName}><Trash2 className="h-4 w-4 text-[#ff554a]" /></Button>
        </div>
        <div className="space-y-2 border-t border-[#1b2029] pt-2">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <Button type="button" variant="outline" size="sm" onClick={onExportProject} className={cn(buttonClassName, 'min-w-0 gap-1 text-xs')}>
              <FolderDown className="h-4 w-4" /> Download project
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onImportProject} className={cn(buttonClassName, 'min-w-0 gap-1 text-xs')}>
              <FolderUp className="h-4 w-4" /> Open project
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".cardforge,.json,application/json,application/zip"
              onChange={onLoadProject}
              aria-hidden="true"
              className="hidden"
            />
          </div>
          {!canUseProjectFiles ? (
            <div className="space-y-2 rounded-[6px] border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-2">
              <p className="flex items-start gap-2 text-[11px] leading-4 text-[var(--cf-text-muted)]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cf-accent-strong)]" />
                <span>{projectFileGateMessage || 'Portable project copies are temporarily unavailable. Refresh and try again.'}</span>
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onStartCheckout}
                disabled={isCheckoutStarting}
                className="h-8 w-full text-xs"
              >
                {isCheckoutStarting ? 'Checking access...' : 'Buy Creator Pass'}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5 pt-1">
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="group flex w-full items-center gap-2 rounded-[5px] border border-[var(--cf-editor-border)] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/70 hover:bg-[#131720]"
              onClick={() => onOpenTemplate(template)}
            >
              <TemplateLibraryPreview template={template} showCardWatermark={showCardWatermark} richTextHighlightColor={richTextHighlightColor} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[var(--cf-accent-text)]">{template.name}</span>
                <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{template.templateCategory || getTemplateLibraryDescription(template)}</span>
                <span className="block text-[10px] text-[#9a8f7c]">{getTemplateCardMeasurement(template, 'mm').label}</span>
              </span>
            </button>
          ))}
          {defaultTemplates.length > quickTemplates.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]"
              onClick={() => setShowAllTemplates((value) => !value)}
            >
              {showAllTemplates ? 'Return to quick view' : `Browse all ${defaultTemplates.length} Templates`}
            </Button>
          ) : null}
        </div>
        {backFaceTemplates.length > 0 ? (
          <div data-card-back-library tabIndex={-1} className="scroll-mt-4 space-y-1.5 border-t border-[#1b2029] pt-2 outline-none">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#757d8c]">
              Card Backs
            </p>
            {visibleCardBacks.map((template) => (
              <button
                key={template.id}
                type="button"
                className="group flex w-full items-center gap-2 rounded-[5px] border border-[var(--cf-editor-border)] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#7dd3fc]/70 hover:bg-[#131720]"
                onClick={() => onOpenTemplate(template)}
              >
                <TemplateLibraryPreview template={template} showCardWatermark={showCardWatermark} richTextHighlightColor={richTextHighlightColor} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[#b9f3ff]">{template.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{template.templateCategory || 'Card back'}</span>
                  <span className="block text-[10px] text-[#9a8f7c]">{getTemplateCardMeasurement(template, 'mm').label}</span>
                </span>
              </button>
            ))}
            {backFaceTemplates.length > CARD_BACK_QUICK_VIEW_LIMIT ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full text-[10px] uppercase tracking-[0.12em] text-[#9a8f7c]"
                onClick={() => setShowAllCardBacks((value) => !value)}
              >
                {showAllCardBacks ? 'Show fewer card backs' : `View all ${backFaceTemplates.length} card backs`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}

function TemplateLibraryPreview({
  template,
  showCardWatermark,
  richTextHighlightColor,
}: {
  template: TCGCardTemplate;
  showCardWatermark: boolean;
  richTextHighlightColor: string;
}) {
  return (
    <span className="relative grid h-[84px] w-[64px] shrink-0 place-items-center overflow-hidden rounded-[5px] border border-[var(--cf-editor-border)] bg-[#05070b]">
      <CardPreview
        card={{
          template,
          data: template.templatePreviewData ?? {},
          uniqueId: `template-library-${template.id ?? template.name}`,
        }}
        targetWidthPx={64}
        isEditorPreview
        highlightColor={richTextHighlightColor}
      />
      {showCardWatermark ? <CardWatermarkOverlay testId="template-library-watermark" /> : null}
    </span>
  );
}
