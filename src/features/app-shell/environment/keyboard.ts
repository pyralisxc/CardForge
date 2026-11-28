/** Preserve native text editing and let an open dialog own its keys. */
export const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable="true"], .ProseMirror, [role="textbox"]'));
};

export const hasBlockingKeyboardLayer = (): boolean => (
  typeof document !== 'undefined' && Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'))
    .some((element) => element.getAttribute('data-state') !== 'closed' && !element.hasAttribute('data-desk-tool-surface') && element.getClientRects().length > 0)
);
