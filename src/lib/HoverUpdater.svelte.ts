import { Vector3 } from 'three'
import type { Entity } from 'koota'
import { traits } from './ecs/index.ts'
import type { IntersectionEvent } from '@threlte/extras'

export interface HoverInfo {
	index: number
	position: {
		x: number
		y: number
		z: number
	}
	orientation?: {
		x: number
		y: number
		z: number
	}
}

export const getClosestArrow = (positions: Float32Array, point: Vector3): HoverInfo => {
	let smallestDistance = Infinity
	let index = -1

	for (let i = 0; i < positions.length; i += 6) {
		const x = positions[i] / 1000
		const y = positions[i + 1] / 1000
		const z = positions[i + 2] / 1000

		const distance = point.distanceToSquared(new Vector3(x, y, z))

		if (distance < smallestDistance) {
			smallestDistance = distance
			index = i
		}
	}

	return {
		index: Math.floor(index / 6),
		position: {
			x: positions[index] / 1000,
			y: positions[index + 1] / 1000,
			z: positions[index + 2] / 1000,
		},
		orientation: {
			x: positions[index + 3],
			y: positions[index + 4],
			z: positions[index + 5],
		},
	}
}

export const getClosestPoint = (positions: Float32Array, point: Vector3): HoverInfo => {
	let smallestDistance = Infinity
	let index = -1

	for (let i = 0; i < positions.length; i += 3) {
		const x = positions[i]
		const y = positions[i + 1]
		const z = positions[i + 2]

		const distance = point.distanceToSquared(new Vector3(x, y, z))

		if (distance < smallestDistance) {
			smallestDistance = distance
			index = i
		}
	}

	return {
		index: Math.floor(index / 3),
		position: {
			x: positions[index],
			y: positions[index + 1],
			z: positions[index + 2],
		},
	}
}

export const getPointAtIndex = (positions: Float32Array, index: number): HoverInfo | null => {
	if (index < 0 || index >= positions.length / 3) {
		return null
	}
	return {
		index,
		position: {
			x: positions[index * 3],
			y: positions[index * 3 + 1],
			z: positions[index * 3 + 2],
		},
	}
}
export const getArrowAtIndex = (positions: Float32Array, index: number): HoverInfo | null => {
	if (index < 0 || index >= positions.length / 6) {
		return null
	}
	return {
		index,
		position: {
			x: positions[index * 6] / 1000,
			y: positions[index * 6 + 1] / 1000,
			z: positions[index * 6 + 2] / 1000,
		},
		orientation: {
			x: positions[index * 6 + 3],
			y: positions[index * 6 + 4],
			z: positions[index * 6 + 5],
		},
	}
}

export const updateHoverInfo = (
	entity: Entity,
	hoverEvent: IntersectionEvent<MouseEvent>
): HoverInfo | null => {
	const { index, point } = hoverEvent
	if (index === -1) {
		return null
	}

	const hoverPosition = new Vector3(point.x, point.y, point.z)

	let hoverInfo: HoverInfo | null = null

	if (entity.has(traits.Arrows)) {
		const closestArrow = getClosestArrow(
			entity.get(traits.Positions) as Float32Array,
			hoverPosition
		)
		if (closestArrow) {
			hoverInfo = closestArrow
		}
	} else if (entity.has(traits.Points)) {
		const positions = entity.get(traits.BufferGeometry)?.attributes.position.array as Float32Array
		const closestPoint = getClosestPoint(positions, hoverPosition)
		if (closestPoint) {
			hoverInfo = closestPoint
		}
	}

	return hoverInfo
}

export const getLinkedHoverInfo = (index: number, linkedEntity: Entity): HoverInfo | null => {
	if (linkedEntity.has(traits.Arrows)) {
		const closestArrow = getArrowAtIndex(linkedEntity.get(traits.Positions) as Float32Array, index)
		if (closestArrow) {
			return closestArrow
		}
	} else if (linkedEntity.has(traits.Points)) {
		const positions = linkedEntity.get(traits.BufferGeometry)?.attributes.position
			.array as Float32Array
		const closestPoint = getPointAtIndex(positions, index)
		if (closestPoint) {
			return closestPoint
		}
	}

	return null
}
