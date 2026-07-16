import type { ReactNode } from 'react';
import { FolderOpen, UserCircle2 } from 'lucide-react';

export interface LocalAssetSummary {
  textures: number;
  dividers: number;
  icons: number;
  images: number;
}

export function AccountIdentitySection({
  accountDisplayName,
  accountEmail,
  accountPanelMessage,
  accountTitle,
  accessExpiresOn,
  actions,
  cleanExportLabel,
  effectiveSignedIn,
  libraryAccessLabel,
  localAssetSummary,
}: {
  accountDisplayName: string | null;
  accountEmail: string;
  accountPanelMessage: string;
  accountTitle: string;
  accessExpiresOn: string | null;
  actions: ReactNode;
  cleanExportLabel: string;
  effectiveSignedIn: boolean;
  libraryAccessLabel: string;
  localAssetSummary: LocalAssetSummary;
}) {
  return (
    <div className="border border-[#5f4526] bg-[#15100a] p-4 md:p-5">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <UserCircle2 className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">
          {accountDisplayName ? `${accountDisplayName} workspace` : 'Your workspace'}
        </span>
      </div>
      <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">{accountTitle}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cbb58b]">{accountPanelMessage}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <StatusCell label="Account">
          {effectiveSignedIn && accountDisplayName ? (
            <>
              <p className="mt-2 truncate font-semibold text-[#ffe7ad]" title={accountEmail}>{accountDisplayName}</p>
              <p className="mt-1 truncate text-sm text-[#c7b288]" title={accountEmail}>{accountEmail}</p>
            </>
          ) : <p className="mt-2 break-words text-[#ffe7ad]">{accountEmail}</p>}
        </StatusCell>
        <StatusCell label="Clean export">
          <p className="mt-2 text-[#ffe7ad]">{cleanExportLabel}</p>
          {accessExpiresOn ? <p className="mt-1 text-xs text-[#c7b288]">Beta through {accessExpiresOn}</p> : null}
        </StatusCell>
        <StatusCell label="Forge status"><p className="mt-2 text-[#ffe7ad]">Maker and generator available</p></StatusCell>
        <StatusCell label="Asset access"><p className="mt-2 text-[#ffe7ad]">{libraryAccessLabel}</p></StatusCell>
      </div>

      <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <FolderOpen className="mt-1 h-5 w-5 text-[#e2aa4a]" />
            <div>
              <p className="font-serif text-lg text-[#fff1c7]">Local Asset Library</p>
              <p className="mt-1 text-sm leading-5 text-[#c7b288]">
                {effectiveSignedIn
                  ? 'Your custom uploads stay browser-local across refreshes and page changes in this workspace.'
                  : 'Your custom uploads stay browser-local across refreshes and page changes. Sign in to add uploads to this workspace.'}
              </p>
            </div>
          </div>
          <div className="grid min-w-44 grid-cols-2 gap-2 text-center">
            {Object.entries(localAssetSummary).map(([label, count]) => (
              <div key={label} className="border border-[#4a3823] bg-[#0c0b09] px-3 py-2">
                <p className="text-lg font-semibold text-[#ffe7ad]">{count}</p>
                <p className="text-[10px] capitalize tracking-[0.14em] text-[#a98a55]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a98a55]">
          {effectiveSignedIn ? 'Custom art uploads are available in this workspace' : 'Sign in to add custom art'}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">{actions}</div>
    </div>
  );
}

function StatusCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">{label}</p>
      {children}
    </div>
  );
}
