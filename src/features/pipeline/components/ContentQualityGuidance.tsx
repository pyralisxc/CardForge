"use client";

import { getSemanticRoleLabel, type PipelineSemanticRole } from '../lib/contentTaxonomy';
import {
  CONTENT_QUALITY_AI,
  CONTENT_QUALITY_BY_ROLE,
  CONTENT_QUALITY_FINISH,
  CONTENT_QUALITY_STANDARD_VERSION,
  CONTENT_QUALITY_UNIVERSAL,
} from '../lib/contentQualityStandard';

/** One source of criteria for Contributors and Owner editorial reviewers. */
export function ContentQualityGuidance({ role }: { role: PipelineSemanticRole }) {
  const rule = CONTENT_QUALITY_BY_ROLE[role];
  return <details data-content-quality-standard className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-3 py-2 text-xs leading-5 text-[var(--cf-text-muted)]">
    <summary className="cursor-pointer font-semibold text-[var(--cf-accent-text)]">
      Quality criteria · {CONTENT_QUALITY_STANDARD_VERSION} · {getSemanticRoleLabel(role)}
    </summary>
    <div className="mt-2 grid gap-2">
      <p><strong>Pass:</strong> {rule.pass}</p>
      <p><strong>Revise:</strong> {rule.revise}</p>
      <p><strong>Reject:</strong> {rule.reject}</p>
      <p><strong>Proof:</strong> {rule.proof}</p>
      <p className="font-semibold text-[var(--cf-accent-text)]">All content</p>
      <ul className="list-disc space-y-1 pl-5">{CONTENT_QUALITY_UNIVERSAL.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="font-semibold text-[var(--cf-accent-text)]">AI-assisted and remixed content</p>
      <ul className="list-disc space-y-1 pl-5">{CONTENT_QUALITY_AI.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="font-semibold text-[var(--cf-accent-text)]">Digital versus physical finishes</p>
      <ul className="list-disc space-y-1 pl-5">{CONTENT_QUALITY_FINISH.map((item) => <li key={item}>{item}</li>)}</ul>
      <p>Human editorial quality is separate from Content Health and votes. Review the actual card-size output, and do not include private prompts or personal user data in source notes.</p>
    </div>
  </details>;
}
