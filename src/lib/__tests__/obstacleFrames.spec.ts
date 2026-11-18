import { describe, expect, it } from 'vitest'

import type { ObstacleGeometryConfig } from '../obstacleAttributes'

import { deriveObstacleFrames } from '../obstacleFrames'

const derive = (geometries: ObstacleGeometryConfig[]) => deriveObstacleFrames('wall', geometries)

describe('deriveObstacleFrames', () => {
	it('names a labelled box <component>:<label>, parented to the component at identity', () => {
		const [frame] = derive([{ type: 'box', x: 10, y: 20, z: 30, label: 'slab' }])

		expect(frame?.referenceFrame).toBe('wall:slab')
		expect(frame?.uuid).toEqual(new Uint8Array(0))
		expect(frame?.poseInObserverFrame?.referenceFrame).toBe('wall')
		expect(frame?.poseInObserverFrame?.pose).toMatchObject({ x: 0, y: 0, z: 0, oZ: 1, theta: 0 })
		expect(frame?.physicalObject?.geometryType).toEqual({
			case: 'box',
			value: { dimsMm: { x: 10, y: 20, z: 30 } },
		})
	})

	it('puts the translation offset in the geometry center', () => {
		const [frame] = derive([
			{ type: 'box', x: 1, y: 1, z: 1, label: 'a', translation: { x: 7, y: 8, z: 9 } },
		])

		expect(frame?.physicalObject?.center).toMatchObject({ x: 7, y: 8, z: 9 })
		expect(frame?.poseInObserverFrame?.pose).toMatchObject({ x: 0, y: 0, z: 0 })
	})

	it('names an unlabeled entry by its index', () => {
		const frames = derive([
			{ type: 'box', x: 1, y: 1, z: 1, label: 'a' },
			{ type: 'box', x: 1, y: 1, z: 1, label: 'b' },
			{ type: 'box', x: 1, y: 1, z: 1 },
		])

		expect(frames.map((frame) => frame.referenceFrame)).toEqual([
			'wall:a',
			'wall:b',
			'wall:geometry_2',
		])
	})

	it('honours a capitalised Label', () => {
		const entry = { type: 'box', x: 1, y: 1, z: 1, Label: 'Cap' } as ObstacleGeometryConfig

		expect(derive([entry])[0]?.referenceFrame).toBe('wall:Cap')
	})

	it('puts an ov_degrees orientation offset in the center', () => {
		const [frame] = derive([
			{
				type: 'sphere',
				r: 5,
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 45 } },
			},
		])

		expect(frame?.physicalObject?.center).toMatchObject({ oX: 0, oY: 0, oZ: 1, theta: 45 })
		expect(frame?.poseInObserverFrame?.pose).toMatchObject({ theta: 0 })
	})

	it('reads sphere and capsule dimensions', () => {
		const frames = derive([
			{ type: 'sphere', r: 5, label: 's' },
			{ type: 'capsule', r: 3, l: 12, label: 'c' },
		])

		expect(frames.map((frame) => frame.physicalObject?.geometryType)).toEqual([
			{ case: 'sphere', value: { radiusMm: 5 } },
			{ case: 'capsule', value: { radiusMm: 3, lengthMm: 12 } },
		])
	})

	it('keeps the first entry when two share a name', () => {
		const frames = derive([
			{ type: 'box', x: 1, y: 1, z: 1, label: 'a', translation: { x: 1, y: 0, z: 0 } },
			{ type: 'box', x: 1, y: 1, z: 1, label: 'a', translation: { x: 2, y: 0, z: 0 } },
		])

		expect(frames).toHaveLength(1)
		expect(frames[0]?.physicalObject?.center?.x).toBe(1)
	})

	it('still emits a frame, without a physicalObject, for a shape that cannot be drawn', () => {
		const entry = { type: 'none', label: 'ghost' } as unknown as ObstacleGeometryConfig
		const [frame] = derive([entry])

		expect(frame?.referenceFrame).toBe('wall:ghost')
		expect(frame?.physicalObject).toBeUndefined()
	})

	it('returns no frames for an empty list', () => {
		expect(derive([])).toEqual([])
	})
})
