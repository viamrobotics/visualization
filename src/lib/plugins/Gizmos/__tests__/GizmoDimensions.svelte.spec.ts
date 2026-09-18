import { render } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

import GizmoDimensions from '../GizmoDimensions.svelte'

describe('GizmoDimensions', () => {
	const world = createWorld()

	it('writes an edited box dimension to the Box trait on the entity', async () => {
		const entity = world.spawn(traits.Box({ x: 200, y: 200, z: 200 }))
		const { container } = render(GizmoDimensions, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		const xInput = container
			.querySelector('[aria-label="mutable box dimensions"]')
			?.querySelector('input[type="text"]')

		expect(xInput).toBeTruthy()

		await userEvent.clear(xInput as HTMLInputElement)
		await userEvent.type(xInput as HTMLInputElement, '350')
		await userEvent.tab()

		expect(entity.get(traits.Box)).toEqual({ x: 350, y: 200, z: 200 })
	})

	it('writes an edited sphere radius to the Sphere trait on the entity', async () => {
		const entity = world.spawn(traits.Sphere({ r: 200 }))
		const { container } = render(GizmoDimensions, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})

		const rInput = container
			.querySelector('[aria-label="mutable sphere dimensions"]')
			?.querySelector('input[type="text"]')

		expect(rInput).toBeTruthy()

		await userEvent.clear(rInput as HTMLInputElement)
		await userEvent.type(rInput as HTMLInputElement, '75')
		await userEvent.tab()

		expect(entity.get(traits.Sphere)).toEqual({ r: 75 })
	})
})
