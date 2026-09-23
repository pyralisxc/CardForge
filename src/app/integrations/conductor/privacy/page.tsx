import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conductor integration privacy',
  description: 'Privacy notice for the private Pyralis Conductor Vercel connection.',
  robots: { index: false, follow: false },
};

export default function ConductorPrivacyPage() {
  return (
    <article className="space-y-7 leading-7">
      <div>
        <h1 className="text-3xl font-semibold">Conductor integration privacy</h1>
        <p className="mt-2 text-sm text-[#F6F3EA]/70">Effective September 23, 2026</p>
      </div>
      <p>This notice covers the Pyralis Conductor Vercel connection, which is separate from ordinary CardForge Studio accounts. Visiting or using CardForge Studio does not connect your Vercel account. The <a className="underline" href="/privacy">CardForge Studio privacy policy</a> covers CardForge&apos;s own service.</p>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Information used</h2><p>When an authorized owner connects Vercel, Conductor receives an installation identifier, the connected account or team identifier, and an access credential. It encrypts the credential before storing it in its credential store. Conductor uses the connection to request selected project, deployment, and domain details from Vercel. Project bindings may retain project and team identifiers. Short-lived authorization state is used to complete the connection.</p></section>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Purpose and sharing</h2><p>This information supports owner-requested deployment inspection and project operations. Vercel supplies the account data and processes API requests. Conductor&apos;s hosting and credential-storage providers process the data needed to operate the service. The connection is not used to grant access to ordinary CardForge accounts.</p></section>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Retention and removal</h2><p>The stored connection remains until the owner disconnects it, the integration is uninstalled, or the service removes it. Disconnecting in Conductor deletes its stored credential; uninstalling in Vercel revokes provider access. Project bindings, operational logs, and provider records are separate from the credential and may remain under their respective retention settings. Contact us to request review or removal of remaining Conductor information.</p></section>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Contact</h2><p>For access, removal, or privacy questions, email <a className="underline" href="mailto:pyraliscameron@gmail.com">pyraliscameron@gmail.com</a>. Changes to this notice will be reflected by a new effective date.</p></section>
    </article>
  );
}
