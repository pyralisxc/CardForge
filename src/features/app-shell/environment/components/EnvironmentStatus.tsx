import { AlertTriangle, CircleCheck, Clock3, ShieldCheck } from 'lucide-react';

import type { EnvironmentStatusTone } from '../presentation';
import styles from './EnvironmentFoundation.module.css';

export function EnvironmentStatus({ label, tone = 'neutral' }: { label: string; tone?: EnvironmentStatusTone }) {
  const icon = tone === 'success'
    ? <CircleCheck size={14} aria-hidden="true" />
    : tone === 'warning'
      ? <Clock3 size={14} aria-hidden="true" />
      : tone === 'danger'
        ? <AlertTriangle size={14} aria-hidden="true" />
        : <ShieldCheck size={14} aria-hidden="true" />;
  return <span className={styles.status} data-tone={tone}>{icon}<span>{label}</span></span>;
}
