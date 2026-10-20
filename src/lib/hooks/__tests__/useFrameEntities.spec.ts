import { createWorld, type World } from 'koota'
import { Matrix4 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { FRAME_ENTITY_QUERY, frameEntitiesByName } from '$lib/hooks/useFrameEntities.svelte'

let world: World

beforeEach(() => {
	world = createWorld()
})

afterEach(() => {
	world.destroy()
})

const lookup = () => frameEntitiesByName([...world.query(...FRAME_ENTITY_QUERY)])

describe('frame entity lookup', () => {
	it('resolves a frame by its name', () => {
		const frame = world.spawn(traits.FramesAPI, traits.Name('wrist-cam'))

		expect(lookup().get('wrist-cam')).toBe(frame)
	})

	it('resolves the frame, not a drawn transform sharing its reference frame name', () => {
		const frame = world.spawn(traits.FramesAPI, traits.Name('wrist-cam'))
		world.spawn(traits.DrawAPI, traits.Name('wrist-cam'), traits.WorldMatrix(new Matrix4()))

		expect(lookup().get('wrist-cam')).toBe(frame)
	})

	it('resolves the frame, not a world-state transform sharing its name', () => {
		const frame = world.spawn(traits.FramesAPI, traits.Name('wrist-cam'))
		world.spawn(
			traits.WorldStateStoreAPI,
			traits.Name('wrist-cam'),
			traits.WorldMatrix(new Matrix4())
		)

		expect(lookup().get('wrist-cam')).toBe(frame)
	})

	it('finds nothing for a component whose only entity is its frameless placeholder', () => {
		world.spawn(traits.Name('depth-cam'), traits.FramelessComponent)

		expect(lookup().get('depth-cam')).toBeUndefined()
	})

	it('includes a frame that has no WorldMatrix yet', () => {
		const frame = world.spawn(traits.FramesAPI, traits.Name('wrist-cam'))

		expect(lookup().get('wrist-cam')).toBe(frame)
		expect(frame.has(traits.WorldMatrix)).toBe(false)
	})
})
