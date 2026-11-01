import type { DependencyImpact } from '../lib/dependencyImpactContract';

export function DependencyImpactPreview({ impact }: { impact?: DependencyImpact }) {
  if (!impact) return null;
  return <section aria-label="Trash impact preview" className="grid gap-2 text-xs">
    <p>{impact.affectedCount} known affected record{impact.affectedCount === 1 ? '' : 's'}. Existing authored references and bytes stay intact; affected current Pipeline work will show a technical Content Health finding.</p>
    {impact.privateAffectedCount ? <p>{impact.privateAffectedCount} private affected record{impact.privateAffectedCount === 1 ? '' : 's'}: identities are not available to this account.</p> : null}
    <ul className="grid max-h-48 gap-1 overflow-y-auto break-words">{impact.items.map(item => <li key={`${item.origin}:${item.recordId}`}>{item.name} · {item.origin} · {item.recordId}{item.submissionId ? ` · revision UUID ${item.submissionId}` : ''}</li>)}</ul>
    {impact.coverageWarningCount ? <p>{impact.coverageWarningCount} other source interpretation{impact.coverageWarningCount === 1 ? ' is' : 's are'} incomplete. This is a coverage warning, not a known reference to this asset or proof that physical deletion is safe.</p> : null}
  </section>;
}
export const impactConfirmationText = (impact?: DependencyImpact) => impact?.confirmationRequired
  ? ` ${impact.affectedCount} known record(s) will be affected${impact.privateAffectedCount ? `, including ${impact.privateAffectedCount} private record(s) whose identities are withheld` : ''}. Current affected Pipeline objects will need dependency review in Content Health. Confirm the displayed impact?`
  : '';
