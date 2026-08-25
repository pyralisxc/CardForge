import type { ReactNode } from 'react';
import { ChevronDown, Cloud, FolderOpen, HardDrive, Images, Laptop } from 'lucide-react';

interface StorageLocationProps {
  children: ReactNode;
  detail: string;
  icon: ReactNode;
  title: string;
}

function StorageLocation({ children, detail, icon, title }: StorageLocationProps) {
  return (
    <details className="group border-b border-[var(--cf-border-subtle)]">
      <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left sm:min-h-16 [&::-webkit-details-marker]:hidden">
        <span className="text-[var(--cf-accent-strong)]">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--cf-text-strong)]">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-[var(--cf-text-muted)]">{detail}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--cf-text-subtle)] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="account-storage-detail pb-5 pl-0 sm:pl-7 md:pl-8 [&>div]:m-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>section]:m-0 [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0 [&>section>div]:border-0 [&>section>div]:bg-transparent [&>section>div]:p-0">
        {children}
      </div>
    </details>
  );
}

export function AccountStorageWorkspace({
  browserAndCloud,
  cloudDetails,
  connectedAssets,
  googleDriveProjects,
  localProjectFolder,
}: {
  browserAndCloud: ReactNode;
  cloudDetails: ReactNode;
  connectedAssets: ReactNode;
  googleDriveProjects: ReactNode;
  localProjectFolder: ReactNode;
}) {
  return (
    <section aria-labelledby="storage-locations-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--cf-border)] pb-3">
        <div>
          <h2 id="storage-locations-heading" className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Storage locations</h2>
          <p className="mt-1 text-sm text-[var(--cf-text-muted)]">Expand one location to inspect its live status and valid actions.</p>
        </div>
        <span className="text-[11px] text-[var(--cf-text-subtle)] sm:text-xs">Nothing moves between locations automatically</span>
      </div>
      <div>
        <StorageLocation icon={<Laptop className="h-5 w-5" aria-hidden="true" />} title="This device & CardForge backups" detail="Local sets, private cloud mirrors, working drafts, and location-specific removal">
          {browserAndCloud}
        </StorageLocation>
        <StorageLocation icon={<FolderOpen className="h-5 w-5" aria-hidden="true" />} title="Local project folder" detail="Attach, save, reload, or detach a browser-authorized project folder">
          {localProjectFolder}
        </StorageLocation>
        <StorageLocation icon={<HardDrive className="h-5 w-5" aria-hidden="true" />} title="Google Drive projects" detail="Connection health, selected project folder, permissions, and project-file actions">
          {googleDriveProjects}
        </StorageLocation>
        <StorageLocation icon={<Images className="h-5 w-5" aria-hidden="true" />} title="Connected asset library" detail="Explicitly authorized Drive artwork, frames, and fonts available to CardForge">
          {connectedAssets}
        </StorageLocation>
        <StorageLocation icon={<Cloud className="h-5 w-5" aria-hidden="true" />} title="CardForge Cloud space" detail="Exact metadata and artwork usage for private cloud-set mirrors">
          {cloudDetails}
        </StorageLocation>
      </div>
    </section>
  );
}
