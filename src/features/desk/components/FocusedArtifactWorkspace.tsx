"use client";

import dynamic from 'next/dynamic';
import { Minus, Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getCardFaceCanvas, type DisplayCard } from '@/domain/rendering';
import { ArtifactSlot, useArtifactFace, useArtifactViewport } from '@/features/card-rendering/client';

import styles from './Desk.module.css';

const CardActions = dynamic(() => import('@/features/card-generator/client/card-actions').then((module) => module.CardActions), { ssr: false });

interface FocusedArtifactWorkspaceProps {
  artifactId: string;
  card: DisplayCard;
  canExportClean: boolean;
  canUseProjectFiles: boolean;
  setName: string;
  title: string;
  subtitle: string;
  onEdit: () => void;
}

export function FocusedArtifactWorkspace({
  artifactId,
  card,
  canExportClean,
  canUseProjectFiles,
  setName,
  title,
  subtitle,
  onEdit,
}: FocusedArtifactWorkspaceProps) {
  const [face] = useArtifactFace(artifactId);
  const canvas = getCardFaceCanvas(card, face);
  const viewport = useArtifactViewport({
    aspectRatio: canvas ? `${canvas.width}:${canvas.height}` : (face === 'back' ? card.backingTemplate : card.template)?.aspectRatio,
    horizontalPadding: 96,
    maxWidth: 560,
    verticalPadding: 96,
  });

  return <div className={styles.artifactWorkspace} data-focused-artifact-workspace data-zoom={viewport.zoom.toFixed(2)}>
    <div className={styles.artifactWorkspaceControls} aria-label="Focused Artifact controls">
      <span className={styles.artifactWorkspaceIdentity}><strong>{title}</strong><small>{subtitle}</small></span>
      <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
      <span className={styles.artifactZoomValue} aria-live="polite">{Math.round(viewport.zoom * 100)}%</span>
      <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={viewport.fit}>Fit</Button>
      <Button type="button" size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-4 w-4" />Edit Artifact</Button>
      <CardActions card={card} canExportClean={canExportClean} canUseProjectFiles={canUseProjectFiles} />
    </div>
    <div
      ref={viewport.viewportRef}
      tabIndex={-1}
      className={styles.contentStage}
      data-desk-artifact-stage
      data-scene-viewport
      data-artifact-focus-exclusive="false"
      data-artifact-scroll-contained
      data-auto-fit={viewport.isAutoFit ? 'true' : 'false'}
      onWheel={viewport.onWheel}
      onPointerDown={viewport.onPointerDown}
      onPointerMove={viewport.onPointerMove}
      onPointerUp={viewport.onPointerUp}
      onPointerCancel={viewport.onPointerCancel}
      style={{ overflow: viewport.isAutoFit ? 'hidden' : 'auto', touchAction: 'pan-x pan-y' }}
      aria-label={`${setName} focused Artifact viewport`}
    >
      <div className={styles.focusedArtifactWorld} style={{ width: viewport.worldWidth, height: viewport.worldHeight }}>
        <div className={styles.focusedArtifactFrame} style={{ width: viewport.visualWidth, minHeight: viewport.visualHeight }} data-card-face={face}>
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
            <ArtifactSlot card={card} face={face} width={viewport.visualWidth} depth="focus" flipLabel={title} watermark={!canExportClean} />
            <span className="sr-only">{title}</span>
          </button>
        </div>
      </div>
    </div>
  </div>;
}
