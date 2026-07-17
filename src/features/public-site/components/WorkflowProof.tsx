import { CheckCheck, Download, Layers3, Paintbrush } from 'lucide-react';

const steps = [
  {
    title: 'Make the look once',
    copy: 'Set up the front, back, words, and pictures for the kind of card you want.',
    icon: Paintbrush,
  },
  {
    title: 'Add your card list',
    copy: 'Type the details or bring in a list you already have. Each line becomes a card.',
    icon: CheckCheck,
  },
  {
    title: 'Build the whole set',
    copy: 'CardForge places every title, picture, and detail into the same design.',
    icon: Layers3,
  },
  {
    title: 'Check and download',
    copy: 'Look through every card, fix anything odd, and save the finished files.',
    icon: Download,
  },
] as const;

export function WorkflowProof() {
  return (
    <section aria-labelledby="workflow-heading" className="border-b border-[var(--public-border)] bg-[var(--public-charcoal)] px-5 py-10 md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <p className="text-base font-semibold text-[var(--public-brass)]">How it works</p>
        <h2 id="workflow-heading" className="mt-2 max-w-3xl font-[var(--public-font-display)] text-3xl font-semibold text-[var(--public-ivory)] md:text-4xl">
          From one good-looking card to the whole set.
        </h2>
        <ol className="mt-7 grid gap-px overflow-hidden border border-[var(--public-border)] bg-[var(--public-border)] md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="bg-[var(--public-surface)] p-5">
              <div className="flex items-center justify-between gap-4">
                <step.icon className="h-6 w-6 text-[var(--public-brass)]" aria-hidden="true" />
                <span className="text-base font-bold text-[var(--public-brass)]">{index + 1}</span>
              </div>
              <h3 className="mt-4 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{step.title}</h3>
              <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{step.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
