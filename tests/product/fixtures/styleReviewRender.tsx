import { getFreshDefaultTemplateObject, type FreeformCardElement, type AppearanceStylePreset } from '@/domain/templates';
import { createRecipesFromAppearanceStyles, buildElementPresetElementUpdates } from '@/features/template-editor/lib/elementPresetRecipes';
import { renderCardToPngBlob } from '@/features/card-generator/lib/cardPreviewExport';
// Only synthetic fixture data. The published/candidate distinction is native
// SQL-tested; this checks its complete style payload against the real renderer.
const target = document.createElement('main'); document.body.replaceChildren(target);
const button = document.createElement('button'); button.textContent = 'Render synthetic corrected style'; target.append(button);
button.onclick = async () => {
  const style: AppearanceStylePreset = { id: 'synthetic-corrected-style', name: 'Synthetic green material', kind: 'material',
    targets: ['shape'], appearance: { material: { baseColor: '#00cc66' }, border: { kind: 'solid', color: '#112244', width: 4 } } };
  const primitive: FreeformCardElement = { id: 'panel', type: 'shape', name: 'Panel', shapeKind: 'rectangle',
    x: 0, y: 0, width: 630, height: 880, rotation: 0, opacity: 1, zIndex: 1 };
  const recipe = createRecipesFromAppearanceStyles([style])[0];
  const template = getFreshDefaultTemplateObject('synthetic-style-review', 'Synthetic correction render');
  template.baseBackgroundColor = '#fff'; template.cardBackgroundImageUrl = undefined;
  template.appearance = undefined; template.fieldContracts = []; template.templatePreviewData = {};
  template.freeformCanvas = { width: 630, height: 880, elements: [{ ...primitive, ...buildElementPresetElementUpdates(recipe, primitive) }] };
  const blob = await renderCardToPngBlob({ template, data: {}, uniqueId: template.id! }, 'virtual', 72);
  const image = document.createElement('img'); image.alt = 'Synthetic corrected style'; image.src = URL.createObjectURL(blob); target.append(image);
};
