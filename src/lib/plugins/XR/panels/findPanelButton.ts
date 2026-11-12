import type { PanelLayout } from './layoutPanel'

/** Texture coordinates of a pointer hit, with v running bottom to top. */
export interface PanelUv {
	x: number
	y: number
}

/**
 * Returns the index in `layout.boxes` of the enabled button under `uv`,
 * or -1 when the point is over no enabled button.
 */
export const findPanelButton = (layout: PanelLayout, uv: PanelUv) => {
	const x = uv.x * layout.width
	// Texture v grows upward. Layout y grows downward from the panel's top edge.
	const y = (1 - uv.y) * layout.height

	for (let index = layout.boxes.length - 1; index >= 0; index -= 1) {
		const box = layout.boxes[index]
		if (box.node.type !== 'button' || box.node.isDisabled) continue

		const isInside = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
		if (isInside) return index
	}

	return -1
}
