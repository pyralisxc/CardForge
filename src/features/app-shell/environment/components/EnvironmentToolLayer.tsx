"use client";

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import styles from './EnvironmentFoundation.module.css';

interface EnvironmentToolLayerProps {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
}

export function EnvironmentToolLayer({ id, eyebrow, title, summary, closeLabel, children, onClose }: EnvironmentToolLayerProps) {
  return (
    <div className={styles.toolLayer} role="dialog" aria-modal="false" aria-labelledby={id}>
      <button type="button" className={styles.toolScrim} aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <section className={styles.toolPanel}>
        <header className={styles.toolHeader}>
          <div>
            <p className={styles.toolEyebrow}>{eyebrow}</p>
            <h2 id={id} className={styles.toolTitle}>{title}</h2>
            <p className={styles.toolSummary}>{summary}</p>
          </div>
          <button type="button" className={styles.toolClose} onClick={onClose} aria-label={closeLabel}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={styles.toolContent}>{children}</div>
      </section>
    </div>
  );
}
