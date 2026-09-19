import type { FeatureOwnerId } from './model';

export type EnvironmentToolPresentation = 'inline' | 'floating' | 'inspector' | 'sheet' | 'provider-handoff';

export interface EnvironmentToolSession<ToolId extends string = string> {
  instanceId: string;
  toolId: ToolId;
  ownerFeature: FeatureOwnerId;
  presentation: EnvironmentToolPresentation;
  targetIds: string[];
  dirty: boolean;
}

export const openEnvironmentToolSession = <ToolId extends string>(
  stack: readonly EnvironmentToolSession<ToolId>[],
  tool: EnvironmentToolSession<ToolId>,
): EnvironmentToolSession<ToolId>[] => [
  ...stack.filter((candidate) => candidate.instanceId !== tool.instanceId),
  { ...tool, targetIds: [...tool.targetIds] },
];

export const setEnvironmentToolSessionDirty = <ToolId extends string>(
  stack: readonly EnvironmentToolSession<ToolId>[],
  instanceId: string,
  dirty: boolean,
): EnvironmentToolSession<ToolId>[] => stack.map((tool) => (
  tool.instanceId === instanceId ? { ...tool, dirty } : tool
));

export const closeEnvironmentToolSession = <ToolId extends string>(
  stack: readonly EnvironmentToolSession<ToolId>[],
): {
  stack: EnvironmentToolSession<ToolId>[];
  closed: EnvironmentToolSession<ToolId> | null;
} => ({
  stack: stack.slice(0, -1),
  closed: stack.at(-1) ?? null,
});
