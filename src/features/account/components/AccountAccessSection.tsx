import { CheckCircle2, CreditCard, Crown, FolderOpen, Hammer, Lock, ShieldCheck, type LucideIcon } from 'lucide-react';

const accessExplainerRows = [
  ['Free preview', 'Design templates, import data, generate previews, and export/import project files locally.'],
  ['Founder Beta', 'A time-boxed clean export grant while billing and the shared library are still being proven.'],
  ['Creator Pass', 'The paid or beta export tier for clean PDF, PNG, ZIP, and deeper reviewed library assets.'],
  ['Developer', 'Approved contributors can submit and vote on shared library assets without paying for access.'],
] as const;

export function AccountAccessSection({ effectiveSignedIn, isDeveloper, isOwner }: {
  effectiveSignedIn: boolean;
  isDeveloper: boolean;
  isOwner: boolean;
}) {
  return (
    <>
      <div className="border border-[#5f4526] bg-[#15100a] p-4">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="font-serif text-xl text-[#fff1c7]">Access at a glance</h2>
        </div>
        <div className="mt-3">
          {accessExplainerRows.map(([label, value]) => (
            <div key={label} className="border-b border-[#4a3823] py-3 last:border-b-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a98a55]">{label}</p>
              <p className="mt-1 text-sm leading-5 text-[#d8c49a]">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a98a55]">Project files and personal uploads stay local unless you choose to export files or submit assets.</p>
      </div>
      <div className="border border-[#5f4526] bg-[#15100a] p-4">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <Lock className="h-5 w-5" />
          <h2 className="font-serif text-xl text-[#fff1c7]">What your account unlocks</h2>
        </div>
        <div className="mt-3">
          <LibraryLaneRow icon={CheckCircle2} label="Starter" value="Use CardForge templates and free library assets." />
          <LibraryLaneRow icon={FolderOpen} label="Local art" value={effectiveSignedIn ? 'Organize custom uploads in this browser workspace.' : 'Sign in to organize custom uploads in this browser.'} />
          <LibraryLaneRow icon={CreditCard} label="Creator Pass" value="Unlock clean exports and deeper reviewed library assets." />
          {isDeveloper ? <LibraryLaneRow icon={Hammer} label="Forge Review" value="Submit and vote on CardForge library assets." /> : null}
          {isOwner ? <LibraryLaneRow icon={Crown} label="Command" value="Control launch, library, and voting mechanics." /> : null}
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a98a55]">Your projects remain local unless you choose to export or upload assets.</p>
      </div>
    </>
  );
}

function LibraryLaneRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.4rem_7rem_1fr] items-start gap-3 border-b border-[#4a3823] py-3 last:border-b-0">
      <Icon className="mt-0.5 h-4 w-4 text-[#e2aa4a]" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a98a55]">{label}</p>
      <p className="text-sm leading-5 text-[#d8c49a]">{value}</p>
    </div>
  );
}
