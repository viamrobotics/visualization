import { describe, expect, it } from 'vitest'

import type { Frame } from '$lib/frame'
import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
import type { ComponentFramesConfig } from '$lib/resolveComponentFrames'

import { resolveComponentFrames } from '$lib/resolveComponentFrames'

const FRAGMENT_ID = 'fragment-1'

const frameAt = (x: number, y = 0, z = 0): Frame => ({
	parent: 'world',
	translation: { x, y, z },
	orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
})

const fragmentInfo = (overrides: Partial<FragmentInfo> = {}): Record<string, FragmentInfo> => ({
	'frag-arm': { id: FRAGMENT_ID, variables: {}, ...overrides },
})

const withMods = (...mods: Record<string, unknown>[]): ComponentFramesConfig => ({
	components: [],
	fragment_mods: [{ fragment_id: FRAGMENT_ID, mods }],
})

describe('resolveComponentFrames', () => {
	it('keeps a part component frame under the frames the config authors', () => {
		const { frames } = resolveComponentFrames(
			{ components: [{ name: 'arm', frame: frameAt(100) }] },
			{}
		)

		expect(frames.get('arm')?.translation.x).toBe(100)
	})

	it('reports a part component with no frame as unset', () => {
		const { unsetFrameNames } = resolveComponentFrames({ components: [{ name: 'arm' }] }, {})

		expect([...unsetFrameNames]).toEqual(['arm'])
	})

	it('falls back to the fragment base frame when no mod touches it', () => {
		const { fragmentFrames } = resolveComponentFrames(
			{ components: [] },
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(fragmentFrames.get('frag-arm')?.translation.x).toBe(30)
	})

	it('patches the fragment base frame from a mod on a path beneath the frame', () => {
		const { frames } = resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm.frame.translation.y': 1003 } }),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.translation).toEqual({ x: 30, y: 1003, z: 0 })
	})

	it('creates the missing intermediate objects a patch writes through', () => {
		const { frames } = resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm.frame.geometry.type': 'box' } }),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.geometry).toEqual({ type: 'box' })
	})

	it('deletes a single frame field for an unset of a path beneath the frame', () => {
		const { frames } = resolveComponentFrames(
			withMods({ $unset: { 'components.frag-arm.frame.orientation.value.z': '' } }),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.orientation.value).toEqual({ x: 0, y: 0, th: 0 })
	})

	it('applies patches in the order the mods are declared', () => {
		const { frames } = resolveComponentFrames(
			withMods(
				{ $set: { 'components.frag-arm.frame.translation.x': 1 } },
				{ $set: { 'components.frag-arm.frame.translation.x': 2 } }
			),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.translation.x).toBe(2)
	})

	it('leaves the fragment base frame untouched when a mod patches a copy of it', () => {
		const base = frameAt(30)

		resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm.frame.translation.x': 99 } }),
			fragmentInfo({ frame: base })
		)

		expect(base.translation.x).toBe(30)
	})

	it('leaves a fragment frame no mod touched as a fallback rather than an authored frame', () => {
		const { frames, fragmentFrames } = resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm.attributes.speed': 20 } }),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.has('frag-arm')).toBe(false)
		expect(fragmentFrames.get('frag-arm')?.translation.x).toBe(30)
	})

	it('treats a whole-frame set mod as a frame the config authors', () => {
		const { frames, fragmentFrames } = resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm.frame': frameAt(10) } }),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.translation.x).toBe(10)
		expect(fragmentFrames.has('frag-arm')).toBe(false)
	})

	it('uses the last whole-frame set mod', () => {
		const { frames } = resolveComponentFrames(
			withMods(
				{ $set: { 'components.frag-arm.frame': frameAt(10) } },
				{ $set: { 'components.frag-arm.frame': frameAt(20) } }
			),
			fragmentInfo()
		)

		expect(frames.get('frag-arm')?.translation.x).toBe(20)
	})

	it('drops a patch that a later whole-frame set mod replaces', () => {
		const { frames } = resolveComponentFrames(
			withMods(
				{ $set: { 'components.frag-arm.frame.translation.y': 1003 } },
				{ $set: { 'components.frag-arm.frame': frameAt(20) } }
			),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.translation).toEqual({ x: 20, y: 0, z: 0 })
	})

	it('reports a component whose whole frame an unset mod removes as unset', () => {
		const { unsetFrameNames, frames, fragmentFrames } = resolveComponentFrames(
			withMods(
				{ $set: { 'components.frag-arm.frame': frameAt(10) } },
				{ $unset: { 'components.frag-arm.frame': '' } }
			),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect([...unsetFrameNames]).toEqual(['frag-arm'])
		expect(frames.has('frag-arm')).toBe(false)
		expect(fragmentFrames.has('frag-arm')).toBe(false)
	})

	it('restores a frame a later set mod puts back after an unset', () => {
		const { frames, unsetFrameNames } = resolveComponentFrames(
			withMods(
				{ $unset: { 'components.frag-arm.frame': '' } },
				{ $set: { 'components.frag-arm.frame': frameAt(20) } }
			),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.translation.x).toBe(20)
		expect([...unsetFrameNames]).toEqual([])
	})

	it('reports a patch with no base frame to patch as unresolved rather than frameless', () => {
		const { unresolvedFrameNames, unsetFrameNames, fragmentFrames } = resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm.frame.translation.y': 1003 } }),
			fragmentInfo()
		)

		expect([...unresolvedFrameNames]).toEqual(['frag-arm'])
		expect([...unsetFrameNames]).toEqual([])
		expect(fragmentFrames.has('frag-arm')).toBe(false)
	})

	it('reports a fragment component with neither a frame nor a frame mod as frameless', () => {
		const { frames, fragmentFrames, unsetFrameNames, unresolvedFrameNames } =
			resolveComponentFrames(
				withMods({ $set: { 'components.frag-arm.attributes.speed': 20 } }),
				fragmentInfo()
			)

		expect(frames.has('frag-arm')).toBe(false)
		expect(fragmentFrames.has('frag-arm')).toBe(false)
		expect([...unsetFrameNames]).toEqual([])
		expect([...unresolvedFrameNames]).toEqual([])
	})

	it('applies every mods entry sharing a fragment id, not just the first', () => {
		const { frames } = resolveComponentFrames(
			{
				components: [],
				fragment_mods: [
					{
						fragment_id: FRAGMENT_ID,
						prefix: 'left',
						mods: [{ $set: { 'components.other-arm.frame.translation.x': 7 } }],
					},
					{
						fragment_id: FRAGMENT_ID,
						prefix: 'right',
						mods: [{ $set: { 'components.frag-arm.frame.translation.x': 99 } }],
					},
				],
			},
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(frames.get('frag-arm')?.translation.x).toBe(99)
	})

	it('ignores mods belonging to another fragment', () => {
		const { fragmentFrames } = resolveComponentFrames(
			{
				components: [],
				fragment_mods: [
					{
						fragment_id: 'fragment-2',
						mods: [{ $set: { 'components.frag-arm.frame.translation.x': 99 } }],
					},
				],
			},
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(fragmentFrames.get('frag-arm')?.translation.x).toBe(30)
	})

	it('ignores a mod on a component whose name the frame path only prefixes', () => {
		const { fragmentFrames } = resolveComponentFrames(
			withMods({ $set: { 'components.frag-arm-2.frame.translation.x': 99 } }),
			fragmentInfo({ frame: frameAt(30) })
		)

		expect(fragmentFrames.get('frag-arm')?.translation.x).toBe(30)
	})
})
