import {
  isActionAvailable,
  type ActionDescriptor,
  type FeatureOwnerId,
} from './model';

export interface ActionOperationInput {
  targetIds: string[];
  sourceIds?: string[];
  payload?: unknown;
}

export type ActionOperationResult =
  | { kind: 'navigation'; href: string }
  | { kind: 'preview'; previewId: string }
  | { kind: 'mutation'; changedIds: string[] }
  | { kind: 'provider-handoff'; href: string }
  | { kind: 'download'; fileName: string };

export interface ActionOperation {
  id: ActionDescriptor['id'];
  ownerFeature: FeatureOwnerId;
  result: ActionDescriptor['result'];
  execute: (input: ActionOperationInput) => Promise<ActionOperationResult>;
}

export interface ActionDefinition {
  descriptor: ActionDescriptor;
  operation: ActionOperation;
}

export interface ActionRuntime {
  get: (id: ActionDescriptor['id']) => ActionDefinition | null;
  execute: (id: ActionDescriptor['id'], input: ActionOperationInput) => Promise<ActionOperationResult>;
}

export const createActionDefinition = (
  descriptor: ActionDescriptor,
  execute: ActionOperation['execute'],
): ActionDefinition => ({
  descriptor,
  operation: {
    id: descriptor.id,
    ownerFeature: descriptor.ownerFeature,
    result: descriptor.result,
    execute,
  },
});

const assertDefinitionMatches = ({ descriptor, operation }: ActionDefinition) => {
  if (descriptor.id !== operation.id) {
    throw new Error(`Action operation ${operation.id} does not match descriptor ${descriptor.id}.`);
  }
  if (descriptor.ownerFeature !== operation.ownerFeature) {
    throw new Error(`Action ${descriptor.id} owner ${descriptor.ownerFeature} does not match operation owner ${operation.ownerFeature}.`);
  }
  if (descriptor.result !== operation.result) {
    throw new Error(`Action ${descriptor.id} result ${descriptor.result} does not match operation result ${operation.result}.`);
  }
};

export const createActionRuntime = (definitions: readonly ActionDefinition[]): ActionRuntime => {
  const byId = new Map<ActionDescriptor['id'], ActionDefinition>();
  for (const definition of definitions) {
    assertDefinitionMatches(definition);
    if (byId.has(definition.descriptor.id)) {
      throw new Error(`Action ${definition.descriptor.id} has more than one execution owner.`);
    }
    byId.set(definition.descriptor.id, definition);
  }

  return {
    get: (id) => byId.get(id) ?? null,
    execute: async (id, input) => {
      const definition = byId.get(id);
      if (!definition) throw new Error(`Action ${id} has no registered execution owner.`);
      if (!isActionAvailable(definition.descriptor)) {
        const reason = definition.descriptor.availability.kind === 'available'
          ? 'This action is unavailable.'
          : definition.descriptor.availability.reason;
        throw new Error(reason);
      }
      const result = await definition.operation.execute(input);
      if (result.kind !== definition.descriptor.result) {
        throw new Error(`Action ${id} returned ${result.kind}; ${definition.descriptor.result} was declared.`);
      }
      return result;
    },
  };
};
