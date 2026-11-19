import { createWorld, type Entity, type World } from 'koota'
import { Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { FrameDescriptor } from '$lib/motion/frameDescriptors'

import { traits } from '$lib/ecs'
import { modelKey } from '$lib/hooks/use3DModels.svelte'
import { Pose } from '$lib/math'

import { createPreviewGhosts, spawnSavedPoseGhosts } from '../previewGhosts'

const uuid = () => new Uint8Array(16) as Uint8Array<ArrayBuffer>

/** One revolute joint about +z, with a link 100 mm out along +x hanging off it. */
const arm: FrameDescriptor[] = [
	{
		kind: 'joint',
		motion: 'rotational',
		name: 'arm:shoulder',
		parent: 'world',
		axis: { X: 0, Y: 0, Z: 1 },
		componentName: 'arm',
		jointIndex: 0,
		uuid: uuid(),
	},
	{
		kind: 'static',
		name: 'arm:upper_arm_link',
		parent: 'arm:shoulder',
		localPose: new Pose(100, 0, 0),
		geometry: null,
		uuid: uuid(),
	},
]

const twinNamed = (world: World, name: string): Entity | undefined =>
	world.query(traits.Name).find((entity) => entity.get(traits.Name) === name)

describe('spawnSavedPoseGhosts', () => {
	let world: World

	beforeEach(() => {
		world = createWorld()
	})

	afterEach(() => world.destroy())

	it('turns the arm joints to the saved inputs', () => {
		spawnSavedPoseGhosts(world, arm, 'arm-pose-1', 'arm', [Math.PI / 2], createPreviewGhosts())

		const shoulder = twinNamed(world, 'saved-pose:arm-pose-1:arm:shoulder')
		const xAxis = new Vector3(1, 0, 0).applyMatrix4(shoulder!.get(traits.Matrix)!)
		expect(xAxis.x).toBeCloseTo(0, 6)
		expect(xAxis.y).toBeCloseTo(1, 6)
	})

	it('looks up the 3D model of the live link each twin copies', () => {
		spawnSavedPoseGhosts(world, arm, 'arm-pose-1', 'arm', [0], createPreviewGhosts())

		const link = twinNamed(world, 'saved-pose:arm-pose-1:arm:upper_arm_link')
		expect(modelKey(link!)).toBe('arm:upper_arm_link')
	})
})
