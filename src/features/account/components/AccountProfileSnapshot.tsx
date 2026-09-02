interface AccountProfileSnapshotProps {
  accountLabel: string;
  identityLabel: string;
  planLabel: string;
  workspaceLabel: string;
  authorityLabel: string;
}

export function AccountProfileSnapshot({
  accountLabel,
  identityLabel,
  planLabel,
  workspaceLabel,
  authorityLabel,
}: AccountProfileSnapshotProps) {
  const metrics: Array<readonly [string, string]> = [
    ['Account', accountLabel],
    ['Access', planLabel],
    ['Workspace', workspaceLabel],
  ];
  metrics.push(['Authority', authorityLabel]);

  return (
    <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)]" aria-labelledby="profile-snapshot-heading" data-testid="profile-snapshot">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--cf-border-subtle)] px-4 py-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Right now</p>
          <h2 id="profile-snapshot-heading" className="mt-0.5 font-serif text-xl text-[var(--cf-text-strong)]">Your CardForge account at a glance</h2>
        </div>
        <span className="text-xs text-[var(--cf-text-subtle)]">{identityLabel}</span>
      </div>
      <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-[var(--cf-border-subtle)] px-4 py-3 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
            <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-[var(--cf-text-strong)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
