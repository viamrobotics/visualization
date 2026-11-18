/** Whether `target` is an element that accepts typed text. */
export const isEditableTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement &&
	(target.isContentEditable || target.closest('input, textarea, select') !== null)
