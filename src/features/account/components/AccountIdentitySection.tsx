import type { ReactNode } from 'react';
import { FolderOpen, UserCircle2 } from 'lucide-react';

export function AccountIdentitySection({
  accountDisplayName,
  accountEmail,
  accountPanelMessage,
  accountTitle,
  actions,
  effectiveSignedIn,
  planLabel,
}: {
  accountDisplayName: string | null;
  accountEmail: string;
  accountPanelMessage: string;
  accountTitle: string;
  actions: ReactNode;
  effectiveSignedIn: boolean;
  planLabel: string;
}) {
  return (
    <section className="border border-[#5f4526] bg-[#15100a] p-5 md:p-6">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <UserCircle2 className="h-5 w-5" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">
          {effectiveSignedIn && accountDisplayName ? accountDisplayName : 'CardForge'}
        </span>
      </div>
      <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-[#fff1c7] md:text-4xl">{accountTitle}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cbb58b]">{accountPanelMessage}</p>

      {effectiveSignedIn ? (
        <p className="mt-4 truncate text-sm text-[#d8c49a]" title={accountEmail}>
          Signed in as <span className="font-semibold text-[#ffe7ad]">{accountEmail}</span>
        </p>
      ) : null}

      <div className="mt-5 border border-[#5f4526] bg-[#100c08] p-4">
        <div className="flex items-start gap-3">
          <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#e2aa4a]" aria-hidden="true" />
          <div>
            <h2 className="font-serif text-lg text-[#fff1c7]">Your work, your choice</h2>
            <p
              className="mt-1 text-sm leading-5 text-[#c7b288]"
              title="CardForge keeps your normal workspace on this device. When you sign in, you can explicitly back up selected sets to private account cloud slots for cross-device access and ChatGPT discovery."
            >
              Your normal workspace stays on this device. Sign in to explicitly back up selected sets to your private CardForge cloud library when you want cross-device access.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#a98a55]">Your plan</p>
            <p className="mt-1 text-sm text-[#ffe7ad]">{planLabel}</p>
          </div>
        </div>
      </div>

      <div id="account-actions" className="mt-5 flex scroll-mt-5 flex-col gap-2 sm:flex-row">{actions}</div>
    </section>
  );
}
