import { parseProjectDocumentValue, type ProjectDocumentV1 } from './projectDocument';
import { normalizeProjectProductionPlan, type ProjectProductionPlan } from './projectProductionPlan';

/** Document payload only. This is not yet a .cardforge package or a workspace restore API. */
export interface WorkspaceBackupDocumentV2 {
  version: 2;
  project: ProjectDocumentV1;
  documentPlanGroups: WorkspacePlanGroup[];
}

export interface WorkspacePlanGroup {
  setIds: string[];
  plan: ProjectProductionPlan;
}

export interface ParsedWorkspaceBackupDocument {
  document: ProjectDocumentV1;
  documentPlanGroups: WorkspacePlanGroup[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const inputSurvives = (input: unknown, output: unknown): boolean => {
  if (input === undefined) return true;
  if (Array.isArray(input)) return Array.isArray(output) && input.length === output.length && input.every((v, i) => inputSurvives(v, output[i]));
  if (isRecord(input)) return isRecord(output) && Object.entries(input).every(([key, v]) => inputSurvives(v, output[key]));
  return Object.is(input, output);
};

// Compare JSON values without depending on object property order. This detects
// future plan fields or invalid values that the legacy normalizer would strip.
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

export const parseWorkspaceBackupDocument = (value: unknown): ParsedWorkspaceBackupDocument => {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) {
    throw new Error('Unsupported workspace backup document version.');
  }
  if (value.version === 1) {
    const parsed = parseProjectDocumentValue(value);
    if (!parsed.success) throw new Error(parsed.error);
    return {
      document: parsed.document,
      documentPlanGroups: parsed.document.productionPlan
        ? [{ setIds: parsed.document.cardSets.map((set) => set.id), plan: parsed.document.productionPlan }]
        : [],
    };
  }
  if (Object.keys(value).some(key => !['version', 'project', 'documentPlanGroups'].includes(key))) throw new Error('Unsupported workspace backup field.');
  if (!isRecord(value.project) || value.project.productionPlan !== undefined || !Array.isArray(value.documentPlanGroups)) {
    throw new Error('Invalid workspace backup document.');
  }
  const parsed = parseProjectDocumentValue(value.project);
  if (!parsed.success) throw new Error(parsed.error);
  if (!inputSurvives(value.project, parsed.document)) throw new Error('Unsupported or invalid workspace project metadata.');
  const setIds = new Set(parsed.document.cardSets.map((set) => set.id));
  const assigned = new Set<string>();
  const groups = value.documentPlanGroups.map((group): WorkspacePlanGroup => {
    if (!isRecord(group) || Object.keys(group).some((key) => key !== 'setIds' && key !== 'plan') || !Array.isArray(group.setIds)
      || group.setIds.some((id: unknown) => typeof id !== 'string' || !setIds.has(id))
      || new Set(group.setIds).size !== group.setIds.length) {
      throw new Error('Invalid workspace plan group Set membership.');
    }
    // A Set has one document-plan owner; empty groups remain independent.
    if ((group.setIds as string[]).some(id => assigned.has(id))) throw new Error('Overlapping workspace plan group Set membership.');
    (group.setIds as string[]).forEach(id => assigned.add(id));
    const normalized = normalizeProjectProductionPlan(group.plan);
    if (!normalized || canonical(normalized) !== canonical(group.plan)) {
      throw new Error('Invalid or unsupported workspace production plan.');
    }
    return { setIds: [...group.setIds] as string[], plan: JSON.parse(JSON.stringify(group.plan)) as ProjectProductionPlan };
  });
  return { document: parsed.document, documentPlanGroups: groups };
};

export const createWorkspaceBackupDocument = (
  document: ProjectDocumentV1,
  documentPlanGroups: readonly WorkspacePlanGroup[],
): WorkspaceBackupDocumentV2 => {
  if (document.productionPlan) throw new Error('Workspace backup project must not contain a separate production plan.');
  const backup = { version: 2 as const, project: document, documentPlanGroups: [...documentPlanGroups] };
  parseWorkspaceBackupDocument(backup);
  return JSON.parse(JSON.stringify(backup)) as WorkspaceBackupDocumentV2;
};
