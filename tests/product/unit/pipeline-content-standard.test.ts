import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARDFORGE_SEMANTIC_ROLE_OPTIONS } from '@/features/pipeline/lib/contentTaxonomy';
import {
  CONTENT_QUALITY_AI,
  CONTENT_QUALITY_BY_ROLE,
  CONTENT_QUALITY_FINISH,
  CONTENT_QUALITY_STANDARD_VERSION,
  buildPipelineSourceEvidence,
  parseContentQualityReviewNote,
  stampContentQualityReviewNote,
} from '@/features/pipeline/lib/contentQualityStandard';
import { ContentQualityGuidance } from '@/features/pipeline/components/ContentQualityGuidance';

describe('CardForge first-party content standard', () => {
  it('covers every governed semantic role with real editorial decisions and proof', () => {
    const roles = CARDFORGE_SEMANTIC_ROLE_OPTIONS.map(({ id }) => id);
    expect(Object.keys(CONTENT_QUALITY_BY_ROLE).toSorted()).toEqual(roles.toSorted());
    for (const rule of Object.values(CONTENT_QUALITY_BY_ROLE)) {
      for (const text of Object.values(rule)) expect(text.length).toBeGreaterThan(25);
    }
    expect(CONTENT_QUALITY_AI.join(' ')).toMatch(/sensitive prompts/);
    expect(CONTENT_QUALITY_FINISH.join(' ')).toMatch(/printer-specific proof/);
  });

  it('projects one role-specific quality rubric into the UI', () => {
    const html = renderToStaticMarkup(createElement(ContentQualityGuidance, { role: 'font' }));
    expect(html).toContain(CONTENT_QUALITY_STANDARD_VERSION);
    expect(html).toContain('embedding/export rights');
    expect(html).toContain('AI-assisted and remixed');
    expect(html).toContain('Digital versus physical finishes');
  });

  it('records explicit AI-use/rights evidence without losing long notes', () => {
    expect(buildPipelineSourceEvidence({ rightsAndSources: '', aiAssistance: 'none', aiProcess: '' }).ok).toBe(false);
    expect(buildPipelineSourceEvidence({ rightsAndSources: 'Original owned artwork', aiAssistance: 'used', aiProcess: '' }).ok).toBe(false);
    const evidence = buildPipelineSourceEvidence({
      rightsAndSources: '  Original   artwork with publication permission ',
      aiAssistance: 'used',
      aiProcess: 'Tool/model X, date unknown; manually redrew the output.',
    });
    expect(evidence).toEqual({
      ok: true,
      value: 'Rights and sources: Original artwork with publication permission | AI assistance: Used | Process: Tool/model X, date unknown; manually redrew the output.',
    });
    expect(buildPipelineSourceEvidence({ rightsAndSources: 'x'.repeat(600), aiAssistance: 'none', aiProcess: '' }).ok).toBe(false);
  });

  it('stamps exact-review decisions and preserves unstamped historical notes', () => {
    expect(parseContentQualityReviewNote('Prior valid reason')).toEqual({ version: null, reason: 'Prior valid reason' });
    const saved = stampContentQualityReviewNote('Reviewed readability and originality.');
    expect(saved).toEqual({ ok: true, value: `[${CONTENT_QUALITY_STANDARD_VERSION}] Reviewed readability and originality.` });
    if (!saved.ok) throw new Error('expected versioned review');
    expect(parseContentQualityReviewNote(saved.value)).toEqual({ version: CONTENT_QUALITY_STANDARD_VERSION, reason: 'Reviewed readability and originality.' });
    expect(stampContentQualityReviewNote(saved.value)).toEqual(saved);
    expect(stampContentQualityReviewNote('x'.repeat(600)).ok).toBe(false);
  });
});
