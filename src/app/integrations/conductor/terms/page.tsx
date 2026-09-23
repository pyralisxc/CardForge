import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conductor integration terms',
  description: 'Terms for the private Pyralis Conductor Vercel connection.',
  robots: { index: false, follow: false },
};

export default function ConductorTermsPage() {
  return (
    <article className="space-y-7 leading-7">
      <div>
        <h1 className="text-3xl font-semibold">Conductor integration terms</h1>
        <p className="mt-2 text-sm text-[#F6F3EA]/70">Effective September 23, 2026</p>
      </div>
      <p>These terms apply to the Pyralis Conductor integration and its Vercel account connection. They are separate from the CardForge Studio account and purchase terms. Hosting this notice at cardforges.com does not make a CardForge account necessary to use Conductor.</p>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Authorized use</h2><p>Only an authorized owner may connect a Vercel account or team. You must have permission to install the integration and access the selected projects. The connection initially permits Conductor to inspect project, deployment, and domain information. Any later capability to change deployments or project settings requires a separate permission change and authorization.</p></section>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Your control</h2><p>You choose the Vercel installation and the projects to bind in Conductor. You can disconnect the stored credential in Conductor and uninstall the integration in Vercel to revoke its provider access. Existing project configuration and records outside that connection may require separate removal.</p></section>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Other services</h2><p>Vercel operates the connected account and its API under Vercel&apos;s own terms. Conductor may be unavailable when its hosting, credential store, or Vercel is unavailable. Do not rely on an integration result as the sole record of a deployment or project state; verify consequential actions in Vercel.</p></section>
      <section className="space-y-2"><h2 className="text-xl font-semibold text-[#D2B66C]">Changes and contact</h2><p>We may update these terms as the integration changes. The effective date above identifies this version. Questions about the integration or these terms can be sent to <a className="underline" href="mailto:pyraliscameron@gmail.com">pyraliscameron@gmail.com</a>.</p></section>
    </article>
  );
}
