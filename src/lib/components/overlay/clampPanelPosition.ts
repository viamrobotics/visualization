interface Point {
	x: number
	y: number
}

interface Size {
	width: number
	height: number
}

/**
 * Moves a floating panel's top-left corner so the panel stays inside the scene.
 * All three arguments share the scene's coordinate space, with the origin at its top-left.
 *
 * A panel larger than the scene pins to the origin, which keeps its drag header in reach.
 */
export const clampPanelPosition = (position: Point, panelSize: Size, sceneSize: Size): Point => ({
	x: Math.max(0, Math.min(position.x, sceneSize.width - panelSize.width)),
	y: Math.max(0, Math.min(position.y, sceneSize.height - panelSize.height)),
})
