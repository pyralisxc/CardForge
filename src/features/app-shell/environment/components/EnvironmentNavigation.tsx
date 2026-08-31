import Image from 'next/image';
import Link, { useLinkStatus } from 'next/link';
import { Home, LibraryBig, Menu, ShieldCheck, UserCircle2, WandSparkles, type LucideIcon } from 'lucide-react';

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
  owner: ShieldCheck,
};

interface EnvironmentNavigationProps {
  zones: readonly ZoneDefinition[];
  activeZone: ZoneId;
  brand: { src: string; alt: string };
}

function ZoneLinkContents({ Icon, label }: { Icon: LucideIcon; label: string }) {
  const { pending } = useLinkStatus();
  return <>
    <Icon size={19} aria-hidden="true" />
    <span>{label}</span>
    {pending ? <span className={styles.zonePending} aria-hidden="true" /> : null}
  </>;
}

function MobileZoneButton({
  zone,
  activeZone,
}: {
  zone: ZoneDefinition;
  activeZone: ZoneId;
}) {
  const Icon = ZONE_ICONS[zone.id];
  return (
    <Link
      href={zone.href}
      prefetch={true}
      className={styles.mobileZoneButton}
      aria-current={activeZone === zone.id ? 'page' : undefined}
    >
      <ZoneLinkContents Icon={Icon} label={zone.shortLabel} />
    </Link>
  );
}

export function EnvironmentNavigation({ zones, activeZone, brand }: EnvironmentNavigationProps) {
  const coreZones = zones.filter((zone) => zone.minimumAccess === 'guest' || zone.minimumAccess === 'member');
  const protectedZones = zones.filter((zone) => zone.minimumAccess === 'contributor' || zone.minimumAccess === 'owner');

  return (
    <>
      <aside className={styles.rail} aria-label="CardForge zones">
        <Link href="/" prefetch={false} className={styles.brand} aria-label="Open the CardForge public site" title="CardForge public site"><Image src={brand.src} alt="" width={30} height={30} priority /></Link>
        <nav className={styles.railNav} aria-label="Environment zones">
          {zones.map((zone, index) => {
            const Icon = ZONE_ICONS[zone.id];
            const previous = zones[index - 1];
            const showDivider = Boolean(previous && previous.minimumAccess !== zone.minimumAccess && zone.minimumAccess === 'contributor');
            return (
              <div key={zone.id}>
                {showDivider ? <div className={styles.railDivider} aria-hidden="true" /> : null}
                <Link href={zone.href} prefetch={true} className={styles.railButton} aria-current={activeZone === zone.id ? 'page' : undefined}>
                  <ZoneLinkContents Icon={Icon} label={zone.shortLabel} />
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>

      <nav className={styles.mobileNav} aria-label="CardForge zones" style={{ gridTemplateColumns: `repeat(${coreZones.length + (protectedZones.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}>
        {coreZones.map((zone) => (
          <MobileZoneButton key={zone.id} zone={zone} activeZone={activeZone} />
        ))}
        {protectedZones.length === 1 ? (
          <MobileZoneButton zone={protectedZones[0]!} activeZone={activeZone} />
        ) : protectedZones.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.mobileZoneButton} aria-label="Open protected zones">
                <Menu size={19} aria-hidden="true" /><span>More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={styles.mobileMoreMenu} side="top" align="end">
              {protectedZones.map((zone) => {
                const Icon = ZONE_ICONS[zone.id];
                return <DropdownMenuItem key={zone.id} asChild><Link href={zone.href} prefetch={true}><Icon aria-hidden="true" />{zone.label}</Link></DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>
    </>
  );
}
