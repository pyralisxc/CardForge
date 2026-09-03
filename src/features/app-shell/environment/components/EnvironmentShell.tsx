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
}

export function EnvironmentShell({ ariaLabel, brand, viewer, zones, activeZone, viewportPolicy, detail, detailVisual, detailContent, actions, focusReturnId, primaryDisabledReason, showPrimaryAction = true, search, accountControl, contextBand, focusDepth = 'zone', statusContent, footerContent, surfaceRef, primaryScroll = 'page', children, onCommand, onAction, onCloseDetail }: EnvironmentShellProps) {
  const [mobileDetail, setMobileDetail] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const ownedSurfaceRef = useRef<HTMLElement | null>(null);
  const resolvedSurfaceRef = surfaceRef ?? ownedSurfaceRef;

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
      <div className={styles.shell} data-detail-open={Boolean(detail)} data-viewport={viewportPolicy} data-focus-depth={focusDepth}>
        <EnvironmentNavigation zones={zones} activeZone={activeZone} brand={brand} />
        <div className={styles.commandStack}>
          <EnvironmentCommandBand zone={activeDefinition} brand={brand} primaryAction={primaryAction} primaryDisabledReason={primaryDisabledReason} search={search} accountControl={accountControl} onCommand={() => { if (visibleActions.length) setCommandOpen(true); else onCommand(); }} onAction={onAction} />
          {contextBand ? <div className={styles.contextBand}>{contextBand}</div> : null}
        </div>
        <main ref={resolvedSurfaceRef} className={styles.primarySurface} data-scroll={primaryScroll}>{children}</main>
        {detail && !mobileDetail ? <EnvironmentDesktopInspector record={detail} visual={detailVisual} content={detailContent} actions={visibleActions} onClose={onCloseDetail} onAction={onAction} /> : null}
        <footer className={styles.statusBar} aria-label="Environment status">
          <div className={styles.statusItems}>{statusContent}</div>
          <div className={styles.selectionDock}>{footerContent}</div>
        </footer>
      </div>
      {detail && mobileDetail ? <EnvironmentMobileSheet open focusReturnId={focusReturnId} record={detail} visual={detailVisual} content={detailContent} actions={visibleActions} onClose={onCloseDetail} onAction={onAction} /> : null}
      <EnvironmentCommandPalette open={commandOpen} actions={visibleActions} onOpenChange={setCommandOpen} onAction={onAction} />
    </section>
  );
}
