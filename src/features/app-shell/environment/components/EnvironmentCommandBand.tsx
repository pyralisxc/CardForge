import { ChevronRight, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { isActionAvailable, type ActionDescriptor, type ZoneId } from '../model';
import { ZONE_ICONS } from './EnvironmentNavigation';
import styles from './EnvironmentFoundation.module.css';

interface EnvironmentCommandBandProps {
  zone: { id: ZoneId; label: string };
  brand?: { src: string; alt: string };
  primaryAction: ActionDescriptor | null;
  primaryDisabledReason?: string;
  search?: ReactNode;
  accountControl?: ReactNode;
  onCommand: () => void;
  onAction: (action: ActionDescriptor) => void;
}

export function EnvironmentCommandBand({ zone, brand, primaryAction, primaryDisabledReason, search, accountControl, onCommand, onAction }: EnvironmentCommandBandProps) {
  const Icon = ZONE_ICONS[zone.id];
  const disabledReason = primaryAction?.availability.kind === 'disabled'
    ? primaryAction.availability.reason
    : primaryDisabledReason;
  return (
    <header className={styles.commandBand}>
      <div className={styles.commandIdentity}>
        {brand ? <Link href="/" prefetch={false} className={styles.mobileBrand} aria-label="Open the CardForge public site" title="CardForge public site"><Image src={brand.src} alt="" width={26} height={26} priority /></Link> : null}
        <Icon size={18} aria-hidden="true" /><strong>{zone.label}</strong>
      </div>
      <button type="button" className={styles.commandLauncher} onClick={onCommand} data-tool-safe-action>
        <Search size={16} aria-hidden="true" /><span>Search or type a command…</span><kbd>Ctrl / ⌘ K</kbd>
      </button>
      <div className={styles.commandActions}>
        {search}
        {primaryAction ? (
          <button type="button" className={styles.primaryButton} data-environment-action={primaryAction.id} disabled={!isActionAvailable(primaryAction) || Boolean(disabledReason)} title={disabledReason} onClick={() => { if (isActionAvailable(primaryAction) && !disabledReason) onAction(primaryAction); }}>
            <ChevronRight size={17} aria-hidden="true" /><span>{primaryAction.label}</span>
          </button>
        ) : null}
        {accountControl}
      </div>
    </header>
  );
}
