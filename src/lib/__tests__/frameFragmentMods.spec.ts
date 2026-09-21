import { describe, expect, it } from 'vitest'

import type { Frame } from '$lib/frame'

import { frameModOperations, replaceFrameMods } from '$lib/frameFragmentMods'

const frame = (overrides: Partial<Frame> = {}): Frame => ({
	parent: 'world',
	translation: { x: 0, y: 0, z: 0 },
	orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
	...overrides,
})

describe('frameModOperations', () => {
	it('writes only the changed leaf, leaving every other field to the fragment', () => {
		const operations = frameModOperations(
			'left-arm',
			frame(),
			frame({ translation: { x: 0, y: 1003, z: 0 } })
		)

		expect(operations).toEqual([{ $set: { 'components.left-arm.frame.translation.y': 1003 } }])
	})

	it('writes nothing when the edit lands back on the fragment value', () => {
		expect(frameModOperations('left-arm', frame(), frame())).toEqual([])
	})

	it('sets the whole frame when the fragment component has none to diff against', () => {
		const next = frame({ translation: { x: 1, y: 2, z: 3 } })

		expect(frameModOperations('left-arm', undefined, next)).toEqual([
			{ $set: { 'components.left-arm.frame': next } },
		])
	})

	it('unsets a field the edit removed', () => {
		const operations = frameModOperations(
			'left-arm',
			frame({ geometry: { type: 'box', x: 1, y: 1, z: 1 } }),
			frame()
		)

		expect(operations).toEqual([{ $unset: { 'components.left-arm.frame.geometry': '' } }])
	})

	it('adds a field the fragment frame never had', () => {
		const operations = frameModOperations(
			'left-arm',
			frame(),
			frame({ geometry: { type: 'sphere', r: 5 } })
		)

		expect(operations).toEqual([
			{ $set: { 'components.left-arm.frame.geometry': { type: 'sphere', r: 5 } } },
		])
	})

	it('treats a changed orientation type as one leaf each, not a whole-frame replacement', () => {
		const operations = frameModOperations(
			'left-arm',
			frame(),
			frame({ orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 90 } } })
		)

		expect(operations).toEqual([{ $set: { 'components.left-arm.frame.orientation.value.th': 90 } }])
	})
})

describe('replaceFrameMods', () => {
	it('drops a prior patch of the same frame before appending', () => {
		const mods = [{ $set: { 'components.left-arm.frame.translation.y': 1003 } }]

		expect(
			replaceFrameMods(mods, 'left-arm', [
				{ $set: { 'components.left-arm.frame.translation.y': 12 } },
			])
		).toEqual([{ $set: { 'components.left-arm.frame.translation.y': 12 } }])
	})

	it('keeps a non-frame argument sharing the operation with a frame one', () => {
		const mods = [
			{
				$set: {
					'components.left-arm.frame.translation.y': 1003,
					'components.left-arm.attributes.speed_degs_per_sec': 20,
				},
			},
		]

		expect(replaceFrameMods(mods, 'left-arm', [])).toEqual([
			{ $set: { 'components.left-arm.attributes.speed_degs_per_sec': 20 } },
		])
	})

	it('leaves another component frame alone', () => {
		const mods = [{ $set: { 'components.right-arm.frame.translation.y': 1003 } }]

		expect(replaceFrameMods(mods, 'left-arm', [])).toEqual(mods)
	})

	it('leaves a component whose name this one only prefixes alone', () => {
		const mods = [{ $set: { 'components.left-arm-2.frame.translation.y': 1003 } }]

		expect(replaceFrameMods(mods, 'left-arm', [])).toEqual(mods)
	})

	it('discards an operation left with no arguments', () => {
		const mods = [
			{ $set: { 'components.left-arm.frame.translation.y': 1003 } },
			{ $unset: { 'components.left-arm.frame.geometry': '' } },
		]

		expect(replaceFrameMods(mods, 'left-arm', [])).toEqual([])
	})
})
