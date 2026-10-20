import { describe, expect, it } from 'vitest'

import type { Frame } from '$lib/frame'
import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'

import { frameVariableLock, isFrameVariableLocked } from '$lib/frameVariableLocks'

const frame = (y: number): Frame => ({
	parent: 'world',
	translation: { x: 0, y, z: 0 },
	orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
})

const info = (overrides: Partial<FragmentInfo> = {}): FragmentInfo => ({
	id: 'fragment-1',
	variables: {},
	frame: frame(1003),
	...overrides,
})

describe('frameVariableLock', () => {
	it('locks a frame field a variable supplies', () => {
		expect(
			frameVariableLock(info({ variablePaths: { 'frame.translation.y': 'arm-y' } }), frame(1003))
		).toEqual({ kind: 'fields', paths: ['translation.y'] })
	})

	it('unlocks a field once the part overrides the variable value', () => {
		expect(
			frameVariableLock(info({ variablePaths: { 'frame.translation.y': 'arm-y' } }), frame(12))
		).toEqual({ kind: 'none' })
	})

	it('ignores a variable that supplies an attribute rather than a frame field', () => {
		expect(
			frameVariableLock(
				info({ variables: { ip: '192.168.1.212' }, variablePaths: { 'attributes.host': 'ip' } }),
				frame(1003)
			)
		).toEqual({ kind: 'none' })
	})

	it('reports unknown, not none, when the source cannot say which paths are variable backed', () => {
		expect(frameVariableLock(info({ variables: { ip: '192.168.1.212' } }), frame(1003))).toEqual({
			kind: 'unknown',
		})
	})

	it('locks nothing when an empty map asserts no path is variable backed', () => {
		expect(
			frameVariableLock(
				info({ variables: { ip: '192.168.1.212' }, variablePaths: {} }),
				frame(1003)
			)
		).toEqual({ kind: 'none' })
	})

	it('locks nothing for a component no fragment provides', () => {
		expect(frameVariableLock(undefined, frame(1003))).toEqual({ kind: 'none' })
	})
})

describe('isFrameVariableLocked', () => {
	it('is false for a fragment component whose variables never touch its frame', () => {
		expect(
			isFrameVariableLocked(
				info({ variables: { ip: '192.168.1.212' }, variablePaths: { 'attributes.host': 'ip' } }),
				frame(1003)
			)
		).toBe(false)
	})

	it('is true while a variable still supplies a frame field', () => {
		expect(
			isFrameVariableLocked(
				info({ variablePaths: { 'frame.translation.y': 'arm-y' } }),
				frame(1003)
			)
		).toBe(true)
	})
})
