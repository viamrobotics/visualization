import type { IntersectionEvent } from '@threlte/extras'
import type { Entity } from 'koota'

import { Vector3 } from 'three'

import { traits } from '$lib/ecs'

export interface HoverInfo {
	index: number
	x: number
	y: number
	z: number
	oX: number
	oY: number
	oZ: number
	theta: number
}

const hoverPosition = new Vector3()

export const getPointAtIndex = (positions: Float32Array, index: number): HoverInfo | null => {
	if (index < 0 || index >= positions.length / 3) {
		return null
	}
	return {
		index,
		x: positions[index * 3],
		y: positions[index * 3 + 1],
		z: positions[index * 3 + 2],
		oX: 0,
		oY: 0,
		oZ: 0,
		theta: 0,
	}
}
export const getArrowAtIndex = (positions: Float32Array, index: number): HoverInfo | null => {
	if (index < 0 || index >= positions.length / 6) {
		return null
	}
	return {
		index,
		x: positions[index * 6] / 1000,
		y: positions[index * 6 + 1] / 1000,
		z: positions[index * 6 + 2] / 1000,
		oX: positions[index * 6 + 3],
		oY: positions[index * 6 + 4],
		oZ: positions[index * 6 + 5],
		theta: 0,
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

	hoverPosition.set(point.x, point.y, point.z)

	let hoverInfo: HoverInfo | null = null

	if (entity.has(traits.Arrows)) {
		let closestArrow: HoverInfo | null = null
		if (index && index > 0) {
			closestArrow = getArrowAtIndex(entity.get(traits.Positions) as Float32Array, index)
		}

		if (closestArrow) {
			hoverInfo = closestArrow
		}
	} else if (entity.has(traits.Points)) {
		const positions = entity.get(traits.BufferGeometry)?.attributes.position.array as Float32Array
		let closestPoint: HoverInfo | null = null
		if (index && index > 0) {
			closestPoint = getPointAtIndex(positions, index)
		}
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
