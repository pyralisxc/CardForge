import type { Metadata } from 'next';

import { TemplateDraftPreviewClient } from '@/features/studio-documents/client';

export const metadata: Metadata = {
  title: 'CardForge Draft Preview',
  robots: { index: false, follow: false },
};

export default function McpTemplatePreviewPage() {
  return <TemplateDraftPreviewClient />;
}
