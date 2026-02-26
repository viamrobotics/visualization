import { Vector3 } from 'three'

export const pointInPolygon = (point: Vector3, polygon: number[]): boolean => {
	const px = point.x
	const pz = point.y

	let inside = false

	const count = polygon.length

	for (let i = 0, j = count - 1; i < count; j = i++) {
		const xi = polygon[i * 3 + 0]
		const yi = polygon[i * 3 + 1]

		const xj = polygon[j * 3 + 0]
		const yj = polygon[j * 3 + 1]

		// Check if edge crosses horizontal ray at pz
		const intersects = yi > pz !== yj > pz && px < ((xj - xi) * (pz - yi)) / (yj - yi) + xi

		if (intersects) {
			inside = !inside
		}
	}

	return inside
}
