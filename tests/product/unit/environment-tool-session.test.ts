import { describe, expect, it } from 'vitest';

import {
  closeEnvironmentToolSession,
  openEnvironmentToolSession,
  setEnvironmentToolSessionDirty,
  type EnvironmentToolSession,
} from '@/features/app-shell/client/environment';

type ToolId = 'design' | 'locations';

const tool = (
  instanceId: string,
  toolId: ToolId,
  targetIds: string[],
): EnvironmentToolSession<ToolId> => ({
  instanceId,
  toolId,
  ownerFeature: toolId === 'design' ? 'template-editor' : 'storage-management',
  presentation: toolId === 'design' ? 'floating' : 'sheet',
  targetIds,
  dirty: false,
});

describe('environment tool session lifecycle', () => {
  it('moves a reopened instance to the top without duplicating it', () => {
    let stack = openEnvironmentToolSession([], tool('design-one', 'design', ['template-1']));
    stack = openEnvironmentToolSession(stack, tool('locations', 'locations', []));
    stack = openEnvironmentToolSession(stack, tool('design-one', 'design', ['template-2']));

    expect(stack.map((session) => session.instanceId)).toEqual(['locations', 'design-one']);
    expect(stack.at(-1)?.targetIds).toEqual(['template-2']);
  });

  it('updates dirty state only on the named session', () => {
    let stack = [
      tool('locations', 'locations', []),
      tool('design-one', 'design', ['template-1']),
    ];

    stack = setEnvironmentToolSessionDirty(stack, 'design-one', true);

    expect(stack[0]?.dirty).toBe(false);
    expect(stack[1]?.dirty).toBe(true);
  });

  it('closes only the top session and reports what closed', () => {
    const locations = tool('locations', 'locations', []);
    const design = tool('design-one', 'design', ['template-1']);

    const result = closeEnvironmentToolSession([locations, design]);

    expect(result.closed).toEqual(design);
    expect(result.stack).toEqual([locations]);
    expect(closeEnvironmentToolSession([])).toEqual({ stack: [], closed: null });
  });

  it('copies target identity when opening so callers cannot mutate session scope afterward', () => {
    const targetIds = ['template-1'];
    const stack = openEnvironmentToolSession([], tool('design-one', 'design', targetIds));

    targetIds.push('template-2');

    expect(stack[0]?.targetIds).toEqual(['template-1']);
  });
});
