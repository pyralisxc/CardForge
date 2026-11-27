import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { PipelineSubmissionPanel } from '@/features/pipeline/components/PipelineSubmissionPanel';

const actor = new URL(location.href).searchParams.get('actor') || 'fixture-author';
createRoot(document.body).render(<TooltipProvider><PipelineSubmissionPanel contributorId={actor} context={{ maxSubmissionFileSizeMb: 25, monthlySubmissionLimit: 5, monthlyPublishedRequirement: 0, submittedThisMonth: 0, publishedThisMonth: 0, remainingSubmissions: 5, ownerNote: null }} onSubmitted={async () => {}} /><Toaster /></TooltipProvider>);
