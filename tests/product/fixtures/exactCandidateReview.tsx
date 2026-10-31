import { createRoot } from 'react-dom/client';
import { ExactCandidateReview } from '@/features/creator-workbench/components/ExactCandidateReview';
import { Toaster } from '@/components/ui/toaster';
const target = document.createElement('main');
document.body.replaceChildren(target);
createRoot(target).render(<><ExactCandidateReview /><Toaster /></>);
