import { Database, FileCheck2, Layers3, PanelsTopLeft } from 'lucide-react';

const steps = [
  {
    title: 'Design the template',
    copy: 'Define the shared front, back, fields, art zones, and visual rules once.',
    icon: PanelsTopLeft,
  },
  {
    title: 'Connect your data',
    copy: 'Bring in structured rows from CSV, JSON, or the editor instead of rebuilding layouts.',
    icon: Database,
  },
  {
    title: 'Generate the set',
    copy: 'Apply every reviewed row to the same reusable system in one production pass.',
    icon: Layers3,
  },
  {
    title: 'Review and export',
    copy: 'Proof the complete set together, then prepare clean PNG, PDF, ZIP, or tabletop output.',
    icon: FileCheck2,
  },
] as const;

export function WorkflowProof() {
  return (
    <section aria-labelledby="workflow-heading" className="bg-[#f0e5d2] px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-base font-semibold uppercase tracking-[0.14em] text-[#76551c]">One system, complete output</p>
        <h2 id="workflow-heading" className="mt-3 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-text)] md:text-5xl">
          From template to reviewed set in four clear steps.
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-5">
              <div className="flex items-center justify-between gap-4">
                <step.icon className="h-6 w-6 text-[#775817]" aria-hidden="true" />
                <span className="text-base font-bold text-[#76551c]">{index + 1}</span>
              </div>
              <h3 className="mt-5 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-text)]">{step.title}</h3>
              <p className="mt-3 text-base leading-7 text-[#5f5548]">{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
