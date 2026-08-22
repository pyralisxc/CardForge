"use client";

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { Lock, Unlock, X } from 'lucide-react';

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
      viewport.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: 'smooth' });
    });
  }, [getScrollViewport, onActiveSectionChange]);

  return (
    <div className={cn(styles.workspace, 'cardforge-panel-workspace flex h-full min-h-0 flex-col')} data-cardforge-panel-workspace={title.toLowerCase()}>
      <div className="cardforge-panel-workspace-menu flex-none border-b border-[var(--cf-editor-border)] bg-[var(--cf-editor-inset)]">
        <div className="flex items-start justify-between gap-3 px-3 pb-2 pt-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-text)]">{title}</p>
            {description ? <p className="mt-1 truncate text-[11px] text-[var(--cf-text-muted)]">{description}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label={closeLabel}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-[var(--cf-editor-control-border)] bg-[var(--cf-editor-control)] text-[var(--cf-editor-text)] transition hover:border-[var(--cf-border-strong)] hover:text-[var(--cf-accent-text)] lg:hidden"
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
            className="cardforge-panel-section-menu flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:thin]"
          >
            {sections.map((section) => {
              const active = section.id === activeSection?.id;
              const pinned = pinnedSet.has(section.id);
              return (
                <div
                  key={section.id}
                  className={cn(
                    'flex shrink-0 items-stretch overflow-hidden rounded-[6px] border bg-[var(--cf-editor-control)]',
                    active ? 'border-[var(--cf-accent-strong)]' : 'border-[var(--cf-editor-control-border)]',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      'min-h-9 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition',
                      active ? 'bg-[var(--cf-accent-surface)] text-[var(--cf-accent-text)]' : 'text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]',
                    )}
                    onClick={() => activateSection(section.id)}
                  >
                    {section.label}
                  </button>
                  <button
                    type="button"
                    aria-pressed={pinned}
                    aria-label={`${pinned ? 'Unlock' : 'Lock'} ${section.label} section`}
                    title={`${pinned ? 'Unlock' : 'Lock'} ${section.label}`}
                    className={cn(
                      'inline-flex min-h-9 w-8 items-center justify-center border-l border-[var(--cf-editor-control-border)] transition',
                      pinned ? 'bg-[var(--cf-surface-raised)] text-[var(--cf-accent-strong)]' : 'text-[var(--cf-text-muted)] hover:text-[var(--cf-text)]',
                    )}
                    onClick={() => onTogglePinnedSection(section.id)}
                  >
                    {pinned ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <ScrollArea ref={scrollRootRef} className="cardforge-maker-scroll min-h-0 flex-1">
        <div className="space-y-3 p-2" data-cardforge-panel-section-content="true">
          {visibleSections.length > 0
            ? visibleSections.map((section) => (
                <div
                  key={section.id}
                  data-cardforge-panel-section={section.id}
                  data-active={section.id === activeSection?.id ? 'true' : 'false'}
                  data-locked={pinnedSet.has(section.id) ? 'true' : 'false'}
                >
                  {section.content}
                </div>
              ))
            : emptyState}
        </div>
      </ScrollArea>
    </div>
  );
}
