import { normalizeProjectProductionPlan, type ProjectProductionPlan } from './productionPlan';

export interface SetPlan {
  version: 1;
  context: string;
  brief?: ProjectProductionPlan;
  [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const authoredPlanInputSurvives = (input: unknown, output: unknown): boolean => {
  if (input === undefined) return true;
  if (Array.isArray(input)) return Array.isArray(output) && input.length === output.length
    && input.every((value, index) => authoredPlanInputSurvives(value, output[index]));
  if (isRecord(input)) return isRecord(output) && Object.entries(input)
    .every(([key, value]) => (value === undefined || Object.hasOwn(output, key))
      && authoredPlanInputSurvives(value, output[key]));
  return Object.is(input, output);
};

export const authoredPlanValuesEqual = (left: unknown, right: unknown): boolean => (
  authoredPlanInputSurvives(left, right) && authoredPlanInputSurvives(right, left)
);

export const normalizeSetPlan = (value: unknown): SetPlan => {
  if (!isRecord(value) || value.version !== 1 || typeof value.context !== 'string') {
    throw new Error('This Set context has an unsupported version or invalid content. Its source was left unchanged.');
  }
  const brief = normalizeProjectProductionPlan(value.brief);
  if (value.brief !== undefined && (!brief || !authoredPlanInputSurvives(value.brief, brief))) {
    throw new Error('This Set context contains an unsupported creation brief. Its source was left unchanged.');
  }
  return { ...value, version: 1, context: value.context, ...(brief ? { brief } : {}) };
};
