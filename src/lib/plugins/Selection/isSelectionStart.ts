/**
 * Whether a pointerdown should begin drawing a selection shape.
 *
 * Only the primary button draws, so right-drag keeps panning the camera while
 * `selecting` is on. Touch contacts and pen tips report button 0, so they still draw.
 */
export const isSelectionStart = (event: PointerEvent, selecting: boolean): boolean =>
	event.button === 0 && (selecting || event.shiftKey)
