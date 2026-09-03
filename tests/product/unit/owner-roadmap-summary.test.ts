import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { OwnerReadinessPanel } from '@/features/owner/components/OwnerReadinessPanel';

describe('Profile Owner Roadmap summary', () => {
  it('presents Roadmap state without rehosting status mutations', () => {
    const markup = renderToStaticMarkup(createElement(OwnerReadinessPanel, {
      operationsPayload: {
        businessIdentity: {} as never,
        databaseMetrics: null,
        roadmapItems: [{
          id: 'roadmap-1',
          title: 'Touch interaction hardening',
          description: 'Finish the native spatial interaction model.',
          itemType: 'feature',
          status: 'testing',
          source: 'official',
          visibleMonth: '2026-09',
          monthlyCostCents: null,
          expenseProvider: null,
          expensePlan: null,
          expenseSourceUrl: null,
          expenseVerifiedAt: null,
          shippedAt: null,
        }],
      },
      view: 'roadmap',
      compactRoadmap: true,
      onOpenRoadmap: vi.fn(),
    }));

    expect(markup).toContain('Roadmap summary');
    expect(markup).toContain('Testing');
    expect(markup).toContain('Open Roadmap to manage 1 records');
    expect(markup).not.toMatch(/>Plan<|>Start<|>Test<|>Complete</u);
  });
});
