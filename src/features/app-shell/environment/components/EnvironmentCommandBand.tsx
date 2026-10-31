import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { isActionAvailable, type ActionDescriptor, type ZoneId } from '../model';
import styles from './EnvironmentFoundation.module.css';

interface EnvironmentCommandBandProps {
  zone: { id: ZoneId; label: string };
  brand?: { src: string; alt: string };
  primaryAction: ActionDescriptor | null;
  primaryDisabledReason?: string;
  search?: ReactNode;
  accountControl?: ReactNode;
  context?: ReactNode;
  onAction: (action: ActionDescriptor) => void;
}

export function EnvironmentCommandBand({ zone, brand, primaryAction, primaryDisabledReason, search, accountControl, context, onAction }: EnvironmentCommandBandProps) {
  const disabledReason = primaryAction?.availability.kind === 'disabled'
    ? primaryAction.availability.reason
    : primaryDisabledReason;
  return (
    <header className={styles.commandBand} data-context={Boolean(context)} data-has-search={Boolean(search)}>
      {context ? <div className={styles.contextBand}>{context}</div> : <div className={styles.commandIdentity}>
        {brand ? <Link href="/" prefetch={false} className={styles.mobileBrand} aria-label="Open the CardForge public site" title="CardForge public site"><Image src={brand.src} alt="" width={26} height={26} priority /></Link> : null}
        <strong>{zone.label}</strong>
      </div>}
      <div className="min-w-0">{search}</div>
      <div className={styles.commandActions}>
        {primaryAction ? (
          <button type="button" className={styles.primaryButton} data-environment-action={primaryAction.id} disabled={!isActionAvailable(primaryAction) || Boolean(disabledReason)} title={disabledReason ?? primaryAction.label} onClick={() => { if (isActionAvailable(primaryAction) && !disabledReason) onAction(primaryAction); }}>
            <span>{primaryAction.label}</span>
          </button>
        ) : null}
        {accountControl}
      </div>
    </header>
  );
}
