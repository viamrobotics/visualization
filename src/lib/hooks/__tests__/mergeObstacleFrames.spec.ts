import { describe, expect, it } from 'vitest'

import type { Transform } from '$lib/geometry'

import { mergeObstacleFrames } from '../mergeObstacleFrames'

const frame = (referenceFrame: string): Transform => ({ referenceFrame }) as Transform

describe('mergeObstacleFrames', () => {
	it('replaces an obstacle machine links with its config frames', () => {
		const machine = frame('box:old')
		const config = frame('box:new')
		const merged = mergeObstacleFrames({ 'box:old': machine }, { box: [config] })

		expect(merged['box:new']).toBe(config)
		expect(merged['box:old']).toBeUndefined()
	})

	it('drops a machine frame the config no longer declares', () => {
		const merged = mergeObstacleFrames(
			{ 'box:a': frame('box:a'), 'box:b': frame('box:b') },
			{ box: [frame('box:a')] }
		)

		expect(Object.keys(merged)).toEqual(['box:a'])
	})

	it('removes every machine link for a component with an empty list', () => {
		const merged = mergeObstacleFrames(
			{ 'box:a': frame('box:a'), 'box:b': frame('box:b') },
			{ box: [] }
		)

		expect(merged).toEqual({})
	})

	it('leaves other components untouched', () => {
		const arm = frame('arm:link')
		const merged = mergeObstacleFrames({ 'arm:link': arm, 'box:a': frame('box:a') }, { box: [] })

		expect(merged).toEqual({ 'arm:link': arm })
	})

	it('does not mutate its inputs', () => {
		const kinematics = { 'box:a': frame('box:a') }
		const obstacles = { box: [frame('box:b')] }
		mergeObstacleFrames(kinematics, obstacles)

		expect(Object.keys(kinematics)).toEqual(['box:a'])
		expect(obstacles.box.map((entry) => entry.referenceFrame)).toEqual(['box:b'])
	})
})
