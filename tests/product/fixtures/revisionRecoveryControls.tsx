import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RevisionRecoveryControls } from '@/features/pipeline/components/RevisionRecoveryControls';
function Fixture() {
  const [submissionId, setSubmissionId] = useState('00000000-0000-4000-8000-000000000001');
  const [actorScope, setActorScope] = useState('account-a');
  const [refreshes, setRefreshes] = useState(0);
  return <main>
    <button onClick={() => setSubmissionId('00000000-0000-4000-8000-000000000002')}>Switch revision</button>
    <button onClick={() => setActorScope('account-b')}>Switch account</button>
    <p>Refreshes: {refreshes}</p>
    <RevisionRecoveryControls submissionId={submissionId} actorScope={actorScope} onChanged={() => { setRefreshes(value => value + 1); }} />
  </main>;
}
const target = document.createElement('div');
document.body.replaceChildren(target);
createRoot(target).render(<Fixture />);
