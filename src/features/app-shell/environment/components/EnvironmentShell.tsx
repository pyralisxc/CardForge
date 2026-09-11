"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';

import { isActionApplicable, type ActionDescriptor, type EnvironmentViewer, type ZoneDefinition, type ZoneId, type ZoneViewportPolicy } from '../model';
import type { EnvironmentDetailRecord } from '../presentation';
import { EnvironmentCommandBand } from './EnvironmentCommandBand';
import { EnvironmentCommandPalette } from './EnvironmentCommandPalette';
import { EnvironmentDesktopInspector, EnvironmentMobileSheet } from './EnvironmentDetail';
import { EnvironmentNavigation } from './EnvironmentNavigation';
import styles from './EnvironmentFoundation.module.css';

interface EnvironmentShellProps {
  zones: readonly ZoneDefinition[];
  activeZone: ZoneId;
  viewportPolicy: ZoneViewportPolicy;
  ariaLabel: string;
  brand: { src: string; alt: string };
  viewer: EnvironmentViewer;
  detail: EnvironmentDetailRecord | null;
  detailVisual?: ReactNode;
  detailContent?: ReactNode;
  actions: readonly ActionDescriptor[];
  focusReturnId?: string;
  primaryDisabledReason?: string;
  showPrimaryAction?: boolean;
  search?: ReactNode;
  accountControl?: ReactNode;
  contextBand?: ReactNode;
  focusDepth?: 'zone' | 'set' | 'artifact' | 'tool';
  statusContent: ReactNode;
  footerContent: ReactNode;
  surfaceRef?: MutableRefObject<HTMLElement | null>;
  primaryScroll?: 'page' | 'contained';
  children?: ReactNode;
  onCommand: () => void;
  onAction: (action: ActionDescriptor) => void;
  onCloseDetail: () => void;
  onActiveZoneNavigate?: () => void;
}

export function EnvironmentShell({ ariaLabel, brand, viewer, zones, activeZone, viewportPolicy, detail, detailVisual, detailContent, actions, focusReturnId, primaryDisabledReason, showPrimaryAction = true, search, accountControl, contextBand, focusDepth = 'zone', statusContent, footerContent, surfaceRef, primaryScroll = 'page', children, onCommand, onAction, onCloseDetail, onActiveZoneNavigate }: EnvironmentShellProps) {
  const [mobileDetail, setMobileDetail] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const ownedSurfaceRef = useRef<HTMLElement | null>(null);
  const resolvedSurfaceRef = surfaceRef ?? ownedSurfaceRef;
  const mobileNavigationPersistent = focusDepth !== 'tool';

  useEffect(() => {
    if (primaryScroll !== 'contained') return;
    resolvedSurfaceRef.current?.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }, [primaryScroll, resolvedSurfaceRef]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileDetail(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const activeDefinition = zones.find((zone) => zone.id === activeZone) ?? zones[0];
  if (!activeDefinition) return null;
  const visibleActions = actions.filter((action) => isActionApplicable(action, {
    objectKind: detail?.kind ?? null,
    sources: detail?.actionSources ?? [],
    viewer,
  }));
  const primaryAction = showPrimaryAction
    ? visibleActions.find((action) => action.hierarchy === 'primary' && action.availability.kind !== 'hidden') ?? null
    : null;
  return (
    <section className={styles.lab} data-primary-scroll={primaryScroll} aria-label={ariaLabel}>
      <div
        className={`${styles.shell} ${mobileNavigationPersistent ? 'max-md:!pb-[calc(4.25rem+env(safe-area-inset-bottom))]' : ''}`}
        data-detail-open={Boolean(detail)}
        data-viewport={viewportPolicy}
        data-focus-depth={focusDepth}
      >
        <EnvironmentNavigation zones={zones} activeZone={activeZone} brand={brand} onActiveZoneNavigate={onActiveZoneNavigate} mobilePersistent={mobileNavigationPersistent} />
        <div className={styles.commandStack}>
          <EnvironmentCommandBand zone={activeDefinition} brand={brand} primaryAction={primaryAction} primaryDisabledReason={primaryDisabledReason} search={search} accountControl={accountControl} context={contextBand} onCommand={() => { if (visibleActions.length) setCommandOpen(true); else onCommand(); }} onAction={onAction} />
        </div>
        <main ref={resolvedSurfaceRef} className={styles.primarySurface} data-scene-viewport data-scroll={primaryScroll}>{children}</main>
        {detail && !mobileDetail ? <EnvironmentDesktopInspector record={detail} visual={detailVisual} content={detailContent} actions={visibleActions} onClose={onCloseDetail} onAction={onAction} /> : null}
        <footer className={`${styles.statusBar} max-md:!flex max-md:!min-h-10 max-md:!gap-2 max-md:!overflow-hidden max-md:!px-2 max-md:!py-1`} aria-label="Environment status">
          <div className={`${styles.statusItems} max-md:!gap-3 max-md:flex-1 max-md:overflow-x-auto max-md:whitespace-nowrap`}>{statusContent}</div>
          <div className={`${styles.selectionDock} max-md:hidden`}>{footerContent}</div>
        </footer>
      </div>
      {detail && mobileDetail ? <EnvironmentMobileSheet open focusReturnId={focusReturnId} record={detail} visual={detailVisual} content={detailContent} actions={visibleActions} onClose={onCloseDetail} onAction={onAction} /> : null}
      <EnvironmentCommandPalette open={commandOpen} actions={visibleActions} onOpenChange={setCommandOpen} onAction={onAction} />
    </section>
  );
}
