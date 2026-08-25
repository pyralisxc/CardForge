import { ChevronRight, ListChecks, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { EnvironmentCollectionRecord, EnvironmentDetailRecord, EnvironmentSettingRecord } from '../presentation';
import styles from './EnvironmentFoundation.module.css';

export function EnvironmentSurfaceHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div className={styles.surfaceHeader}><div><p className={styles.eyebrow}>{eyebrow}</p><h2 className={styles.surfaceTitle}>{title}</h2><p className={styles.surfaceCopy}>{body}</p></div></div>;
}

export function EnvironmentSectionHeading({ id, title, meta }: { id: string; title: string; meta: string }) {
  return <div className={styles.sectionHeading}><h3 id={id}>{title}</h3><span>{meta}</span></div>;
}

export function CompactSettingRow({ item, selected, onOpen }: { item: EnvironmentSettingRecord; selected: boolean; onOpen: (record: EnvironmentDetailRecord) => void }) {
  const Icon = item.icon;
  return (
    <button id={`environment-object-${item.id}`} type="button" className={styles.settingRow} aria-pressed={selected} onClick={() => onOpen(item)}>
      <span className={styles.settingLabel}><Icon size={18} aria-hidden="true" /><span className={styles.rowValue}><strong>{item.title}</strong><span>{item.summary}</span></span></span>
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
    <button id={`environment-object-${record.id}`} type="button" className={`${styles.ledgerRow}${className ? ` ${className}` : ''}`} aria-pressed={selected} onClick={() => onOpen(record)}>
      <EnvironmentObjectIdentity record={record} icon={icon} mobileLocation={mobileLocation} />
      {children}
      <ChevronRight className={styles.rowChevron} size={17} aria-hidden="true" />
    </button>
  );
}

export function CollectionLedgerRow({ item, selected, onOpen }: { item: EnvironmentCollectionRecord; selected: boolean; onOpen: (record: EnvironmentDetailRecord) => void }) {
  return <EnvironmentLedgerRow record={item} icon={item.icon} mobileLocation={item.location} selected={selected} onOpen={onOpen}><span className={styles.ledgerCell}>{item.kind}</span><span className={styles.ledgerCell}>{item.location}</span><span className={styles.ledgerCell}>{item.updated}</span></EnvironmentLedgerRow>;
}
