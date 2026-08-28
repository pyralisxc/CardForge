import Image from 'next/image';
import { Code2, Home, LibraryBig, Menu, ShieldCheck, UserCircle2, WandSparkles, type LucideIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { ZoneDefinition, ZoneId } from '../model';
import styles from './EnvironmentFoundation.module.css';

export const ZONE_ICONS: Record<ZoneId, LucideIcon> = {
  home: Home,
  library: LibraryBig,
  studio: WandSparkles,
  profile: UserCircle2,
  developer: Code2,
  owner: ShieldCheck,
};

interface EnvironmentNavigationProps {
  zones: readonly ZoneDefinition[];
  activeZone: ZoneId;
  brand: { src: string; alt: string };
  onChooseZone: (zone: ZoneDefinition) => void;
}

export function EnvironmentNavigation({ zones, activeZone, brand, onChooseZone }: EnvironmentNavigationProps) {
  const coreZones = zones.filter((zone) => zone.minimumAccess === 'guest' || zone.minimumAccess === 'member');
  const protectedZones = zones.filter((zone) => zone.minimumAccess === 'contributor' || zone.minimumAccess === 'owner');

  return (
    <>
      <aside className={styles.rail} aria-label="CardForge zones">
        <div className={styles.brand}><Image src={brand.src} alt={brand.alt} width={30} height={30} priority /></div>
        <nav className={styles.railNav} aria-label="Environment zones">
          {zones.map((zone, index) => {
            const Icon = ZONE_ICONS[zone.id];
            const previous = zones[index - 1];
            const showDivider = Boolean(previous && previous.minimumAccess !== zone.minimumAccess && zone.minimumAccess === 'contributor');
            return (
              <div key={zone.id}>
                {showDivider ? <div className={styles.railDivider} aria-hidden="true" /> : null}
                <button type="button" className={styles.railButton} aria-current={activeZone === zone.id ? 'page' : undefined} onClick={() => onChooseZone(zone)}>
                  <Icon size={20} aria-hidden="true" /><span>{zone.shortLabel}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      <nav className={styles.mobileNav} aria-label="CardForge zones" style={{ gridTemplateColumns: `repeat(${coreZones.length + (protectedZones.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}>
        {coreZones.map((zone) => {
          const Icon = ZONE_ICONS[zone.id];
          return (
            <button key={zone.id} type="button" className={styles.mobileZoneButton} aria-current={activeZone === zone.id ? 'page' : undefined} onClick={() => onChooseZone(zone)}>
              <Icon size={19} aria-hidden="true" /><span>{zone.shortLabel}</span>
            </button>
          );
        })}
        {protectedZones.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.mobileZoneButton} aria-label="Open protected zones">
                <Menu size={19} aria-hidden="true" /><span>More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={styles.mobileMoreMenu} side="top" align="end">
              {protectedZones.map((zone) => {
                const Icon = ZONE_ICONS[zone.id];
                return <DropdownMenuItem key={zone.id} onSelect={() => onChooseZone(zone)}><Icon aria-hidden="true" />{zone.label}</DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>
    </>
  );
}
