'use client';

import { useEffect, useState } from 'react';
import type { z } from 'zod/v4';
import { contributorReviewFeedback } from '../lib/contributorDraftContract';

type Feedback = z.infer<typeof contributorReviewFeedback>;

/** Exact-revision author feedback; this never reads the Owner's private packet. */
export function ContributorReviewFeedback({ submissionId }: { submissionId: string }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFeedback(null); setError('');
    void fetch(`/api/pipeline/${encodeURIComponent(submissionId)}/feedback`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Feedback is unavailable.');
        const value = contributorReviewFeedback.safeParse(await response.json());
        if (!value.success || value.data.submissionId !== submissionId) throw new Error('The exact revision could not be verified.');
        if (current) setFeedback(value.data);
      })
      .catch(() => { if (current) setError('Feedback is unavailable. Your work is unchanged.'); });
    return () => { current = false; };
  }, [submissionId, attempt]);
  return <section aria-label="Review feedback" className="space-y-2 border border-[var(--cf-border-subtle)] p-3 text-sm">
    <h3>Review feedback</h3>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button></>
      : !feedback ? <p role="status">Loading this revision’s feedback…</p>
        : <><p>Review: {feedback.reviewStatus === 'revise' ? 'Needs revision' : feedback.reviewStatus}</p>
          <p>{feedback.authorNote ?? 'No note to the author has been recorded for this revision.'}</p>
          {feedback.reviewStatus === 'revise' ? <p>Use the note to continue from your saved work.</p> : null}</>}
  </section>;
}
