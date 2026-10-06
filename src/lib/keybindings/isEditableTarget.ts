/** Whether keys pressed with `target` focused are typing into a field, which no shortcut should take. */
export const isEditableTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement &&
	(target.isContentEditable || target.closest('input, textarea, select') !== null)
