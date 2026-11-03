import { useCallback, useRef, useState } from 'react';
import { fingerprintOutput, verifyPreparedOutput } from '@/features/studio-documents/client/outputHandoffVerification';
import { createRoot } from 'react-dom/client';
import { useStudioDocumentHandoff } from '@/features/studio-documents/hooks/useStudioDocumentHandoff';
import type { OutputIntent } from '@/features/studio-documents/outputIntent';
import { useProjectStore, selectAllGeneratedDisplayCards } from '@/features/project/client/workspace';
import { SaveAsPdfButton } from '@/features/card-generator/components/SaveAsPdfButton';
import { Toaster } from '@/components/ui/toaster';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

const doc = createProjectScaleFixture(100);
doc.storedCards = doc.storedCards.slice(0, 2);
doc.userTemplates[0].freeformCanvas!.elements = [{ id: 'label', name: 'Label', type: 'text', x: 20, y: 30, width: 500, height: 80, zIndex: 1, content: 'Synthetic {{cardName}}', fontSizePx: 30, textColor: '#000000' }];
const back = { ...doc.userTemplates[0], id: 'synthetic-back', templateUsage: 'back-preset' as const, name: 'Back' };
doc.userTemplates.push(back);
doc.storedCards[1].backingTemplateId = back.id;
doc.storedCards[1].backingData = {};
(window as unknown as { outputDocument: unknown }).outputDocument = doc;
(window as unknown as { changeWorkspace: () => void }).changeWorkspace = () => useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, { uniqueId: 'unsaved-concurrent', templateId: 'local', data: {} }] }));
const noView = () => {};
const noTemplate = () => {};
function App() {
 const [intent, setIntent] = useState<OutputIntent | null>(null);
 const [message, setMessage] = useState('');
 const snapshot = useRef('');
 const prepared = useCallback((value: OutputIntent) => { snapshot.current = fingerprintOutput(value); setIntent(value); }, []);
 const toast = useCallback((value: { title: string; description: string }) => setMessage(`${value.title}: ${value.description}`), []);
 useStudioDocumentHandoff({ isAccountLoading: false, isSignedIn: true, isStudioReady: true, setStudioView: noView, setSelectedTemplateId: noTemplate, setTemplateEditorSelectedTemplateId: noTemplate, toast, onOutputPrepared: prepared });
 const stored = useProjectStore((state) => state.storedCards);
 const templates = useProjectStore((state) => state.userTemplates);
 void stored; void templates;
 const cards = selectAllGeneratedDisplayCards(useProjectStore.getState());
 const selected = intent ? intent.cardIds.flatMap((id) => cards.filter((card) => card.uniqueId === id)) : [];
 return <><p data-testid="message">{message}</p><p data-testid="selected">{selected.map((card) => card.uniqueId).join(',')}</p>{intent && <SaveAsPdfButton beforeExport={() => verifyPreparedOutput(intent, snapshot.current, true)} generatedDisplayCards={selected} selectedPaperSize={{ name: 'A4', widthMm: 210, heightMm: 297 }} pdfMarginMm={intent.marginMm} pdfCardSpacingMm={intent.spacingMm} pdfIncludeCutLines={intent.cutLines} pdfDuplexLayout={intent.duplex} exportMode={intent.mode} exportDpi={intent.quality} richTextHighlightColor="#fbbf24" canExportClean /> }<Toaster /></>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
