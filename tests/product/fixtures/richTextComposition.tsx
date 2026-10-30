import { ColorField } from '@/features/template-editor/components/ColorField';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CardForgeRichTextEditor } from '@/features/card-rendering/components/CardForgeRichTextEditor';
import { CardPreview } from '@/features/card-rendering/client';
import { getFreshDefaultTemplateObject } from '@/domain/templates';
import { renderCardToPngBlob } from '@/features/card-generator/lib/cardPreviewExport';
function Fixture() {
  const [value, setValue] = useState(() => localStorage.getItem('synthetic-rich-text') ?? 'Combined words');
  const [image, setImage] = useState('');
  const [color, setColor] = useState('#112233'); const [submitted, setSubmitted] = useState(0);
  const template = getFreshDefaultTemplateObject('rich-composition', 'Synthetic composed marks');
  template.cardBackgroundImageUrl = undefined; template.appearance = undefined; template.fieldContracts = []; template.templatePreviewData = {};
  template.baseBackgroundColor = '#fff'; template.cardBorderWidth = '0px';
  template.freeformCanvas = { width: 630, height: 880, elements: [{ id: 'text', type: 'text', name: 'Text', content: value, x: 40, y: 40, width: 550, height: 200, zIndex: 1, fontSizePx: 32, textColor: '#000', padding: 'p-0' }] };
  return <main><form onSubmit={event => { event.preventDefault(); setSubmitted(count => count + 1); }}><ColorField value={color} onChange={setColor} /><output data-testid="color">{color}</output><output data-testid="form-submits">{submitted}</output><button type="button">Outside color</button></form>
    <CardForgeRichTextEditor value={value} onChange={setValue} highlightColor="#ffd700" onHighlightColorChange={() => {}} />
    <button onClick={() => localStorage.setItem('synthetic-rich-text', value)}>Save local text</button>
    <button onClick={async () => setImage(URL.createObjectURL(await renderCardToPngBlob({ template, data: {}, uniqueId: 'rich-proof' }, 'virtual', 72)))}>Export canonical PNG</button>
    <output data-testid="saved-syntax">{value}</output>
    <div data-testid="canonical-card" style={{ width: 315 }}><CardPreview card={{ template, data: {}, uniqueId: "rich-preview" }} targetWidthPx={315} /></div>
    {image && <img alt="Canonical composed marks PNG" src={image} />}
  </main>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Fixture />);
