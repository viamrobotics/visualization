import { Transform } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { parentFrameOptions } from '../parentFrameOptions'

const frame = (name: string, parent = 'world') =>
	new Transform({
		referenceFrame: name,
		poseInObserverFrame: { referenceFrame: parent },
	})

const options = (input: Partial<Parameters<typeof parentFrameOptions>[0]>) =>
	parentFrameOptions({
		frames: [],
		fragmentComponents: [],
		unsetFrameNames: [],
		componentName: undefined,
		...input,
	})

describe('parentFrameOptions', () => {
	it('always offers world, even with no frames at all', () => {
		expect(options({})).toEqual(['world'])
	})

	it('offers every known frame, world first and the rest alphabetical', () => {
		expect(
			options({
				frames: [frame('little-arm'), frame('camera'), frame('base')],
				componentName: 'camera',
			})
		).toEqual(['world', 'base', 'little-arm'])
	})

	it('offers frames the part config never enumerates', () => {
		// A fragment-provided component and a remote part's component both reach
		// the app only through the frame system, never `partConfig.components`.
		expect(
			options({
				frames: [frame('little-arm'), frame('remote-1:gripper')],
				componentName: 'sensor',
			})
		).toEqual(['world', 'little-arm', 'remote-1:gripper'])
	})

	it('offers fragment components that have no frame in the merged set', () => {
		expect(
			options({
				fragmentComponents: [{ name: 'little-arm', parent: 'world' }],
				componentName: 'camera',
			})
		).toEqual(['world', 'little-arm'])
	})

	it('excludes frames deleted locally or unset by a fragment mod', () => {
		expect(
			options({
				frames: [frame('little-arm'), frame('camera')],
				fragmentComponents: [{ name: 'gripper', parent: 'world' }],
				unsetFrameNames: ['camera', 'gripper'],
				componentName: 'sensor',
			})
		).toEqual(['world', 'little-arm'])
	})

	it('excludes offline fragment components that are descendants', () => {
		// gripper is a fragment component with no `$set` mod, so it's absent from
		// frames while offline — but the fragment says it hangs off little-arm.
		expect(
			options({
				frames: [frame('little-arm')],
				fragmentComponents: [{ name: 'gripper', parent: 'little-arm' }],
				componentName: 'little-arm',
			})
		).toEqual(['world'])
	})

	it('excludes a fragment-only frame when it is the component being reparented', () => {
		expect(
			options({
				fragmentComponents: [{ name: 'gripper', parent: 'world' }],
				componentName: 'gripper',
			})
		).toEqual(['world'])
	})

	it('keeps a fragment component whose parent is unknown', () => {
		// Mapped from a `fragment_mods` path alone: no frame, so no edge to walk.
		// It stays selectable even though it really is a child of little-arm.
		expect(
			options({
				frames: [frame('little-arm')],
				fragmentComponents: [{ name: 'gripper', parent: undefined }],
				componentName: 'little-arm',
			})
		).toEqual(['world', 'gripper'])
	})

	it('prefers the resolved frame over the fragment base parent', () => {
		// The machine reports gripper under little-arm. The fragment's own frame still says
		// world, and the resolved parent wins, so gripper is a descendant.
		expect(
			options({
				frames: [frame('little-arm'), frame('gripper', 'little-arm')],
				fragmentComponents: [{ name: 'gripper', parent: 'world' }],
				componentName: 'little-arm',
			})
		).toEqual(['world'])
	})

	it('excludes the frame itself and its descendants', () => {
		// world → little-arm → gripper → camera, plus an unrelated base
		expect(
			options({
				frames: [
					frame('little-arm'),
					frame('gripper', 'little-arm'),
					frame('camera', 'gripper'),
					frame('base'),
				],
				componentName: 'little-arm',
			})
		).toEqual(['world', 'base'])
	})

	it('excludes descendants the part config does not enumerate', () => {
		expect(
			options({
				frames: [frame('little-arm'), frame('remote-1:gripper', 'little-arm')],
				componentName: 'little-arm',
			})
		).toEqual(['world'])
	})

	it('terminates on a cycle already present in the frame data', () => {
		expect(
			options({
				frames: [frame('a', 'b'), frame('b', 'a'), frame('base')],
				componentName: 'a',
			})
		).toEqual(['world', 'base'])
	})
})
