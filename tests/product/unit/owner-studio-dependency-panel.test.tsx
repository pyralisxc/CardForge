import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

const hooks = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.cells)) hooks.cells[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.cells[index], (next: unknown) => {
        hooks.cells[index] = typeof next === 'function' ? next(hooks.cells[index]) : next;
      }];
    },
    useRef: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.cells)) hooks.cells[index] = { current: initial };
      return hooks.cells[index];
    },
  };
});
vi.mock('@/components/ui/button', () => ({ Button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children as ReactNode}</button> }));

import { OwnerStudioDependencyPanel } from '@/features/owner/components/OwnerStudioDependencyPanel';

type Node = ReactElement<Record<string, unknown>>;
const documentId = '8856f600-6c95-4835-8733-3ecb0ceb951d';
function render() { hooks.cursor = 0; return OwnerStudioDependencyPanel(); }
function nodes(root: ReactNode): Node[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== 'object' || !('props' in root)) return [];
  const node = root as Node;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function textOf(root: ReactNode): string {
  if (Array.isArray(root)) return root.map(textOf).join('');
  if (typeof root === 'string' || typeof root === 'number') return String(root);
  if (root && typeof root === 'object' && 'props' in root) return textOf((root as Node).props.children as ReactNode);
  return '';
}
function field(tree: ReactElement, label: string) { return nodes(tree).find(n => n.type === 'input' && n.props['aria-label'] === label)!; }
function input(node: Node, value: string) { (node.props.onChange as (event: unknown) => void)({ target: { value } }); }
function submit(tree: ReactElement) {
  return nodes(tree).find(n => n.type === 'button' || typeof n.props.onClick === 'function')!;
}
function selectTarget() {
  let tree = render();
  input(field(tree, 'Studio document ID'), documentId);
  tree = render();
  input(field(tree, 'Expected Studio revision'), '7');
  return render();
}
beforeEach(() => { hooks.cells = []; hooks.cursor = 0; vi.unstubAllGlobals(); });

describe('Owner Studio dependency action UI', () => {
  it('freezes both target inputs and blocks duplicate submission until the original settles', async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    const initial = selectTarget();
    const original = (submit(initial).props.onClick as () => Promise<void>)();
    const pending = render();
    expect(field(pending, 'Studio document ID').props.disabled).toBe(true);
    expect(field(pending, 'Expected Studio revision').props.disabled).toBe(true);
    expect(submit(pending).props.disabled).toBe(true);
    // The same old click closure also cannot start a second request.
    await (submit(initial).props.onClick as () => Promise<void>)();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ documentId, expectedRevision: 7 });
    resolve(new Response(JSON.stringify({ documentId, revision: 7, contractVersion: 1, complete: true, opaqueReasons: [] })));
    await original;
    const done = render();
    expect(textOf(done)).toContain(`document ${documentId}, revision 7`);
    expect(field(done, 'Studio document ID').props.disabled).toBe(false);
    expect(field(done, 'Expected Studio revision').props.disabled).toBe(false);
  });

  it.each([
    { body: { documentId, revision: 8, contractVersion: 1, complete: true, opaqueReasons: [] } },
    { body: { documentId, revision: 7, contractVersion: 1, complete: 'yes', opaqueReasons: [] } },
    { body: { documentId, revision: 7, contractVersion: 1, complete: false, opaqueReasons: [42] } },
  ])('treats malformed or mismatched successful receipts as uncertain', async ({ body }) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetchMock);
    const tree = selectTarget();
    await (submit(tree).props.onClick as () => Promise<void>)();
    const done = render();
    expect(textOf(done)).toContain('outcome');
    expect(textOf(done)).not.toContain('Reconciliation acknowledged');
    expect(submit(done).props.disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('disables retry after a network or 503 outcome with unknown write state', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('lost response'); });
    vi.stubGlobal('fetch', fetchMock);
    await (submit(selectTarget()).props.onClick as () => Promise<void>)();
    const done = render();
    expect(textOf(done)).toContain('Outcome uncertain');
    expect(submit(done).props.disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('permits correction after a known 409 conflict without claiming success', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Studio revision changed' } }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await (submit(selectTarget()).props.onClick as () => Promise<void>)();
    let tree = render();
    expect(textOf(tree)).not.toContain('Reconciliation acknowledged');
    expect(submit(tree).props.disabled).toBe(false);
    input(field(tree, 'Expected Studio revision'), '8');
    tree = render();
    expect(field(tree, 'Expected Studio revision').props.value).toBe('8');
    expect(submit(tree).props.disabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
