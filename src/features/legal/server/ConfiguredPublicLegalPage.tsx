import type { ComponentProps } from 'react';

import { CardForgeAppProviders } from '@/features/app-shell/server';
import { PublicLegalPage } from '../components/PublicLegalPage';

export function ConfiguredPublicLegalPage(props: ComponentProps<typeof PublicLegalPage>) {
  return (
    <CardForgeAppProviders>
      <PublicLegalPage {...props} />
    </CardForgeAppProviders>
  );
}
