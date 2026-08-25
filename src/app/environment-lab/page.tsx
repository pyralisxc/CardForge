import { notFound } from 'next/navigation';

import { EnvironmentLab } from '@/features/app-shell/client/environment-lab';
import { createPageMetadata } from '@/shared/siteMetadata';

export const metadata = createPageMetadata({
  title: 'Environment Foundation Lab',
  description: 'Preview CardForge environment, density, action, and responsive interaction foundations.',
  path: '/environment-lab',
  index: false,
});

export default function EnvironmentLabPage() {
  const previewLabEnabled = process.env.NODE_ENV !== 'production'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.CARDFORGE_ENVIRONMENT_LAB === 'enabled';
  if (!previewLabEnabled) notFound();

  return <EnvironmentLab />;
}
