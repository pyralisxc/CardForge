export type PipelineActionSource = 'browser-local' | 'google-drive' | 'local-folder' | 'temporary' | 'provider-native';

export interface PipelineActionOperationInput {
  targetIds: string[];
  sourceIds?: string[];
  payload?: unknown;
}

export interface SendToPipelineActionInput {
  id: 'home.send-pipeline' | 'library.send-pipeline';
  objectKind: 'home-work' | 'set';
  sources: readonly PipelineActionSource[];
}

export const createSendToPipelineActionDescriptor = ({
  id,
  objectKind,
  sources,
}: SendToPipelineActionInput) => ({
  id,
  label: 'Send to Pipeline',
  ownerFeature: 'pipeline' as const,
  supportedObjectKinds: [objectKind],
  supportedSources: sources,
  revisionPolicy: 'none' as const,
  requiredPermission: 'contributor' as const,
  scope: 'object' as const,
  hierarchy: 'supporting' as const,
  availability: { kind: 'available' as const },
  commitment: 'publication' as const,
  automation: { kind: 'human-only' as const, owner: 'cardforge' as const },
  result: 'mutation' as const,
});

export const createSendToPipelineActionDefinition = ({
  execute,
  ...input
}: SendToPipelineActionInput & {
  execute: (input: PipelineActionOperationInput) => void | Promise<void>;
}) => {
  const descriptor = createSendToPipelineActionDescriptor(input);
  return {
    descriptor,
    operation: {
      id: descriptor.id,
      ownerFeature: descriptor.ownerFeature,
      result: descriptor.result,
      execute: async (operationInput: PipelineActionOperationInput) => {
        await execute(operationInput);
        return { kind: 'mutation' as const, changedIds: [...operationInput.targetIds] };
      },
    },
  };
};
