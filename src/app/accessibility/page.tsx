import { PublicLegalPage } from '@/features/legal/client';
import { getCachedPublishedLegalDocument } from '@/features/legal/server';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Accessibility Statement',
  description: 'CardForge Studio accessibility goals, known limitations, and the route for reporting an accessibility barrier.',
  path: '/accessibility',
});

export default async function AccessibilityStatementPage() {
  const { businessIdentity, document } = await getCachedPublishedLegalDocument('accessibility');
  return <PublicLegalPage businessIdentity={businessIdentity} document={document} />;
}
