import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { TooltipContent } from '@/components/ui/tooltip';
import { ElementAlignmentPanel } from '@/features/template-editor/components/ElementAlignmentPanel';

// This stateless panel composes native controls. Inspect its actual React tree,
// retaining real labels and callbacks without browser or geometry claims.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
it('describes the existing canvas inset without print-safe or edge-flush claims', () => {
  const tree = elements(ElementAlignmentPanel({ buttonClassName: 'existing', onAlign: vi.fn(), onArrange: vi.fn(), onFlip: vi.fn() }));
  const labels = tree.filter(node => node.type === Button).map(node => node.props['aria-label']);
  expect(labels.slice(0, 3)).toEqual(['Align to left canvas inset', 'Center horizontally within canvas', 'Align to right canvas inset']);
  const tips = tree.filter(node => node.type === TooltipContent).map(node => node.props.children);
  expect(tips.slice(0, 3)).toEqual(['Place the selected element 32px inside the left canvas edge.', 'Center horizontally within canvas', 'Place the selected element 32px inside the right canvas edge.']);
  expect(tips.join(' ')).not.toMatch(/bleed|trim|print.safe/i);
});
it('preserves the original left, center and right callbacks and leaves other actions alone', () => {
  const onAlign = vi.fn(), onArrange = vi.fn(), onFlip = vi.fn();
  const buttons = elements(ElementAlignmentPanel({ buttonClassName: 'existing', onAlign, onArrange, onFlip })).filter(node => node.type === Button);
  for (const button of buttons.slice(0, 3)) (button.props.onClick as () => void)();
  expect(onAlign.mock.calls).toEqual([['left'], ['center'], ['right']]);
  expect(onArrange).not.toHaveBeenCalled(); expect(onFlip).not.toHaveBeenCalled();
});
