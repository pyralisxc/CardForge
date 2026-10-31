import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RevisionRecoveryControls } from '@/features/pipeline/components/RevisionRecoveryControls';
function Fixture() {
  const [submissionId, setSubmissionId] = useState('00000000-0000-4000-8000-000000000001');
  const [actorScope, setActorScope] = useState('account-a');
  return <main>
    <button onClick={() => setSubmissionId('00000000-0000-4000-8000-000000000002')}>Switch revision</button>
    <button onClick={() => setActorScope('account-b')}>Switch account</button>
    <RevisionRecoveryControls submissionId={submissionId} actorScope={actorScope} />
  </main>;
}
const target = document.createElement('div');
document.body.replaceChildren(target);
createRoot(target).render(<Fixture />);
