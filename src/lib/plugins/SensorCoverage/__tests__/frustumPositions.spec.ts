import { describe, expect, it } from 'vitest'

import { frustumPositions, type Intrinsics } from '../frustumPositions'

const squareFov90: Intrinsics = {
	widthPx: 100,
	heightPx: 100,
	focalXPx: 50,
	focalYPx: 50,
	centerXPx: 50,
	centerYPx: 50,
}

const unfilled: Intrinsics = {
	widthPx: 0,
	heightPx: 0,
	focalXPx: 0,
	focalYPx: 0,
	centerXPx: 0,
	centerYPx: 0,
}

interface Endpoint {
	x: number
	y: number
	z: number
}

const endpoints = (positions: Float32Array): Endpoint[] => {
	const result: Endpoint[] = []

	for (let i = 0; i < positions.length; i += 3) {
		result.push({ x: positions[i]!, y: positions[i + 1]!, z: positions[i + 2]! })
	}

	return result
}

/** Absorbs the drift of storing a double in a `Float32Array`. */
const round = (value: number): number => Math.round(value * 1e6) / 1e6

describe('frustumPositions', () => {
	it('emits twelve edges as twenty-four endpoints', () => {
		expect(frustumPositions(squareFov90, 0, 1)).toHaveLength(72)
	})

	it('puts the four far corners a metre off-axis at a 90 degree field of view', () => {
		const far = endpoints(frustumPositions(squareFov90, 0, 1)!).filter((point) => point.z === 1)

		const corners = new Set(far.map((point) => `${round(point.x)},${round(point.y)}`))

		expect([...corners].toSorted()).toEqual(['-1,-1', '-1,1', '1,-1', '1,1'])
	})

	it('scales linearly with the range', () => {
		const oneMetre = frustumPositions(squareFov90, 0, 1)!
		const fourMetres = frustumPositions(squareFov90, 0, 4)!

		expect([...fourMetres].map((value) => round(value))).toEqual(
			[...oneMetre].map((value) => round(value * 4))
		)
	})

	it('puts every endpoint on the near or far plane, down the +Z axis', () => {
		const depths = new Set(
			endpoints(frustumPositions(squareFov90, 0.5, 2)!).map((point) => round(point.z))
		)

		expect([...depths].toSorted((a, b) => a - b)).toEqual([0.5, 2])
	})

	it('collapses the near ring onto the camera origin when the near plane is zero', () => {
		const atOrigin = endpoints(frustumPositions(squareFov90, 0, 1)!).filter(
			(point) => point.x === 0 && point.y === 0 && point.z === 0
		)

		expect(atOrigin).toHaveLength(12)
	})

	it('reaches further along the axis the principal point sits away from', () => {
		const offCentre = frustumPositions({ ...squareFov90, centerXPx: 25 }, 0, 1)!

		const xs = endpoints(offCentre).map((point) => round(point.x))

		expect([Math.min(...xs), Math.max(...xs)]).toEqual([-0.5, 1.5])
	})

	it.each([
		{ label: 'intrinsics a camera never filled in', intrinsics: unfilled },
		{ label: 'a zero horizontal focal length', intrinsics: { ...squareFov90, focalXPx: 0 } },
		{ label: 'a zero vertical focal length', intrinsics: { ...squareFov90, focalYPx: 0 } },
		{ label: 'a non-finite focal length', intrinsics: { ...squareFov90, focalXPx: Infinity } },
		{
			label: 'a principal point past the right edge',
			intrinsics: { ...squareFov90, centerXPx: 100 },
		},
		{
			label: 'a principal point above the top edge',
			intrinsics: { ...squareFov90, centerYPx: -1 },
		},
	])('returns undefined for $label', ({ intrinsics }) => {
		expect(frustumPositions(intrinsics, 0, 1)).toBeUndefined()
	})

	it.each([
		{ label: 'an empty depth range', near: 1, far: 1 },
		{ label: 'an inverted depth range', near: 2, far: 1 },
		{ label: 'a near plane behind the camera', near: -1, far: 1 },
		{ label: 'an infinite far plane', near: 0, far: Infinity },
		{ label: 'a NaN far plane', near: 0, far: Number.NaN },
	])('returns undefined for $label', ({ near, far }) => {
		expect(frustumPositions(squareFov90, near, far)).toBeUndefined()
	})
})
