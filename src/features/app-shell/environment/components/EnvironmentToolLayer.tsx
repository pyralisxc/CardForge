"use client";

import { X } from 'lucide-react';
import { Component, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useEnvironmentToolLifecycle } from './useEnvironmentToolLifecycle';

import type { CreatorToolPresentation } from '../interactionSession';
import styles from './EnvironmentFoundation.module.css';

interface EnvironmentToolLayerProps {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  closeBlocked?: boolean;
  onDirtyCloseRequest?: () => void;
  onCrash?: (error: Error) => void;
  manageHistory?: boolean;
  presentation?: CreatorToolPresentation;
  railOwned?: boolean;
  sceneVisible?: boolean;
}

class ToolLayerErrorBoundary extends Component<{
  children: ReactNode;
  onCrash?: (error: Error) => void;
}, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onCrash?.(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className={styles.toolFailure}>
          This tool stopped unexpectedly. Your workspace is still open; close the tool and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

export function EnvironmentToolLayer({
  id,
  eyebrow,
  title,
  summary,
  closeLabel,
  children,
  onClose,
  dirty = false,
  closeBlocked = false,
  onDirtyCloseRequest,
  onCrash,
  manageHistory = true,
  presentation = 'sheet',
  railOwned = false,
  sceneVisible = false,
}: EnvironmentToolLayerProps) {
  const workspace = presentation === 'floating' || presentation === 'inline';
  const modal = presentation === 'provider-handoff';
  const headerOwnedByRail = railOwned && !modal;
  const mobileToolAboveNavigation = presentation === 'sheet';
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { closeFromControl, navigationPrompt } = useEnvironmentToolLifecycle({
    id, dirty, closeBlocked, onClose, onDirtyCloseRequest, panelRef, closeButtonRef, modal, manageHistory,
  });

  return (
    <><div className={`${styles.toolLayer} ${workspace ? styles.toolLayerWorkspace : ''} ${mobileToolAboveNavigation ? 'max-md:!z-[70]' : ''}`} role={modal ? 'dialog' : 'region'} aria-modal={modal || undefined} aria-labelledby={id} data-presentation={presentation} data-scene-visible={sceneVisible} data-rail-owned={railOwned || undefined} data-desk-tool-surface>
      {modal ? <button type="button" className={styles.toolScrim} aria-hidden="true" tabIndex={-1} onClick={closeFromControl} /> : <div className={styles.toolSceneReveal} aria-hidden="true" />}
      <section ref={panelRef} className={`${styles.toolPanel} ${workspace ? styles.toolPanelWorkspace : ''}`}>
        <header className={`${styles.toolHeader} ${workspace ? styles.toolHeaderWorkspace : ''} ${headerOwnedByRail ? styles.toolHeaderRailOwned : ''}`}>
          <div>
            <p className={styles.toolEyebrow}>{eyebrow}</p>
            <h2 id={id} className={styles.toolTitle}>{title}</h2>
            <p className={styles.toolSummary}>{summary}</p>
          </div>
          {headerOwnedByRail ? null : <button ref={closeButtonRef} type="button" className={styles.toolClose} onClick={closeFromControl} aria-label={closeLabel}>
            <X aria-hidden="true" />
          </button>}
        </header>
        <div className={`${styles.toolContent} ${workspace ? styles.toolContentWorkspace : ''}`}>
          <ToolLayerErrorBoundary onCrash={onCrash}>{children}</ToolLayerErrorBoundary>
        </div>
      </section>
    </div>
    {navigationPrompt}</>
  );
}
