import type { CameraControlsRef } from '@threlte/extras/webgpu'

import { render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { Box3, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { relations, traits } from '#lib/ecs/index.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'
import { installWorldMatrixListeners } from '#lib/ecs/worldMatrix.js'
import { Pose } from '#lib/math/index.js'

import type { useCamera } from '../useCamera'

import CameraHost from './__fixtures__/CameraHost.svelte'

const framedBoxes: Box3[] = []

const fakeControls = {
	azimuthAngle: 0,
	polarAngle: 0,
	fitToBox: (box: Box3) => {
		framedBoxes.push(box.clone())
		return Promise.resolve([])
	},
	rotateAzimuthTo: () => Promise.resolve(),
	rotatePolarTo: () => Promise.resolve(),
} as unknown as CameraControlsRef

describe('useCamera fit', () => {
	let world: World
	let uninstall: () => void
	let camera: ReturnType<typeof useCamera>

	beforeEach(() => {
		framedBoxes.length = 0
		world = createWorld()
		uninstall = installWorldMatrixListeners(world)
		render(CameraHost, {
			props: { controls: fakeControls, oncamera: (given) => (camera = given) },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
	})

	afterEach(() => {
		uninstall()
		world.destroy()
	})

	it('frames a frame reparented just before the call where its new parent puts it', async () => {
		const base = world.spawn(traits.Matrix(new Pose(1000, 0, 0).toMatrix4()))
		const link = world.spawn(
			traits.Matrix(new Pose(0, 0, 0).toMatrix4()),
			traits.Box({ x: 100, y: 100, z: 100 })
		)
		await Promise.resolve()

		link.add(relations.ChildOf(base))
		await camera.fit([link])

		expect(
			framedBoxes[0]?.getCenter(new Vector3()).x,
			'the box should sit 1 m out, under its new parent, not at the origin it held before'
		).toBeCloseTo(1, 6)
	})
})
