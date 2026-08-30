import { ChevronRight, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { isActionAvailable, type ActionDescriptor, type ZoneId } from '../model';
import { ZONE_ICONS } from './EnvironmentNavigation';
import styles from './EnvironmentFoundation.module.css';

interface EnvironmentCommandBandProps {
  zone: { id: ZoneId; label: string };
  primaryAction: ActionDescriptor | null;
  primaryDisabledReason?: string;
  search?: ReactNode;
  accountControl?: ReactNode;
  onCommand: () => void;
  onAction: (action: ActionDescriptor) => void;
}

export function EnvironmentCommandBand({ zone, primaryAction, primaryDisabledReason, search, accountControl, onCommand, onAction }: EnvironmentCommandBandProps) {
  const Icon = ZONE_ICONS[zone.id];
  const disabledReason = primaryAction?.availability.kind === 'disabled'
    ? primaryAction.availability.reason
    : primaryDisabledReason;
  return (
    <header className={styles.commandBand}>
      <div className={styles.commandIdentity}><Icon size={18} aria-hidden="true" /><strong>{zone.label}</strong></div>
      <button type="button" className={styles.commandLauncher} onClick={onCommand}>
        <Search size={16} aria-hidden="true" /><span>Search or type a command…</span><kbd>⌘K</kbd>
      </button>
      <div className={styles.commandActions}>
        {search}
        {primaryAction ? (
          <button type="button" className={styles.primaryButton} disabled={!isActionAvailable(primaryAction) || Boolean(disabledReason)} title={disabledReason} onClick={() => { if (isActionAvailable(primaryAction) && !disabledReason) onAction(primaryAction); }}>
            <ChevronRight size={17} aria-hidden="true" /><span>{primaryAction.label}</span>
          </button>
        ) : null}
        {accountControl}
      </div>
    </header>
  );
}
