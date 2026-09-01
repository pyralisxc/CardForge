"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Minus, Pencil, Plus, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CardFace } from '@/domain/cards';
import { getCardHeightForWidth, hasCardBacking, type DisplayCard } from '@/domain/rendering';
import { CardPreview } from '@/features/card-rendering/client';

import styles from './HomeDesk.module.css';

interface FocusedArtifactWorkspaceProps {
  artifactId: string;
  card: DisplayCard;
  setName: string;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  title: string;
  subtitle: string;
  zoom: number;
  onEdit: () => void;
  onZoomChange: (zoom: number) => void;
}

const readAspectRatio = (value: string | undefined) => {
  const [width, height] = (value ?? '63:88').split(':').map(Number);
  return width > 0 && height > 0 ? { width, height } : { width: 63, height: 88 };
};

export function FocusedArtifactWorkspace({
  artifactId,
  card,
  setName,
  stageRef,
  title,
  subtitle,
  zoom,
  onEdit,
  onZoomChange,
}: FocusedArtifactWorkspaceProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 900, height: 620 });
  const [face, setFace] = useState<CardFace>('front');
  const aspect = readAspectRatio((face === 'back' ? card.backingTemplate : card.template)?.aspectRatio);
  const fitWidth = useMemo(() => {
    const horizontalRoom = Math.max(160, viewport.width - 112);
    const verticalRoom = Math.max(220, viewport.height - 104);
    return Math.max(140, Math.min(560, horizontalRoom, verticalRoom * aspect.width / aspect.height));
  }, [aspect.height, aspect.width, viewport.height, viewport.width]);
  const visualWidth = fitWidth * zoom;
  const visualHeight = getCardHeightForWidth(fitWidth, `${aspect.width}:${aspect.height}`) * zoom;
  const worldWidth = Math.max(viewport.width, visualWidth + 96);
  const worldHeight = Math.max(viewport.height, visualHeight + 96);

  useLayoutEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    const measure = () => {
      const bounds = viewportNode.getBoundingClientRect();
      setViewport({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
    });
    observer.observe(viewportNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    viewportNode.scrollTo({
      left: Math.max(0, (worldWidth - viewport.width) / 2),
      top: Math.max(0, (worldHeight - viewport.height) / 2),
      behavior: 'auto',
    });
  }, [artifactId, viewport.height, viewport.width, worldHeight, worldWidth, zoom]);

  return <div className={styles.artifactWorkspace} data-focused-artifact-workspace data-zoom={zoom.toFixed(2)}>
    <div className={styles.artifactWorkspaceControls} aria-label="Focused Artifact controls">
      <span className={styles.artifactWorkspaceIdentity}><strong>{title}</strong><small>{subtitle}</small></span>
      <Button type="button" size="icon" variant="ghost" onClick={() => onZoomChange(zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
      <span className={styles.artifactZoomValue} aria-live="polite">{Math.round(zoom * 100)}%</span>
      <Button type="button" size="icon" variant="ghost" onClick={() => onZoomChange(zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onZoomChange(1)}>Fit</Button>
      <Button type="button" size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-4 w-4" />Edit Artifact</Button>
    </div>
    <div
      ref={(node) => { viewportRef.current = node; stageRef.current = node; }}
      tabIndex={-1}
      className={styles.contentStage}
      data-home-artifact-stage
      data-artifact-focus-exclusive="true"
      data-artifact-scroll-contained
      aria-label={`${setName} focused Artifact viewport`}
    >
      <div className={styles.focusedArtifactWorld} style={{ width: worldWidth, height: worldHeight }}>
        <div className={styles.focusedArtifactFrame} style={{ width: visualWidth, minHeight: visualHeight }} data-card-face={face}>
          <button
            id={`spatial-artifact-${artifactId}`}
            type="button"
            className={styles.focusedArtifactButton}
            data-artifact-id={artifactId}
            data-artifact-type="card"
            data-focused="true"
            aria-label={`${title}. ${subtitle}`}
            onDoubleClick={onEdit}
          >
            <CardPreview card={card} face={face} targetWidthPx={visualWidth} />
            <span className="sr-only">{title}</span>
          </button>
          {hasCardBacking(card) ? <button type="button" className={styles.artifactFlipButton} onClick={() => setFace((current) => current === 'front' ? 'back' : 'front')} aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${title}`}><RefreshCcw aria-hidden="true" /><span>{face === 'front' ? 'Back' : 'Front'}</span></button> : null}
        </div>
      </div>
    </div>
  </div>;
}
