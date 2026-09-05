import { AlertTriangle, ChevronRight, ListChecks, RefreshCw, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { EnvironmentCollectionRecord, EnvironmentDetailRecord, EnvironmentSettingRecord } from '../presentation';
import styles from './EnvironmentFoundation.module.css';

export function EnvironmentSurfaceHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div className={styles.surfaceHeader}><div><p className={styles.eyebrow}>{eyebrow}</p><h2 className={styles.surfaceTitle}>{title}</h2><p className={styles.surfaceCopy}>{body}</p></div></div>;
}

export function EnvironmentSectionHeading({ id, title, meta }: { id: string; title: string; meta: string }) {
  return <div className={styles.sectionHeading}><h3 id={id}>{title}</h3><span>{meta}</span></div>;
}

export function EnvironmentBoundaryNotice({ title, message, actionLabel, onAction, settingsHref }: { title: string; message: string; actionLabel?: string; onAction?: () => void; settingsHref?: string }) {
  return <div className={styles.boundary} role="status"><AlertTriangle size={18} aria-hidden="true" /><p><strong>{title}.</strong> {message}</p>{settingsHref ? <Link className={styles.quietButton} href={settingsHref}>Manage connections<ChevronRight size={14} aria-hidden="true" /></Link> : null}{actionLabel && onAction ? <button type="button" className={styles.quietButton} onClick={onAction}>{actionLabel}<RefreshCw size={14} aria-hidden="true" /></button> : null}</div>;
}

export function CompactSettingRow({ item, selected, showSummary = true, onOpen }: { item: EnvironmentSettingRecord; selected: boolean; showSummary?: boolean; onOpen: (record: EnvironmentDetailRecord) => void }) {
  const Icon = item.icon;
  return (
    <button id={`environment-object-${item.id}`} type="button" className={styles.settingRow} aria-expanded={selected} aria-controls={selected ? 'environment-detail-panel' : undefined} onClick={() => onOpen(item)}>
      <span className={styles.settingLabel}><Icon size={18} aria-hidden="true" /><span className={styles.rowValue}><strong>{item.title}</strong>{showSummary ? <span>{item.summary}</span> : null}</span></span>
      <span className={styles.settingValue}>{item.value}</span><ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

export function EnvironmentObjectIdentity({ record, icon: Icon = ListChecks, mobileLocation }: { record: EnvironmentDetailRecord; icon?: LucideIcon; mobileLocation?: string }) {
  return (
    <span className={styles.objectIdentity}>
      <span className={styles.objectIcon}><Icon size={18} aria-hidden="true" /></span>
      <span className={styles.objectText}><strong>{record.title}</strong><span>{record.summary}{mobileLocation ? <span className={styles.mobileLocation}> · {mobileLocation}</span> : null}</span></span>
    </span>
  );
}

export function EnvironmentLedgerRow({ record, icon, selected, mobileLocation, children, className, onOpen }: { record: EnvironmentDetailRecord; icon?: LucideIcon; selected: boolean; mobileLocation?: string; children: ReactNode; className?: string; onOpen: (record: EnvironmentDetailRecord) => void }) {
  return (
    <button id={`environment-object-${record.id}`} type="button" className={`${styles.ledgerRow}${className ? ` ${className}` : ''}`} aria-expanded={selected} aria-controls={selected ? 'environment-detail-panel' : undefined} onClick={() => onOpen(record)}>
      <EnvironmentObjectIdentity record={record} icon={icon} mobileLocation={mobileLocation} />
      {children}
      <ChevronRight className={styles.rowChevron} size={17} aria-hidden="true" />
    </button>
  );
}

export function CollectionLedgerRow({ item, selected, onOpen }: { item: EnvironmentCollectionRecord; selected: boolean; onOpen: (record: EnvironmentDetailRecord) => void }) {
  return <EnvironmentLedgerRow record={item} icon={item.icon} mobileLocation={item.location} selected={selected} onOpen={onOpen}><span className={styles.ledgerCell}>{item.kind}</span><span className={styles.ledgerCell}>{item.location}</span><span className={styles.ledgerCell}>{item.updated}</span></EnvironmentLedgerRow>;
}
