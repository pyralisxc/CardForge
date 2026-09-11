import { AlertTriangle, CircleCheck, Clock3, ShieldCheck, type LucideIcon } from 'lucide-react';

import type { EnvironmentStatusTone } from '../presentation';
import styles from './EnvironmentFoundation.module.css';

export function EnvironmentStatus({
  label,
  tone = 'neutral',
  icon: Icon,
  onClick,
  title,
}: {
  label: string;
  tone?: EnvironmentStatusTone;
  icon?: LucideIcon;
  onClick?: () => void;
  title?: string;
}) {
  const fallbackIcon = tone === 'success'
    ? <CircleCheck size={14} aria-hidden="true" />
    : tone === 'warning'
      ? <Clock3 size={14} aria-hidden="true" />
      : tone === 'danger'
        ? <AlertTriangle size={14} aria-hidden="true" />
        : <ShieldCheck size={14} aria-hidden="true" />;
  const content = <>{Icon ? <Icon size={14} aria-hidden="true" /> : fallbackIcon}<span>{label}</span></>;
  return onClick
    ? <button type="button" className={`${styles.status} ${styles.statusAction}`} data-tone={tone} onClick={onClick} title={title ?? label}>{content}</button>
    : <span className={styles.status} data-tone={tone}>{content}</span>;
}
