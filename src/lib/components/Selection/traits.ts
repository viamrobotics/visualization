import { relation, trait } from 'koota'

export const Lasso = trait(() => true)
export const Ellipse = trait(() => true)
export const SelectionEnclosedPoints = trait(() => true)

/**
 * Captured points are removable, so we want to also destroy
 * the source selection every time a user deletes one.
 */
export const PointsCapturedBy = relation({ autoDestroy: 'target' })

export interface AABB {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

export interface Point {
	x: number
	y: number
}

export const Box = trait({
	minX: 0,
	minY: 0,
	maxX: 0,
	maxY: 0,
} satisfies AABB)

export const StartPoint = trait({
	x: 0,
	y: 0,
} satisfies Point)

export const Indices = trait(() => new Uint16Array())
export const Boxes = trait(() => [] as AABB[])
