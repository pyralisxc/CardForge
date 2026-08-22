"use client";

import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pin, X } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/shared/classNames';
import styles from '@/features/template-editor/components/TemplatePanelWorkspace.module.css';

export interface TemplatePanelWorkspaceSection {
  id: string;
  label: string;
  content: ReactNode;
}

interface TemplatePanelWorkspaceProps {
  title: string;
  description?: string;
  sections: TemplatePanelWorkspaceSection[];
  activeSectionId: string;
  pinnedSectionIds: string[];
  memoryKey?: string;
  onActiveSectionChange: (sectionId: string) => void;
  onTogglePinnedSection: (sectionId: string) => void;
  onClose?: () => void;
  closeLabel?: string;
  emptyState?: ReactNode;
}

const MAX_SCROLL_MEMORY_CONTEXTS = 10;
const MIN_COMPACT_PANEL_SIZE = 24;
const MAX_COMPACT_PANEL_SIZE = 68;
const COMPACT_PANEL_SNAP_POINTS = [28, 40, 60] as const;
let sharedCompactPanelSize = 40;

const clampPanelSize = (value: number) => Math.min(MAX_COMPACT_PANEL_SIZE, Math.max(MIN_COMPACT_PANEL_SIZE, value));
const snapPanelSize = (value: number) => COMPACT_PANEL_SNAP_POINTS.reduce((closest, candidate) => (
  Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
));

export function TemplatePanelWorkspace({
  title,
  description,
  sections,
  activeSectionId,
  pinnedSectionIds,
  memoryKey,
  onActiveSectionChange,
  onTogglePinnedSection,
  onClose,
  closeLabel = `Close ${title}`,
  emptyState,
}: TemplatePanelWorkspaceProps) {
  const resolvedMemoryKey = memoryKey ?? title.toLowerCase();
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollMemoryRef = useRef(new Map<string, number>());
  const recentScrollKeysRef = useRef<string[]>([]);
  const panelSizeRef = useRef(sharedCompactPanelSize);
  const [panelSize, setPanelSize] = useState(sharedCompactPanelSize);
  const pinnedSet = new Set(pinnedSectionIds);
  const pinnedSections = sections.filter((section) => pinnedSet.has(section.id));
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null;
  const visibleSections = activeSection && !pinnedSet.has(activeSection.id)
    ? [...pinnedSections, activeSection]
    : pinnedSections.length > 0
      ? pinnedSections
      : activeSection
        ? [activeSection]
        : [];
  const showVisibleSectionLabels = visibleSections.length > 1;

  const getScrollViewport = useCallback(() => (
    scrollRootRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]') ?? null
  ), []);

  const rememberScrollPosition = useCallback((key: string, scrollTop: number) => {
    scrollMemoryRef.current.set(key, scrollTop);
    recentScrollKeysRef.current = [key, ...recentScrollKeysRef.current.filter((candidate) => candidate !== key)]
      .slice(0, MAX_SCROLL_MEMORY_CONTEXTS);
    const retained = new Set(recentScrollKeysRef.current);
    for (const storedKey of scrollMemoryRef.current.keys()) {
      if (!retained.has(storedKey)) scrollMemoryRef.current.delete(storedKey);
    }
  }, []);

  useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;
    const handleScroll = () => rememberScrollPosition(resolvedMemoryKey, viewport.scrollTop);
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [getScrollViewport, rememberScrollPosition, resolvedMemoryKey]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = getScrollViewport();
      if (viewport) viewport.scrollTop = scrollMemoryRef.current.get(resolvedMemoryKey) ?? 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [getScrollViewport, resolvedMemoryKey]);

  const activateSection = useCallback((sectionId: string) => {
    onActiveSectionChange(sectionId);
    requestAnimationFrame(() => {
      const viewport = getScrollViewport();
      const target = viewport?.querySelector<HTMLElement>(`[data-cardforge-panel-section="${sectionId}"]`);
      if (!viewport || !target) return;
      viewport.scrollTo({ top: Math.max(0, target.offsetTop - 6), behavior: 'smooth' });
    });
  }, [getScrollViewport, onActiveSectionChange]);

  const applyCompactPanelSize = useCallback((handle: HTMLElement, value: number) => {
    const next = clampPanelSize(value);
    sharedCompactPanelSize = next;
    panelSizeRef.current = next;
    setPanelSize(next);
    handle.closest<HTMLElement>('.cardforge-maker-shell')?.style.setProperty('--cf-mobile-panel-size', `${next}%`);
  }, []);

  const resizeFromPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const grid = event.currentTarget.closest<HTMLElement>('.cardforge-maker-grid');
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const rawSize = landscape
      ? ((rect.right - event.clientX) / rect.width) * 100
      : ((rect.bottom - event.clientY) / rect.height) * 100;
    applyCompactPanelSize(event.currentTarget, rawSize);
  }, [applyCompactPanelSize]);

  const finishResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    applyCompactPanelSize(event.currentTarget, snapPanelSize(panelSizeRef.current));
  }, [applyCompactPanelSize]);

  const handleResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    let next = panelSizeRef.current;
    if (event.key === 'Home') next = MIN_COMPACT_PANEL_SIZE;
    else if (event.key === 'End') next = MAX_COMPACT_PANEL_SIZE;
    else if ((!landscape && event.key === 'ArrowUp') || (landscape && event.key === 'ArrowLeft')) next += 4;
    else if ((!landscape && event.key === 'ArrowDown') || (landscape && event.key === 'ArrowRight')) next -= 4;
    else return;
    event.preventDefault();
    applyCompactPanelSize(event.currentTarget, next);
  }, [applyCompactPanelSize]);

  return (
    <div className={cn(styles.workspace, 'cardforge-panel-workspace flex h-full min-h-0 flex-col')} data-cardforge-panel-workspace={title.toLowerCase()}>
      <div
        role="separator"
        tabIndex={0}
        aria-label={`Resize ${title} workspace`}
        aria-valuemin={MIN_COMPACT_PANEL_SIZE}
        aria-valuemax={MAX_COMPACT_PANEL_SIZE}
        aria-valuenow={Math.round(panelSize)}
        className="cardforge-panel-resize-handle"
        onFocus={(event) => {
          panelSizeRef.current = sharedCompactPanelSize;
          setPanelSize(sharedCompactPanelSize);
          event.currentTarget.closest<HTMLElement>('.cardforge-maker-shell')?.style.setProperty('--cf-mobile-panel-size', `${sharedCompactPanelSize}%`);
        }}
        onKeyDown={handleResizeKeyDown}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={resizeFromPointer}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      >
        <span aria-hidden="true" className="cardforge-panel-resize-grip" />
      </div>

      <div className="cardforge-panel-workspace-menu flex-none bg-[var(--cf-editor-inset)]">
        <div className="cardforge-panel-title-row flex h-9 items-center gap-2 border-b border-[var(--cf-editor-border)] px-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cf-accent-text)]">{title}</span>
          {description ? <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--cf-text-muted)]">{description}</span> : <span className="flex-1" />}
          {onClose ? (
            <button
              type="button"
              aria-label={closeLabel}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[var(--cf-text-muted)] transition hover:bg-[var(--cf-editor-control)] hover:text-[var(--cf-text)] lg:hidden"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {sections.length > 0 ? (
          <div
            role="toolbar"
            aria-label={`${title} sections`}
            className="cardforge-panel-section-menu flex min-h-9 items-stretch overflow-x-auto border-b border-[var(--cf-editor-border)] px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((section) => {
              const active = section.id === activeSection?.id;
              const pinned = pinnedSet.has(section.id);
              return (
                <div key={section.id} className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      'h-9 border-b-2 px-2 text-[11px] font-medium transition',
                      active
                        ? 'border-[var(--cf-accent-strong)] text-[var(--cf-text)]'
                        : 'border-transparent text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]',
                    )}
                    onClick={() => activateSection(section.id)}
                  >
                    {section.label}
                  </button>
                  {active || pinned ? (
                    <button
                      type="button"
                      aria-pressed={pinned}
                      aria-label={`${pinned ? 'Stop keeping' : 'Keep'} ${section.label} visible`}
                      title={`${pinned ? 'Unpin' : 'Pin'} ${section.label}`}
                      className={cn(
                        'mr-0.5 inline-flex h-7 w-6 items-center justify-center rounded-[4px] transition',
                        pinned ? 'text-[var(--cf-accent-strong)]' : 'text-[var(--cf-text-muted)] hover:bg-[var(--cf-editor-control)] hover:text-[var(--cf-text)]',
                      )}
                      onClick={() => onTogglePinnedSection(section.id)}
                    >
                      <Pin className={cn('h-3 w-3', pinned && 'fill-current')} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <ScrollArea ref={scrollRootRef} className="cardforge-maker-scroll min-h-0 flex-1">
        <div className="space-y-2 p-2" data-cardforge-panel-section-content="true">
          {visibleSections.length > 0
            ? visibleSections.map((section, index) => {
                const pinned = pinnedSet.has(section.id);
                return (
                  <section
                    key={section.id}
                    className={cn('cardforge-panel-section-surface', index > 0 && 'border-t border-[var(--cf-editor-border)] pt-2')}
                    data-cardforge-panel-section={section.id}
                    data-active={section.id === activeSection?.id ? 'true' : 'false'}
                    data-locked={pinned ? 'true' : 'false'}
                  >
                    {showVisibleSectionLabels ? (
                      <div className="mb-2 flex h-6 items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--cf-text-muted)]">
                        <span>{section.label}</span>
                        {pinned ? <Pin aria-label="Pinned section" className="h-3 w-3 fill-current text-[var(--cf-accent-strong)]" /> : null}
                      </div>
                    ) : null}
                    {section.content}
                  </section>
                );
              })
            : emptyState}
        </div>
      </ScrollArea>
    </div>
  );
}
