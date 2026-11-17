import { describe, expect, it } from 'vitest';
import { authoredPlanInputSurvives, authoredPlanValuesEqual, normalizeCardSet, normalizeProjectProductionPlan } from '@/domain/cards';
import { createProjectDocumentFromState, instantiateProjectDocumentCopy, isolateProjectDocumentToSet, parseProjectDocumentValue, CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/model/projectDocument';
import { prepareTemplateDocumentSet } from '@/features/studio-documents/model';

const plan = { version: 1 as const, context: 'Keep the title readable.\nUse the creator’s original wording.' };
const documentWithContext = () => createProjectDocumentFromState({
  userTemplates: [], appearanceStyles: [], storedCards: [],
  cardSets: [{ id: 'set-a', name: 'First Set', plan }],
});

describe('Set-owned authoring context', () => {
  it('does not count inherited properties as preserved JSON metadata', () => {
    const metadata = JSON.parse('{"__proto__":{}}');
    expect(authoredPlanInputSurvives(metadata, {})).toBe(false);
    expect(authoredPlanValuesEqual(metadata, {})).toBe(false);
    expect(authoredPlanValuesEqual({}, metadata)).toBe(false);
    expect(authoredPlanInputSurvives({ optional: undefined }, {})).toBe(true);
  });

  it.each(['custom-generated', 'user-provided', 'cardforge-library', 'cardforge-output', 'placeholder'] as const)('copies %s asset identities according to their source, not a bare ID collision', (sourceKind) => {
    const source = documentWithContext();
    const brief = normalizeProjectProductionPlan({ version: 1, decisionMode: 'confirmed', purpose: 'Readable cards', deliverable: 'Cards', outputSize: { width: 63, height: 88, unit: 'mm' }, visualDirection: { summary: 'Quiet', palette: [], typography: [] }, editableFieldKeys: [], assets: [{ id: 'art', name: 'Art', kind: 'image', role: 'Face', source: sourceKind, status: 'selected', quantity: 1, assetId: 'collision' }] })!;
    source.cardSets[0].plan = { ...plan, brief };
    source.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY] = [{ id: 'collision', name: 'Local image', kind: 'image', url: 'https://example.com/local.png', tileMode: 'stretch', seamless: false, allowedTargets: ['template'] }];
    let ordinal = 0;
    const copy = instantiateProjectDocumentCopy(source, (kind) => `${kind}-${++ordinal}`);
    expect(copy.cardSets[0].plan?.brief?.assets[0].assetId).toBe(['custom-generated', 'user-provided'].includes(sourceKind) ? copy.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY][0].id : 'collision');
    expect(source.cardSets[0].plan?.brief?.assets[0].assetId).toBe('collision');
    expect(copy.cardSets[0].plan?.brief).not.toBe(source.cardSets[0].plan?.brief);
  });

  it('keeps prepared Templates when a context-bearing Set has no cards yet', () => {
    const source = documentWithContext();
    source.userTemplates = [{ id: 'prepared', name: 'Prepared', aspectRatio: '2:3', freeformCanvas: { width: 200, height: 300, elements: [] } }];
    source.cardSets[0].templateIds = ['prepared'];
    expect(isolateProjectDocumentToSet(source, 'set-a').userTemplates[0]?.id).toBe('prepared');
  });

  it('gives a legacy private Template a stable owner without renaming or clearing existing Set context', () => {
    const source = documentWithContext();
    source.cardSets = [];
    source.userTemplates = [{ id: 'prepared', name: 'Prepared', aspectRatio: '2:3', freeformCanvas: { width: 200, height: 300, elements: [] } }];
    source.productionPlan = normalizeProjectProductionPlan({ version: 1, decisionMode: 'confirmed', purpose: 'Readable cards', deliverable: 'Cards', outputSize: { width: 63, height: 88, unit: 'mm' }, visualDirection: { summary: 'Quiet', palette: [], typography: [] }, editableFieldKeys: [], assets: [] });
    const existing = { id: 'studio-document-private-id', name: 'Creator’s own title', plan: { ...plan, brief: source.productionPlan } };
    const prepared = prepareTemplateDocumentSet(source, 'private-id', 'Agent title', [existing]);
    expect(prepared.contextKept).toBe(true);
    expect(prepared.document.cardSets[0]).toMatchObject(existing);
    const workingId = prepared.document.cardSets[0]!.templateIds?.[0];
    expect(workingId).toBeTruthy();
    expect(workingId).not.toBe(source.userTemplates[0]!.id);
    expect(prepared.document.userTemplates).toHaveLength(2);
    expect(prepared.document.userTemplates.find((template) => template.id === source.userTemplates[0]!.id)).toEqual(source.userTemplates[0]);
    expect(prepared.document.userTemplates.find((template) => template.id === workingId)).toMatchObject({
      templateOriginLineageId: source.userTemplates[0]!.templateLineageId ?? source.userTemplates[0]!.id,
      templateOriginRevisionId: source.userTemplates[0]!.templateRevisionId,
      templatePipelineContext: undefined,
    });
    expect(prepared.document.version).toBe(3);
    expect(prepared.document.productionPlan).toEqual(source.productionPlan);
    expect(source.cardSets).toEqual([]);
  });
  it('refuses to replace an existing generated Set when its cards cannot be mapped to the fork', () => {
    const source = documentWithContext();
    source.cardSets = [];
    source.userTemplates = [{ id: 'prepared', name: 'Prepared', aspectRatio: '2:3', freeformCanvas: { width: 200, height: 300, elements: [] } }];
    source.productionPlan = normalizeProjectProductionPlan({ version: 1, decisionMode: 'confirmed', purpose: 'Readable cards', deliverable: 'Cards', outputSize: { width: 63, height: 88, unit: 'mm' }, visualDirection: { summary: 'Quiet', palette: [], typography: [] }, editableFieldKeys: [], assets: [] });
    const existing = { id: 'studio-document-private-id', name: 'Generated Set' };
    expect(() => prepareTemplateDocumentSet(
      source,
      'private-id',
      'Agent title',
      [existing],
      [{ uniqueId: 'existing-card', setId: existing.id, templateId: 'old-template', data: { title: 'Keep me' } }],
    )).toThrow(/independent copy/i);
  });
  it('keeps context with the Set during normalization', () => {
    expect(normalizeCardSet({ id: 'set-a', name: 'First Set', plan })?.plan).toEqual(plan);
  });

  it('uses a forward-incompatible runtime boundary for context-bearing documents', () => {
    const document = documentWithContext();
    expect(document.version).toBe(3);
    const parsed = parseProjectDocumentValue(JSON.parse(JSON.stringify(document)));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.document.cardSets[0].plan).toEqual(plan);
  });

  it('copies context independently without changing its source', () => {
    const source = documentWithContext();
    let ordinal = 0;
    const copied = instantiateProjectDocumentCopy(source, (kind) => `${kind}-${++ordinal}`);
    expect(copied.cardSets[0].id).not.toBe(source.cardSets[0].id);
    expect(copied.cardSets[0].plan).toEqual(plan);
    expect(copied.cardSets[0].plan).not.toBe(source.cardSets[0].plan);
  });

  it('refuses context smuggled through a legacy document boundary', () => {
    const document = { ...documentWithContext(), version: 1, cardSets: [{ id: 'set-a', name: 'First Set', plan }] };
    expect(parseProjectDocumentValue(document).success).toBe(false);
  });

  it('preserves unknown context metadata without interpreting it', () => {
    const extended = { ...plan, custom: { rules: ['Keep this information'] } };
    expect(normalizeCardSet({ id: 'set-a', name: 'First Set', plan: extended })?.plan).toEqual(extended);
  });

  it('refuses an unsupported context version instead of normalizing it away', () => {
    expect(() => normalizeCardSet({ id: 'set-a', name: 'First Set', plan: { ...plan, version: 99 } })).toThrow(/context|version/i);
  });
});
