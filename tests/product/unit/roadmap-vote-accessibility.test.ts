import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { FeatureCard } from '@/features/roadmap/components/RoadmapPresentation';
import type { RoadmapItem } from '@/features/roadmap/model/roadmap';

it('exposes each vote count and the current user’s selected vote to assistive technology', () => {
  const item: RoadmapItem = {
    id: 'one', title: 'A request', description: null, itemType: 'feature', status: 'planned', source: 'user',
    visibleMonth: '2026-11', monthlyCostCents: null, expenseProvider: null, expensePlan: null,
    expenseSourceUrl: null, expenseVerifiedAt: null, shippedAt: null, createdAt: '2026-11-01',
    upVotes: 12, downVotes: 3, userVote: 'up',
  };
  const html = renderToStaticMarkup(createElement(FeatureCard, { item, rank: 1, isSignedIn: true, isSaving: false, isOwner: false, onVote: vi.fn(), onStatusChange: vi.fn() }));
  expect(html).toContain('aria-pressed="true" aria-label="Withdraw thumbs up vote. 12 votes"');
  expect(html).toContain('aria-pressed="false" aria-label="Cast not for me vote. 3 votes"');
});
