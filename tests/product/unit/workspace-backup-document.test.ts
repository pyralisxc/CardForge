import { describe, expect, it } from 'vitest';
import { createProjectDocumentFromState, parseProjectDocumentValue } from '@/features/project/model/projectDocument';
import { createWorkspaceBackupDocument, parseWorkspaceBackupDocument } from '@/features/project/model/workspaceBackupDocument';

const plan = (purpose: string) => ({ version: 1 as const, decisionMode: 'confirmed' as const, purpose, deliverable: 'Cards', outputSize: { width: 1, height: 1, unit: 'px' as const }, visualDirection: { summary: 'Style', palette: [], typography: [] }, editableFieldKeys: [], assets: [] });
const document = () => createProjectDocumentFromState({ userTemplates: [], storedCards: [], appearanceStyles: [], cardSets: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] });

describe('version-safe workspace backup document', () => {
  it('round-trips multiple independent and zero-Set plan groups without assigning unplanned Sets', () => {
    const groups = [{ setIds: ['a', 'c'], plan: plan('first') }, { setIds: ['b'], plan: plan('second') }, { setIds: [], plan: plan('zero') }];
    const backup = createWorkspaceBackupDocument(document(), groups);
    const result = parseWorkspaceBackupDocument(JSON.parse(JSON.stringify(backup)));
    expect(result.documentPlanGroups).toEqual(groups);
    expect(result.document.cardSets.map(set => set.id)).toEqual(['a', 'b', 'c']);
    expect(parseProjectDocumentValue(backup).success).toBe(false);
  });

  it('reads an existing V1 document with its plan associated with its Sets', () => {
    const legacy = { ...document(), productionPlan: plan('legacy') };
    const result = parseWorkspaceBackupDocument(JSON.parse(JSON.stringify(legacy)));
    expect(result.documentPlanGroups).toEqual([{ setIds: ['a', 'b', 'c'], plan: expect.objectContaining(plan('legacy')) }]);
  });

  it('rejects unknown versions and invalid references without mutating the input', () => {
    const backup = createWorkspaceBackupDocument(document(), [{ setIds: ['a'], plan: plan('original') }]);
    const unknown = { ...backup, version: 99 };
    const before = JSON.stringify(unknown);
    expect(() => parseWorkspaceBackupDocument(unknown)).toThrow(/version/i);
    expect(JSON.stringify(unknown)).toBe(before);
    const bad = { ...backup, documentPlanGroups: [{ setIds: ['missing'], plan: plan('bad') }] };
    expect(() => parseWorkspaceBackupDocument(bad)).toThrow(/set/i);
    const futureGroup = { ...backup, documentPlanGroups: [{ setIds: ['a'], plan: { ...plan('original'), futureField: 'important' } }] };
    expect(() => parseWorkspaceBackupDocument(futureGroup)).toThrow(/plan/i);
    const futureMembership = { ...backup, documentPlanGroups: [{ ...backup.documentPlanGroups[0], futureField: 'important' }] };
    expect(() => parseWorkspaceBackupDocument(futureMembership)).toThrow(/group/i);
  });
  it('rejects unknown backup and project metadata and overlapping group ownership', () => {
    const backup = createWorkspaceBackupDocument(document(), [{ setIds: ['a'], plan: plan('one') }]);
    expect(() => parseWorkspaceBackupDocument({ ...backup, future: 'data' })).toThrow();
    expect(() => parseWorkspaceBackupDocument({ ...backup, project: { ...backup.project, future: 'data' } })).toThrow();
    expect(() => parseWorkspaceBackupDocument({ ...backup, documentPlanGroups: [...backup.documentPlanGroups, { setIds: ['a'], plan: plan('two') }] })).toThrow();
  });

});
