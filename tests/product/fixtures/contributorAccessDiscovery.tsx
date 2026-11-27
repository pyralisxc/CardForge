import { createRoot } from 'react-dom/client';
import { useContributorAccess } from '@/features/contributor-access/client';

function Probe({ readOnly }: { readOnly: boolean }) {
  const access = useContributorAccess({ eligible: true, sessionKey: 'fixture-account', readOnly });
  return <output aria-label={readOnly ? 'Discovery access' : 'Established access'}>{access.isLoading ? 'loading' : access.active ? 'active' : 'inactive'}</output>;
}

createRoot(document.body).render(<><Probe readOnly /><Probe readOnly={false} /></>);
