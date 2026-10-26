import { getCurrentOwnerAccess } from '@/features/owner/server';
import { ExactCandidateReview } from '@/features/creator-workbench/client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Exact candidate review', robots: { index: false, follow: false } };
export default async function CandidateReviewPage() {
  const access = await getCurrentOwnerAccess();
  if (!access.isOwner || !access.userId) return <main>Owner review access required.</main>;
  return <ExactCandidateReview />;
}
