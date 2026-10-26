import { createRoot } from 'react-dom/client';
import { CatalogTrashControls } from '@/features/pipeline/components/CatalogTrashControls';
const target = document.createElement('main');
target.style.padding = '16px';
document.body.replaceChildren(target);
createRoot(target).render(<CatalogTrashControls submissionId="00000000-0000-4000-8000-000000000002" />);
